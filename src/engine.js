/** A small, isolated teaching shell. All files and network responses live in memory. */
const HOME = '/home/trainee';
const DEFAULT_SOCKETS = 'Netid State  Local Address:Port    Peer Address:Port\ntcp   LISTEN 0.0.0.0:22           0.0.0.0:*\ntcp   LISTEN 0.0.0.0:8088         0.0.0.0:*\nudp   UNCONN 127.0.0.1:53         0.0.0.0:*\n';
const DEFAULT_PROCESSES = 'USER PID %CPU %MEM COMMAND\nroot 1 0.0 0.2 /sbin/init\nroot 455 0.0 0.1 /usr/sbin/sshd\ntrainee 714 0.1 0.3 /bin/bash\nservice 809 0.2 1.1 /opt/relay/relay-agent --port 8088\n';
const HOSTS = { 'example.test': '192.0.2.10', 'academy.test': '192.0.2.20' };
const SUPPORTED = new Set('pwd whoami ls cd cat echo touch mkdir cp mv find grep head tail sort uniq wc awk tee chmod sha256sum base64 nslookup ping curl ss ps help history clear'.split(' '));
const queuedExecutions = new WeakMap();

function normalize(shell, path = '.') {
  let value = String(path);
  if (value === '~' || value.startsWith('~/')) value = HOME + value.slice(1);
  if (!value.startsWith('/')) value = `${shell.cwd}/${value}`;
  const parts = [];
  for (const part of value.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  const normalized = '/' + parts.join('/');
  if (normalized.length > 240 || normalized.includes('\\') || /[\u0000-\u001f\u007f]/.test(normalized)) fail('Paths must be at most 240 characters and contain no control characters or backslashes.');
  return normalized;
}
const parent = path => path.slice(0, path.lastIndexOf('/')) || '/';
const basename = path => path.split('/').at(-1) || '/';
const isDirectory = (shell, path) => shell.directories.includes(path);
const exists = (shell, path) => Object.hasOwn(shell.files, path) || isDirectory(shell, path);
const fail = message => { throw new Error(message); };
const lines = text => text === '' ? [] : text.replace(/\n$/, '').split('\n');
const joinLines = items => items.length ? items.join('\n') + '\n' : '';
const asList = value => value == null ? [] : Array.isArray(value) ? value : [value];

export function createShell(fixtures = {}) {
  const shell = { cwd: HOME, files: {}, directories: ['/', '/home', HOME], directoryModes: {}, history: [] };
  for (const [name, fixture] of Object.entries(fixtures)) {
    const path = normalize(shell, name);
    if (path === '/') fail('A fixture file cannot be the root directory.');
    const data = typeof fixture === 'string' ? { content: fixture } : fixture;
    if (!data || typeof data.content !== 'string' || data.content.length > 32768 || data.content.includes('\0')) fail(`Invalid text fixture: ${name}`);
    const mode = String(data.mode ?? '644');
    if (!/^[0-7]{3}$/.test(mode)) fail(`Invalid fixture permissions: ${name}`);
    shell.files[path] = { content: data.content, mode, mtime: Number.isFinite(data.mtime) && data.mtime >= 0 ? data.mtime : 0 };
    let directory = parent(path);
    while (!shell.directories.includes(directory)) {
      shell.directories.push(directory);
      directory = parent(directory);
    }
  }
  for (const directory of shell.directories) {
    if (Object.hasOwn(shell.files, directory)) fail(`A fixture is both a file and a directory: ${directory}`);
  }
  if (Object.keys(shell.files).length > 512 || shell.directories.length > 512) fail('Each lab supports at most 512 files and 512 directories.');
  shell.directories.sort();
  return shell;
}

/** Tokenization deliberately has no variable expansion, substitution, or host shell. */
function tokenize(raw) {
  const tokens = [];
  let word = '', active = false, quote = null;
  const flush = () => {
    if (active) tokens.push({ type: 'word', value: word });
    word = ''; active = false;
  };
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (quote) {
      if (char === quote) { quote = null; continue; }
      if (quote === '"' && char === '\\') {
        const next = raw[i + 1];
        if (next === undefined) fail('Unfinished escape.');
        if ('"\\$'.includes(next)) { word += next; i++; }
        else word += char;
      } else if (quote === '"' && (char === '`' || (char === '$' && raw[i + 1] === '('))) {
        fail('Command substitution is not supported.');
      } else word += char;
      continue;
    }
    if (char === "'" || char === '"') { active = true; quote = char; continue; }
    if (char === '\\') {
      if (i + 1 >= raw.length) fail('Unfinished escape.');
      word += raw[++i]; active = true; continue;
    }
    if (char === '\n' || char === '\r' || ';<&`()'.includes(char)) fail(`Unsupported shell syntax: ${char === '\n' ? 'newline' : char}`);
    if (/\s/.test(char)) { flush(); continue; }
    if (char === '|' || char === '>') {
      flush();
      let operator = char;
      if (char === '>' && raw[i + 1] === '>') { operator = '>>'; i++; }
      tokens.push({ type: 'operator', value: operator });
      continue;
    }
    word += char; active = true;
  }
  if (quote) fail('Unclosed quote.');
  flush();
  return tokens;
}

function parse(raw) {
  const tokens = tokenize(raw);
  const stages = [];
  let stage = { words: [], redirect: null };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'word') { stage.words.push(token.value); continue; }
    if (token.value === '|') {
      if (!stage.words.length) fail('A pipe needs a command on both sides.');
      stages.push(stage); stage = { words: [], redirect: null }; continue;
    }
    if (stage.redirect) fail('Use one output redirection per command.');
    const target = tokens[++i];
    if (!target || target.type !== 'word' || !target.value) fail('Output redirection needs a file path.');
    stage.redirect = { path: target.value, append: token.value === '>>' };
  }
  if (tokens.length && !stage.words.length) fail('A command is missing.');
  if (stage.words.length) stages.push(stage);
  for (const item of stages) {
    if (!SUPPORTED.has(item.words[0])) fail(`Command not available: ${item.words[0]}. Type help.`);
  }
  return stages;
}

function readFile(shell, rawPath, events) {
  const path = normalize(shell, rawPath);
  if (isDirectory(shell, path)) fail(`Is a directory: ${path}`);
  if (!Object.hasOwn(shell.files, path)) fail(`No such file: ${path}`);
  const content = shell.files[path].content;
  events.push({ type: 'read', path, content });
  return content;
}

function writeFile(shell, rawPath, content, events, append = false, mode) {
  const path = normalize(shell, rawPath);
  if (isDirectory(shell, path)) fail(`Is a directory: ${path}`);
  if (!isDirectory(shell, parent(path))) fail(`No such directory: ${parent(path)}`);
  const previous = shell.files[path];
  const nextContent = append ? (previous?.content ?? '') + content : content;
  if (nextContent.length > 32768 || nextContent.includes('\0')) fail('Files are limited to 32,768 text characters without null bytes in this lab.');
  shell.files[path] = {
    content: nextContent,
    mode: previous?.mode ?? mode ?? '644',
    mtime: 0,
  };
  events.push({ type: 'write', path, content: shell.files[path].content, append });
  return path;
}

function noArgs(name, args) {
  if (args.length) fail(`${name}: unexpected argument: ${args[0]}`);
}
function operands(name, args, count) {
  if (args.length !== count) fail(`${name}: expected ${count} ${count === 1 ? 'operand' : 'operands'}.`);
  for (const arg of args) if (arg.startsWith('-')) fail(`${name}: unsupported option: ${arg}`);
}
function options(name, args, allowed) {
  const flags = new Set(), values = [];
  let ended = false;
  for (const arg of args) {
    if (!ended && arg === '--') { ended = true; continue; }
    if (!ended && arg.startsWith('-') && arg !== '-') {
      const parts = arg.slice(1).split('');
      if (!parts.length || parts.some(flag => !allowed.includes(flag))) fail(`${name}: unsupported option: ${arg}`);
      parts.forEach(flag => flags.add(flag));
    } else values.push(arg);
  }
  return { flags, values };
}
function inputData(shell, args, input, events, name) {
  if (args.length > 1) fail(`${name}: this lesson shell accepts one input file.`);
  return args.length && args[0] !== '-' ? readFile(shell, args[0], events) : input;
}
function lineArguments(name, args) {
  let count = 10, files = [], seenCount = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '-n' || /^-\d+$/.test(arg)) {
      if (seenCount) fail(`${name}: specify one line count.`);
      const value = arg === '-n' ? args[++index] : arg.slice(1);
      if (!/^\d+$/.test(value ?? '')) fail(`${name}: line count must be a nonnegative whole number.`);
      count = Number(value); seenCount = true;
    } else if (arg.startsWith('-') && arg !== '-') fail(`${name}: unsupported option: ${arg}`);
    else files.push(arg);
  }
  return { count, files };
}

/** Semantic facts describe this teaching subset, rather than a particular spelling. */
function commandDetails(name, args, cwd) {
  const facts = new Set();
  let stdin = false;
  const addFlags = flags => flags.forEach(flag => facts.add(`flag:${flag}`));
  const addPaths = (values, defaultPath) => {
    if (!values.length && defaultPath !== undefined) values = [defaultPath];
    stdin = !values.length || values.includes('-');
    values.filter(value => value !== '-').forEach(value => facts.add(`path:${normalize({ cwd }, value)}`));
  };
  const fileOptions = { ls: 'al', cat: '', grep: 'in', sort: '', uniq: 'c', wc: 'l', tee: 'a', base64: 'd', sha256sum: '' };
  if (Object.hasOwn(fileOptions, name)) {
    const { flags, values } = options(name, args, fileOptions[name]);
    addFlags(flags);
    if (name === 'grep') {
      facts.add(`pattern:${values[0]}`);
      addPaths(values.slice(1));
    } else addPaths(values, name === 'ls' ? '.' : undefined);
    if (name === 'ls') stdin = false;
    // tee writes its operands and always consumes the preceding stage's output.
    if (name === 'tee') stdin = true;
  } else if (name === 'head' || name === 'tail') {
    const { count, files } = lineArguments(name, args);
    facts.add(`count:${count}`); addPaths(files);
  } else if (name === 'find') {
    let index = 0;
    const start = args[0] && !args[0].startsWith('-') ? args[index++] : '.';
    addPaths([start]);
    for (; index < args.length; index += 2) facts.add(`find:${args[index]}:${args[index + 1]}`);
    stdin = false;
  } else if (name === 'ss') {
    addFlags(new Set(args.flatMap(arg => arg.startsWith('-') ? [...arg.slice(1)] : [])));
  } else if (name === 'curl') {
    facts.add(`flag:${args[0]}`); facts.add(`url:${new URL(args[1]).href}`);
  } else if (name === 'ping') {
    let count = 4;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '-c') count = Number(args[++index]);
      else facts.add(`arg:${args[index]}`);
    }
    facts.add(`count:${count}`);
  } else {
    args.forEach(arg => facts.add(`arg:${arg}`));
    stdin = name === 'awk';
  }
  return { facts, stdin };
}
function symbolicMode(mode, directory = false) {
  const bits = Number.parseInt(mode, 8);
  return (directory ? 'd' : '-') + [6, 3, 0].map(shift => {
    const part = (bits >> shift) & 7;
    return `${part & 4 ? 'r' : '-'}${part & 2 ? 'w' : '-'}${part & 1 ? 'x' : '-'}`;
  }).join('');
}
function listing(shell, path, name = basename(path)) {
  const directory = isDirectory(shell, path), file = shell.files[path];
  const mode = directory ? shell.directoryModes?.[path] ?? '755' : file.mode;
  const size = directory ? 4096 : new TextEncoder().encode(file.content).length;
  return `${symbolicMode(mode, directory)}  trainee trainee ${String(size).padStart(5)} Oct 10 ${name}`;
}
function glob(pattern) {
  const wanted = [...pattern];
  let steps = 0;
  // A greedy wildcard matcher revisits only the most recent star; no regex backtracking.
  return { test(value) {
    const actual = [...value];
    let word = 0, token = 0, star = -1, retry = 0;
    while (word < actual.length) {
      if (++steps > 2000000) fail('find: this filename pattern is too complex for the training terminal. Use a shorter pattern.');
      if (wanted[token] === '?' || wanted[token] === actual[word]) { word++; token++; }
      else if (wanted[token] === '*') { star = token++; retry = word; }
      else if (star >= 0) { token = star + 1; word = ++retry; }
      else return false;
    }
    while (wanted[token] === '*') token++;
    return token === wanted.length;
  } };
}

function grepMatcher(pattern, ignoreCase) {
  const chars = [...pattern], atoms = [];
  let anchorStart = false, anchorEnd = false, steps = 0;
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];
    if (char === '^' && index === 0) { anchorStart = true; continue; }
    if (char === '$' && index === chars.length - 1) { anchorEnd = true; continue; }
    if (char === '*') {
      if (!atoms.length || atoms.at(-1).repeat) fail('grep: invalid * repetition.');
      atoms.at(-1).repeat = true; continue;
    }
    let test;
    if (char === '.') test = () => true;
    else if (char === '[') {
      let end = index + 1;
      for (; end < chars.length; end++) {
        if (chars[end] === '\\') { end++; continue; }
        if (chars[end] === ']') break;
      }
      if (end === chars.length || end > chars.length) fail('grep: unclosed character class.');
      const expression = chars.slice(index, end + 1).join('');
      if (expression.includes('[:')) fail('grep: named character classes are not supported; use a range such as [0-9].');
      let matcher;
      try { matcher = new RegExp(`^(?:${expression})$`, ignoreCase ? 'iu' : 'u'); }
      catch { fail('grep: invalid character class.'); }
      test = value => matcher.test(value); index = end;
    } else {
      let literal = char;
      if (char === '\\') {
        literal = chars[++index];
        if (literal === undefined) fail('grep: unfinished pattern escape.');
        if ('123456789()+?|{}'.includes(literal)) fail('grep: groups, backreferences, and extended repetitions are not supported.');
      }
      const expected = ignoreCase ? literal.toLowerCase() : literal;
      test = value => (ignoreCase ? value.toLowerCase() : value) === expected;
    }
    atoms.push({ test, repeat: false });
  }
  const budget = () => { if (++steps > 2000000) fail('grep: this search is too complex for the training terminal. Use a shorter pattern.'); };
  const close = states => {
    for (const state of states) {
      budget();
      if (atoms[state]?.repeat) states.add(state + 1);
    }
    return states;
  };
  // Merge every possible match into finite states. Runtime is bounded, even for repeated wildcards.
  return { test(value) {
    let active = close(new Set([0]));
    if (active.has(atoms.length) && (!anchorEnd || !value.length)) return true;
    const input = [...value];
    for (let index = 0; index < input.length; index++) {
      const next = new Set();
      for (const state of active) {
        budget();
        const atom = atoms[state];
        if (atom?.test(input[index])) next.add(atom.repeat ? state : state + 1);
      }
      if (!anchorStart) next.add(0);
      active = close(next);
      if (active.has(atoms.length) && (!anchorEnd || index === input.length - 1)) return true;
    }
    return active.has(atoms.length);
  } };
}
function labHost(name) {
  const host = name.toLowerCase().replace(/\.$/, '');
  if (!Object.hasOwn(HOSTS, host)) fail('This lab simulates example.test and academy.test only. No network request was sent.');
  return host;
}
function encodeBase64(content) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new TextEncoder().encode(content);
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    output += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    output += b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)];
    output += c === undefined ? '=' : alphabet[c & 63];
  }
  return output;
}
function decodeBase64(content) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const value = content.replace(/\s/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail('base64: invalid input.');
  const bytes = [];
  for (let i = 0; i < value.length; i += 4) {
    const a = alphabet.indexOf(value[i]), b = alphabet.indexOf(value[i + 1]);
    const c = alphabet.indexOf(value[i + 2]), d = alphabet.indexOf(value[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (value[i + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2));
    if (value[i + 3] !== '=') bytes.push(((c & 3) << 6) | d);
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); }
  catch { fail('base64: this text lab cannot display non-UTF-8 binary data.'); }
}
async function sha256(content) {
  const bytes = new TextEncoder().encode(content);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  if (globalThis.process?.versions?.node) {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(bytes).digest('hex');
  }
  fail('SHA-256 needs a secure browser context. Open this game on localhost or HTTPS.');
}

async function run(shell, name, args, input, events) {
  switch (name) {
    case 'pwd': noArgs(name, args); return shell.cwd + '\n';
    case 'whoami': noArgs(name, args); return 'trainee\n';
    case 'help':
      noArgs(name, args);
      return 'Training shell — isolated files and fictional network responses.\n' + [...SUPPORTED].join(', ') + '\nUse | to pass output, > to save, and >> to append. Quote spaces with " or \'.\nSupported examples: ls -la; find /tmp -type f -name "*.txt" -mmin -30; grep -in "failed" log.txt; head -n 5 log.txt; awk \'{print $NF}\'; chmod 600 notes.txt.\nNetwork commands use example.test and academy.test only. No real commands, scripts, or network requests run.\n';
    case 'history': noArgs(name, args); return joinLines(shell.history.map((raw, i) => `${String(i + 1).padStart(3)}  ${raw}`));
    case 'clear': noArgs(name, args); events.push({ type: 'clear' }); return '';
    case 'echo': {
      let values = args, newline = '\n';
      if (values[0] === '-n') { newline = ''; values = values.slice(1); }
      if (['-e', '-E'].includes(values[0])) fail(`echo: unsupported option: ${values[0]}`);
      return values.join(' ') + newline;
    }
    case 'cd': {
      if (args.length > 1) fail('cd: too many arguments.');
      const path = normalize(shell, args[0] ?? '~');
      if (!isDirectory(shell, path)) fail(`Not a directory: ${path}`);
      shell.cwd = path; events.push({ type: 'directory-change', path }); return '';
    }
    case 'ls': {
      const { flags, values } = options(name, args, 'al');
      if (values.length > 1) fail('ls: this lesson shell accepts one path.');
      const path = normalize(shell, values[0] ?? '.');
      if (!exists(shell, path)) fail(`No such file or directory: ${path}`);
      if (!isDirectory(shell, path)) return (flags.has('l') ? listing(shell, path) : basename(path)) + '\n';
      const children = [...shell.directories, ...Object.keys(shell.files)].filter(child => child !== path && parent(child) === path && (flags.has('a') || !basename(child).startsWith('.'))).sort();
      const entries = children.map(child => ({ path: child, name: basename(child) }));
      if (flags.has('a')) entries.unshift({ path, name: '.' }, { path: parent(path), name: '..' });
      return joinLines(entries.map(entry => flags.has('l') ? listing(shell, entry.path, entry.name) : entry.name));
    }
    case 'cat': {
      const { values } = options(name, args, '');
      if (!values.length) return input;
      return values.map(path => path === '-' ? input : readFile(shell, path, events)).join('');
    }
    case 'touch': {
      const { values } = options(name, args, '');
      if (!values.length) fail('touch: missing file operand.');
      for (const value of values) {
        const path = normalize(shell, value);
        if (isDirectory(shell, path)) continue;
        writeFile(shell, path, shell.files[path]?.content ?? '', events);
      }
      return '';
    }
    case 'mkdir': {
      const { flags, values } = options(name, args, 'p');
      if (!values.length) fail('mkdir: missing directory operand.');
      for (const value of values) {
        const path = normalize(shell, value);
        if (exists(shell, path)) {
          if (flags.has('p') && isDirectory(shell, path)) continue;
          fail(`File exists: ${path}`);
        }
        const missing = [path];
        let ancestor = parent(path);
        while (!isDirectory(shell, ancestor)) {
          if (Object.hasOwn(shell.files, ancestor)) fail(`Not a directory: ${ancestor}`);
          if (!flags.has('p')) fail(`No such directory: ${ancestor}`);
          missing.unshift(ancestor); ancestor = parent(ancestor);
        }
        for (const directory of missing) {
          shell.directories.push(directory); events.push({ type: 'directory', path: directory });
        }
      }
      return '';
    }
    case 'cp': case 'mv': {
      operands(name, args, 2);
      const source = normalize(shell, args[0]);
      let destination = normalize(shell, args[1]);
      if (source === '/') fail(`${name}: the simulated root directory cannot be moved or copied.`);
      if (!exists(shell, source)) fail(`No such file or directory: ${source}`);
      if (isDirectory(shell, destination)) destination = normalize(shell, `${destination}/${basename(source)}`);
      if (source === destination) fail(`${name}: source and destination are the same.`);
      if (!isDirectory(shell, parent(destination))) fail(`No such directory: ${parent(destination)}`);
      if (isDirectory(shell, source)) {
        if (name === 'cp') fail('cp: directory copies require unsupported recursive mode.');
        if (destination.startsWith(source + '/')) fail('mv: cannot move a directory inside itself.');
        if (exists(shell, destination)) fail(`mv: destination already exists: ${destination}`);
        const oldDirectories = shell.directories.filter(path => path === source || path.startsWith(source + '/'));
        for (const oldPath of oldDirectories) {
          const newPath = destination + oldPath.slice(source.length);
          shell.directories[shell.directories.indexOf(oldPath)] = newPath;
          if (shell.directoryModes?.[oldPath]) {
            shell.directoryModes[newPath] = shell.directoryModes[oldPath]; delete shell.directoryModes[oldPath];
          }
          events.push({ type: 'directory', path: newPath });
        }
        for (const oldPath of Object.keys(shell.files).filter(path => path.startsWith(source + '/'))) {
          const newPath = destination + oldPath.slice(source.length);
          shell.files[newPath] = shell.files[oldPath]; delete shell.files[oldPath];
          events.push({ type: 'write', path: newPath, content: shell.files[newPath].content, append: false });
        }
        if (shell.cwd === source || shell.cwd.startsWith(source + '/')) shell.cwd = destination + shell.cwd.slice(source.length);
      } else {
        if (isDirectory(shell, destination)) fail(`Is a directory: ${destination}`);
        const content = readFile(shell, source, events);
        if (name === 'mv') {
          shell.files[destination] = { ...shell.files[source] }; delete shell.files[source];
          events.push({ type: 'write', path: destination, content, append: false });
        } else writeFile(shell, destination, content, events, false, shell.files[source].mode);
      }
      events.push({ type: name === 'mv' ? 'move' : 'copy', source, destination });
      return '';
    }
    case 'find': {
      let index = 0, start = '.';
      if (args[0] && !args[0].startsWith('-')) start = args[index++];
      const origin = normalize(shell, start), filters = [];
      if (!exists(shell, origin)) fail(`No such file or directory: ${origin}`);
      while (index < args.length) {
        const flag = args[index++], value = args[index++];
        if (value === undefined) fail(`find: missing value for ${flag}.`);
        if (flag === '-type') {
          if (!['f', 'd'].includes(value)) fail('find: -type supports f or d.');
          filters.push(path => value === 'd' ? isDirectory(shell, path) : Object.hasOwn(shell.files, path));
        } else if (flag === '-name') {
          const matcher = glob(value); filters.push(path => matcher.test(basename(path)));
        } else if (flag === '-mmin') {
          if (!/^[+-]?\d+$/.test(value)) fail('find: -mmin needs a whole number, optionally prefixed with + or -.');
          const minutes = Number(value.replace(/^[+-]/, ''));
          filters.push(path => {
            if (!shell.files[path]) return false;
            const age = shell.files[path].mtime ?? 0;
            return value.startsWith('-') ? age < minutes : value.startsWith('+') ? age >= minutes + 1 : Math.floor(age) === minutes;
          });
        } else fail(`find: unsupported option: ${flag}`);
      }
      const prefix = origin === '/' ? '/' : origin + '/';
      return joinLines([...shell.directories, ...Object.keys(shell.files)].filter(path => (path === origin || path.startsWith(prefix)) && filters.every(filter => filter(path))).sort());
    }
    case 'grep': {
      const { flags, values } = options(name, args, 'in');
      if (!values.length) fail('grep: missing search pattern.');
      const [pattern, ...paths] = values;
      if (pattern.length > 512) fail('grep: this lab limits search patterns to 512 characters.');
      const matcher = grepMatcher(pattern, flags.has('i'));
      const data = inputData(shell, paths, input, events, name);
      const found = lines(data).flatMap((line, index) => matcher.test(line) ? [flags.has('n') ? `${index + 1}:${line}` : line] : []);
      if (!found.length) fail('grep: no matching lines (exit status 1).');
      return joinLines(found);
    }
    case 'head': case 'tail': {
      const { count, files } = lineArguments(name, args);
      const data = inputData(shell, files, input, events, name);
      // Unlike text filters, head and tail preserve a missing final newline.
      const items = data.match(/[^\n]*\n|[^\n]+$/g) ?? [];
      return (name === 'head' ? items.slice(0, count) : count === 0 ? [] : items.slice(-count)).join('');
    }
    case 'sort': {
      const { values } = options(name, args, '');
      return joinLines(lines(inputData(shell, values, input, events, name)).sort());
    }
    case 'uniq': {
      const { flags, values } = options(name, args, 'c');
      const data = lines(inputData(shell, values, input, events, name)), groups = [];
      for (const value of data) {
        if (groups.at(-1)?.value === value) groups.at(-1).count++;
        else groups.push({ value, count: 1 });
      }
      return joinLines(groups.map(group => flags.has('c') ? `${String(group.count).padStart(7)} ${group.value}` : group.value));
    }
    case 'wc': {
      const { flags, values } = options(name, args, 'l');
      if (!flags.has('l')) fail('wc: this lesson shell supports wc -l.');
      const data = inputData(shell, values, input, events, name);
      const count = (data.match(/\n/g) ?? []).length;
      return `${count}${values.length && values[0] !== '-' ? ` ${values[0]}` : ''}\n`;
    }
    case 'awk': {
      if (!/^\{\s*print\s+\$NF\s*\}$/.test(args[0] ?? '')) fail("awk: this lesson shell supports awk '{print $NF}'.");
      const { values } = options(name, args.slice(1), '');
      return joinLines(lines(inputData(shell, values, input, events, name)).map(line => line.trim().split(/\s+/).at(-1) ?? ''));
    }
    case 'tee': {
      const { flags, values } = options(name, args, 'a');
      if (!values.length) fail('tee: missing file operand.');
      for (const value of values) writeFile(shell, value, input, events, flags.has('a'));
      return input;
    }
    case 'chmod': {
      if (args.length !== 2 || !['600', '640', '644', '700'].includes(args[0])) fail('chmod: use chmod 600, 640, 644, or 700 followed by one path.');
      const path = normalize(shell, args[1]);
      if (!exists(shell, path)) fail(`No such file or directory: ${path}`);
      if (isDirectory(shell, path)) { shell.directoryModes ??= {}; shell.directoryModes[path] = args[0]; }
      else shell.files[path].mode = args[0];
      events.push({ type: 'permission', path, mode: args[0] }); return '';
    }
    case 'sha256sum': {
      const { values } = options(name, args, '');
      const paths = values.length ? values : ['-'], output = [];
      for (const path of paths) {
        const data = path === '-' ? input : readFile(shell, path, events);
        output.push(`${await sha256(data)}  ${path}`);
      }
      return joinLines(output);
    }
    case 'base64': {
      const { flags, values } = options(name, args, 'd');
      const data = inputData(shell, values, input, events, name);
      if (flags.has('d')) return decodeBase64(data);
      const encoded = encodeBase64(data);
      return joinLines(encoded.match(/.{1,76}/g) ?? []);
    }
    case 'nslookup': {
      operands(name, args, 1); const host = labHost(args[0]);
      return `Server:\t192.0.2.53\nAddress:\t192.0.2.53#53\n\nNon-authoritative answer:\nName:\t${host}\nAddress: ${HOSTS[host]}\n`;
    }
    case 'ping': {
      let count = 4, hostName;
      for (let index = 0; index < args.length; index++) {
        if (args[index] === '-c') {
          const value = args[++index];
          if (!/^[1-4]$/.test(value ?? '')) fail('ping: simulated count must be 1 to 4.');
          count = Number(value);
        } else if (args[index].startsWith('-')) fail(`ping: unsupported option: ${args[index]}`);
        else if (hostName) fail('ping: use one lab host.');
        else hostName = args[index];
      }
      if (!hostName) fail('ping: missing lab host.');
      const host = labHost(hostName), ip = HOSTS[host];
      return `PING ${host} (${ip}) 56(84) bytes of data.\n` + joinLines(Array.from({ length: count }, (_, index) => `64 bytes from ${ip}: icmp_seq=${index + 1} ttl=64 time=0.4 ms`)) + `\n--- ${host} ping statistics ---\n${count} packets transmitted, ${count} received, 0% packet loss\n`;
    }
    case 'curl': {
      if (args.length !== 2 || args[0] !== '-I') fail('curl: this lab supports curl -I https://example.test or https://academy.test.');
      let url;
      try { url = new URL(args[1]); } catch { fail('curl: use a complete HTTPS lab URL.'); }
      if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('curl: use the HTTPS root of a lab host without extra URL options.');
      const host = labHost(url.hostname);
      return `HTTP/2 200\ncontent-type: text/html; charset=utf-8\nserver: trail-lab\nstrict-transport-security: max-age=31536000\nx-training-host: ${host}\n\n`;
    }
    case 'ss': {
      if (args.length !== 1 || !['-tuln', '-tlnu'].includes(args[0])) fail('ss: this lesson shell supports ss -tuln.');
      return shell.files['/etc/network.txt']?.content ?? DEFAULT_SOCKETS;
    }
    case 'ps': {
      if (args.length !== 1 || args[0] !== 'aux') fail('ps: this lesson shell supports ps aux.');
      return shell.files['/etc/processes.txt']?.content ?? DEFAULT_PROCESSES;
    }
    default: fail(`Command not available: ${name}`);
  }
}

async function perform(shell, raw) {
  const command = String(raw ?? '').trim();
  if (!command) return { output: '', error: false, events: [] };
  if (command.includes('\0')) return { output: 'trail: commands cannot contain null bytes.\n', error: true, events: [] };
  shell.history ??= [];
  shell.history.push(command);
  if (shell.history.length > 100) shell.history.splice(0, shell.history.length - 100);
  try {
    if (command.length > 2048) {
      shell.history[shell.history.length - 1] = command.slice(0, 2048);
      fail('Commands are limited to 2,048 characters in this lab.');
    }
    const stages = parse(command);
    // Validate and execute on a private copy: a failed pipeline cannot damage evidence.
    const draft = JSON.parse(JSON.stringify(shell));
    const events = [];
    let output = '', sources = [];
    for (const stage of stages) {
      const [name, ...args] = stage.words;
      const cwd = draft.cwd, eventStart = events.length;
      output = await run(draft, name, args, output, events);
      if (output.length > 131072) fail('Command output is limited to 131,072 text characters. Narrow the input before printing.');
      const details = commandDetails(name, args, cwd);
      const reads = events.slice(eventStart).filter(event => event.type === 'read').map(event => event.path);
      sources = [...new Set([...reads, ...(details.stdin ? sources : [])])];
      events.push({ type: 'command', name, args, output, cwd, sources, usesInput: details.stdin, redirected: Boolean(stage.redirect) });
      if (stage.redirect) {
        writeFile(draft, stage.redirect.path, output, events, stage.redirect.append);
        output = ''; sources = [];
      }
    }
    if (Object.keys(draft.files).length > 512 || draft.directories.length > 512) fail('Each lab supports at most 512 files and 512 directories.');
    for (const path of [...draft.directories, ...Object.keys(draft.files)]) normalize(draft, path);
    shell.cwd = draft.cwd;
    shell.files = draft.files;
    shell.directories = draft.directories;
    shell.directoryModes = draft.directoryModes ?? {};
    return { output, error: false, events };
  } catch (error) {
    return { output: `trail: ${error.message}\n`, error: true, events: [] };
  }
}

export async function execute(shell, raw) {
  const previous = queuedExecutions.get(shell) ?? Promise.resolve();
  const next = previous.then(() => perform(shell, raw));
  queuedExecutions.set(shell, next.catch(() => {}));
  return next;
}

function matchesCommand(check, event) {
  if (!event || event.name !== check.name) return false;
  const required = asList(check.argsIncludes).map(String);
  if (required.length) {
    try {
      const expected = commandDetails(check.name, required, HOME).facts;
      const actual = commandDetails(event.name, event.args, event.cwd ?? HOME).facts;
      // A filter may receive the same verified file via cat and a pipe.
      (event.sources ?? []).forEach(path => actual.add(`path:${path}`));
      if ([...expected].some(fact => !actual.has(fact))) return false;
    } catch { return false; }
  }
  return asList(check.outputIncludes).every(value => {
    const expected = String(value);
    // Three matching lines must not also accept a count of thirteen.
    if (check.name === 'wc' && /^\d+$/.test(expected)) return Number(event.output.trim().split(/\s+/)[0]) === Number(expected);
    return String(event.output).includes(expected);
  });
}

/** Completion comes from successful, structured effects, never the typed text. */
export function matchesObjective(objective, result, shell) {
  if (!objective || !result || result.error || !Array.isArray(result.events)) return false;
  const check = objective.check ?? objective;
  const contains = (content, required) => asList(required).every(value => String(content).includes(String(value)));
  const path = check.path ? normalize(shell, check.path) : null;
  switch (check.type) {
    case 'command': {
      const commands = result.events.filter(event => event.type === 'command');
      const preceding = asList(check.pipeline);
      return commands.some((event, index) => matchesCommand(check, event) && index >= preceding.length &&
        (!preceding.length || event.usesInput) && preceding.every((requirement, offset) => {
          const prior = commands[index - preceding.length + offset];
          return !prior.redirected && (offset === 0 || prior.usesInput) && matchesCommand(requirement, prior);
        }));
    }
    case 'read':
      return result.events.some(event => event.type === 'read' && event.path === path && contains(event.content, check.contains));
    case 'write':
      return result.events.some(event => event.type === 'write' && event.path === path && contains(event.content, check.contains)) && Object.hasOwn(shell.files, path) && contains(shell.files[path].content, check.contains);
    case 'permission':
      return result.events.some(event => event.type === 'permission' && event.path === path && event.mode === String(check.mode)) && String(shell.files[path]?.mode ?? shell.directoryModes?.[path]) === String(check.mode);
    case 'directory':
      return result.events.some(event => event.type === 'directory' && event.path === path) && isDirectory(shell, path);
    case 'decision':
      return result.events.some(event => event.type === 'decision' && event.value === check.value);
    default: return false;
  }
}
