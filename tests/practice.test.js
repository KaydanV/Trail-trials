import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { missions } from '../src/curriculum.js';
import { createShell, execute, matchesObjective } from '../src/engine.js';
import { createPracticeMission, MAX_PRACTICE_VARIANT } from '../src/practice.js';

const base = id => missions.find(mission => mission.id === id);
const fixtureText = fixture => typeof fixture === 'string' ? fixture : fixture.content;
const findFixture = (mission, ending) => fixtureText(Object.entries(mission.fixtures).find(([path]) => path.endsWith(ending))[1]);

async function solve(mission) {
  const shell = createShell(mission.fixtures);
  const tasks = mission.objectives.map(() => false);
  for (const command of mission.solutions) {
    const result = await execute(shell, command);
    assert.equal(result.error, false, `${mission.id} variant ${mission.practiceVariant}: ${command}: ${result.output}`);
    mission.objectives.forEach((objective, index) => { tasks[index] ||= matchesObjective(objective, result, shell); });
  }
  const chosen = mission.decision.options.find(option => option.correct);
  assert.equal(mission.decision.options.filter(option => option.correct).length, 1);
  const decision = { error: false, events: [{ type: 'decision', value: chosen.id }] };
  mission.objectives.forEach((objective, index) => { tasks[index] ||= matchesObjective(objective, decision, shell); });
  assert.deepEqual(tasks, mission.objectives.map(() => true), `${mission.id} variant ${mission.practiceVariant} requires real evidence for every objective`);
  assert.ok(Number.isInteger(mission.quiz.answer) && mission.quiz.answer >= 0 && mission.quiz.answer < mission.quiz.options.length);
  return shell;
}

test('all 24 practice lessons are achievable with real shell effects across four variants', async () => {
  assert.equal(missions.length, 24);
  for (const variant of [1, 2, 3, MAX_PRACTICE_VARIANT]) {
    for (const mission of missions) await solve(createPracticeMission(mission, variant));
  }
});

test('remixes are deterministic deep clones with unchanged mission/objective identities', () => {
  const original = JSON.stringify(missions);
  for (const mission of missions) {
    const first = createPracticeMission(mission);
    const again = createPracticeMission(mission, 1);
    const next = createPracticeMission(mission, 2);
    assert.deepEqual(first, again);
    assert.equal(first.id, mission.id);
    assert.equal(first.practiceVariant, 1);
    assert.deepEqual(first.objectives.map(objective => objective.id), mission.objectives.map(objective => objective.id));
    assert.notDeepEqual(first.solutions, mission.solutions);
    assert.notDeepEqual(first.solutions, next.solutions);
    for (const path of Object.keys(mission.fixtures)) assert.equal(Object.hasOwn(first.fixtures, path), false, `${mission.id}: old fixture path ${path}`);
    first.story[0].text = 'Changed only this remix';
    first.objectives[0].check.type = 'invalid';
    first.decision.options[0].label = 'Changed option';
    assert.notEqual(again.story[0].text, first.story[0].text);
  }
  assert.equal(JSON.stringify(missions), original);
});

test('instructions, filenames and renamed directories agree, including sentence punctuation and spaced script paths', async () => {
  const map = createPracticeMission(base('hike-02'), 2);
  assert.match(map.story[1].text, /cd maps-r2/);
  assert.match(map.hints[1], /cd maps-r2/);
  assert.equal(map.objectives.find(objective => objective.id === 'move').check.outputIncludes[0], '/home/trainee/maps-r2');
  assert.match(createPracticeMission(base('hike-01'), 1).objectives[2].detail, /cat briefing-r1\.txt/);
  const punctuated = createPracticeMission({ ...base('hike-01'), hints: ['Read briefing.txt.'] }, 2);
  assert.equal(punctuated.hints[0], 'Read briefing-r2.txt.');
  const script = createPracticeMission(base('hike-12'), 3);
  assert.match(findFixture(script, 'backup-r3.sh'), /SOURCE="field notes-r3\.txt"/);
  assert.ok(script.fixtures['/home/trainee/automation-r3/field notes-r3.txt']);
  await solve(script);
});

test('renamed targets cannot be satisfied by old filenames, printed output, or pre-existing files alone', async () => {
  const mission = createPracticeMission(base('hike-05'), 2);
  const shell = createShell(mission.fixtures);
  const old = await execute(shell, 'cp relay-status.txt status.txt');
  assert.equal(old.error, true);
  for (const objective of mission.objectives) assert.equal(matchesObjective(objective, old, shell), false);
  const copy = mission.objectives.find(objective => objective.id === 'copy');
  shell.files[copy.check.path] = { content: 'Cause unconfirmed.', mode: '644', mtime: 0 };
  assert.equal(matchesObjective(copy, { error: false, output: 'Cause unconfirmed.', events: [] }, shell), false);
  const hash = createPracticeMission(base('hike-18'), 1).objectives.find(objective => objective.id === 'hash');
  assert.equal(matchesObjective(hash, { error: false, output: hash.check.outputIncludes[0], events: [] }, shell), false);
});

test('account evidence changes the valid decision instead of repeating a memorized answer', async () => {
  const weak = createPracticeMission(base('hike-08'), 1);
  const healthy = createPracticeMission(base('hike-08'), 2);
  assert.match(findFixture(weak, 'account-audit-r1.txt'), /password_reuse=yes\nmfa_enabled=no/);
  assert.match(findFixture(healthy, 'account-audit-r2.txt'), /password_reuse=no\nmfa_enabled=yes/);
  const weakDecision = weak.objectives.find(objective => objective.check.type === 'decision');
  const healthyDecision = healthy.objectives.find(objective => objective.check.type === 'decision');
  assert.equal(weakDecision.check.value, 'manager');
  assert.equal(healthyDecision.check.value, 'retain');
  assert.equal(matchesObjective(healthyDecision, { error: false, events: [{ type: 'decision', value: weakDecision.check.value }] }, createShell(healthy.fixtures)), false);
  await solve(weak);
  await solve(healthy);
});

test('trusted hash records match the changed bytes, and mismatch variants demand a different conclusion', async () => {
  for (const id of ['hike-18', 'hike-24']) {
    for (const variant of [1, 2, 3]) {
      const mission = createPracticeMission(base(id), variant);
      const route = findFixture(mission, `route-r${variant}.conf`);
      const actual = createHash('sha256').update(route).digest('hex');
      const check = mission.objectives.find(objective => objective.id === 'hash').check;
      assert.deepEqual(check.outputIncludes, [actual]);
      const record = findFixture(mission, id === 'hike-18' ? `trusted-sha256-r${variant}.txt` : `closure-r${variant}.txt`);
      const expected = record.match(/[a-f0-9]{64}/)[0];
      const correct = mission.decision.options.find(option => option.correct).id;
      if (id === 'hike-18' && variant % 2 === 0) {
        assert.notEqual(expected, actual);
        assert.equal(correct, 'mismatch');
        assert.match(mission.hints[2], /digests differ/);
      } else assert.equal(expected, actual);
      await solve(mission);
    }
  }
});

test('logs, listeners, versions and incident references have consistent fresh evidence', async () => {
  const counts = [];
  for (const variant of [1, 2, 3]) {
    const log = createPracticeMission(base('hike-21'), variant);
    const count = findFixture(log, `auth-r${variant}.log`).split('\n').filter(line => line.includes('AUTH_FAIL')).length;
    counts.push(count);
    assert.deepEqual(log.objectives.find(objective => objective.id === 'count').check.outputIncludes, [String(count)]);
    const network = createPracticeMission(base('hike-16'), variant);
    const expectedPort = network.objectives.find(objective => objective.id === 'sockets').check.outputIncludes[0];
    assert.match(network.fixtures['/etc/network.txt'], new RegExp(`:${expectedPort}\\s`));
    assert.match(network.fixtures['/etc/processes.txt'], new RegExp(`--port ${expectedPort}`));
    const version = createPracticeMission(base('hike-19'), variant);
    assert.ok(version.solutions.at(-1).includes(version.objectives.find(objective => objective.id === 'version').check.outputIncludes[0]));
    const incident = createPracticeMission(base('hike-22'), variant);
    assert.ok(incident.solutions.at(-1).includes(`S-${17 + variant}`));
    await solve(log);
    await solve(network);
    await solve(version);
    await solve(incident);
  }
  assert.equal(new Set(counts).size, 3);
});

test('practice rejects malformed variants and missing mission data', () => {
  for (const variant of [0, -1, 1.5, NaN, Infinity, '1', null, MAX_PRACTICE_VARIANT + 1]) assert.throws(() => createPracticeMission(missions[0], variant), RangeError);
  for (const mission of [undefined, null, {}, { id: 'x', fixtures: {}, objectives: [] }]) assert.throws(() => createPracticeMission(mission), TypeError);
});
