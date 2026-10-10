import test from 'node:test';
import assert from 'node:assert/strict';
import { createShell, execute, matchesObjective } from '../src/engine.js';
import { missions } from '../src/curriculum.js';

const FIXTURES = {
  '/home/trainee/readme.txt': 'Keep the original evidence.\n',
  '/home/trainee/.secret': { content: 'quiet signal\n', mode: '600' },
  '/var/log/auth.log': 'INFO healthy 192.0.2.1\nAUTH_FAIL fox 192.0.2.8\nAUTH_FAIL fox 192.0.2.8\nAUTH_FAIL owl 192.0.2.9\n',
  '/tmp/.cache/signal.key': { content: 'RELAY-8088\n', mtime: 5 },
  '/tmp/old.txt': { content: 'old note\n', mtime: 90 },
};

async function success(shell, command) {
  const result = await execute(shell, command);
  assert.equal(result.error, false, `${command}: ${result.output}`);
  return result;
}

test('fixtures create virtual parent directories without sharing caller-owned objects', async () => {
  const fixture = { content: 'original', mode: '640', mtime: 12 };
  const shell = createShell({ '/deep/nested/file.txt': fixture });
  assert.equal(shell.cwd, '/home/trainee');
  assert.ok(shell.directories.includes('/deep/nested'));
  await success(shell, 'echo changed > /deep/nested/file.txt');
  assert.equal(fixture.content, 'original');
  assert.equal(shell.files['/deep/nested/file.txt'].mode, '640');
  assert.throws(() => createShell({ '/a': 'file', '/a/b': 'child' }), /both a file and a directory/);
});

test('navigation, hidden listings and permission listings behave like terminal basics', async () => {
  const shell = createShell(FIXTURES);
  assert.equal((await success(shell, 'pwd')).output, '/home/trainee\n');
  assert.equal((await success(shell, 'whoami')).output, 'trainee\n');
  assert.equal((await success(shell, 'ls')).output, 'readme.txt\n');
  const listed = await success(shell, 'ls -al');
  assert.match(listed.output, /-rw-------.*\.secret/);
  assert.match(listed.output, /drwxr-xr-x.* \.\n/);
  await success(shell, 'cd /tmp/.cache');
  assert.equal((await success(shell, 'cat ./signal.key')).output, 'RELAY-8088\n');
  await success(shell, 'cd ../../../home/trainee');
  assert.equal(shell.cwd, '/home/trainee');
  await success(shell, 'cd /');
  await success(shell, 'cd ~');
  assert.equal(shell.cwd, '/home/trainee');
});

test('quoted operators, escaped spaces and mixed quoting are plain content', async () => {
  const shell = createShell();
  await success(shell, 'echo "a > b | c" > "field notes.txt"');
  assert.equal(shell.files['/home/trainee/field notes.txt'].content, 'a > b | c\n');
  const quoted = await success(shell, "echo 'single > |' \"double > |\" plain\\ word pre\"fix\" | cat");
  assert.equal(quoted.output, 'single > | double > | plain word prefix\n');
  assert.equal((await success(shell, 'echo ""')).output, '\n');
  await success(shell, 'echo "line one\nline two" > multiline.txt');
  assert.equal(shell.files['/home/trainee/multiline.txt'].content, 'line one\nline two\n');
});

test('malformed and unsupported syntax is rejected before any filesystem side effects', async () => {
  const shell = createShell(FIXTURES);
  const before = JSON.stringify(shell.files);
  for (const command of [
    'echo bad > readme.txt |',
    'echo bad > readme.txt > other.txt',
    'echo bad >',
    'echo "unfinished > readme.txt',
    'echo bad > readme.txt ; whoami',
    'echo bad > readme.txt && whoami',
    'echo $(whoami) > readme.txt',
    'echo "$(whoami)" > readme.txt',
    'echo `whoami` > readme.txt',
    'echo bad > readme.txt | sudo cat',
    'echo bad > readme.txt | ls --delete',
    'echo bad > readme.txt\nwhoami',
  ]) {
    const result = await execute(shell, command);
    assert.equal(result.error, true, command);
    assert.deepEqual(result.events, [], command);
    assert.equal(JSON.stringify(shell.files), before, command);
  }
});

test('all filesystem access stays in the virtual map', async () => {
  const shell = createShell();
  const result = await execute(shell, 'cat /etc/passwd');
  assert.equal(result.error, true);
  assert.match(result.output, /No such file/);
  assert.deepEqual(result.events, []);
  await success(shell, 'cd /');
  await success(shell, 'mkdir sandbox');
  await success(shell, 'echo safe > /sandbox/file');
  assert.equal(shell.files['/sandbox/file'].content, 'safe\n');
});

test('failed reads cannot satisfy objectives and listings are not read evidence', async () => {
  const shell = createShell(FIXTURES);
  const objective = { check: { type: 'read', path: '/home/trainee/readme.txt' } };
  const listing = await success(shell, 'ls readme.txt');
  assert.equal(matchesObjective(objective, listing, shell), false);
  const result = await execute(shell, 'cat readme.txt missing.txt');
  assert.equal(result.error, true);
  assert.equal(matchesObjective(objective, result, shell), false);
  assert.deepEqual(result.events, []);
  const read = await success(shell, 'cat readme.txt');
  assert.equal(matchesObjective(objective, read, shell), true);
});

test('pipe processing records each actual successful command and retains blank lines', async () => {
  const shell = createShell(FIXTURES);
  const result = await success(shell, "grep AUTH_FAIL /var/log/auth.log | awk '{print $NF}' | sort | uniq -c");
  assert.equal(result.output, '      2 192.0.2.8\n      1 192.0.2.9\n');
  assert.deepEqual(result.events.filter(event => event.type === 'command').map(event => event.name), ['grep', 'awk', 'sort', 'uniq']);
  assert.equal(matchesObjective({ type: 'command', name: 'uniq', argsIncludes: ['-c'], outputIncludes: ['2 192.0.2.8'] }, result, shell), true);
  const count = await success(shell, 'grep AUTH_FAIL /var/log/auth.log | wc -l');
  assert.equal(count.output, '3\n');
  assert.equal(matchesObjective({ check: { type: 'command', name: 'wc', argsIncludes: ['-l'], outputIncludes: ['3'] } }, count, shell), true);
  await success(shell, 'echo "a\n\nb" > blank.txt');
  assert.equal((await success(shell, 'head -n 2 blank.txt')).output, 'a\n\n');
  assert.equal((await success(shell, 'tail -0 blank.txt')).output, '');
  await success(shell, 'echo -n "a\nb" > no-newline.txt');
  assert.equal((await success(shell, 'tail -1 no-newline.txt')).output, 'b');
  assert.equal((await success(shell, 'head -n 2 no-newline.txt')).output, 'a\nb');
});

test('grep accepts case and line flags and treats no match as unsuccessful evidence', async () => {
  const shell = createShell({ '/home/trainee/status': 'ok\nWARNING check\nwarning again\n' });
  assert.equal((await success(shell, 'grep -in warning status')).output, '2:WARNING check\n3:warning again\n');
  const result = await execute(shell, 'grep missing status');
  assert.equal(result.error, true);
  assert.deepEqual(result.events, []);
  assert.equal(matchesObjective({ type: 'command', name: 'grep' }, result, shell), false);
});

test('grep supports bounded basic patterns and find wildcards cannot backtrack exponentially', async () => {
  const shell = createShell({
    '/home/trainee/patterns': 'AUTH_FAIL 9\naaaab\n(a+)+\n',
    '/home/trainee/adversarial': 'a'.repeat(1000) + '!\n',
    ['/home/trainee/' + 'a'.repeat(80)]: 'fixture',
  });
  assert.equal((await success(shell, 'grep "^AUTH_.*[0-9]$" patterns')).output, 'AUTH_FAIL 9\n');
  assert.equal((await success(shell, 'grep "^a*b$" patterns')).output, 'aaaab\n');
  assert.equal((await success(shell, "grep '(a+)+$' patterns")).output, '(a+)+\n');
  assert.equal((await execute(shell, "grep '(a+)+$' adversarial")).error, true);
  assert.equal((await execute(shell, "grep 'a.*.*.*.*.*.*.*.*.*.*.*.*b' adversarial")).error, true);
  const globResult = await success(shell, 'find . -name "' + '*a'.repeat(18) + 'b"');
  assert.equal(globResult.output, '');
});

test('find filters type, glob and modification time without pretending to read files', async () => {
  const shell = createShell(FIXTURES);
  const recent = await success(shell, 'find /tmp -type f -mmin -30');
  assert.equal(recent.output, '/tmp/.cache/signal.key\n');
  assert.equal(recent.events.some(event => event.type === 'read'), false);
  assert.equal((await success(shell, 'find /tmp -type f -name "*.txt"')).output, '/tmp/old.txt\n');
  assert.equal((await success(shell, 'find /tmp -type d')).output, '/tmp\n/tmp/.cache\n');
  assert.equal((await success(shell, 'find /tmp -mmin +30')).output, '/tmp/old.txt\n');
  assert.equal((await execute(shell, 'find /tmp -type f -delete')).error, true);
});

test('redirection appends and tee preserves output plus the evidence artifact', async () => {
  const shell = createShell(FIXTURES);
  const saved = await success(shell, 'find /tmp -type f -mmin -30 > report.txt');
  assert.equal(saved.output, '');
  assert.equal(matchesObjective({ type: 'write', path: '/home/trainee/report.txt', contains: ['signal.key'] }, saved, shell), true);
  await success(shell, 'echo "review required" >> report.txt');
  assert.equal(shell.files['/home/trainee/report.txt'].content, '/tmp/.cache/signal.key\nreview required\n');
  const tee = await success(shell, 'ss -tuln | tee ports.txt');
  assert.match(tee.output, /8088/);
  assert.equal(shell.files['/home/trainee/ports.txt'].content, tee.output);
  assert.equal(matchesObjective({ type: 'write', path: '/home/trainee/ports.txt', contains: ['8088', '22'] }, tee, shell), true);
  await success(shell, 'echo additional | tee -a ports.txt');
  assert.match(shell.files['/home/trainee/ports.txt'].content, /additional\n$/);
});

test('touch, copying and moving keep original evidence and stored file permissions', async () => {
  const shell = createShell(FIXTURES);
  await success(shell, 'touch readme.txt');
  assert.equal(shell.files['/home/trainee/readme.txt'].content, FIXTURES['/home/trainee/readme.txt']);
  await success(shell, 'mkdir evidence');
  await success(shell, 'cp .secret evidence');
  assert.equal(shell.files['/home/trainee/evidence/.secret'].mode, '600');
  await success(shell, 'mv evidence/.secret evidence/signal.txt');
  assert.equal(shell.files['/home/trainee/evidence/.secret'], undefined);
  assert.equal(shell.files['/home/trainee/evidence/signal.txt'].content, 'quiet signal\n');
  assert.equal(shell.files['/home/trainee/.secret'].content, 'quiet signal\n');
  const snapshot = JSON.stringify(shell.files);
  assert.equal((await execute(shell, 'cp readme.txt readme.txt')).error, true);
  assert.equal((await execute(shell, 'cp evidence archive')).error, true);
  assert.equal(JSON.stringify(shell.files), snapshot);
});

test('mkdir -p and directory moves update nested paths and current working directory', async () => {
  const shell = createShell();
  const made = await success(shell, 'mkdir -p case/notes');
  assert.equal(matchesObjective({ type: 'directory', path: '/home/trainee/case/notes' }, made, shell), true);
  await success(shell, 'echo report > case/notes/report');
  await success(shell, 'cd case/notes');
  await success(shell, 'mv /home/trainee/case /home/trainee/archive');
  assert.equal(shell.cwd, '/home/trainee/archive/notes');
  assert.equal(shell.files['/home/trainee/archive/notes/report'].content, 'report\n');
  assert.equal((await execute(shell, 'mv /home/trainee/archive /home/trainee/archive/sub')).error, true);
  assert.equal((await execute(shell, 'mv / archive')).error, true);
  assert.ok(shell.directories.includes('/'));
});

test('permission objectives require a successful permission effect', async () => {
  const shell = createShell(FIXTURES);
  const check = { type: 'permission', path: '/home/trainee/readme.txt', mode: '600' };
  assert.equal(matchesObjective(check, await success(shell, 'ls -l'), shell), false);
  const result = await success(shell, 'chmod 600 readme.txt');
  assert.equal(matchesObjective(check, result, shell), true);
  assert.match((await success(shell, 'ls -l readme.txt')).output, /^-rw-------/);
  assert.equal((await execute(shell, 'chmod 777 readme.txt')).error, true);
  assert.equal(shell.files['/home/trainee/readme.txt'].mode, '600');
  await success(shell, 'mkdir private');
  const directory = await success(shell, 'chmod 700 private');
  assert.equal(matchesObjective({ type: 'permission', path: '/home/trainee/private', mode: '700' }, directory, shell), true);
});

test('SHA-256 is a real UTF-8 digest and preserves file contents', async () => {
  const shell = createShell({ '/home/trainee/payload': 'abc' });
  const result = await success(shell, 'sha256sum payload');
  assert.equal(result.output, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  payload\n');
  assert.equal(matchesObjective({ type: 'read', path: '/home/trainee/payload' }, result, shell), true);
  await success(shell, 'sha256sum payload > checksum.txt');
  assert.equal(shell.files['/home/trainee/payload'].content, 'abc');
});

test('base64 encodes and decodes UTF-8; malformed data never writes a destination', async () => {
  const shell = createShell({ '/home/trainee/payload': 'Trail 🌲\n' });
  const original = shell.files['/home/trainee/payload'].content;
  await success(shell, 'base64 payload > encoded.txt');
  const decoded = await success(shell, 'base64 -d encoded.txt');
  assert.equal(decoded.output, original);
  assert.equal((await success(shell, 'echo -n abc | base64')).output, 'YWJj\n');
  const result = await execute(shell, 'echo "not base64!" | base64 -d > damaged.txt');
  assert.equal(result.error, true);
  assert.equal(shell.files['/home/trainee/damaged.txt'], undefined);
  assert.deepEqual(result.events, []);
});

test('simulated network commands only accept documented lab destinations', async () => {
  const shell = createShell();
  assert.match((await success(shell, 'nslookup example.test')).output, /192\.0\.2\.10/);
  assert.match((await success(shell, 'ping -c 2 academy.test')).output, /2 packets transmitted, 2 received/);
  assert.match((await success(shell, 'curl -I https://academy.test')).output, /HTTP\/2 200/);
  for (const command of ['curl -I https://google.com', 'curl -I http://example.test', 'curl -I https://example.test.evil/', 'nslookup localhost', 'ping -c 99 example.test', 'ping 127.0.0.1']) {
    assert.equal((await execute(shell, command)).error, true, command);
  }
  assert.match((await success(shell, 'ss -tuln')).output, /8088/);
  assert.match((await success(shell, 'ps aux')).output, /relay-agent --port 8088/);
  const custom = createShell({ '/etc/network.txt': 'custom socket fixture\n' });
  assert.equal((await success(custom, 'ss -tuln')).output, 'custom socket fixture\n');
});

test('objectives check structured effects rather than words typed or stale artifacts', async () => {
  const shell = createShell(FIXTURES);
  const echo = await success(shell, 'echo "cat readme.txt chmod 600 readme.txt"');
  assert.equal(matchesObjective({ type: 'read', path: '/home/trainee/readme.txt' }, echo, shell), false);
  assert.equal(matchesObjective({ type: 'permission', path: '/home/trainee/readme.txt', mode: '600' }, echo, shell), false);
  assert.equal(matchesObjective({ type: 'command', name: 'cat' }, echo, shell), false);
  await success(shell, 'echo saved > report.txt');
  assert.equal(matchesObjective({ type: 'write', path: '/home/trainee/report.txt', contains: ['saved'] }, await success(shell, 'pwd'), shell), false);
  assert.equal(matchesObjective({ type: 'decision', value: 'report' }, { error: false, events: [{ type: 'decision', value: 'report' }] }, shell), true);
});

test('failed pipelines roll back directory, mode and file changes together', async () => {
  const shell = createShell(FIXTURES);
  const files = JSON.stringify(shell.files), directories = [...shell.directories];
  const failed = await execute(shell, 'mkdir evidence | chmod 600 readme.txt | cat missing');
  assert.equal(failed.error, true);
  assert.equal(JSON.stringify(shell.files), files);
  assert.deepEqual(shell.directories, directories);
  assert.deepEqual(failed.events, []);
});

test('asynchronous hashes serialize with subsequent writes instead of losing filesystem changes', async () => {
  const shell = createShell({ '/home/trainee/data': 'abc' });
  const [hash, write] = await Promise.all([execute(shell, 'sha256sum data > checksum'), execute(shell, 'echo later > notes')]);
  assert.equal(hash.error, false);
  assert.equal(write.error, false);
  assert.ok(shell.files['/home/trainee/checksum']);
  assert.equal(shell.files['/home/trainee/notes'].content, 'later\n');
});

test('resource limits preserve storage-compatible files and bounded command history', async () => {
  const shell = createShell({ '/home/trainee/large': 'x'.repeat(32760) });
  const result = await execute(shell, 'echo "too many characters" >> large');
  assert.equal(result.error, true);
  assert.equal(shell.files['/home/trainee/large'].content.length, 32760);
  assert.equal((await execute(shell, 'echo ' + 'x'.repeat(2050))).error, true);
  assert.equal(shell.history.at(-1).length, 2048);
  assert.equal((await execute(shell, 'touch ' + 'a'.repeat(241))).error, true);
  assert.equal((await execute(shell, 'echo "AA==" | base64 -d > binary')).error, true);
  assert.equal(shell.files['/home/trainee/binary'], undefined);
  for (let i = 0; i < 102; i++) await execute(shell, 'pwd');
  assert.equal(shell.history.length, 100);
});

test('every Hike Trail mission can complete all objectives using its documented solutions', async () => {
  for (const mission of missions) {
    const shell = createShell(mission.fixtures), completed = new Set();
    for (const solution of mission.solutions) {
      const result = await success(shell, solution);
      mission.objectives.forEach((objective, index) => {
        if (matchesObjective(objective, result, shell)) completed.add(index);
      });
    }
    const selected = mission.decision.options.find(option => option.correct);
    assert.ok(selected, `${mission.id} needs a correct decision.`);
    const decision = { output: '', error: false, events: [{ type: 'decision', value: selected.id }] };
    mission.objectives.forEach((objective, index) => {
      if (matchesObjective(objective, decision, shell)) completed.add(index);
    });
    assert.deepEqual(
      mission.objectives.filter((objective, index) => !completed.has(index)).map(objective => objective.id),
      [],
      `${mission.id} has objectives that its solutions cannot complete.`,
    );
  }
});
