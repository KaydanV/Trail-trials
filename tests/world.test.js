import test from 'node:test';
import assert from 'node:assert/strict';
import { missions } from '../src/curriculum.js';
import { getWorldState, renderWorld, updateWorld } from '../src/world.js';
import { createPracticeMission } from '../src/practice.js';

const session = (mission, selected = []) => ({ tasks: mission.objectives.map(objective => selected.includes(objective.id)) });
const all = mission => session(mission, mission.objectives.map(objective => objective.id));

test('all 24 worlds respond to their own verified evidence and await the debrief', () => {
  for (const mission of missions) {
    const before = getWorldState(mission, session(mission));
    assert.equal(before.phase, 'waiting', mission.id);
    const markup = renderWorld(mission);
    assert.ok(markup.includes(`data-kind="${before.kind}"`));
    for (const objective of mission.objectives) {
      assert.ok(markup.includes(`data-world-task="${objective.id}"`), `${mission.id}: missing ${objective.id} illustration`);
    }
    const first = getWorldState(mission, session(mission, [mission.objectives[0].id]));
    assert.equal(first.phase, 'discovering');
    assert.notEqual(first.title, before.title);
    assert.equal(first.stage, 1);
    const clues = getWorldState(mission, session(mission, mission.objectives.slice(0, -1).map(objective => objective.id)));
    assert.equal(clues.phase, 'ready');
    assert.equal(getWorldState(mission, all(mission)).phase, 'secured');
    assert.equal(getWorldState(mission, all(mission), true).phase, 'complete');
    assert.notEqual(getWorldState(mission, all(mission), true).title, before.title);
  }
});

test('commands, hints, failed attempts, and an early decision cannot award world progress', () => {
  for (const mission of missions) {
    const initial = getWorldState(mission, session(mission));
    assert.deepEqual(getWorldState(mission, { tasks: [], commands: 900, hints: 3, shell: { history: ['help', 'unsafe'] } }, true), initial);
    assert.equal(getWorldState(mission, session(mission, ['decision']), true).phase, 'waiting');
    assert.equal(getWorldState(mission, { tasks: mission.objectives.map(() => 'true') }, true).phase, 'waiting');
    assert.equal(getWorldState(mission, session(mission, [mission.objectives[0].id]), true).phase, 'discovering');
  }
});

test('a later objective reveals its own evidence without inventing previous checks', () => {
  const mission = missions[3];
  const state = getWorldState(mission, session(mission, ['note']));
  assert.equal(state.stage, 1);
  assert.equal(state.title, 'The source note joins the trail');
  assert.equal(state.effect, 'evidence');
});

test('signal restoration is local and needs approval, preservation, restoration, and verification', () => {
  const mission = missions[5];
  assert.equal(getWorldState(mission, session(mission, ['verify'])).effect, 'evidence');
  assert.equal(getWorldState(mission, session(mission, ['restore', 'verify'])).effect, 'evidence');
  const checked = getWorldState(mission, session(mission, ['approval', 'preserve', 'restore', 'verify']));
  assert.equal(checked.effect, 'signal');
  assert.match(checked.detail, /One local signal/);
  assert.match(renderWorld(mission), /world-signal-glow[^>]*data-world-requires="approval preserve restore verify"/);
  assert.match(getWorldState(missions[0], all(missions[0]), true).detail, /still needs investigation/);
});

test('the dragon passage and summit beacon require completed reflection as well as verified tasks', () => {
  const dragon = missions[7], summit = missions[23];
  assert.match(renderWorld(dragon), /world-gate-open[^>]*data-world-requires="policy reuse mfa decision complete"/);
  assert.match(renderWorld(summit), /world-beacon-light[^>]*data-world-requires="closure hash permission service decision complete"/);
  assert.equal(getWorldState(summit, all(summit)).effect, 'evidence');
  assert.equal(getWorldState(summit, all(summit), true).effect, 'beacon');
  assert.equal(getWorldState(summit, session(summit), true).effect, 'none');
});

test('requested changes keep their honest status in maintenance, access, response, and handoff', () => {
  for (const index of [11, 18, 19, 21, 22]) {
    const mission = missions[index], state = getWorldState(mission, all(mission), true);
    assert.match(state.detail, /separate|not been|requested|staged|review/i, mission.id);
    assert.doesNotMatch(state.detail, /upgrade is installed|containment completed|firewall is applied/i);
  }
});

test('world markup accepts known authored data and excludes command output and supplied HTML', () => {
  const fallback = renderWorld(undefined);
  for (const id of ['__proto__', '<script>alert(1)</script>', '" onload="alert(1)', 'unmapped']) {
    assert.equal(renderWorld({ id, summary: '<img src=x onerror=alert(1)>' }), fallback);
    assert.equal(getWorldState({ id, objectives: [] }, { tasks: [true] }, true).phase, 'waiting');
  }
  for (const mission of missions) {
    assert.doesNotMatch(renderWorld(mission), /<script|onload|onerror|javascript:|<foreignObject|<image/i);
    assert.match(renderWorld(mission), /aria-hidden="true"/);
  }
  assert.deepEqual(updateWorld(null, missions[0], all(missions[0])), getWorldState(missions[0], all(missions[0])));
});

test('a mismatched persisted task list cannot light a different mission', () => {
  const mission = missions[23];
  const incorrect = { ...mission, objectives: missions[0].objectives };
  assert.equal(getWorldState(incorrect, all(missions[0]), true).phase, 'waiting');
});

test('fresh practice evidence changes the world interpretation and drawing', () => {
  const healthy = createPracticeMission(missions[7], 2);
  assert.match(getWorldState(healthy, session(healthy, ['reuse'])).detail, /no password reuse/);
  assert.match(getWorldState(healthy, session(healthy, ['mfa'])).detail, /enabled passkey MFA/);
  assert.match(getWorldState(healthy, all(healthy), true).detail, /retained the existing/);
  const mismatch = createPracticeMission(missions[17], 2);
  assert.match(getWorldState(mismatch, session(mismatch, ['hash'])).detail, /does not match/);
  assert.match(getWorldState(mismatch, all(mismatch), true).detail, /held the copy/);
  assert.match(renderWorld(mismatch), /world-fingerprint-mismatch/);
  assert.doesNotMatch(getWorldState(mismatch, all(mismatch), true).title, /matches/);
  const logs = createPracticeMission(missions[20], 2);
  assert.equal((renderWorld(logs).match(/class="world-warning"/g) || []).length, 5);
  assert.match(getWorldState(logs, all(logs), true).detail, /case’s event count/);
});
