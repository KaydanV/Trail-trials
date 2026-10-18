import test from 'node:test';
import assert from 'node:assert/strict';
import { createShell, execute, matchesObjective } from '../shell.js';
import { missions as originalMissions } from '../../src/curriculum.js';

const fixture = () => createShell({
  'briefing.txt': 'SIGNAL READY\nERROR denied\nWARN delayed\nerror lower\n',
  'counts.txt': '3 owl\n13 fox\n2 bear\n',
  'names.csv': 'name,role,relay\nNova,ranger,pine\nPatch,robot,owl\n',
  'private.txt': { content: 'Archive record\n', mode: '666', owner: 'bramble', group: 'rangers' },
});
async function ok(shell, command, expected) {
  const result = await execute(shell, command);
  assert.equal(result.error, false, `${command}: ${result.output}`);
  if (expected !== undefined) assert.equal(result.output, expected, command);
  return result;
}

test('legacy tools and facts remain available without changing the original shell', async () => {
  const shell = fixture();
  await ok(shell, 'pwd', '/home/trainee\n');
  await ok(shell, 'head -2 briefing.txt', 'SIGNAL READY\nERROR denied\n');
  await ok(shell, 'tail -n 1 briefing.txt', 'error lower\n');
  const result = await ok(shell, 'cat briefing.txt | head -n 2');
  assert.equal(matchesObjective({ type: 'command', name: 'head', argsIncludes: ['-2', 'briefing.txt'] }, result, shell), true);
  assert.equal(result.events.some(event => event.path === '/.living-valley-stdin'), false);
  assert.equal(Object.hasOwn(shell.files, '/.living-valley-stdin'), false);
});

test('grep counts matching lines, extended alternation, numbering and inverse matches', async () => {
  const shell = fixture();
  await ok(shell, 'grep -c -i error briefing.txt', '2\n');
  await ok(shell, 'grep -En "ERROR|WARN" briefing.txt', '2:ERROR denied\n3:WARN delayed\n');
  await ok(shell, 'grep -E "(ERROR|WARN) [a-z]+" briefing.txt', 'ERROR denied\nWARN delayed\n');
  await ok(shell, 'grep -v -i error briefing.txt', 'SIGNAL READY\nWARN delayed\n');
  assert.equal((await execute(shell, 'grep -c ABSENT briefing.txt')).output, '0\n');
  assert.equal((await execute(shell, 'grep -c ABSENT briefing.txt')).exitCode, 1);
});

test('bounded regular expressions support anchors, classes, optional atoms and repetition', async () => {
  const shell = createShell({ 'rows.txt': 'aaab\nab\nb\nzero\naabX\n' });
  await ok(shell, 'grep -E "^a+b$" rows.txt', 'aaab\nab\n');
  await ok(shell, 'grep -E "^a?b$" rows.txt', 'ab\nb\n');
  await ok(shell, 'grep "^a*b$" rows.txt', 'aaab\nab\nb\n');
  await ok(shell, 'grep -E "^[a-z]+X$" rows.txt', 'aabX\n');
  assert.equal((await execute(shell, 'grep -E "(a+)+$" rows.txt')).error, true);
  assert.equal((await execute(shell, 'grep -E "[bad" rows.txt')).error, true);
});

test('adversarial patterns stop within a finite search budget', async () => {
  const shell = createShell({ 'long.txt': 'a'.repeat(20000) + 'X\n' });
  const result = await execute(shell, `grep "${'a*'.repeat(100)}Z" long.txt`);
  assert.equal(result.error, true);
  assert.match(result.output, /budget|simpler/);
});

test('numeric reverse sorting and pipeline provenance solve real counts', async () => {
  const shell = fixture();
  const result = await ok(shell, 'sort -rn counts.txt | head -1', '13 fox\n');
  const final = result.events.filter(event => event.type === 'command').at(-1);
  assert.deepEqual(final.sources, ['/home/trainee/counts.txt']);
  assert.equal(matchesObjective({ type: 'command', name: 'head', argsIncludes: ['-n', '1'], outputIncludes: ['13 fox'], pipeline: [{ name: 'sort', argsIncludes: ['-n', '-r', 'counts.txt'] }] }, result, shell), true);
});

test('command checks do not turn thirteen into an expected count of three', async () => {
  const shell = createShell({ 'log.txt': 'hit\n'.repeat(13) });
  const result = await ok(shell, 'grep -c hit log.txt', '13\n');
  assert.equal(matchesObjective({ type: 'command', name: 'grep', argsIncludes: ['-c', 'hit', 'log.txt'], outputIncludes: ['3'] }, result, shell), false);
});

test('cut selects fields and characters, preserving untouched delimiter-free lines', async () => {
  const shell = fixture();
  await ok(shell, 'cut -d , -f 1,3 names.csv', 'name,relay\nNova,pine\nPatch,owl\n');
  await ok(shell, 'cut -c 1-3 counts.txt', '3 o\n13 \n2 b\n');
  assert.equal((await execute(shell, 'cut -f 1-999999 names.csv')).error, true);
});

test('sed repairs output without silently overwriting the source', async () => {
  const shell = createShell({ 'state.txt': 'OFFLINE OFFLINE\nREADY\n' });
  await ok(shell, "sed 's/OFFLINE/ONLINE/g' state.txt > repaired.txt", '');
  await ok(shell, 'cat repaired.txt', 'ONLINE ONLINE\nREADY\n');
  assert.equal(shell.files['/home/trainee/state.txt'].content, 'OFFLINE OFFLINE\nREADY\n');
  await ok(shell, "sed -n '2p' state.txt", 'READY\n');
  await ok(shell, "sed '1d' state.txt", 'READY\n');
  assert.equal((await execute(shell, "sed -i 's/OFFLINE/ONLINE/' state.txt")).error, true);
});

test('permission and ownership listings reflect actual mutated metadata', async () => {
  const shell = fixture();
  const changed = await ok(shell, 'chmod u=rw,go= private.txt');
  assert.equal(shell.files['/home/trainee/private.txt'].mode, '600');
  assert.equal(matchesObjective({ type: 'mode', path: '/home/trainee/private.txt', value: '600' }, changed, shell), true);
  assert.equal(matchesObjective({ type: 'file', path: '/home/trainee/private.txt', mode: '600' }, changed, shell), true);
  await ok(shell, 'chmod u+x private.txt');
  const listing = await ok(shell, 'ls -l private.txt');
  assert.match(listing.output, /-rwx------ bramble rangers/);
  await ok(shell, 'chmod 640 private.txt');
  assert.equal(shell.files['/home/trainee/private.txt'].mode, '640');
});

test('sudo cannot invent authorization, open a root shell or alter protected ownership', async () => {
  const shell = fixture();
  for (const command of ['chown root private.txt', 'sudo chown root private.txt', 'sudo -i', 'sudo bash', 'su', 'sudo rm private.txt']) {
    assert.equal((await execute(shell, command)).error, true, command);
  }
  assert.equal(shell.files['/home/trainee/private.txt'].owner, 'bramble');
  const authorized = createShell({ 'private.txt': 'Record\n' }, { authorizedActions: ['chown:/home/trainee/private.txt', 'chgrp:/home/trainee/private.txt'] });
  await ok(authorized, 'sudo chown bramble:rangers private.txt');
  assert.equal(authorized.files['/home/trainee/private.txt'].owner, 'bramble');
  await ok(authorized, 'chgrp keepers private.txt');
  await ok(authorized, 'touch private.txt');
  await ok(authorized, 'echo UPDATED | tee private.txt');
  assert.match((await ok(authorized, 'ls -l private.txt')).output, /bramble keepers/);
});

test('file removal is explicit, bounded and cannot recursively destroy scenario evidence', async () => {
  const shell = fixture();
  await ok(shell, 'mkdir scratch');
  await ok(shell, 'touch scratch/spare.txt');
  assert.equal((await execute(shell, 'rmdir scratch')).error, true);
  assert.equal((await execute(shell, 'rm -rf /')).error, true);
  assert.equal((await execute(shell, 'rm briefing.txt /var/log/auth.log')).error, true);
  assert.ok(shell.files['/home/trainee/briefing.txt'], 'failed pipeline must retain the first file');
  const removed = await ok(shell, 'rm scratch/spare.txt');
  assert.equal(matchesObjective({ type: 'absent', path: '/home/trainee/scratch/spare.txt' }, removed, shell), true);
  await ok(shell, 'rmdir scratch');
  assert.equal(shell.directories.includes('/home/trainee/scratch'), false);
  const restricted = createShell({ '/var/log/auth.log': 'preserve me\n' });
  assert.equal((await execute(restricted, 'rm /var/log/auth.log')).error, true);
});

test('process tools reveal real simulated state and only allow scoped termination', async () => {
  const shell = createShell({}, { processes: [{ pid: 809, user: 'service', command: 'relay-agent', cpu: 85, memory: 30 }, { pid: 1, user: 'root', command: 'init', protected: true }], authorizedActions: ['kill:809', 'kill:1'] });
  assert.match((await ok(shell, 'top -b -n 1')).output, /service 809 85 30 relay-agent/);
  assert.equal((await execute(shell, 'kill 1')).error, true);
  await ok(shell, 'kill -TERM 809');
  assert.doesNotMatch((await ok(shell, 'ps aux')).output, /809/);
});

test('services, service journals and disk snapshots use authored scenario state', async () => {
  const shell = createShell({ 'cache/one.txt': 'cache\n' }, { services: { 'relay.service': { active: false, description: 'Observatory relay', log: 'Cache invalid\n' } }, disk: { total: 100, used: 94, mount: '/' }, authorizedActions: ['service:relay.service:restart'] });
  assert.match((await ok(shell, 'systemctl status relay')).output, /inactive \(dead\)/);
  assert.equal((await execute(shell, 'systemctl start relay')).error, true);
  await ok(shell, 'sudo systemctl restart relay.service');
  assert.match((await ok(shell, 'systemctl status relay')).output, /active \(running\)/);
  assert.match((await ok(shell, 'journalctl -u relay.service -n 1')).output, /Authorized restart/);
  assert.match((await ok(shell, 'df -h')).output, /94%/);
  await ok(shell, 'du -sh cache', '1K\tcache\n');
});

test('network responses are configured fictional fixtures, including unavailable systems', async () => {
  const shell = createShell({}, { hosts: { 'relay.valley.test': '10.24.5.20' }, network: { address: '10.24.5.12/24', gateway: '10.24.5.1', dns: '10.24.5.53' }, probes: { 'relay.valley.test': { reachable: true, hops: ['10.24.5.1', '10.24.5.20'], status: 200, body: 'Relay ready\n' }, 'dark.valley.test': { address: '10.24.5.21', reachable: false } } });
  assert.match((await ok(shell, 'ip addr')).output, /10\.24\.5\.12\/24/);
  assert.match((await ok(shell, 'ip route')).output, /default via 10\.24\.5\.1/);
  assert.match((await ok(shell, 'nslookup relay.valley.test')).output, /10\.24\.5\.53/);
  assert.match((await ok(shell, 'ping -c1 relay.valley.test')).output, /1 packets transmitted, 1 received/);
  assert.match((await ok(shell, 'traceroute relay.valley.test')).output, /2  10\.24\.5\.20/);
  await ok(shell, 'curl -s https://relay.valley.test/', 'Relay ready\n');
  assert.match((await ok(shell, 'curl -I https://academy.test')).output, /HTTP\/2 200/);
  assert.match((await ok(shell, 'ping -c 1 dark.valley.test')).output, /100% packet loss/);
  for (const command of ['curl https://google.com', 'ping 127.0.0.1', 'nslookup localhost', 'curl file:///etc/passwd', 'curl https://name:password@academy.test']) assert.equal((await execute(shell, command)).error, true, command);
});

test('variables honor literal single quotes and cannot inject command operators', async () => {
  const shell = fixture();
  await ok(shell, "NAME=Patch; echo \"$NAME\"; echo '$NAME'", 'Patch\n$NAME\n');
  await ok(shell, 'export PLACE="Owl archive"; echo "${PLACE}"', 'Owl archive\n');
  await ok(shell, "PAYLOAD='hello; rm briefing.txt'; echo \"$PAYLOAD\"", 'hello; rm briefing.txt\n');
  assert.ok(shell.files['/home/trainee/briefing.txt']);
  await ok(shell, 'echo "\\$NAME"', '$NAME\n');
  assert.equal((await execute(shell, `HUGE='${'x'.repeat(2049)}'`)).error, true);
  assert.equal(Object.hasOwn(shell.variables, 'HUGE'), false);
});

test('export controls child inheritance and child variables or directory changes do not leak back', async () => {
  const shell=createShell({'scripts/check.sh':'echo "STATION=$STATION LOCAL=$LOCAL"\nSTATION=CHANGED\ncd scripts\necho CHILD > result.txt\n'});
  await ok(shell,'STATION="Pine Relay"; LOCAL=private');
  await ok(shell,'bash scripts/check.sh','STATION= LOCAL=\n');
  await ok(shell,'export STATION');
  await ok(shell,'bash scripts/check.sh','STATION=Pine Relay LOCAL=\n');
  assert.equal(shell.variables.STATION,'Pine Relay');
  assert.equal(shell.cwd,'/home/trainee');
  assert.equal(shell.files['/home/trainee/scripts/result.txt'].content,'CHILD\n');
  assert.equal(shell.exported.includes('LOCAL'),false);
  await ok(shell,'export LOCAL=visible');
  await ok(shell,'bash scripts/check.sh','STATION=Pine Relay LOCAL=visible\n');
});

test('direct script execution needs an x bit while bash can interpret the script without that bit', async () => {
  const shell=createShell({'hello.sh':'echo HELLO\n'});
  assert.equal((await execute(shell,'./hello.sh')).error,true);
  await ok(shell,'chmod u+x hello.sh');
  await ok(shell,'./hello.sh','HELLO\n');
});

test('success-only sequencing does not run failed branches and resumes after semicolons', async () => {
  const shell = fixture();
  await ok(shell, 'false && echo WRONG && echo ALSO_WRONG; echo NEXT', 'NEXT\n');
  await ok(shell, 'true && echo READY', 'READY\n');
  assert.equal((await execute(shell, 'echo READY &&')).error, true);
});

test('conditional outcome checks require the successful evidence check before the final action', async () => {
  const shell = createShell({ 'approvals.txt': 'CHG-42 APPROVED\n' });
  const check = { type: 'command', name: 'echo', argsIncludes: ['READY'], after: { name: 'grep', argsIncludes: ['CHG-42 APPROVED', 'approvals.txt'] } };
  assert.equal(matchesObjective(check, await ok(shell, 'echo READY'), shell), false);
  assert.equal(matchesObjective(check, await ok(shell, 'grep "CHG-42 APPROVED" approvals.txt && echo READY'), shell), true);
  assert.equal(matchesObjective(check, await ok(shell, 'echo READY; grep "CHG-42 APPROVED" approvals.txt'), shell), false);
});

test('repair verification accepts separate actions and alternate safe methods while checking actual file and service outcomes', async () => {
  const make=()=>createShell({'configs/relay.conf':'relay=disabled\n','recover.sh':'echo relay=enabled > configs/relay.conf\nsystemctl start relay.service\n'}, {services:{'relay.service':{active:false,description:'Valley relay'}},authorizedActions:['service:relay.service:start']});
  const check={type:'command',name:'systemctl',argsIncludes:['status','relay.service'],outputIncludes:['active (running)'],files:[{path:'/home/trainee/configs/relay.conf',equals:'relay=enabled\n'}],services:[{name:'relay.service',active:true}]};
  const scripted=make();
  assert.equal(matchesObjective(check,await ok(scripted,'systemctl status relay.service'),scripted),false);
  await ok(scripted,'bash recover.sh');
  assert.equal(matchesObjective(check,await ok(scripted,'systemctl status relay.service'),scripted),true);
  const manual=make();
  await ok(manual,'systemctl start relay.service');
  assert.equal(matchesObjective(check,await ok(manual,'systemctl status relay.service'),manual),false,'Service status alone cannot bypass the wrong configuration');
  await ok(manual,'echo relay=enabled > configs/relay.conf');
  assert.equal(matchesObjective(check,await ok(manual,'systemctl status relay.service'),manual),true,'An authorised manual repair is equally valid');
});

test('scripts execute real quoted variables, branches and bounded loops', async () => {
  const shell = fixture();
  await ok(shell, `echo '#!/bin/bash
NAME=Patch
for station in pine owl; do echo "$station $NAME"; done
if grep -q SIGNAL briefing.txt; then echo READY; else echo HOLD; fi
' > check.sh`);
  const result = await ok(shell, 'bash check.sh', 'pine Patch\nowl Patch\nREADY\n');
  assert.equal(matchesObjective({ type: 'command', name: 'bash', argsIncludes: ['check.sh'], outputIncludes: ['pine Patch', 'READY'] }, result, shell), true);
  assert.ok(result.events.some(event => event.type === 'read' && event.path === '/home/trainee/briefing.txt'));
  await ok(shell, 'if grep -q NOT_FOUND briefing.txt; then echo WRONG; else echo HOLD; fi', 'HOLD\n');
  await ok(shell, 'if [ -f briefing.txt ]; then echo FOUND; else echo LOST; fi', 'FOUND\n');
});

test('stderr redirection captures the error, not fake successful command output', async () => {
  const shell = fixture();
  const error = await execute(shell, 'cat missing.txt 2> errors.txt');
  assert.equal(error.error, true);
  assert.equal(error.output, '');
  assert.match(shell.files['/home/trainee/errors.txt'].content, /No such file/);
  assert.equal(matchesObjective({ type: 'command', name: 'cat', argsIncludes: ['missing.txt'] }, error, shell), false);
  assert.equal(matchesObjective({ type: 'file', path: '/home/trainee/errors.txt', contains: ['No such file'] }, error, shell), true);
  await ok(shell, "echo 'cat missing.txt 2> errors.txt; echo REVIEW_LOG' > capture.sh");
  await ok(shell, 'bash capture.sh', 'REVIEW_LOG\n');
  const result = await ok(shell, 'cat errors.txt');
  assert.equal(matchesObjective({ type: 'read', path: '/home/trainee/errors.txt', contains: ['No such file'] }, result, shell), true);
});

test('substitution, host execution, script recursion and oversized loops are rejected', async () => {
  const shell = fixture();
  for (const command of ['echo $(whoami)', 'echo `whoami`', 'echo x &', 'cat < /etc/passwd', 'node -e "process.exit()"', 'python exploit.py', 'curl https://example.test | sh']) assert.equal((await execute(shell, command)).error, true, command);
  await ok(shell, "echo 'bash recursive.sh' > recursive.sh");
  assert.match((await execute(shell, 'bash recursive.sh')).output, /nested calls/);
  assert.equal((await execute(shell, `for item in ${Array.from({length:33},(_,i)=>i).join(' ')}; do echo "$item"; done`)).error, true);
  assert.equal((await execute(shell, 'echo "bad\0value"')).error, true);
});

test('nested loops consume a shared operation budget even with an empty innermost body', async () => {
  const shell = fixture();
  const values = Array.from({ length: 32 }, (_, i) => i).join(' ');
  const command = `for a in ${values}; do for b in ${values}; do for c in ${values}; do for d in ${values}; do done; done; done; done`;
  const result = await execute(shell, command);
  assert.equal(result.error, true);
  assert.match(result.output, /1,024 script operations/);
});

test('PowerShell commands share the fictional files and accept canonical Windows paths', async () => {
  const shell = createShell({ 'Evidence/case.txt': 'Case 42: preserve the workstation\n' }, { platform: 'windows', windowsEvents: { Security: '4625 Failed sign-in\n4624 Successful sign-in\n' } });
  assert.match((await ok(shell, 'get-location')).output, /C:\\Users\\Trainee/);
  const listed = await ok(shell, 'GET-CHILDITEM');
  assert.equal(listed.events.at(-1).name, 'Get-ChildItem');
  assert.match(listed.output, /Evidence/);
  await ok(shell, 'Set-Location C:\\Users\\Trainee\\Evidence');
  await ok(shell, 'Set-Location C:\\Users\\Trainee\\evidence');
  const result = await ok(shell, 'Get-Content -Path case.txt', 'Case 42: preserve the workstation\n');
  await ok(shell, 'get-content CASE.TXT', 'Case 42: preserve the workstation\n');
  assert.equal(matchesObjective({ type: 'read', path: '/home/trainee/Evidence/case.txt' }, result, shell), true);
  assert.match((await ok(shell, 'Get-Process')).output, /relay-agent/);
  assert.match((await ok(shell, 'Get-Service')).output, /Running relay.service/);
  await ok(shell, 'Get-WinEvent -LogName Security -MaxEvents 1', '4625 Failed sign-in\n');
});

test('manuals and help explain the simulator boundary and supported syntax', async () => {
  const shell = fixture();
  assert.match((await ok(shell, 'help')).output, /No host execution/);
  assert.match((await ok(shell, 'man grep')).output, /counts matching lines/);
  assert.match((await ok(shell, 'chmod --help')).output, /u\+x/);
  assert.match((await ok(shell, 'less briefing.txt')).output, /SIGNAL READY/);
  await ok(shell, 'id', 'uid=1000(trainee) gid=1000(trainee) groups=1000(trainee),1001(rangers)\n');
});

test('concurrent commands are serialized and preserve history and evidence', async () => {
  const shell = createShell();
  const results = await Promise.all([execute(shell, 'echo FIRST > notes.txt'), execute(shell, 'echo SECOND >> notes.txt'), execute(shell, 'cat notes.txt')]);
  assert.equal(results.every(result => !result.error), true);
  assert.equal(results.at(-1).output, 'FIRST\nSECOND\n');
  assert.equal(shell.history.length, 3);
  const history=await ok(shell,'history');
  assert.match(history.output,/1  echo FIRST > notes.txt/);
  assert.doesNotMatch(history.output,/living-valley-stdin/);
});

test('failed pipelines cannot partially alter permissions, files or variables', async () => {
  const shell = fixture();
  const before = JSON.stringify(shell.files);
  const result = await execute(shell, 'chmod 600 private.txt | unsupported-command');
  assert.equal(result.error, true);
  assert.equal(JSON.stringify(shell.files), before);
  assert.equal(matchesObjective({ type: 'mode', path: '/home/trainee/private.txt', value: '600' }, result, shell), false);
});

test('reading objectives require visible inspection rather than an internal copy, hash or hidden pipe', async () => {
  const shell = fixture();
  const check = { type: 'read', path: '/home/trainee/briefing.txt' };
  for(const command of ['cp briefing.txt copied.txt','sha256sum briefing.txt','cat briefing.txt > copied.txt','cat briefing.txt | wc -l','cp briefing.txt copied.txt | cat']){
    const result=await ok(shell,command);
    assert.equal(matchesObjective(check,result,shell),false,command);
  }
  for(const command of ['cat briefing.txt','less briefing.txt','head -n 1 briefing.txt','grep SIGNAL briefing.txt','cat briefing.txt | grep SIGNAL']){
    const result=await ok(shell,command);
    assert.equal(matchesObjective(check,result,shell),true,command);
  }
  const partial=await ok(shell,'head -1 briefing.txt');
  assert.equal(matchesObjective({...check,contains:['ERROR denied']},partial,shell),false);
  await ok(shell,"echo 'cat briefing.txt' > inspect.sh");
  assert.equal(matchesObjective(check,await ok(shell,'bash inspect.sh > copied.txt'),shell),false);
});

test('all 81 original expedition commands still produce their 79 nondecision outcomes', async () => {
  let commands=0, objectives=0;
  for(const mission of originalMissions){
    const shell=createShell(mission.fixtures),completed=new Set();
    for(const command of mission.solutions){
      const result=await ok(shell,command);commands++;
      for(const objective of mission.objectives)if(matchesObjective(objective,result,shell))completed.add(objective.id);
    }
    for(const objective of mission.objectives.filter(item=>item.check.type!=='decision')){
      assert.equal(completed.has(objective.id),true,`${mission.id}: ${objective.id}`);objectives++;
    }
  }
  assert.equal(commands,81);
  assert.equal(objectives,79);
});
