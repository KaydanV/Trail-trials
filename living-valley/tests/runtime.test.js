import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_KEY, MAX_SAVE_BYTES, createSession, currentStep, runCommand, inspectItem,
  submitActivity, requestHint, answerQuestion, canComplete, completeMission,
  createProfile, createStorage, validateProfile,
} from '../runtime.js';
import {makeReviewMission} from '../review.js';

const HOME = '/home/trainee/';
const questions = () => [
  {question: 'What did the record establish?', options: ['An unknown actor', 'An observed outage', 'A completed repair'], answer: 1, explanation: 'The record establishes an outage; it does not identify an actor or verify a repair.'},
  {question: 'What remains to be done?', options: ['Verify the repair', 'Announce attribution', 'Erase the record'], answer: 0, explanation: 'Verification is still needed before claiming recovery.'},
];
const terminalStep = (id = 'notice', file = 'notice.txt') => ({
  id, title: 'Read the actual notice', tool: 'terminal', prompt: 'Find what the ranger recorded.',
  check: {type: 'read', path: HOME + file}, solution: `cat ${file}`,
  hints: ['Consider where the ranger left the notice.', 'List the nearby files.', `Inspect ${file}.`, `cat ${file}`],
  feedback: {speaker: 'NOVA', text: 'The notice records unavailable trail signs.', why: 'A recorded outage is evidence, not attribution.'},
});
function mission(id = 'c01-01', phase = 'practice', steps = [terminalStep()]) {
  return {
    id, phase, title: 'The ranger notice', chapter: 1, lesson: 1,
    summary: 'The signs need an investigation.',
    briefing: {plain: 'Read the notice.', why: 'The ranger saved notice.txt in this folder.'},
    fixtures: {'notice.txt': 'Trail signs unavailable. Cause unknown.\n', 'second.txt': 'A second clue.\n'},
    steps, questions: questions(),
  };
}
function activityStep(kind, extra = {}) {
  return {
    id: 'board', title: 'Use the evidence board', tool: 'evidence', prompt: 'Investigate the recorded outage.',
    check: {type: 'activity'},
    activity: {
      kind, heading: 'Ranger evidence board', instructions: 'Inspect the actual observation.',
      items: [{id: 'notice', label: 'Ranger notice', detail: 'The signs are unavailable.'}, {id: 'snack', label: 'Snack receipt', detail: 'One pear.'}],
      requiredInspect: ['notice'], ...extra,
    },
    hints: ['Look for an observation about the signs.', 'Inspect the ranger notice.', 'Keep cause separate from impact.', 'Select the outage observation.'],
    feedback: {speaker: 'PATCH', text: 'The outage is recorded without guessing its cause.'},
  };
}
async function finish(m, s = createSession(m)) {
  s.started = true;
  for (let index = currentStep(m, s); index < m.steps.length; index++) {
    const step = m.steps[index];
    if (step.tool === 'terminal') {
      for (const command of Array.isArray(step.solution) ? step.solution : [step.solution]) await runCommand(m, s, command);
    } else {
      for (const id of step.solution?.inspect || step.activity.requiredInspect || []) inspectItem(m, s, index, id);
      if (!s.done[index]) submitActivity(m, s, index, step.solution);
    }
    assert.equal(s.done[index], true, `fixture step ${index} completes`);
  }
  for (const [index, question] of m.questions.entries()) answerQuestion(m, s, index, question.answer);
  const record = completeMission(m, s, 'The observation is a fact; the cause is still unknown.');
  return {session: s, record};
}
function backend(entries = []) {
  const map = new Map(entries), writes = [];
  return {map, writes, getItem: key => map.get(key) ?? null, setItem: (key, value) => {writes.push(key); map.set(key, value);}};
}
async function completedProfile(ms) {
  const profile = createProfile(ms);
  const completed = await finish(ms[0]);
  profile.sessions[ms[0].id] = completed.session;
  profile.records[ms[0].id] = completed.record;
  profile.completed.push(ms[0].id);
  return profile;
}

test('commands verify only the current clue, including a command that reads two files', async () => {
  const m = mission('c01-01', 'practice', [terminalStep('first'), terminalStep('second', 'second.txt')]);
  const s = createSession(m);
  await runCommand(m, s, 'cat second.txt');
  assert.deepEqual(s.done, [false, false]);
  assert.equal(currentStep(m, s), 0);
  const first = await runCommand(m, s, 'cat notice.txt second.txt');
  assert.equal(first.completedStep, 0);
  assert.deepEqual(s.done, [true, false]);
  await runCommand(m, s, 'cat notice.txt');
  assert.deepEqual(s.done, [true, false]);
  assert.equal((await runCommand(m, s, 'cat second.txt')).completedStep, 1);
  assert.equal(currentStep(m, s), 2);
});

test('failed commands retain attempts and feedback but award no evidence', async () => {
  const m = mission(), s = createSession(m);
  const result = await runCommand(m, s, 'cat missing.txt');
  assert.equal(result.error, true);
  assert.match(result.output, /No such file/);
  assert.deepEqual(s.done, [false]);
  assert.deepEqual(s.attempts, [1]);
  assert.equal(s.transcript.at(-1).kind, 'error');
  assert.equal((await runCommand(m, s, 'cat ./notice.txt')).completedStep, 0);
});

test('script and Windows tool steps verify real command effects rather than their panel label', async () => {
  const script = terminalStep('run-script');script.tool = 'script';script.check = {type: 'command', name: 'bash', argsIncludes: ['hello.sh'], outputIncludes: ['Valley ready']};
  const m = mission('c09-01', 'practice', [script]);m.fixtures['hello.sh'] = 'echo "Valley ready"\n';
  const s = createSession(m);
  assert.equal((await runCommand(m, s, 'bash hello.sh')).completedStep, 0);
  const windows = terminalStep();windows.tool = 'windows';
  const other = mission('c10-01', 'practice', [windows]);other.shell = {platform: 'windows'};
  assert.equal((await runCommand(other, createSession(other), 'Get-Content notice.txt')).completedStep, 0);
});

test('a deliberately captured stderr file can satisfy its file outcome without pretending the command succeeded', async () => {
  const step = terminalStep('capture-error');step.tool = 'script';step.check = {type: 'file', path: HOME + 'errors.txt', contains: ['No such file']};
  const m = mission('c09-02', 'practice', [step]), s = createSession(m);
  const result = await runCommand(m, s, 'cat missing.txt 2> errors.txt');
  assert.equal(result.error, true);
  assert.equal(result.completedStep, 0);
  assert.match(s.shell.files[HOME + 'errors.txt'].content, /No such file/);
});

test('a synchronous duplicate action cannot race an asynchronous terminal check', async () => {
  const m = mission(), s = createSession(m);
  const first = runCommand(m, s, 'cat notice.txt');
  const second = await runCommand(m, s, 'cat notice.txt');
  assert.equal(second.ok, false);
  assert.match(second.reason, /Wait/);
  await first;
  assert.deepEqual(s.attempts, [1]);
});

test('inspection requires the authored evidence, not an irrelevant item or forged submission', () => {
  const step = activityStep('inspect'), m = mission('c01-01', 'discover', [step]), s = createSession(m);
  assert.equal(inspectItem(m, s, 0, 'snack').text, 'One pear.');
  assert.deepEqual(s.done, [false]);
  assert.equal(submitActivity(m, s, 0, {inspect: ['notice']}).ok, false);
  assert.deepEqual(s.activity[0].inspected, ['snack']);
  assert.equal(inspectItem(m, s, 0, 'notice').completedStep, 0);
  assert.deepEqual(s.done, [true]);
});

test('multi-item inspection waits for every required observation', () => {
  const step = activityStep('inspect', {requiredInspect: ['notice', 'snack']});
  const m = mission('c01-01', 'practice', [step]), s = createSession(m);
  assert.equal(inspectItem(m, s, 0, 'notice').completedStep, undefined);
  assert.equal(inspectItem(m, s, 0, 'notice').completedStep, undefined);
  assert.deepEqual(s.activity[0].inspected, ['notice']);
  assert.equal(inspectItem(m, s, 0, 'snack').completedStep, 0);
});

test('future activity controls cannot award progress or collect hidden observations', () => {
  const m = mission('c01-01', 'practice', [terminalStep(), activityStep('inspect')]), s = createSession(m);
  assert.equal(inspectItem(m, s, 1, 'notice').ok, false);
  assert.equal(submitActivity(m, s, 1, {inspect: ['notice']}).ok, false);
  assert.equal(requestHint(m, s, 1).depth, 0);
  assert.deepEqual(s.done, [false, false]);
  assert.deepEqual(s.activity[1].inspected, []);
  assert.equal(s.attempts[1], 0);
  assert.equal(s.hints[1], 0);
});

for (const kind of ['choose', 'compare']) test(`${kind} requires inspected evidence and an actually correct action`, () => {
  const step = activityStep(kind, {choices: [{id: 'record', label: 'Record the outage', correct: true, feedback: 'Supported by the notice.'}, {id: 'blame', label: 'Name an actor', correct: false, feedback: 'The notice gives no actor.'}]});
  const m = mission('c01-01', 'prove', [step]), s = createSession(m);
  assert.equal(submitActivity(m, s, 0, {choice: 'record', inspect: ['notice']}).ok, false);
  inspectItem(m, s, 0, 'notice');
  assert.equal(submitActivity(m, s, 0, {choice: 'unknown'}).ok, false);
  assert.match(submitActivity(m, s, 0, {choice: 'blame'}).reason, /no actor/);
  assert.deepEqual(s.done, [false]);
  assert.equal(submitActivity(m, s, 0, {choice: 'record'}).completedStep, 0);
});

test('classification requires every evidence item exactly once in an authored category', () => {
  const step = activityStep('classify', {requiredInspect: [], items: [{id: 'fact', label: 'Signs unavailable', detail: 'Observed', category: 'verified'}, {id: 'cause', label: 'A suspected cause', detail: 'Unconfirmed', category: 'unknown'}], categories: [{id: 'verified', label: 'Verified'}, {id: 'unknown', label: 'Unknown'}]});
  const m = mission('c01-01', 'practice', [step]), s = createSession(m);
  assert.equal(submitActivity(m, s, 0, {classifications: {fact: 'verified'}}).ok, false);
  assert.equal(submitActivity(m, s, 0, {classifications: {fact: 'verified', cause: 'unknown', extra: 'unknown'}}).ok, false);
  assert.equal(submitActivity(m, s, 0, {classifications: {fact: 'unknown', cause: 'verified'}}).ok, false);
  assert.equal(submitActivity(m, s, 0, {classifications: {fact: 'verified', cause: 'unknown'}}).completedStep, 0);
});

for (const kind of ['sequence', 'connect']) test(`${kind} rejects duplicated or partial routes`, () => {
  const step = activityStep(kind, {requiredInspect: [], order: ['notice', 'preserve', 'verify']});
  const m = mission('c01-01', 'practice', [step]), s = createSession(m);
  assert.equal(submitActivity(m, s, 0, {order: ['notice', 'preserve']}).ok, false);
  assert.equal(submitActivity(m, s, 0, {order: ['notice', 'preserve', 'preserve']}).ok, false);
  assert.equal(submitActivity(m, s, 0, {order: ['preserve', 'notice', 'verify']}).ok, false);
  assert.equal(submitActivity(m, s, 0, {order: ['notice', 'preserve', 'verify']}).completedStep, 0);
});

test('report fields check factual anchors without accepting partial tokens or missing fields', () => {
  const step = activityStep('report', {requiredInspect: [], fields: [{id: 'case', label: 'Case', required: ['TT-4']}, {id: 'status', label: 'Action status', required: ['requested', 'unknown']}]});
  const m = mission('c01-01', 'prove', [step]), s = createSession(m);
  assert.equal(submitActivity(m, s, 0, {fields: {case: 'TT-40', status: 'Containment requested; cause unknown.'}}).ok, false);
  assert.equal(submitActivity(m, s, 0, {fields: {case: 'TT-4'}}).ok, false);
  assert.equal(submitActivity(m, s, 0, {fields: {case: 'Case tt-4', status: 'Containment REQUESTED. Cause remains UNKNOWN.'}}).completedStep, 0);
});

test('text repair is labelled text-only and cannot pretend to run behavioral tests', () => {
  const textStep = activityStep('repair', {requiredInspect: [], expected: ['echo "ready"']});
  const m = mission('c01-01', 'practice', [textStep]), s = createSession(m);
  const result = submitActivity(m, s, 0, {text: 'echo "ready"'});
  assert.equal(result.completedStep, 0);
  assert.equal(result.validation, 'text-only');
  const executable = mission('c01-02', 'practice', [activityStep('repair', {requiredInspect: [], expected: ['echo'], tests: [{input: 'a', output: 'b'}]})]);
  const other = createSession(executable);
  assert.equal(submitActivity(executable, other, 0, {text: 'echo b'}).ok, false);
  assert.deepEqual(other.done, [false]);
});

test('hints have four real tiers and all help remains recorded after repeated requests', async () => {
  const m = mission(), s = createSession(m);
  assert.deepEqual([1, 2, 3, 4, 4].map(() => requestHint(m, s).depth), [1, 2, 3, 4, 4]);
  assert.equal(s.hints[0], 5);
  const {record} = await finish(m, s);
  assert.equal(record.hints, 5);
  assert.equal(record.independent, false);
  assert.equal(record.introduced, false);
});

test('all questions gate completion; wrong answers and unanswered questions cannot clear a mission', async () => {
  const m = mission(), s = createSession(m);
  assert.equal(answerQuestion(m, s, 0, 1).correct, false);
  assert.equal(s.answers[0], null);
  await runCommand(m, s, 'cat notice.txt');
  assert.equal(canComplete(m, s), false);
  assert.throws(() => completeMission(m, s), /every debrief/);
  assert.equal(answerQuestion(m, s, 0, 1).correct, true);
  assert.equal(answerQuestion(m, s, 1, 2).correct, false);
  assert.equal(canComplete(m, s), false);
  assert.equal(answerQuestion(m, s, 1, 0).correct, true);
  assert.equal(canComplete(m, s), true);
});

test('discovery, independent practice and assisted proof are different completion evidence', async () => {
  const discover = mission('c01-01', 'discover');
  const discovered = (await finish(discover)).record;
  assert.equal(discovered.introduced, true);
  assert.equal(discovered.independent, false);
  for (const phase of ['practice', 'prove', 'boss']) {
    const m = mission('c01-01', phase), result = await finish(m);
    assert.equal(result.record.introduced, false);
    assert.equal(result.record.independent, true);
  }
  const m = mission('c01-01', 'prove'), s = createSession(m);
  requestHint(m, s);
  assert.equal((await finish(m, s)).record.independent, false);
});

test('completion returns a record without silently changing story progress', async () => {
  const m = mission(), p = createProfile([m]), {session, record} = await finish(m);
  assert.equal(session.completed, true);
  assert.equal(record.missionId, m.id);
  assert.deepEqual(p.completed, []);
  assert.deepEqual(p.records, {});
  assert.equal((await runCommand(m, session, 'cat notice.txt')).ok, false);
});

test('collecting the last clue still allows artifact inspection before the debrief', async () => {
  const m = mission(), s = createSession(m);
  await runCommand(m, s, 'cat notice.txt');
  assert.equal(currentStep(m, s), 1);
  const result = await runCommand(m, s, 'cat second.txt');
  assert.equal(result.error, false);
  assert.match(result.output, /second clue/);
  assert.equal(result.completedStep, undefined);
  assert.deepEqual(s.done, [true]);
  assert.equal(canComplete(m, s), false);
});

test('save, load and reset use only the Living Valley namespace and leave legacy progress intact', async () => {
  const m = mission(), b = backend([['terminal-trails-v5-slot-1', 'legacy proof'], ['terminal-trails-v2-slot-1', 'older proof']]);
  const store = createStorage([m], b), p = await completedProfile([m]);
  store.write(p);
  assert.deepEqual(store.read(), JSON.parse(b.map.get(SAVE_KEY)));
  assert.equal(b.map.get('terminal-trails-v5-slot-1'), 'legacy proof');
  assert.equal(b.map.get('terminal-trails-v2-slot-1'), 'older proof');
  assert.deepEqual(store.reset().completed, []);
  assert.ok(b.writes.every(key => key === SAVE_KEY));
});

test('save round-trip preserves partially inspected evidence, hints and independent activity state', () => {
  const step = activityStep('choose', {choices: [{id: 'record', label: 'Record the outage', correct: true}]}), m = mission('c01-01', 'practice', [step]);
  const p = createProfile([m]);p.sessions[m.id] = createSession(m);p.sessions[m.id].started = true;
  inspectItem(m, p.sessions[m.id], 0, 'notice');requestHint(m, p.sessions[m.id]);
  const store = createStorage([m], null), restored = store.import(store.export(p));
  assert.deepEqual(restored, p);
  assert.deepEqual(restored.sessions[m.id].activity[0].inspected, ['notice']);
  assert.equal(submitActivity(m, restored.sessions[m.id], 0, {choice: 'record'}).completedStep, 0);
});

test('shell files, variables and authorized process/service changes survive a validated save', async () => {
  const m = mission();m.shell = {authorizedActions: ['kill:809', 'service:relay.service:stop']};
  const p = createProfile([m]), s = createSession(m);p.sessions[m.id] = s;
  for (const raw of ['mkdir notes', 'cp second.txt notes/copy.txt', 'export MOTTO="Read before changing"', 'kill 809', 'systemctl stop relay.service']) assert.equal((await runCommand(m, s, raw)).error, false, raw);
  const restored = createStorage([m], null).import(createStorage([m], null).export(p));
  assert.equal(restored.sessions[m.id].shell.files[HOME + 'notes/copy.txt'].content, m.fixtures['second.txt']);
  assert.equal(restored.sessions[m.id].shell.variables.MOTTO, 'Read before changing');
  assert.ok(!restored.sessions[m.id].shell.processes.some(process => process.pid === 809));
  assert.equal(restored.sessions[m.id].shell.services['relay.service'].active, false);
});

test('completed return trips round-trip independently of canonical files and records', async () => {
  const m = mission('c01-01', 'discover'), p = await completedProfile([m]);
  const canonical = JSON.stringify({sessions: p.sessions, records: p.records, completed: p.completed});
  const reviewed = makeReviewMission(m, 2), result = await finish(reviewed);
  assert.equal(result.record.independent, true);
  p.practiceSessions[m.id] = {variant: 2, ...result};
  const store = createStorage([m], null), restored = store.import(store.export(p));
  assert.equal(restored.practiceSessions[m.id].record.phase, 'prove');
  assert.equal(JSON.stringify({sessions: restored.sessions, records: restored.records, completed: restored.completed}), canonical);
});

test('locked return trips and discontinuous story completions are rejected', async () => {
  const first = mission('c01-01'), second = mission('c01-02'), ms = [first, second], p = createProfile(ms);
  p.practiceSessions[first.id] = {variant: 1, session: createSession(makeReviewMission(first, 1))};
  assert.throws(() => validateProfile(p, ms), /only for completed/);
  delete p.practiceSessions[first.id];p.completed = [second.id];
  assert.throws(() => validateProfile(p, ms), /without gaps/);
  p.completed = [];p.currentMission = second.id;
  assert.throws(() => validateProfile(p, ms), /not been unlocked/);
});

test('imported completion claims must match saved evidence, questions and hint-derived metadata', async () => {
  const m = mission(), store = createStorage([m], null), original = await completedProfile([m]);
  for (const mutate of [
    p => {p.sessions[m.id].done[0] = false;},
    p => {p.sessions[m.id].answers[1] = 2;},
    p => {p.records[m.id].hints = 4;},
    p => {p.records[m.id].independent = false;},
    p => {delete p.records[m.id];},
  ]) {
    const forged = structuredClone(original);mutate(forged);
    assert.throws(() => store.import(JSON.stringify(forged)));
  }
});

test('import rejects traversal, invented processes and broadened scenario authorization', () => {
  const m = mission(), original = createProfile([m]);original.sessions[m.id] = createSession(m);
  for (const mutate of [
    p => {p.sessions[m.id].shell.cwd = '/home/trainee/../other';},
    p => {p.sessions[m.id].shell.config.authorizedActions = ['kill:1'];},
    p => {p.sessions[m.id].shell.processes = p.sessions[m.id].shell.processes.filter(process => process.pid !== 1);},
    p => {p.sessions[m.id].shell.processes.push({pid: 999, command: 'invented'});},
    p => {p.sessions[m.id].shell.services['relay.service'].active = false;},
  ]) {
    const forged = structuredClone(original);mutate(forged);
    assert.throws(() => validateProfile(forged, [m]));
  }
});

test('invalid imports are atomic and do not overwrite a previously stored journey', async () => {
  const m = mission(), b = backend(), store = createStorage([m], b), p = await completedProfile([m]);
  store.write(p);const original = b.map.get(SAVE_KEY), count = b.writes.length;
  for (const value of ['not JSON', '{"version":99}', '{"version":1,"__proto__":{"polluted":true}}']) assert.throws(() => store.import(value));
  assert.equal(b.map.get(SAVE_KEY), original);
  assert.equal(b.writes.length, count);
  assert.equal({}.polluted, undefined);
});

test('save validation rejects getters without invoking them and forbids unknown structure', () => {
  const m = mission(), p = createProfile([m]);let invoked = false;
  Object.defineProperty(p.settings, 'motion', {enumerable: true, get() {invoked = true;return true;}});
  assert.throws(() => validateProfile(p, [m]), /accessor/);
  assert.equal(invoked, false);
  const extra = createProfile([m]);extra.hiddenCredit = true;
  assert.throws(() => validateProfile(extra, [m]), /unsupported field/);
});

test('oversized imports are rejected before JSON parsing', () => {
  const store = createStorage([mission()], null);
  assert.throws(() => store.import(' '.repeat(MAX_SAVE_BYTES + 1)), /smaller than 8 MB/);
});

test('storage write failure falls back to an exportable memory journey', () => {
  const m = mission(), store = createStorage([m], {getItem: () => null, setItem: () => {throw new Error('quota');}});
  const p = createProfile([m]);p.settings.textSize = 'large';store.write(p);
  assert.equal(store.available, false);
  assert.match(store.warning, /export a backup/);
  assert.equal(store.read().settings.textSize, 'large');
  assert.equal(store.import(store.export(store.read())).settings.textSize, 'large');
});

test('corrupt stored progress is preserved while the tab uses temporary memory', () => {
  const m = mission(), raw = '{not a valid journey', b = backend([[SAVE_KEY, raw]]), store = createStorage([m], b);
  const p = store.read();assert.deepEqual(p.completed, []);
  assert.equal(store.available, false);
  assert.match(store.warning, /stored copy was preserved/);
  store.write(p);assert.equal(b.map.get(SAVE_KEY), raw);
  store.reset();
  assert.equal(store.available, true);
  assert.deepEqual(JSON.parse(b.map.get(SAVE_KEY)).completed, []);
});

test('reading progress returns a detached copy rather than live mutable storage state', () => {
  const m = mission(), store = createStorage([m], null), first = store.read();
  first.settings.sound = true;first.completed.push(m.id);
  assert.equal(store.read().settings.sound, false);
  assert.deepEqual(store.read().completed, []);
});

test('optional practice time round-trips without affecting completion credit and rejects invalid durations', async () => {
  const m = mission(), s = createSession(m);s.elapsed = 41.5;
  const {record} = await finish(m, s);
  assert.equal(record.elapsed, 41.5);
  assert.equal(record.independent, true);
  const p = createProfile([m]);p.sessions[m.id] = s;p.records[m.id] = record;p.completed = [m.id];
  assert.equal(validateProfile(p, [m]).sessions[m.id].elapsed, 41.5);
  p.sessions[m.id].elapsed = -1;
  assert.throws(() => validateProfile(p, [m]), /duration/);
});

test('accepted reports preserve the player’s actual wording and are regraded on import', async () => {
  const step = activityStep('report', {requiredInspect: [], fields: [{id: 'finding', label: 'Finding', required: ['outage', 'unknown']}]});
  const authored = 'The outage affects the trail signs. The cause remains unknown. My own note: <img src=x>.';
  step.solution = {fields: {finding: authored}};
  const m = mission('c01-01', 'prove', [step]), p = await completedProfile([m]), store = createStorage([m], null);
  assert.equal(p.sessions[m.id].activity[0].submission.fields.finding, authored);
  const restored = store.import(store.export(p));
  assert.equal(restored.sessions[m.id].activity[0].submission.fields.finding, authored);
  restored.sessions[m.id].activity[0].submission.fields.finding = 'A repair has definitely completed.';
  assert.throws(() => store.import(JSON.stringify(restored)), /does not satisfy/);
  const missing = structuredClone(p);delete missing.sessions[m.id].activity[0].submission;
  assert.throws(() => validateProfile(missing, [m]), /missing the player/);
});

for (const kind of ['choose', 'compare', 'classify', 'sequence', 'connect', 'repair']) test(`accepted ${kind} responses are saved as evidence and invalid replacements cannot import`, async () => {
  let extra, solution, invalid;
  if (kind === 'choose' || kind === 'compare') {
    extra = {choices: [{id: 'record', label: 'Record impact', correct: true}, {id: 'invent', label: 'Invent a cause', correct: false}]};
    solution = {inspect: ['notice'], choice: 'record'};invalid = {choice: 'invent'};
  } else if (kind === 'classify') {
    extra = {requiredInspect: [], categories: [{id: 'fact', label: 'Fact'}], items: [{id: 'notice', label: 'Outage', detail: 'Observed outage.', category: 'fact'}]};
    solution = {classifications: {notice: 'fact'}};invalid = {classifications: {notice: 'invented'}};
  } else if (kind === 'repair') {
    extra = {requiredInspect: [], expected: ['echo ready']};solution = {text: 'echo ready'};invalid = {text: 'echo false'};
  } else {
    extra = {requiredInspect: [], order: ['notice', 'snack']};solution = {order: ['notice', 'snack']};invalid = {order: ['snack', 'notice']};
  }
  const step = activityStep(kind, extra);step.solution = solution;
  const m = mission('c01-01', 'practice', [step]), p = await completedProfile([m]), store = createStorage([m], null);
  const accepted = p.sessions[m.id].activity[0].submission;
  assert.ok(accepted);
  assert.equal(Object.hasOwn(accepted, 'inspect'), false);
  assert.deepEqual(store.import(store.export(p)).sessions[m.id].activity[0].submission, accepted);
  const forged = structuredClone(p);forged.sessions[m.id].activity[0].submission = invalid;
  assert.throws(() => store.import(JSON.stringify(forged)), /does not satisfy/);
});
