import test from 'node:test';
import assert from 'node:assert/strict';
import { missions } from '../src/curriculum.js';
import { createShell, execute, matchesObjective } from '../src/engine.js';
import { getNextObjective, getHint, explainFailure } from '../src/coach.js';
import { createPracticeMission } from '../src/practice.js';

const missionById = id => missions.find(mission => mission.id === id);
const sessionFor = mission => ({ shell: createShell(mission.fixtures), tasks: mission.objectives.map(() => false), commands: 0, hints: 0, elapsed: 0 });

async function move(mission, session, command) {
  const result = await execute(session.shell, command);
  session.commands++;
  mission.objectives.forEach((objective, index) => {
    if (matchesObjective(objective, result, session.shell)) session.tasks[index] = true;
  });
  return result;
}

test('the next clue follows verified statuses and leaves the decision until terminal evidence is complete', () => {
  const mission = missionById('hike-01');
  assert.deepEqual(getNextObjective(mission, [true, false, true, false]), { objective: mission.objectives[1], index: 1 });
  assert.equal(getNextObjective(mission, [true, true, true, false]).objective.check.type, 'decision');
  assert.equal(getNextObjective(mission, mission.objectives.map(() => true)), null);
  const reordered = { objectives: [mission.objectives[3], mission.objectives[0]] };
  assert.equal(getNextObjective(reordered, [false, false]).index, 1);
  assert.equal(getNextObjective(reordered, [false, true]).index, 0);
});

test('hint strength is relative to a target and does not use total hints or expose an exact route early', async () => {
  const mission = missionById('hike-01');
  const session = sessionFor(mission);
  session.hints = 90;
  assert.equal(getHint(mission, session).strength, 0);
  assert.equal(getHint(mission, session).example, undefined);
  assert.equal(getHint(mission, session, 1).example, undefined);
  const route = getHint(mission, session, 2);
  assert.equal(route.targetId, 'location');
  assert.equal(route.example, 'pwd');
  await move(mission, session, 'pwd');
  const next = getHint(mission, session);
  assert.equal(next.targetId, 'identity');
  assert.equal(next.strength, 0);
  assert.match(next.text, /1 clue recorded/);
  assert.doesNotMatch(next.text, /briefing|authorized first step|Investigate the simulated/);
  assert.equal(getHint(mission, session, 999).strength, 2);
  assert.equal(getHint(mission, session, -10).strength, 0);
});

const scenarios = missions.flatMap(mission => [mission, createPracticeMission(mission, 1), createPracticeMission(mission, 2)]);
for (const mission of scenarios) {
  test(`${mission.id}${mission.practiceVariant ? ` remix ${mission.practiceVariant}` : ''}: every focused route completes its remaining clue, then supports the evidence-based decision`, async () => {
    const session = sessionFor(mission);
    let iterations = 0;
    while (getNextObjective(mission, session.tasks)?.objective.check.type !== 'decision') {
      assert.ok(++iterations <= mission.objectives.length, 'coach must advance rather than loop');
      const next = getNextObjective(mission, session.tasks);
      assert.ok(next, 'a mission has a decision after terminal evidence');
      const before = JSON.stringify(session);
      const hints = [0, 1, 2].map(depth => getHint(mission, session, depth));
      assert.equal(JSON.stringify(session), before, 'asking for hints must not mutate or award credit');
      for (const hint of hints) {
        assert.equal(hint.targetId, next.objective.id);
        assert.equal(hint.index, next.index);
        assert.ok(hint.text.trim().length, 'each strength must provide guidance');
      }
      assert.equal(hints[0].example, undefined);
      assert.equal(hints[1].example, undefined);
      if (mission.practiceVariant) {
        const base = missionById(mission.id);
        const baseAction = getHint(base, { tasks: session.tasks, shell: { cwd: '/home/trainee' } }, 1).text;
        Object.keys(base.fixtures).forEach((path, fixtureIndex) => {
          const oldRelative = path.replace('/home/trainee/', '');
          if (path.startsWith('/home/trainee/') && baseAction.includes(oldRelative)) {
            const newRelative = Object.keys(mission.fixtures)[fixtureIndex].replace('/home/trainee/', '');
            assert.ok(hints[1].text.includes(newRelative), `action should follow ${newRelative}: ${hints[1].text}`);
            assert.ok(!hints[1].text.includes(oldRelative), `action should not repeat original ${oldRelative}`);
          }
        });
      }
      assert.ok(hints[2].example, `${next.objective.id} needs a focused executable route`);
      assert.notEqual(hints[2].example, mission.solutions.join('\n'), 'one clue must not disclose the whole mission');
      for (const command of hints[2].example.split('\n')) {
        const result = await move(mission, session, command);
        assert.equal(result.error, false, `${command}: ${result.output}`);
      }
      assert.equal(session.tasks[next.index], true, `route should earn ${next.objective.id} through actual effects`);
    }
    const next = getNextObjective(mission, session.tasks);
    assert.equal(next.objective.check.type, 'decision');
    const decisionHint = getHint(mission, session, 2);
    const correct = mission.decision.options.find(option => option.correct);
    assert.ok(decisionHint.text.includes(correct.label));
    assert.equal(decisionHint.example, undefined, 'a decision must never be an executable command');
    session.tasks[next.index] = true;
    const finished = getHint(mission, session, 2);
    assert.equal(finished.targetId, null);
    assert.equal(finished.example, undefined);
    assert.match(finished.text, /Finish & reflect/);
  });
}

test('navigation guidance notices an entered folder before its confirmation clue is complete', async () => {
  const mission = missionById('hike-02');
  const session = sessionFor(mission);
  await move(mission, session, 'ls');
  await move(mission, session, 'cd maps');
  assert.equal(session.tasks[1], false, 'moving alone is not the verified pwd clue');
  assert.equal(getHint(mission, session, 2).example, 'pwd');
  await move(mission, session, 'pwd');
  assert.equal(getHint(mission, session, 2).example, 'cat trail.txt');
  await move(mission, session, 'cd /');
  const fromElsewhere = getHint(mission, session, 2);
  assert.equal(fromElsewhere.example, 'cat /home/trainee/maps/trail.txt');
  assert.equal((await move(mission, session, fromElsewhere.example)).error, false);
  assert.equal(session.tasks[2], true);
});

test('file preparation is not repeated when a handoff folder already exists', async () => {
  const mission = missionById('hike-23');
  const session = sessionFor(mission);
  await move(mission, session, mission.solutions[0]);
  await move(mission, session, mission.solutions[1]);
  await move(mission, session, 'mkdir handoff');
  assert.equal(session.tasks[2], false);
  const hint = getHint(mission, session, 2);
  assert.equal(hint.example, 'cp report/sanitized-timeline.txt handoff/timeline.txt');
  assert.match(getHint(mission, session, 1).text, /already there/);
  assert.equal((await move(mission, session, hint.example)).error, false);
  assert.equal(session.tasks[2], true);
});

for (const variant of [1, 2]) {
  test(`remix ${variant}: navigation and existing-folder guidance follow renamed paths`, async () => {
    const map = createPracticeMission(missionById('hike-02'), variant);
    const mapSession = sessionFor(map);
    await move(map, mapSession, map.solutions[0]);
    await move(map, mapSession, map.solutions[1]);
    assert.equal(getHint(map, mapSession, 2).example, 'pwd');
    await move(map, mapSession, 'pwd');
    assert.equal(getHint(map, mapSession, 2).example, `cat trail-r${variant}.txt`);
    assert.ok(getHint(map, mapSession, 1).text.includes(`maps-r${variant}`));
    const handoff = createPracticeMission(missionById('hike-23'), variant);
    const handoffSession = sessionFor(handoff);
    for (const command of handoff.solutions.slice(0, 3)) await move(handoff, handoffSession, command);
    assert.equal(getHint(handoff, handoffSession, 2).example, handoff.solutions[3]);
    assert.match(getHint(handoff, handoffSession, 1).text, /already there/);
    assert.ok(getHint(handoff, handoffSession, 1).text.includes(`handoff-r${variant}/timeline-r${variant}.txt`));
    await move(handoff, handoffSession, `cd handoff-r${variant}`);
    assert.equal(getHint(handoff, handoffSession, 2).example, `cd /home/trainee\n${handoff.solutions[3]}`);
  });
}

test('focused routes remain valid after moving away from the starting directory', async () => {
  const mission = missionById('hike-03');
  const session = sessionFor(mission);
  await move(mission, session, 'cat porch/guide.txt');
  await move(mission, session, 'cd porch');
  const hint = getHint(mission, session, 2);
  assert.equal(hint.example, 'cd /home/trainee\nhead -n 2 porch/relay.log');
  assert.match(getHint(mission, session, 1).text, /currently in \/home\/trainee\/porch/);
  for (const command of hint.example.split('\n')) assert.equal((await move(mission, session, command)).error, false);
  assert.equal(session.tasks[1], true);
});

test('commands independent of file location avoid an unnecessary navigation step', async () => {
  const mission = missionById('hike-14');
  const session = sessionFor(mission);
  await move(mission, session, 'cd /');
  const hint = getHint(mission, session, 2);
  assert.equal(hint.example, 'nslookup academy.test');
  assert.equal((await move(mission, session, hint.example)).error, false);
  assert.equal(session.tasks[0], true);
});

test('wrong or failed commands do not advance guidance to a later clue', async () => {
  const mission = missionById('hike-01');
  const session = sessionFor(mission);
  await move(mission, session, 'whoami');
  const failed = await move(mission, session, 'pwd --all');
  assert.equal(failed.error, true);
  assert.equal(getHint(mission, session).targetId, 'location');
  assert.equal(getHint(mission, session, 2).example, 'pwd');
});

test('generic objectives retain a focused fallback instead of dumping a mission route', () => {
  const mission = { id: 'custom', objectives: [{ id: 'read', label: 'Read the field note', detail: 'Read this note with cat.', check: { type: 'read', path: '/home/trainee/field note.txt' } }], hints: ['Look for a field note.'] };
  const session = { tasks: [false], shell: { cwd: '/home/trainee' } };
  assert.equal(getHint(mission, session, 1).text, 'Read this note with cat.');
  assert.equal(getHint(mission, session, 2).example, "cat 'field note.txt'");
});

test('failure feedback diagnoses missing files, folders, quotes, flags, commands, permissions, and network scope', async () => {
  const mission = missionById('hike-03');
  const session = sessionFor(mission);
  const cases = [
    ['cat missing.txt', /current directory|location and spelling/],
    ['echo note > missing/note.txt', /parent folder.*mkdir/],
    ['cd porch/guide.txt', /folder.*file/],
    ['cat porch', /directory.*file/],
    ['echo "unfinished', /matching quote/],
    ['head -q porch/relay.log', /-n.*line count/],
    ['pwd --all', /pwd takes no arguments/],
    ['cp porch/guide.txt', /source file first.*destination second/],
    ['pww', /Did you mean pwd/],
    ['sudo cat porch/guide.txt', /help.*supported/],
    ['chmod 777 porch/guide.txt', /600.*owner/],
    ['nslookup google.com', /academy\.test.*example\.test.*simulation/],
    ['ping -c 100 academy.test', /count from 1 to 4/],
    ['curl -k https://academy.test', /verification enabled/],
    ['grep missing porch/guide.txt', /no lines matching.*letter case/],
    ['cat porch/guide.txt |', /command on each side/],
    ['echo note >', /destination file path.*replaces/],
    ['echo one; whoami', /one command at a time.*quote/],
  ];
  for (const [command, expected] of cases) {
    const result = await execute(session.shell, command);
    assert.equal(result.error, true, command);
    const before = JSON.stringify(session);
    const explanation = explainFailure(mission, session, command, result);
    assert.match(explanation, expected, `${command}: ${explanation}`);
    assert.equal(JSON.stringify(session), before, 'feedback must not execute commands or award credit');
    assert.equal(session.tasks.some(Boolean), false);
  }
  assert.match(explainFailure(mission, session, 'cat x', { error: true, output: 'trail: Permission denied' }), /intended owner.*access policy/);
  assert.equal(explainFailure(mission, session, 'pwd', { error: false, output: '/home/trainee\n' }), null);
});
