/** Living Valley's bounded, in-memory teaching terminal. Never a host shell. */
import { createShell as legacyCreate, execute as legacyExecute, matchesObjective as legacyMatches } from '../src/engine.js';

const HOME = '/home/trainee';
const MAX_OUTPUT = 131072;
const queue = new WeakMap();
const BASE = new Set('pwd whoami ls cd cat echo touch mkdir cp mv find head tail uniq wc awk tee sha256sum base64 ss history clear'.split(' '));
const EXTRA = new Set('help man less id groups rm rmdir grep sort cut sed chmod chown chgrp sudo su ps top kill systemctl df du journalctl ip traceroute nslookup ping curl bash sh export test [ true false printf file stat which uname hostname uptime date Get-Location Get-ChildItem Set-Location Get-Content Get-Process Get-Service Get-WinEvent'.split(' '));
const ALL = new Set([...BASE, ...EXTRA]);
const manuals = {
  pwd: 'pwd — print your current directory. Example: pwd',
  ls: 'ls [-a] [-l] [path] — list files. -a includes hidden names; -l shows permissions, owner, group and size. Example: ls -la maps',
  cd: 'cd [path] — change directory. .. means the parent folder; ~ means your home. Example: cd maps',
  cat: 'cat [file ...] — read complete text files. Example: cat briefing.txt',
  less: 'less file — inspect a text file. This simulator prints the page; a real less pager uses arrows and q to leave.',
  grep: 'grep [-i] [-n] [-c] [-q] [-v] [-E] pattern [file] — find matching lines. -i ignores case; -n numbers lines; -c counts matching lines; -q is quiet; -v selects nonmatches; -E enables bounded extended patterns such as ERROR|WARN. Example: grep -n "DENIED" logs/access.log',
  sort: 'sort [-n] [-r] [file] — sort lines. -n compares leading numbers; -r reverses the order. Example: sort -rn counts.txt',
  cut: 'cut -d delimiter -f fields [file] — select delimited fields. Example: cut -d , -f 1,3 names.csv. Also supports cut -c 1-5 file.',
  sed: 'sed [-n] expression [file] — bounded text edits: s/old/new/[g], Nd, Np. Example: sed "s/OFFLINE/ONLINE/g" status.txt. Output changes until you redirect it; original evidence stays intact.',
  chmod: 'chmod mode path — change simulated permissions. Numeric modes 000–777 or symbolic u+x,go-rwx,u=rw are supported. r=read, w=write, x=execute/traverse; u=owner, g=group, o=others.',
  chown: 'chown owner[:group] path — change simulated ownership only when this scenario explicitly authorizes that path. sudo does not invent permission.',
  chgrp: 'chgrp group path — change a simulated group only when this scenario explicitly authorizes that path.',
  sudo: 'sudo command — request a scoped administrative action. This game permits only actions explicitly authorized by the scenario. It never runs a real command or grants a root shell.',
  rm: 'rm [--] file ... — remove simulated files inside your home or /tmp. Recursive deletion is deliberately unavailable; inspect and preserve evidence first.',
  rmdir: 'rmdir directory — remove an empty simulated directory inside your home or /tmp.',
  bash: 'bash script.sh — run a bounded training script, not full Bash. Supported: variables/export, quoted $NAME/${NAME}, pipes, >, >>, 2>, &&, if COMMAND; then ...; else ...; fi, for NAME in words; do ...; done, and test/[ ]. No substitution, background jobs, host programs, or actual network calls.',
  systemctl: 'systemctl status|start|stop|restart service — inspect or change fictional service state. Changes need scenario authorization. Status inspection is successful even when a service is inactive (simplified status codes).',
  journalctl: 'journalctl [-u service] [-n count] — inspect scenario service messages, never this computer’s system journal.',
  ip: 'ip addr [show] / ip route [show] — inspect the configured fictional interface and route.',
  curl: 'curl [-I|-i|-s] https://configured-host/path — inspect fictional scenario HTTP responses. -I shows headers; -i includes headers with body; -s suppresses progress. No request leaves the game.',
  test: 'test -f file / test -d directory / test -n text / test left = right / test 3 -gt 2. [ ... ] uses the same bounded conditions.',
};
const fail = message => { throw new Error(message); };
const clone = value => JSON.parse(JSON.stringify(value));
const lines = value => value === '' ? [] : String(value).replace(/\n$/, '').split('\n');
const joined = values => values.length ? values.join('\n') + '\n' : '';
const parent = path => path.slice(0, path.lastIndexOf('/')) || '/';
const basename = path => path.split('/').at(-1);
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];

export function normalize(shell, raw = '.') {
  let value = String(raw);
  // Windows tools share the fictional trainee's files, never the host C: drive.
  value = value.replace(/^C:\\Users\\Trainee(?=\\|$)/i, HOME).replace(/^C:\/Users\/Trainee(?=\/|$)/i, HOME);
  if (value.includes('\\') && (value.startsWith(HOME) || shell.platform === 'windows')) value = value.replaceAll('\\', '/');
  if (value === '~' || value.startsWith('~/')) value = HOME + value.slice(1);
  if (!value.startsWith('/')) value = `${shell.cwd}/${value}`;
  if (value.length > 1024 || /[\u0000-\u001f\u007f\\]/.test(value)) fail('Paths cannot contain control characters or unsupported drive syntax.');
  const parts = [];
  for (const part of value.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  let result = '/' + parts.join('/');
  if (result.length > 240) fail('Paths are limited to 240 characters.');
  if (shell.platform === 'windows') {
    const known = [...shell.directories ?? [], ...Object.keys(shell.files ?? {})];
    const exact = known.find(path => path.toLowerCase() === result.toLowerCase());
    if (exact) result = exact;
    else { const actualParent = known.find(path => path.toLowerCase() === parent(result).toLowerCase()); if(actualParent)result=actualParent.replace(/\/$/,'')+'/'+basename(result); }
  }
  return result;
}
function directory(shell, path) { return shell.directories.includes(path); }
function exists(shell, path) { return directory(shell, path) || Object.hasOwn(shell.files, path); }
function read(shell, name, events) {
  const path = normalize(shell, name);
  if (!Object.hasOwn(shell.files, path)) fail(directory(shell, path) ? `Is a directory: ${path}` : `No such file: ${path}`);
  const content = shell.files[path].content;
  events.push({ type: 'read', path, content });
  return content;
}
function write(shell, name, content, events, append = false) {
  const path = normalize(shell, name);
  if (directory(shell, path)) fail(`Is a directory: ${path}`);
  if (!directory(shell, parent(path))) fail(`No such directory: ${parent(path)}`);
  const previous = shell.files[path];
  const next = (append ? previous?.content ?? '' : '') + content;
  if (next.length > 32768 || next.includes('\0')) fail('Files are limited to 32,768 text characters without null bytes.');
  shell.files[path] = { ...previous, content: next, mode: previous?.mode ?? '644', owner: previous?.owner ?? 'trainee', group: previous?.group ?? 'trainee', mtime: 0 };
  events.push({ type: 'write', path, content: next, append });
}
function validate(shell) {
  if (Object.keys(shell.files).length > 512 || shell.directories.length > 512) fail('Each scenario permits at most 512 files and 512 directories.');
  for (const [path, file] of Object.entries(shell.files)) {
    normalize(shell, path);
    if (file.content.length > 32768 || file.content.includes('\0')) fail('Invalid or oversized text file.');
  }
}

export function createShell(fixtures = {}, config = {}) {
  if (typeof config === 'string') config = { platform: config === 'powershell' || config === 'windows' ? 'windows' : 'linux' };
  const clean = Object.create(null);
  for (const [path, value] of Object.entries(fixtures)) clean[normalize({ cwd: HOME, platform: config.platform }, path)] = value;
  const shell = legacyCreate(clean);
  for (const [path, fixture] of Object.entries(clean)) {
    shell.files[path].owner = typeof fixture === 'object' ? fixture.owner ?? 'trainee' : 'trainee';
    shell.files[path].group = typeof fixture === 'object' ? fixture.group ?? 'trainee' : 'trainee';
  }
  shell.config = clone(config ?? {});
  shell.platform = config.platform === 'windows' ? 'windows' : 'linux';
  shell.variables = { HOME, USER: 'trainee' };
  shell.exported = ['HOME', 'USER'];
  shell.lastStatus = 0;
  shell.processes = clone(config.processes ?? [
    { pid: 1, user: 'root', command: 'init', cpu: 0, memory: 0.2, protected: true },
    { pid: 455, user: 'root', command: 'sshd', cpu: 0, memory: 0.1, protected: true },
    { pid: 714, user: 'trainee', command: 'bash', cpu: 0.1, memory: 0.3, protected: true },
    { pid: 809, user: 'service', command: 'relay-agent', cpu: 0.2, memory: 1.1, protected: false },
  ]);
  shell.services = clone(config.services ?? { 'relay.service': { active: true, description: 'Valley relay', log: 'Relay ready\n' } });
  return shell;
}

/** Expand only game-owned variables while tokenizing; expansion cannot inject syntax. */
function tokenize(raw, shell) {
  const result = [];
  let word = '', active = false, quote = null, quoted = false;
  const flush = () => { if (active) result.push({ type: 'word', value: word, quoted }); word = ''; active = false; quoted = false; };
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (quote === "'") {
      if (char === "'") quote = null; else word += char;
      continue;
    }
    if (char === '`' || (char === '$' && raw[index + 1] === '(')) fail('Command substitution is unavailable. No host command was run.');
    if (char === '$') {
      active = true;
      if (raw[index + 1] === '?') { word += String(shell.lastStatus ?? 0); index++; continue; }
      const braced = raw.slice(index).match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}/);
      const plain = raw.slice(index).match(/^\$([A-Za-z_][A-Za-z0-9_]*)/);
      const match = braced ?? plain;
      if (match) { word += shell.variables?.[match[1]] ?? ''; index += match[0].length - 1; }
      else if (raw[index + 1] === '{') fail('Only ${NAME} variable expansion is supported.');
      else word += char;
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === '\\' && ['"', '\\', '$'].includes(raw[index + 1])) word += raw[++index];
      else word += char;
      continue;
    }
    if (char === '"' || char === "'") { active = true; quoted = true; quote = char; continue; }
    if (char === '\\') {
      if (shell.platform === 'windows') { word += char; active = true; continue; }
      if (raw[index + 1] === undefined) fail('Unfinished escape.');
      word += raw[++index]; active = true; continue;
    }
    if (char === '#' && !active) { while (index < raw.length && raw[index] !== '\n') index++; if (index < raw.length) { flush(); result.push({ type: 'operator', value: ';' }); } continue; }
    if (char === '\r') continue;
    if (char === '\n' || char === ';') { flush(); result.push({ type: 'operator', value: ';' }); continue; }
    if (/\s/.test(char)) { flush(); continue; }
    if ('<()'.includes(char)) fail(`Unsupported shell syntax: ${char}.`);
    if (char === '&') {
      if (raw[index + 1] !== '&') fail('Background processes are unavailable; use && for success-only sequencing.');
      flush(); result.push({ type: 'operator', value: '&&' }); index++; continue;
    }
    if (char === '|' || char === '>') {
      if (char === '|' && raw[index + 1] === '|') fail('|| is not part of this bounded teaching shell.');
      let value = char;
      if (char === '>' && active && word === '2' && !quoted) { word = ''; active = false; value = '2>'; }
      flush();
      if (char === '>' && raw[index + 1] === '>') { value += '>'; index++; }
      result.push({ type: 'operator', value }); continue;
    }
    word += char; active = true;
  }
  if (quote) fail('Unclosed quote.');
  flush();
  return result;
}

function parse(tokens) {
  let index = 0, nodes = 0;
  const isWord = name => tokens[index]?.type === 'word' && !tokens[index].quoted && tokens[index].value === name;
  const consumeWord = name => { if (!isWord(name)) fail(`Expected ${name}.`); index++; };
  const separators = () => { while (tokens[index]?.value === ';' && tokens[index]?.type === 'operator') index++; };
  const program = (stops = [], depth = 0) => {
    if (depth > 8) fail('Scripts support at most eight nested control blocks.');
    const output = [];
    separators();
    while (index < tokens.length && !stops.some(isWord)) {
      if (++nodes > 256) fail('A script supports at most 256 commands.');
      let node;
      if (isWord('if')) {
        index++;
        const condition = program(['then'], depth + 1); consumeWord('then');
        const yes = program(['else', 'fi'], depth + 1);
        let no = [];
        if (isWord('else')) { index++; no = program(['fi'], depth + 1); }
        consumeWord('fi');
        if (!condition.length) fail('if needs a condition command.');
        node = { type: 'if', condition, yes, no };
      } else if (isWord('for')) {
        index++; const variable = tokens[index++]?.value;
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable ?? '')) fail('for needs a simple variable name.');
        consumeWord('in');
        const values = [];
        while (tokens[index]?.type === 'word') values.push(tokens[index++].value);
        if (values.length > 32) fail('Loops support at most 32 explicit values.');
        separators(); consumeWord('do');
        const body = program(['done'], depth + 1); consumeWord('done');
        node = { type: 'for', variable, values, body };
      } else {
        const stages = [];
        let stage = { words: [], stdout: null, stderr: null };
        while (index < tokens.length) {
          const token = tokens[index];
          if (token.type === 'word') { stage.words.push(token.value); index++; continue; }
          if (token.value === ';' || token.value === '&&') break;
          index++;
          if (token.value === '|') {
            if (!stage.words.length) fail('A pipe needs a command on both sides.');
            stages.push(stage); stage = { words: [], stdout: null, stderr: null }; continue;
          }
          const target = tokens[index++];
          if (target?.type !== 'word' || !target.value) fail('Redirection needs a file path.');
          const key = token.value.startsWith('2') ? 'stderr' : 'stdout';
          if (stage[key]) fail('Use one redirection for each output stream.');
          stage[key] = { path: target.value, append: token.value.endsWith('>>') };
        }
        if (!stage.words.length) fail('A command is missing.');
        stages.push(stage); node = { type: 'pipeline', stages };
      }
      output.push(node);
      if (tokens[index]?.type === 'operator' && tokens[index].value === '&&') { node.nextOnSuccess = true; index++; if (!tokens[index]) fail('&& needs another command.'); }
      else if (tokens[index]?.type === 'operator' && tokens[index].value === ';') separators();
      else if (index < tokens.length && !stops.some(isWord)) fail('Commands need a semicolon, newline, or && between them.');
    }
    return output;
  };
  const ast = program();
  if (index !== tokens.length) fail('Unexpected control word.');
  return ast;
}

// Runtime variable expansion is performed afresh for each command (including each loop pass).
// Tokens carry literal dollars through this private sentinel; no generated value is ever reparsed.
const VARIABLE = '\uE000';
function deferVariables(raw) {
  let quote = null, result = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === '\\' && quote !== "'" && i + 1 < raw.length) { result += char + raw[++i]; continue; }
    if (char === "'" && quote !== '"') quote = quote === "'" ? null : "'";
    else if (char === '"' && quote !== "'") quote = quote === '"' ? null : '"';
    if (char === '$' && quote !== "'" && raw[i + 1] !== '(') result += VARIABLE; else result += char;
  }
  return result;
}
function expand(value, shell) {
  const expanded = value.replace(/\uE000(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*)|(\?))/g, (_, braced, plain, status) => status ? String(shell.lastStatus ?? 0) : shell.variables[braced ?? plain] ?? '').replaceAll(VARIABLE, '$');
  if (expanded.length > 8192) fail('Expanded arguments are limited to 8,192 characters.');
  return expanded;
}
const quoteWord = value => `'${String(value).replaceAll("'", "'\\''")}'`;
function opts(name, args, allowed) {
  const flags = new Set(), values = []; let ended = false;
  for (const arg of args) {
    if (!ended && arg === '--') { ended = true; continue; }
    if (!ended && arg.startsWith('-') && arg !== '-') {
      const options = [...arg.slice(1)];
      if (options.some(flag => !allowed.includes(flag))) fail(`${name}: unsupported option: ${arg}`);
      options.forEach(flag => flags.add(flag));
    } else values.push(arg);
  }
  return { flags, values };
}
function dataInput(shell, paths, input, events, command) {
  if (paths.length > 1) fail(`${command}: use one input file in this teaching terminal.`);
  return paths.length && paths[0] !== '-' ? read(shell, paths[0], events) : input;
}
function need(args, count, command) { if (args.length !== count) fail(`${command}: expected ${count} operand${count === 1 ? '' : 's'}.`); }
function authorized(shell, action) { return list(shell.config.authorizedActions).includes(action); }
function modeText(mode, isDirectory = false) {
  const bits = Number.parseInt(mode, 8);
  return (isDirectory ? 'd' : '-') + [6, 3, 0].map(shift => { const n = (bits >> shift) & 7; return `${n & 4 ? 'r' : '-'}${n & 2 ? 'w' : '-'}${n & 1 ? 'x' : '-'}`; }).join('');
}
function modeChange(previous, expression) {
  if (/^[0-7]{3}$/.test(expression)) return expression;
  let value = Number.parseInt(previous, 8);
  for (const clause of expression.split(',')) {
    const match = clause.match(/^([ugoa]*)([+=-])([rwx]*)$/);
    if (!match) fail('chmod: use three octal digits or symbolic modes such as u+x,go-rwx,u=rw.');
    const who = !match[1] || match[1].includes('a') ? 'ugo' : match[1];
    let mask = 0, target = 0;
    const permissions = (match[3].includes('r') ? 4 : 0) | (match[3].includes('w') ? 2 : 0) | (match[3].includes('x') ? 1 : 0);
    for (const part of new Set(who)) { const shift = { u: 6, g: 3, o: 0 }[part]; mask |= 7 << shift; target |= permissions << shift; }
    value = match[2] === '+' ? value | target : match[2] === '-' ? value & ~target : (value & ~mask) | target;
  }
  return value.toString(8).padStart(3, '0');
}

/** Finite-state regular expressions: no JS backtracking over untrusted text. */
function regexMatcher(pattern, extended, ignoreCase) {
  if (pattern.length > 256) fail('grep: patterns are limited to 256 characters.');
  let index = 0, budget = 0;
  const tick = () => { if (++budget > 2000000) fail('grep: search budget exceeded; use a simpler pattern.'); };
  const branches = stop => {
    let alternatives = [], current = [[]];
    while (index < pattern.length && !(stop && pattern[index] === ')')) {
      let char = pattern[index++];
      if (extended && char === '|') { alternatives.push(...current); current = [[]]; continue; }
      let addition;
      if (extended && char === '(') {
        addition = branches(true);
        if (pattern[index++] !== ')') fail('grep: unclosed group.');
        if ('*+?{'.includes(pattern[index] ?? '\0')) fail('grep: repeated groups are outside this bounded subset; repeat a single character or class.');
      } else {
        let atom;
        if (char === '\\') {
          char = pattern[index++];
          if (char === undefined || /[1-9]/.test(char)) fail('grep: unfinished escape or unsupported backreference.');
          atom = { kind: 'literal', value: char };
        } else if (char === '[') {
          let value = '[';
          while (index < pattern.length && pattern[index] !== ']') value += pattern[index++];
          if (pattern[index++] !== ']') fail('grep: unclosed character class.');
          value += ']';
          let expression; try { expression = new RegExp(`^(?:${value})$`, ignoreCase ? 'iu' : 'u'); } catch { fail('grep: invalid character class.'); }
          atom = { kind: 'class', expression };
        } else if (char === '.') atom = { kind: 'any' };
        else if (char === '^') atom = { kind: 'start' };
        else if (char === '$') atom = { kind: 'end' };
        else if (char === '*' || (extended && '+?{}'.includes(char))) fail('grep: invalid or unsupported repetition.');
        else if (extended && char === ')') fail('grep: unmatched group close.');
        else atom = { kind: 'literal', value: char };
        const quantifier = pattern[index];
        if (quantifier === '*' || (extended && (quantifier === '+' || quantifier === '?'))) {
          if (['start', 'end'].includes(atom.kind)) fail('grep: cannot repeat an anchor.');
          index++;
          if (quantifier === '+') addition = [[atom, { ...atom, repeat: true }]];
          else addition = [[{ ...atom, repeat: quantifier === '*', optional: quantifier === '?' }]];
        } else addition = [[atom]];
      }
      current = current.flatMap(prefix => addition.map(suffix => [...prefix, ...suffix]));
      if (current.length + alternatives.length > 64 || current.some(branch => branch.length > 256)) fail('grep: too many pattern alternatives.');
    }
    return [...alternatives, ...current];
  };
  const alternatives = branches(false);
  const matchAtom = (atom, char) => atom.kind === 'any' || atom.kind === 'class' && atom.expression.test(char) || atom.kind === 'literal' && (ignoreCase ? atom.value.toLowerCase() === char.toLowerCase() : atom.value === char);
  return { test(text) {
    const chars = [...text];
    return alternatives.some(atoms => {
      const close = (states, position) => {
        for (const state of states) {
          tick(); const atom = atoms[state];
          if (atom && (atom.repeat || atom.optional || atom.kind === 'start' && position === 0 || atom.kind === 'end' && position === chars.length)) states.add(state + 1);
        }
        return states;
      };
      let active = close(new Set([0]), 0);
      if (active.has(atoms.length)) return true;
      for (let p = 0; p < chars.length; p++) {
        const next = new Set([0]);
        for (const state of active) { tick(); const atom = atoms[state]; if (atom && matchAtom(atom, chars[p])) next.add(atom.repeat ? state : state + 1); }
        active = close(next, p + 1);
        if (active.has(atoms.length)) return true;
      }
      return false;
    });
  } };
}

function probe(shell, name) {
  const host = String(name).toLowerCase().replace(/\.$/, '');
  const defaults = { 'academy.test': '192.0.2.20', 'example.test': '192.0.2.10' };
  const configured = shell.config.probes?.[host];
  const address = configured?.address ?? shell.config.hosts?.[host] ?? defaults[host];
  if (!address && !configured) fail(`No simulated response configured for ${host}. No network request was sent.`);
  return { host, address: address ?? host, reachable: true, status: 200, body: 'Valley training endpoint\n', ...configured };
}

async function run(shell, name, args, input, events, context) {
  const initialEvents = events.length;
  let output = '', status = 0, usesInput = false;
  if (args.includes('--help') || args.includes('-?')) {
    if (!ALL.has(name)) fail(`Command not available: ${name}. Type help.`);
    return { output: (manuals[name] ?? `${name} — supported training command. Use the lesson's tool guide for its bounded syntax.`) + '\n', status: 0, usesInput: false };
  }
  if(name==='history'){
    need(args,0,name);
    return{output:joined(shell.history.map((entry,index)=>`${String(index+1).padStart(3)}  ${entry}`)),status:0,usesInput:false};
  }
  if (BASE.has(name) && !(name === 'ls' && args.some(arg => /^-[al]*l[al]*$/.test(arg)))) {
    const fake = '/.living-valley-stdin';
    const previous = shell.files[fake];
    const wantsInput = ['cat', 'head', 'tail', 'uniq', 'wc', 'awk', 'tee', 'base64', 'sha256sum'].includes(name);
    if (wantsInput) shell.files[fake] = { content: input, mode: '600', mtime: 0 };
    const command = `${wantsInput ? `cat ${quoteWord(fake)} | ` : ''}${[name, ...args].map(quoteWord).join(' ')}`;
    const history = [...shell.history];
    const metadata = Object.fromEntries(Object.entries(shell.files).map(([path, file]) => [path, { owner: file.owner, group: file.group }]));
    const result = await legacyExecute(shell, command);
    shell.history = history;
    if (previous) shell.files[fake] = previous; else delete shell.files[fake];
    if (result.error) fail(result.output.replace(/^trail:\s*/, '').trim());
    for (const [path, file] of Object.entries(shell.files)) { file.owner ??= metadata[path]?.owner ?? 'trainee'; file.group ??= metadata[path]?.group ?? 'trainee'; }
    const relevant = result.events.filter(event => !(event.type === 'read' && event.path === fake) && !(event.type === 'command' && event.name === 'cat' && event.args[0] === fake));
    const commandEvent = relevant.findLast(event => event.type === 'command');
    usesInput = commandEvent?.usesInput ?? false;
    events.push(...relevant.filter(event => event.type !== 'command'));
    return { output: result.output, status: 0, usesInput };
  }
  switch (name) {
    case 'help': output = 'Living Valley training terminal — everything stays in memory.\n' + [...ALL].sort().join(', ') + '\nUse man COMMAND or COMMAND --help. Supported: pipes, >, >>, 2>, &&, bounded if/for, variables and bash scripts. No host execution, real network, command substitution, background jobs, or full Bash.\n'; break;
    case 'man': need(args, 1, name); if (!ALL.has(args[0])) fail(`No training manual for ${args[0]}.`); output = (manuals[args[0]] ?? `${args[0]} — see the mission's tool introduction and supported example.`) + '\n'; break;
    case 'less': need(args, 1, name); output = read(shell, args[0], events); break;
    case 'id': need(args, 0, name); output = 'uid=1000(trainee) gid=1000(trainee) groups=1000(trainee),1001(rangers)\n'; break;
    case 'groups': need(args, 0, name); output = 'trainee rangers\n'; break;
    case 'ls': {
      const { flags, values } = opts(name, args, 'al');
      if (values.length > 1) fail('ls: use one directory or file.');
      const path = normalize(shell, values[0] ?? '.');
      if (!exists(shell, path)) fail(`No such file or directory: ${path}`);
      const children = directory(shell, path) ? [...shell.directories, ...Object.keys(shell.files)].filter(p => p !== path && parent(p) === path && (flags.has('a') || !basename(p).startsWith('.'))).sort() : [path];
      if (flags.has('a') && directory(shell, path)) children.unshift(path, parent(path));
      output = joined(children.map((p, index) => {
        const file = shell.files[p], isDir = directory(shell, p);
        const label = flags.has('a') && directory(shell, path) && index < 2 ? ['.', '..'][index] : basename(p);
        return `${modeText(file?.mode ?? shell.directoryModes[p] ?? '755', isDir)} ${file?.owner ?? 'trainee'} ${file?.group ?? 'trainee'} ${String(isDir ? 4096 : new TextEncoder().encode(file.content).length).padStart(5)} Oct 17 ${label}`;
      })); break;
    }
    case 'rm': case 'rmdir': {
      const { values } = opts(name, args, '');
      if (!values.length) fail(`${name}: missing path.`);
      for (const raw of values) {
        const path = normalize(shell, raw);
        if (![HOME + '/', '/tmp/'].some(prefix => path.startsWith(prefix)) && !authorized(shell, `remove:${path}`)) fail(`${name}: that path is outside the authorized disposable area.`);
        if (!exists(shell, path)) fail(`No such file or directory: ${path}`);
        if (name === 'rm' && directory(shell, path)) fail('rm: use rmdir for an empty directory; recursive deletion is unavailable.');
        if (name === 'rmdir') {
          if (!directory(shell, path)) fail('rmdir: not a directory.');
          if ([...shell.directories, ...Object.keys(shell.files)].some(p => p.startsWith(path + '/'))) fail('rmdir: directory is not empty.');
          if (shell.cwd === path || shell.cwd.startsWith(path + '/')) fail('rmdir: leave the directory before removing it.');
          shell.directories = shell.directories.filter(p => p !== path); delete shell.directoryModes[path];
        } else delete shell.files[path];
        events.push({ type: 'remove', path });
      }
      break;
    }
    case 'grep': {
      const { flags, values } = opts(name, args, 'incqEv');
      if (!values.length) fail('grep: missing search pattern.');
      const matcher = regexMatcher(values[0], flags.has('E'), flags.has('i'));
      const data = dataInput(shell, values.slice(1), input, events, name);
      usesInput = values.length === 1 || values[1] === '-';
      const found = lines(data).flatMap((line, i) => matcher.test(line) !== flags.has('v') ? [flags.has('n') ? `${i + 1}:${line}` : line] : []);
      status = found.length ? 0 : 1;
      output = flags.has('q') ? '' : flags.has('c') ? `${found.length}\n` : joined(found);
      break;
    }
    case 'sort': {
      const { flags, values } = opts(name, args, 'nr');
      usesInput = !values.length || values[0] === '-';
      const valuesToSort = lines(dataInput(shell, values, input, events, name));
      const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
      valuesToSort.sort(flags.has('n') ? (a, b) => (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0) || lexical(a, b) : lexical);
      if (flags.has('r')) valuesToSort.reverse();
      output = joined(valuesToSort); break;
    }
    case 'cut': {
      let delimiter = '\t', field = null, characters = false; const files = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-d') delimiter = args[++i];
        else if (arg.startsWith('-d')) delimiter = arg.slice(2);
        else if (arg === '-f' || arg === '-c') { characters = arg === '-c'; field = args[++i]; }
        else if (/^-[fc]/.test(arg)) { characters = arg[1] === 'c'; field = arg.slice(2); }
        else if (arg.startsWith('-') && arg !== '-') fail(`cut: unsupported option: ${arg}`); else files.push(arg);
      }
      if (!field || !/^[1-9]\d*(?:-[1-9]\d*)?(?:,[1-9]\d*(?:-[1-9]\d*)?)*$/.test(field)) fail('cut: use positive fields such as -f 1,3 or -c 1-5.');
      if ([...delimiter ?? ''].length !== 1) fail('cut: delimiter must be one character.');
      const indexes = new Set();
      for (const range of field.split(',')) { const [a, b = a] = range.split('-').map(Number); if (b < a || b > 1024) fail('cut: field range must ascend and stay within 1–1024.'); for (let n = a; n <= b; n++) indexes.add(n - 1); }
      usesInput = !files.length || files[0] === '-';
      output = joined(lines(dataInput(shell, files, input, events, name)).map(line => !characters && !line.includes(delimiter) ? line : (characters ? [...line] : line.split(delimiter)).filter((_, i) => indexes.has(i)).join(characters ? '' : delimiter)));
      break;
    }
    case 'sed': {
      const { flags, values } = opts(name, args, 'n');
      const expression = values.shift();
      if (!expression) fail('sed: missing expression.');
      usesInput = !values.length || values[0] === '-';
      const inputLines = lines(dataInput(shell, values, input, events, name));
      const lineAction = expression.match(/^([1-9]\d*)([pd])$/);
      if (lineAction) output = joined(inputLines.filter((_, i) => lineAction[2] === 'd' ? i + 1 !== Number(lineAction[1]) && !flags.has('n') : i + 1 === Number(lineAction[1]) || !flags.has('n')));
      else {
        const replacement = expression.match(/^s([^\w\s\\])((?:\\.|(?!\1).)*)\1((?:\\.|(?!\1).)*)\1(g?)$/);
        if (!replacement) fail('sed: supported expressions are s/old/new/[g], Nd, and Np. -i is deliberately unavailable; preserve evidence.');
        if (/[.*+?()[\]{}^$]/.test(replacement[2])) fail('sed: this teaching subset replaces literal text, not regular expressions.');
        const before = replacement[2].replaceAll('\\' + replacement[1], replacement[1]);
        const after = replacement[3].replaceAll('\\' + replacement[1], replacement[1]);
        if (!before) fail('sed: the search text cannot be empty.');
        output = flags.has('n') ? '' : joined(inputLines.map(line => replacement[4] ? line.split(before).join(after) : line.replace(before, after)));
      }
      break;
    }
    case 'chmod': {
      need(args, 2, name); const path = normalize(shell, args[1]);
      if (!exists(shell, path)) fail(`No such file or directory: ${path}`);
      const mode = modeChange(shell.files[path]?.mode ?? shell.directoryModes[path] ?? '755', args[0]);
      if (directory(shell, path)) shell.directoryModes[path] = mode; else shell.files[path].mode = mode;
      events.push({ type: 'permission', path, mode }); break;
    }
    case 'chown': case 'chgrp': {
      need(args, 2, name); const path = normalize(shell, args[1]);
      if (!Object.hasOwn(shell.files, path)) fail(`No such file: ${path}`);
      if (!authorized(shell, `${name}:${path}`)) fail(`${name}: this scenario has not authorized that ownership change. Request scoped approval; sudo is not automatic authorization.`);
      if (!/^[a-z_][a-z0-9_-]*(?::[a-z_][a-z0-9_-]*)?$/i.test(args[0]) || name === 'chgrp' && args[0].includes(':')) fail(`${name}: use a simple fictional account or group.`);
      if (name === 'chown') { const [owner, group] = args[0].split(':'); shell.files[path].owner = owner; if (group) shell.files[path].group = group; }
      else shell.files[path].group = args[0];
      events.push({ type: 'ownership', path, owner: shell.files[path].owner, group: shell.files[path].group }); break;
    }
    case 'su': fail('su: a root shell is outside this lab. Administrative work needs a specific authorized action.'); break;
    case 'sudo': {
      if (!args.length || args[0] === '-s' || args[0] === '-i' || ['bash', 'sh', 'su'].includes(args[0])) fail('sudo: root shells are unavailable. Request a specific scenario-authorized action.');
      if (!['chown', 'chgrp', 'kill', 'systemctl'].includes(args[0])) fail('sudo: this command has no authorized administrative workflow in the scenario.');
      const child = await run(shell, args[0], args.slice(1), input, events, context);
      events.push({ type: 'command', name: args[0], args: args.slice(1), output: child.output, cwd: shell.cwd, sources: [], usesInput: false, exitCode: child.status, redirected: false });
      return child;
    }
    case 'ps': case 'top': {
      if (name === 'ps' && !(args.length === 0 || args.length === 1 && ['aux', '-ef'].includes(args[0]))) fail('ps: supports ps aux or ps -ef.');
      if (name === 'top' && args.some(arg => !['-b', '-n', '1'].includes(arg))) fail('top: supports top or top -b -n 1 (one simulated snapshot).');
      output = joined(['USER PID %CPU %MEM COMMAND', ...shell.processes.map(p => `${p.user ?? 'trainee'} ${p.pid} ${p.cpu ?? 0} ${p.memory ?? 0} ${p.command}`)]); break;
    }
    case 'kill': {
      let pid = args[0]; if (args[0] === '-TERM' || args[0] === '-15') pid = args[1];
      if (!/^\d+$/.test(pid ?? '') || args.length !== (pid === args[0] ? 1 : 2)) fail('kill: use kill PID or kill -TERM PID; forced termination is unavailable.');
      const process = shell.processes.find(p => Number(p.pid) === Number(pid));
      if (!process) fail(`kill: no such simulated process: ${pid}`);
      if (process.protected || !authorized(shell, `kill:${pid}`)) fail('kill: this process is protected or not authorized for termination.');
      shell.processes = shell.processes.filter(p => p !== process); events.push({ type: 'process', action: 'terminate', pid: Number(pid) }); break;
    }
    case 'systemctl': {
      need(args, 2, name); const [action, serviceName] = args;
      const key = Object.hasOwn(shell.services, serviceName) ? serviceName : serviceName + '.service';
      const service = shell.services[key];
      if (!service) fail(`systemctl: no configured fictional service: ${serviceName}`);
      if (action === 'status') output = `${key} — ${service.description ?? key}\n   Active: ${service.active ? 'active (running)' : 'inactive (dead)'}\n`;
      else if (['start', 'stop', 'restart'].includes(action)) {
        if (!authorized(shell, `service:${key}:${action}`) && !authorized(shell, `service:${serviceName}:${action}`)) fail('systemctl: this service change needs scenario authorization.');
        service.active = action !== 'stop'; service.log = (service.log ?? '') + `Authorized ${action}: ${key}\n`;
        events.push({ type: 'service', name: key, action, active: service.active });
      } else fail('systemctl: supports status, start, stop, and restart.');
      break;
    }
    case 'df': {
      if (args.some(arg => !['-h', '.','/'].includes(arg))) fail('df: supports df -h [/] in this scenario.');
      const disk = shell.config.disk ?? { total: 100, used: 24, mount: '/' };
      output = `Filesystem Size Used Avail Use% Mounted on\nvalley-sim ${disk.total}G ${disk.used}G ${Math.max(0, disk.total - disk.used)}G ${Math.round(disk.used / disk.total * 100)}% ${disk.mount ?? '/'}\n`; break;
    }
    case 'du': {
      const { flags, values } = opts(name, args, 'sh'); if (values.length > 1) fail('du: use one path.');
      const path = normalize(shell, values[0] ?? '.'); if (!exists(shell, path)) fail(`No such path: ${path}`);
      const bytes = Object.entries(shell.files).filter(([p]) => p === path || p.startsWith(path + '/')).reduce((sum, [,file]) => sum + new TextEncoder().encode(file.content).length, 0);
      output = `${flags.has('h') ? Math.max(1, Math.ceil(bytes / 1024)) + 'K' : Math.ceil(bytes / 1024)}\t${values[0] ?? '.'}\n`; break;
    }
    case 'journalctl': {
      let service = null, count = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-u') service = args[++i];
        else if (args[i] === '-n') { const value = args[++i]; if (!/^\d+$/.test(value ?? '') || Number(value) > 1000) fail('journalctl: count must be 0–1000.'); count = Number(value); }
        else if (args[i] !== '--no-pager') fail(`journalctl: unsupported argument: ${args[i]}`);
      }
      if (service) { const info = shell.services[service] ?? shell.services[service + '.service']; if (!info) fail(`journalctl: no configured service ${service}`); output = info.log ?? ''; }
      else output = Object.values(shell.services).map(info => info.log ?? '').join('');
      if (count !== null) output = count === 0 ? '' : joined(lines(output).slice(-count)); break;
    }
    case 'ip': {
      const network = shell.config.network ?? { address: '192.0.2.12/24', gateway: '192.0.2.1', dns: '192.0.2.53' };
      if (['addr', 'address', 'a'].includes(args[0]) && args.length <= 2 && (!args[1] || args[1] === 'show')) output = `1: lo: <LOOPBACK,UP>\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,UP>\n    inet ${network.address} scope global eth0\n`;
      else if (args[0] === 'route' && args.length <= 2 && (!args[1] || args[1] === 'show')) output = `default via ${network.gateway} dev eth0\n${network.address} dev eth0\n`;
      else fail('ip: supports ip addr [show] and ip route [show].'); break;
    }
    case 'nslookup': { need(args, 1, name); const response = probe(shell, args[0]); output = `Server:\t${shell.config.network?.dns ?? '192.0.2.53'}\nName:\t${response.host}\nAddress: ${response.address}\n`; break; }
    case 'ping': {
      let count = 4, hostname;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-c' || /^-c[1-4]$/.test(args[i])) { const value = args[i] === '-c' ? args[++i] : args[i].slice(2); if (!/^[1-4]$/.test(value ?? '')) fail('ping: count must be 1–4.'); count = Number(value); }
        else if (args[i].startsWith('-') || hostname) fail('ping: use ping [-c 1–4] configured-host.'); else hostname = args[i];
      }
      if (!hostname) fail('ping: missing host.'); const response = probe(shell, hostname);
      output = `PING ${response.host} (${response.address})\n` + (response.reachable ? joined(Array.from({ length: count }, (_,i) => `64 bytes from ${response.address}: icmp_seq=${i + 1} ttl=64 time=0.4 ms`)) : 'Destination unreachable in this scenario\n') + `${count} packets transmitted, ${response.reachable ? count : 0} received, ${response.reachable ? 0 : 100}% packet loss\n`;
      // The probe completed successfully even if evidence reports packet loss.
      break;
    }
    case 'traceroute': {
      need(args, 1, name); const response = probe(shell, args[0]);
      output = `traceroute to ${response.host} (${response.address})\n` + joined((response.hops ?? [shell.config.network?.gateway ?? '192.0.2.1', response.address]).map((hop,i) => `${i + 1}  ${hop}  1.0 ms`)) + (response.reachable ? '' : '* * * destination unavailable\n'); break;
    }
    case 'curl': {
      const { flags, values } = opts(name, args, 'Iis'); need(values, 1, name);
      let url; try { url = new URL(values[0]); } catch { fail('curl: use a complete fictional HTTP or HTTPS URL.'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) fail('curl: unsupported URL options. No request was sent.');
      const response = probe(shell, url.hostname);
      if (!response.reachable) fail('curl: configured endpoint is unavailable in this scenario.');
      const headers = { 'content-type': 'text/plain; charset=utf-8', 'x-training-host': response.host, ...response.headers };
      const head = `HTTP/2 ${response.status}\n` + joined(Object.entries(headers).map(([key,value]) => `${key.toLowerCase()}: ${value}`)) + '\n';
      output = (flags.has('I') || flags.has('i') ? head : '') + (flags.has('I') ? '' : response.body); break;
    }
    case 'export': {
      if (!args.length) { output = joined([...shell.exported].sort().map(key => `export ${key}=${quoteWord(shell.variables[key] ?? '')}`)); break; }
      for (const arg of args) {
        const match = arg.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:=(.*))?$/s);
        if (!match) fail('export: use export NAME or export NAME=value.');
        if((match[2]??'').length>2048)fail('Variable values are limited to 2,048 characters.');
        if(match[2]!==undefined)shell.variables[match[1]]=match[2];
        else if(!Object.hasOwn(shell.variables,match[1]))shell.variables[match[1]]='';
        if(!shell.exported.includes(match[1]))shell.exported.push(match[1]);
      }
      if (Object.keys(shell.variables).length > 64) fail('At most 64 training variables are supported.'); break;
    }
    case 'bash': case 'sh': {
      need(args, 1, name);
      if (context.depth >= 8) fail('Scripts are limited to eight nested calls.');
      const content = read(shell, args[0], events);
      if (content.length > 8192) fail('Training scripts are limited to 8,192 characters.');
      const childShell = clone(shell);
      childShell.variables = Object.fromEntries(shell.exported.filter(key=>Object.hasOwn(shell.variables,key)).map(key=>[key,shell.variables[key]]));
      const script = parse(tokenize(deferVariables(content), childShell));
      const child = await runProgram(childShell, script, events, { ...context, depth: context.depth + 1 });
      for(const key of ['files','directories','directoryModes','processes','services'])shell[key]=childShell[key];
      output = child.output; status = child.status; break;
    }
    case '[': if (args.at(-1) !== ']') fail('[: closing ] is required.'); args = args.slice(0, -1); // falls through
    case 'test': {
      let truth;
      if (args.length === 1) truth = args[0].length > 0;
      else if (args.length === 2 && ['-f','-d','-e','-n','-z'].includes(args[0])) {
        truth = args[0] === '-n' ? args[1].length > 0 : args[0] === '-z' ? args[1].length === 0 : args[0] === '-f' ? Object.hasOwn(shell.files, normalize(shell,args[1])) : args[0] === '-d' ? directory(shell,normalize(shell,args[1])) : exists(shell,normalize(shell,args[1]));
      } else if (args.length === 3 && ['=','==','!=','-eq','-ne','-lt','-le','-gt','-ge'].includes(args[1])) {
        const [left, op, right] = args;
        if (op.startsWith('-') && (!/^-?\d+$/.test(left) || !/^-?\d+$/.test(right))) fail('test: numeric comparisons need whole numbers.');
        truth = { '=': () => left === right, '==': () => left === right, '!=': () => left !== right, '-eq': () => Number(left) === Number(right), '-ne': () => Number(left) !== Number(right), '-lt': () => Number(left) < Number(right), '-le': () => Number(left) <= Number(right), '-gt': () => Number(left) > Number(right), '-ge': () => Number(left) >= Number(right) }[op]();
      } else fail('test: unsupported condition. Use man test.');
      status = truth ? 0 : 1; break;
    }
    case 'true': need(args, 0, name); break;
    case 'false': need(args, 0, name); status = 1; break;
    case 'printf': {
      if (!args.length) fail('printf: missing format.');
      if (/%[^%sd]/.test(args[0])) fail('printf: supports %s, %d and %%.');
      let i = 1;
      output = args[0].replaceAll('\\n','\n').replaceAll('\\t','\t').replace(/%([%sd])/g, (_,type) => type === '%' ? '%' : type === 'd' ? String(Number.parseInt(args[i++] ?? '0',10) || 0) : args[i++] ?? ''); break;
    }
    case 'file': need(args,1,name); read(shell,args[0],events); output = `${args[0]}: UTF-8 text${/\.sh$/.test(args[0]) ? ', training shell script' : ''}\n`; break;
    case 'stat': { need(args,1,name); const path=normalize(shell,args[0]); if(!exists(shell,path)) fail(`No such path: ${path}`); const file=shell.files[path]; output=`File: ${path}\nSize: ${file ? new TextEncoder().encode(file.content).length : 4096}\nAccess: (${file?.mode ?? shell.directoryModes[path] ?? '755'}) Uid: ${file?.owner ?? 'trainee'} Gid: ${file?.group ?? 'trainee'}\n`; break; }
    case 'which': need(args,1,name); if(!ALL.has(args[0])) { status=1; break; } output=`/training/bin/${args[0]}\n`; break;
    case 'uname': if(args.length>1||args[0]&&!['-a','-s'].includes(args[0])) fail('uname: supports uname [-a|-s].'); output='Linux valley-simulation (fictional training system)\n';break;
    case 'hostname': need(args,0,name);output='valley-field-station\n';break;
    case 'uptime': need(args,0,name);output='up 2 hours, 1 trainee, load average: 0.25, 0.30, 0.20 (scenario snapshot)\n';break;
    case 'date': need(args,0,name);output=(shell.config.date ?? '2042-06-14 08:30:00 UTC (scenario clock)')+'\n';break;
    case 'Get-Location': need(args,0,name);output=`Path\n----\n${shell.cwd.replace(HOME,'C:\\Users\\Trainee').replaceAll('/','\\')}\n`;break;
    case 'Set-Location': { if(args[0]?.toLowerCase()==='-path')args=args.slice(1);need(args,1,name);const path=normalize({...shell,platform:'windows'},args[0]);if(!directory(shell,path))fail(`Not a directory: ${path}`);shell.cwd=path;events.push({type:'directory-change',path});break; }
    case 'Get-ChildItem': {
      const force=args.some(arg=>arg.toLowerCase()==='-force'); const values=args.filter(arg=>!['-force','-path'].includes(arg.toLowerCase()));if(values.length>1)fail('Get-ChildItem: use one path and optional -Force.');
      const path=normalize({...shell,platform:'windows'},values[0]??'.');if(!exists(shell,path))fail(`No such path: ${path}`);
      const children=directory(shell,path)?[...shell.directories,...Object.keys(shell.files)].filter(p=>p!==path&&parent(p)===path&&(force||!basename(p).startsWith('.'))).sort():[path];output=joined(['Mode  Length Name',...children.map(p=>`${directory(shell,p)?'d----':'-a---'} ${shell.files[p]?.content.length??0} ${basename(p)}`)]);break;
    }
    case 'Get-Content': { if(args[0]?.toLowerCase()==='-path')args=args.slice(1);need(args,1,name);output=read({...shell,platform:'windows'},args[0],events);break; }
    case 'Get-Process': need(args,0,name);output=joined(['Id CPU ProcessName',...shell.processes.map(p=>`${p.pid} ${p.cpu??0} ${p.command}`)]);break;
    case 'Get-Service': { if(args[0]?.toLowerCase()==='-name')args=args.slice(1);if(args.length>1)fail('Get-Service: optional one service name.');const entries=Object.entries(shell.services).filter(([key])=>!args.length||key===args[0]||key===args[0]+'.service');if(args.length&&!entries.length)fail('Get-Service: no configured service.');output=joined(['Status Name DisplayName',...entries.map(([key,s])=>`${s.active?'Running':'Stopped'} ${key} ${s.description??key}`)]);break; }
    case 'Get-WinEvent': {
      let logName='System',max=20;for(let i=0;i<args.length;i++){if(args[i].toLowerCase()==='-logname')logName=args[++i];else if(args[i].toLowerCase()==='-maxevents'){const v=args[++i];if(!/^\d+$/.test(v??'')||Number(v)>1000)fail('Get-WinEvent: -MaxEvents must be 0–1000.');max=Number(v);}else fail(`Get-WinEvent: unsupported argument ${args[i]}`);}
      const logs=shell.config.windowsEvents??{System:'2042-06-14 08:20 Information 7036 Relay service entered running state\n',Security:'2042-06-14 08:22 AuditFailure 4625 Unknown account failed sign-in\n'};
      if(!Object.hasOwn(logs,logName))fail(`Get-WinEvent: no configured ${logName} log.`);output=max===0?'':joined(lines(logs[logName]).slice(0,max));break;
    }
    default: {
      if (name.startsWith('./')) {
        const path=normalize(shell,name);
        if(!Object.hasOwn(shell.files,path))fail(`No such script: ${path}`);
        if(!(Number.parseInt(shell.files[path].mode,8)&0o111))fail('Permission denied: use an appropriate executable permission before ./script.sh, or inspect and run an authorized readable script with bash.');
        return run(shell,'bash',[name,...args],input,events,context);
      }
      fail(`Command not available: ${name}. Type help. This is a bounded simulation, not a host shell.`);
    }
  }
  if (output.length > MAX_OUTPUT) fail('Output is limited to 131,072 characters. Narrow the query.');
  return { output, status, usesInput, reads: events.slice(initialEvents).filter(event=>event.type==='read').map(event=>event.path) };
}

async function runPipeline(shell, node, events, context) {
  const draft = clone(shell), local = []; let output = '', sources = [], status = 0, errorText = '';
  try {
    for (let stageIndex=0;stageIndex<node.stages.length;stageIndex++) {
      const stage=node.stages[stageIndex];
      if (++context.budget.steps > 512) fail('Execution stopped after 512 training commands.');
      const words=stage.words.map(word=>expand(word,draft));
      let [name,...args]=words;
      const canonical = [...EXTRA].find(command => command.startsWith('Get-') || command === 'Set-Location' ? command.toLowerCase() === name.toLowerCase() : false);
      if(canonical)name=canonical;
      const cwd=draft.cwd,eventStart=local.length;
      let result;
      try {
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(name)) {
          if(words.some(word=>!/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)))fail('Assignments must be separate from commands in this teaching shell.');
          for(const word of words){const equals=word.indexOf('=');const value=word.slice(equals+1);if(value.length>2048)fail('Variable values are limited to 2,048 characters.');draft.variables[word.slice(0,equals)]=value;}
          if(Object.keys(draft.variables).length>64)fail('At most 64 training variables are supported.');
          result={output:'',status:0,usesInput:false};
        } else result=await run(draft,name,args,output,local,context);
      } catch(error) {
        result={output:'',status:2,usesInput:false};errorText=`trail: ${error.message}\n`;
        if(stage.stderr){write(draft,expand(stage.stderr.path,draft),errorText,local,stage.stderr.append);errorText='';}
      }
      output=result.output;status=result.status;
      if(stage.stdout||stageIndex<node.stages.length-1){for(const event of local.slice(eventStart)){if(event.type==='command')event.hidden=true;}}
      const reads=local.slice(eventStart).filter(event=>event.type==='read').map(event=>event.path);
      sources=[...new Set([...reads,...(result.usesInput?sources:[])])];
      local.push({type:'command',name,args,output,cwd,sources,usesInput:result.usesInput,redirected:Boolean(stage.stdout),piped:stageIndex<node.stages.length-1,exitCode:status});
      if(stage.stdout){write(draft,expand(stage.stdout.path,draft),output,local,stage.stdout.append);output='';sources=[];}
      if(status!==0)break;
    }
    validate(draft);
    // A failed pipeline cannot partially change evidence. A redirected error is a deliberate observation.
    if(status===0) { Object.assign(shell,draft);events.push(...local); }
    else {
      const errorWrites=local.filter(event=>event.type==='write'&&node.stages.some(stage=>stage.stderr&&normalize(draft,expand(stage.stderr.path,draft))===event.path));
      for(const event of errorWrites){write(shell,event.path,event.content,events,false);events.at(-1).stream='stderr';}
      events.push(...local.filter(event=>event.type==='command').map(event=>({...event,exitCode:event.exitCode||status})));
    }
    shell.lastStatus=status;
    return {output:output+errorText,status};
  } catch(error) {shell.lastStatus=2;return {output:`trail: ${error.message}\n`,status:2};}
}

async function runProgram(shell, nodes, events, context) {
  let output='',status=0,skip=false;
  for(const node of nodes){
    if(++context.budget.control>1024)fail('Execution stopped after 1,024 script operations.');
    if(skip){skip=Boolean(node.nextOnSuccess);continue;}
    let result;
    if(node.type==='pipeline')result=await runPipeline(shell,node,events,context);
    else if(node.type==='if'){
      const condition=await runProgram(shell,node.condition,events,context);
      result=await runProgram(shell,condition.status===0?node.yes:node.no,events,context);
      // A condition's stdout is real output; quiet grep avoids revealing irrelevant lines.
      result.output=condition.output+result.output;
    }else{
      result={output:'',status:0};
      for(const value of node.values){shell.variables[node.variable]=expand(value,shell);const iteration=await runProgram(shell,node.body,events,context);result.output+=iteration.output;result.status=iteration.status;if(result.output.length>MAX_OUTPUT)fail('Loop output is too large.');}
    }
    output+=result.output;status=result.status;shell.lastStatus=status;
    if(output.length>MAX_OUTPUT)fail('Output is limited to 131,072 characters.');
    skip=node.nextOnSuccess&&status!==0;
  }
  return {output,status};
}

async function perform(shell, raw) {
  const command=String(raw??'').trim();
  if(!command)return{output:'',error:false,events:[],exitCode:0};
  if(command.length>8192||command.includes('\0')||command.includes(VARIABLE))return{output:'trail: Commands are limited to 8,192 characters without null or private control markers.\n',error:true,events:[],exitCode:2};
  shell.history??=[];shell.history.push(command);if(shell.history.length>100)shell.history.splice(0,shell.history.length-100);
  const events=[];
  try{
    const ast=parse(tokenize(deferVariables(command),shell));
    const result=await runProgram(shell,ast,events,{depth:0,budget:{steps:0,control:0}});
    return{output:result.output,error:result.status!==0,events,exitCode:result.status};
  }catch(error){return{output:`trail: ${error.message}\n`,error:true,events:[],exitCode:2};}
}
export async function execute(shell,raw){
  const previous=queue.get(shell)??Promise.resolve();const next=previous.then(()=>perform(shell,raw));queue.set(shell,next.catch(()=>{}));return next;
}

function commandMatch(check,event){
  if(!event||event.name!==check.name||event.exitCode)return false;
  if(BASE.has(check.name)){
    const { pipeline, ...isolated } = check;
    try{if(legacyMatches({check:isolated},{error:false,events:[event]},{cwd:HOME,files:{},directories:[],directoryModes:{}}))return true;}catch{}
  }
  const expected=list(check.argsIncludes).map(String);
  const actual=new Set(event.args??[]);
  const flags=new Set((event.args??[]).filter(arg=>/^-[^-]/.test(arg)).flatMap(arg=>[...arg.slice(1)]));
  const equivalentPath=(candidate,arg)=>{try{return normalize({cwd:event.cwd??HOME},candidate)===normalize({cwd:HOME},arg);}catch{return false;}};
  for(const arg of expected){
    if(actual.has(arg))continue;
    if(/^-[^-]+$/.test(arg)&&[...arg.slice(1)].every(flag=>flags.has(flag)))continue;
    if((event.sources??[]).some(source=>equivalentPath(source,arg)))continue;
    if((event.args??[]).some(candidate=>!candidate.startsWith('-')&&equivalentPath(candidate,arg)))continue;
    return false;
  }
  return list(check.outputIncludes).every(value=>/^\d+$/.test(String(value))&&['wc','grep'].includes(check.name)?Number(event.output.trim().split(/\s+/)[0])===Number(value):String(event.output).includes(String(value)));
}
function stateRequirements(check,shell){
  return list(check.files).every(requirement=>{
    const path=normalize(shell,requirement.path),file=shell.files[path];
    return !!file&&(requirement.equals===undefined||file.content===requirement.equals)&&list(requirement.contains).every(value=>file.content.includes(String(value)))&&['mode','owner','group'].every(key=>requirement[key]===undefined||String(file[key])===String(requirement[key]));
  })&&list(check.services).every(requirement=>{
    const service=shell.services[requirement.name]??shell.services[requirement.name+'.service'];
    return !!service&&(requirement.active===undefined||service.active===requirement.active);
  });
}
export function matchesObjective(objective,result,shell){
  if(!objective||!result||!Array.isArray(result.events))return false;
  const check=objective.check??objective;const path=check.path?normalize(shell,check.path):null;
  // Intentionally capturing stderr is a real file outcome, while the originating command remains failed.
  if(result.error&&(!['file','write'].includes(check.type)||!result.events.some(event=>event.type==='write'&&event.path===path&&event.stream==='stderr')))return false;
  const contains=(content,needles)=>list(needles).every(value=>String(content??'').includes(String(value)));
  const commands=result.events.filter(event=>event.type==='command'&&!event.exitCode);
  switch(check.type){
    case'command':return stateRequirements(check,shell)&&commands.some((event,index)=>{const preceding=list(check.pipeline);return commandMatch(check,event)&&list(check.after).every(required=>commands.slice(0,index).some(prior=>commandMatch(required,prior)))&&index>=preceding.length&&(!preceding.length||event.usesInput)&&preceding.every((required,offset)=>{const prior=commands[index-preceding.length+offset];return !prior.redirected&&(offset===0||prior.usesInput)&&commandMatch(required,prior);});});
    case'read':{
      const observations=new Set(['cat','less','head','tail','grep','sed','cut','awk','sort','uniq','Get-Content']);
      return result.events.some(event=>event.type==='read'&&event.path===path&&contains(event.content,check.contains))&&commands.some(event=>observations.has(event.name)&&!event.redirected&&!event.piped&&!event.hidden&&(event.sources??[]).includes(path)&&contains(event.output,check.contains)&&(event.output.length>0||shell.files[path]?.content===''));
    }
    case'write':return result.events.some(event=>event.type==='write'&&event.path===path&&contains(event.content,check.contains))&&Object.hasOwn(shell.files,path)&&contains(shell.files[path].content,check.contains);
    case'file':return Object.hasOwn(shell.files,path)&&contains(shell.files[path].content,check.contains)&&(check.equals===undefined||shell.files[path].content===check.equals)&&(check.mode===undefined||shell.files[path].mode===String(check.mode))&&(check.owner===undefined||shell.files[path].owner===check.owner)&&(check.group===undefined||shell.files[path].group===check.group)&&result.events.some(event=>event.path===path&&['write','permission','ownership','read'].includes(event.type));
    case'mode':case'permission':{const mode=String(check.value??check.mode);return String(shell.files[path]?.mode??shell.directoryModes[path])===mode&&result.events.some(event=>event.type==='permission'&&event.path===path&&event.mode===mode);}
    case'exists':return exists(shell,path)&&result.events.some(event=>event.path===path||event.destination===path);
    case'directory':return directory(shell,path)&&result.events.some(event=>event.path===path&&['directory','directory-change'].includes(event.type));
    case'absent':return !exists(shell,path)&&result.events.some(event=>event.type==='remove'&&event.path===path);
    default:return legacyMatches(objective,result,shell);
  }
}
