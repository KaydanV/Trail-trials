import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, normalizeProgress, createStorage, SaveError, MAX_SAVE_BYTES } from '../src/storage.js';
import { missions as curriculumMissions } from '../src/curriculum.js';
import { createShell } from '../src/engine.js';
import { createPracticeMission, MAX_PRACTICE_VARIANT } from '../src/practice.js';

const missions = [{ id: 'arrival', objectives: [{}, {}] }, { id: 'archive', objectives: [{}] }, { id: 'signal', objectives: [{}] }];
const key = slot => `terminal-trails-v5-slot-${slot}`;
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: name => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, String(value)),
    removeItem: name => values.delete(name)
  };
}
const code = expected => error => error instanceof SaveError && error.code === expected;
function session() {
  return {
    shell: {
      cwd: '/home/trainee', directories: ['/', '/home', '/home/trainee'],
      files: { '/home/trainee/report.txt': { content: 'Evidence preserved.\n', mode: '600', mtime: 0 } },
      history: ['pwd', 'cat report.txt'], directoryModes: { '/home/trainee': '700' }
    },
    tasks: [true, false], started: true, commands: 2, hints: 0, elapsed: 12.5,
    hintState: { targetId: null, depth: 0 }, hintLevel: 0
  };
}
function validProgress() {
  return {
    ...createProgress(missions), completed: ['arrival'], currentMission: 'archive',
    notes: { arrival: 'I checked who and where I was before working.' },
    scores: { arrival: { stars: 3, hints: 0, commands: 2, seconds: 12.5 } },
    sessions: { arrival: session() }, settings: { motion: false, practice: true, tutorialSeen: false }
  };
}

test('new profiles and normalized sparse profiles have independent defaults', () => {
  const first = createProgress(missions);
  const second = normalizeProgress({}, missions);
  first.completed.push('arrival');
  first.settings.motion = false;
  assert.equal(second.version, 5);
  assert.equal(second.currentMission, 'arrival');
  assert.deepEqual(second.completed, []);
  assert.deepEqual(second.settings, { motion: true, practice: true, tutorialSeen: false });
  assert.match(second.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('selection follows contiguous completion even if an imported list has gaps', () => {
  const gap = normalizeProgress({ completed: ['signal'], currentMission: 'signal' }, missions);
  assert.equal(gap.currentMission, 'arrival');
  const next = normalizeProgress({ completed: ['arrival', 'arrival', 'signal'], currentMission: 'signal' }, missions);
  assert.equal(next.currentMission, 'archive');
  assert.deepEqual(next.completed, ['arrival', 'signal']);
  assert.equal(normalizeProgress({ completed: missions.map(m => m.id), currentMission: 'signal' }, missions).currentMission, 'signal');
});

test('three separate slots round-trip notes, scores, settings and mission sessions', () => {
  const storage = memoryStorage();
  const saves = createStorage(storage, missions);
  assert.equal(saves.available, true);
  assert.equal(saves.read(1), null);
  const first = saves.write(1, validProgress());
  const second = saves.write(2, createProgress(missions));
  saves.setActiveSlot(2);
  assert.equal(saves.activeSlot(), 2);
  assert.deepEqual(saves.read(1), first);
  assert.deepEqual(saves.read(2), second);
  assert.equal(saves.read(3), null);
  const imported = saves.import(3, saves.export(1));
  assert.deepEqual({ ...imported, updatedAt: first.updatedAt }, first);
  imported.notes.arrival = 'An outside mutation';
  assert.equal(saves.read(1).notes.arrival, first.notes.arrival);
  saves.remove(2);
  assert.equal(saves.read(2), null);
  assert.deepEqual(saves.read(1), first);
});

test('older V5 settings restore the tutorial without losing existing progress', () => {
  const original = validProgress();
  delete original.settings.tutorialSeen;
  const storage = memoryStorage({ [key(1)]: JSON.stringify(original) });
  const saves = createStorage(storage, missions);
  const restored = saves.read(1);
  assert.equal(restored.settings.tutorialSeen, false);
  assert.deepEqual(restored, { ...original, settings: { ...original.settings, tutorialSeen: false } });
  const imported = saves.import(2, JSON.stringify(original));
  assert.deepEqual({ ...imported, updatedAt: original.updatedAt }, restored);
  assert.equal(JSON.parse(storage.values.get(key(1))).settings.tutorialSeen, undefined);
});

test('older V5 profiles gain independent practice and hint defaults without rewriting their source', () => {
  const original = validProgress();
  delete original.practiceSessions;
  delete original.sessions.arrival.hintState;
  delete original.sessions.arrival.hintLevel;
  original.sessions.arrival.hints = 8;
  const raw = JSON.stringify(original);
  const storage = memoryStorage({ [key(1)]: raw });
  const saves = createStorage(storage, missions);
  const restored = saves.read(1);
  assert.deepEqual(restored, {
    ...original, practiceSessions: {},
    sessions: { arrival: { ...original.sessions.arrival, hintState: { targetId: null, depth: 0 }, hintLevel: 3 } }
  });
  assert.equal(storage.values.get(key(1)), raw);
  const imported = saves.import(2, raw);
  assert.deepEqual({ ...imported, updatedAt: restored.updatedAt }, restored);
});

test('practice shells, completion and reflections round-trip per slot without changing journey credit', () => {
  const saves = createStorage(memoryStorage(), missions);
  const original = validProgress();
  const rehearsal = session();
  rehearsal.tasks = [true, true];
  rehearsal.commands = 14;
  rehearsal.shell.files['/home/trainee/report.txt'].content = 'New practice evidence.\n';
  const draft = structuredClone(original);
  draft.practiceSessions.arrival = { variant: 2, session: rehearsal, completed: true, note: '<b>A practice reflection.</b>' };
  const saved = saves.write(1, draft);
  for (const field of ['completed', 'currentMission', 'scores', 'notes', 'sessions']) assert.deepEqual(saved[field], original[field]);
  const imported = saves.import(3, saves.export(1));
  assert.deepEqual({ ...imported, updatedAt: saved.updatedAt }, saved);
  saves.write(2, { ...original, practiceSessions: { arrival: { variant: 3, session: session() } } });
  assert.equal(saves.read(1).practiceSessions.arrival.variant, 2);
  assert.equal(saves.read(2).practiceSessions.arrival.variant, 3);
  assert.equal(saves.read(2).practiceSessions.arrival.completed, false);
  assert.equal(saves.read(2).practiceSessions.arrival.note, '');
  imported.practiceSessions.arrival.session.shell.files['/home/trainee/report.txt'].content = 'Outside mutation';
  assert.equal(saves.read(1).practiceSessions.arrival.session.shell.files['/home/trainee/report.txt'].content, 'New practice evidence.\n');
  assert.equal(saves.read(1).sessions.arrival.shell.files['/home/trainee/report.txt'].content, original.sessions.arrival.shell.files['/home/trainee/report.txt'].content);
});

test('practice completion for a later lesson grants no canonical completion, score or unlock', () => {
  const profile = createProgress(missions);
  const later = session();
  later.tasks = [true];
  profile.practiceSessions.signal = { variant: 1, session: later, completed: true };
  profile.currentMission = 'signal';
  const normalized = normalizeProgress(profile, missions);
  assert.equal(normalized.currentMission, 'arrival');
  assert.deepEqual(normalized.completed, []);
  assert.deepEqual(normalized.scores, {});
  assert.deepEqual(normalized.sessions, {});
  assert.equal(normalized.practiceSessions.signal.completed, true);
});

test('all generated practice fixture shells and original objective IDs persist in validated sessions', () => {
  const profile = createProgress(curriculumMissions);
  for (const base of curriculumMissions) {
    const practice = createPracticeMission(base, MAX_PRACTICE_VARIANT);
    profile.practiceSessions[base.id] = {
      variant: MAX_PRACTICE_VARIANT, completed: false,
      session: { shell: createShell(practice.fixtures), tasks: practice.objectives.map(() => false), started: true, commands: 0, hints: 2, elapsed: 1, hintState: { targetId: base.objectives[0].id, depth: 1 }, hintLevel: 1 }
    };
  }
  const saves = createStorage(memoryStorage(), curriculumMissions);
  const saved = saves.write(1, profile);
  const imported = saves.import(2, saves.export(1));
  assert.deepEqual({ ...imported, updatedAt: saved.updatedAt }, saved);
  assert.equal(Object.keys(imported.practiceSessions).length, 24);
  assert.deepEqual(imported.completed, []);
});

test('invalid practice wrappers and sessions cannot replace a valid existing save', () => {
  const saves = createStorage(memoryStorage(), missions);
  const valid = validProgress();
  valid.practiceSessions.arrival = { variant: 1, session: session(), completed: false, note: '' };
  const original = saves.write(1, valid);
  const mutations = [
    p => { p.practiceSessions.unknown = p.practiceSessions.arrival; },
    p => { p.practiceSessions.arrival.variant = 0; },
    p => { p.practiceSessions.arrival.variant = MAX_PRACTICE_VARIANT + 1; },
    p => { p.practiceSessions.arrival.variant = 1.5; },
    p => { p.practiceSessions.arrival.variant = '1'; },
    p => { delete p.practiceSessions.arrival.variant; },
    p => { delete p.practiceSessions.arrival.session; },
    p => { p.practiceSessions.arrival.completed = 'true'; },
    p => { p.practiceSessions.arrival.completed = null; },
    p => { p.practiceSessions.arrival.note = null; },
    p => { p.practiceSessions.arrival.note = 'x'.repeat(2001); },
    p => { p.practiceSessions.arrival.note = 'invalid\0note'; },
    p => { p.practiceSessions.arrival.xp = 100; },
    p => { p.practiceSessions.arrival.session.tasks = [true]; },
    p => { p.practiceSessions.arrival.session.shell.cwd = '/home/../trainee'; },
    p => { p.practiceSessions.arrival.session.commands = -1; },
    p => { p.practiceSessions.arrival.session.shell.files['/home/trainee/report.txt'].content = 'x'.repeat(32769); }
  ];
  for (const mutate of mutations) {
    const draft = structuredClone(valid);
    mutate(draft);
    assert.throws(() => saves.import(1, JSON.stringify(draft)), error => error instanceof SaveError);
    assert.deepEqual(saves.read(1), original);
  }
});

test('coach hints validate objective identity and bounded strength in canonical and practice sessions', () => {
  const course = [{ id: 'arrival', objectives: [{ id: 'location' }, { id: 'decision' }] }];
  const profile = createProgress(course);
  profile.sessions.arrival = session();
  profile.sessions.arrival.hints = 6;
  profile.sessions.arrival.hintState = { targetId: 'location', depth: 2 };
  profile.sessions.arrival.hintLevel = 2;
  profile.practiceSessions.arrival = { variant: 2, session: session() };
  profile.practiceSessions.arrival.session.hintState = { targetId: 'decision', depth: 3 };
  assert.equal(normalizeProgress(profile, course).sessions.arrival.hintLevel, 2);
  assert.equal(normalizeProgress(profile, course).practiceSessions.arrival.session.hintState.targetId, 'decision');
  const mutations = [
    s => { s.hintState = null; },
    s => { s.hintState.targetId = 'other-lesson'; },
    s => { s.hintState.targetId = false; },
    s => { s.hintState.depth = -1; },
    s => { s.hintState.depth = 4; },
    s => { s.hintState.depth = 1.5; },
    s => { s.hintState.depth = null; },
    s => { s.hintState.extra = true; },
    s => { s.hintLevel = 4; },
    s => { s.hintLevel = '1'; },
    s => { s.hintLevel = null; }
  ];
  for (const target of ['canonical', 'practice']) {
    for (const mutate of mutations) {
      const draft = structuredClone(profile);
      mutate(target === 'canonical' ? draft.sessions.arrival : draft.practiceSessions.arrival.session);
      assert.throws(() => normalizeProgress(draft, course), error => error instanceof SaveError && ['INVALID_SAVE', 'UNKNOWN_FIELD'].includes(error.code));
    }
  }
});

test('completed or explicitly skipped tutorial stays remembered across save and export', () => {
  const saves = createStorage(memoryStorage(), missions);
  const progress = validProgress();
  progress.settings.tutorialSeen = true;
  const saved = saves.write(1, progress);
  assert.equal(saves.read(1).settings.tutorialSeen, true);
  const restored = saves.import(3, saves.export(1));
  assert.equal(restored.settings.tutorialSeen, true);
  assert.deepEqual({ ...restored, updatedAt: saved.updatedAt }, saved);
  for (const invalid of ['true', 1, null, [], {}]) {
    progress.settings.tutorialSeen = invalid;
    assert.throws(() => saves.import(1, JSON.stringify(progress)), code('INVALID_SAVE'));
    assert.equal(saves.read(1).settings.tutorialSeen, true);
  }
});

test('slot APIs strictly reject out-of-range and noninteger slot values', () => {
  const saves = createStorage(memoryStorage(), missions);
  for (const slot of [0, 4, -1, 1.5, '1', null, undefined, NaN]) {
    for (const operation of [() => saves.read(slot), () => saves.write(slot, {}), () => saves.remove(slot), () => saves.export(slot), () => saves.import(slot, '{}'), () => saves.setActiveSlot(slot)]) {
      assert.throws(operation, code('INVALID_SLOT'));
    }
  }
  assert.throws(() => saves.export(1), code('EMPTY_SLOT'));
});

test('a corrupted saved slot reports the problem without overwriting its source', () => {
  const storage = memoryStorage({ [key(1)]: '{ broken json' });
  const saves = createStorage(storage, missions);
  assert.throws(() => saves.read(1), code('INVALID_JSON'));
  assert.equal(storage.values.get(key(1)), '{ broken json');
  assert.equal(saves.read(2), null);
});

test('invalid imports leave existing progress intact and explain the failure', () => {
  const saves = createStorage(memoryStorage(), missions);
  const original = saves.write(1, validProgress());
  const cases = [
    ['{', 'INVALID_JSON'],
    ['null', 'INVALID_SAVE'],
    ['[]', 'INVALID_SAVE'],
    ['{"version":6}', 'UNSUPPORTED_VERSION'],
    ['{"notes":{"unknown":"text"}}', 'UNKNOWN_MISSION'],
    ['{"completed":["office"]}', 'UNKNOWN_MISSION'],
    ['{"currentMission":"unknown"}', 'UNKNOWN_MISSION'],
    ['{"settings":{"motion":"yes"}}', 'INVALID_SAVE'],
    ['{"settings":{"motion":true,"tracking":true}}', 'UNKNOWN_FIELD'],
    ['{"scores":{"arrival":{"stars":4,"hints":0,"commands":2,"seconds":1}}}', 'INVALID_SAVE'],
    ['{"updatedAt":"2026-02-30T00:00:00.000Z"}', 'INVALID_SAVE']
  ];
  for (const [json, expected] of cases) {
    assert.throws(() => saves.import(1, json), code(expected));
    assert.deepEqual(saves.read(1), original);
  }
});

test('reserved prototype keys and accessor objects never enter a save', () => {
  const saves = createStorage(memoryStorage(), missions);
  for (const json of ['{"__proto__":{"polluted":true}}', '{"notes":{"constructor":"value"}}', '{"settings":{"prototype":true}}']) {
    assert.throws(() => saves.import(1, json), code('UNSAFE_KEY'));
  }
  assert.equal({}.polluted, undefined);
  const object = {};
  Object.defineProperty(object, 'completed', { get() { throw new Error('Getter should not run'); }, enumerable: true });
  assert.throws(() => normalizeProgress(object, missions), code('INVALID_SAVE'));
  assert.throws(() => normalizeProgress(Object.create({ completed: [] }), missions), code('INVALID_SAVE'));
});

test('simulated file paths cannot escape via relative paths, traversal or host schemes', () => {
  for (const unsafe of ['../report.txt', '/home/../etc/key', '/home//trainee/report', 'file:///etc/passwd', 'C:\\secret', '/home/trainee/./report', '/home/trainee/report\0']) {
    const progress = validProgress();
    const file = progress.sessions.arrival.shell.files['/home/trainee/report.txt'];
    progress.sessions.arrival.shell.files = { [unsafe]: file };
    assert.throws(() => normalizeProgress(progress, missions), error => error instanceof SaveError && ['UNSAFE_PATH', 'INVALID_SAVE'].includes(error.code));
  }
  const missingDirectory = validProgress();
  missingDirectory.sessions.arrival.shell.cwd = '/missing';
  assert.throws(() => normalizeProgress(missingDirectory, missions), code('INVALID_SAVE'));
});

test('session data is bounded and permissions survive reload', () => {
  const progress = validProgress();
  progress.sessions.arrival.shell.files['/home/trainee/report.txt'].mode = 0o600;
  const normalized = normalizeProgress(progress, missions);
  assert.equal(normalized.sessions.arrival.shell.files['/home/trainee/report.txt'].mode, '600');
  assert.deepEqual(normalized.sessions.arrival.shell.directoryModes, { '/home/trainee': '700' });
  for (const mutate of [
    p => { p.sessions.arrival.tasks.push(true); },
    p => { p.sessions.arrival.tasks = []; },
    p => { p.sessions.arrival.tasks = [true]; },
    p => { delete p.sessions.arrival.tasks; },
    p => { p.sessions.arrival.tasks[0] = 1; },
    p => { p.sessions.arrival.elapsed = Infinity; },
    p => { p.sessions.arrival.hints = -1; },
    p => { p.sessions.arrival.shell.history = Array(101).fill('pwd'); },
    p => { p.sessions.arrival.shell.files['/home/trainee/report.txt'].content = 'a'.repeat(32769); },
    p => { p.sessions.arrival.shell.directoryModes['/not-here'] = '700'; }
  ]) {
    const invalid = validProgress();
    mutate(invalid);
    assert.throws(() => normalizeProgress(invalid, missions), code('INVALID_SAVE'));
  }
});

test('import size is limited by UTF-8 bytes and strings remain inert plain text', () => {
  const saves = createStorage(memoryStorage(), missions);
  assert.throws(() => saves.import(1, ' '.repeat(MAX_SAVE_BYTES + 1)), code('SAVE_TOO_LARGE'));
  assert.throws(() => saves.import(1, JSON.stringify({ notes: { arrival: '🦉'.repeat(MAX_SAVE_BYTES / 4) } })), code('SAVE_TOO_LARGE'));
  const content = '<img src=x onerror="window.hacked=true">';
  const progress = createProgress(missions);
  progress.notes.arrival = content;
  assert.equal(saves.import(1, JSON.stringify(progress)).notes.arrival, content);
  assert.equal(saves.read(1).notes.arrival, content);
});

test('exports near the size limit remain importable even when indentation would exceed it', () => {
  const saves = createStorage(memoryStorage(), missions);
  const progress = validProgress();
  const files = progress.sessions.arrival.shell.files;
  for (let index = 0; index < 32; index++) files[`/home/trainee/large-${index}.txt`] = { content: '', mode: '644', mtime: 0 };
  let remaining = MAX_SAVE_BYTES - 10 - new TextEncoder().encode(JSON.stringify(progress)).byteLength;
  for (let index = 0; index < 32 && remaining > 0; index++) {
    const length = Math.min(32768, remaining);
    files[`/home/trainee/large-${index}.txt`].content = 'a'.repeat(length);
    remaining -= length;
  }
  saves.write(1, progress);
  const exported = saves.export(1);
  assert.ok(new TextEncoder().encode(exported).byteLength <= MAX_SAVE_BYTES);
  assert.equal(saves.import(2, exported).sessions.arrival.shell.files['/home/trainee/large-0.txt'].content.length, 32768);
});

test('missing or throwing browser storage retains usable independent memory saves', () => {
  for (const storage of [undefined, { getItem() { throw new Error('Blocked'); }, setItem() {}, removeItem() {} }]) {
    const saves = createStorage(storage, missions);
    assert.equal(saves.available, false);
    saves.write(1, validProgress());
    saves.setActiveSlot(3);
    assert.equal(saves.read(1).currentMission, 'archive');
    assert.equal(saves.read(2), null);
    assert.equal(saves.activeSlot(), 3);
    saves.remove(1);
    assert.equal(saves.read(1), null);
  }
});

test('write failures retain cached existing slots and the latest save in memory', () => {
  const storage = memoryStorage({ [key(1)]: JSON.stringify(validProgress()) });
  const saves = createStorage(storage, missions);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  saves.write(2, createProgress(missions));
  assert.equal(saves.available, false);
  assert.equal(saves.read(1).currentMission, 'archive');
  assert.equal(saves.read(2).currentMission, 'arrival');
  assert.equal(storage.values.get(key(2)), undefined);
});

test('legacy migration retains source, notes and XP without granting new curriculum clears', () => {
  const legacy = JSON.stringify({ mission: 2, cleared: [0, 1], xp: 260, notes: { evidence: 'Read the file before acting.' }, files: { '/home/analyst/file': { text: 'Original evidence' } } });
  const storage = memoryStorage({ 'terminal-trails-v2-slot-1': legacy, 'terminal-trails-v2-active-slot': '1' });
  const saves = createStorage(storage, missions);
  assert.deepEqual(saves.migrateLegacy(), { migrated: [1], warnings: [] });
  const profile = saves.read(1);
  assert.equal(profile.migrationNotice, true);
  assert.equal(profile.settings.tutorialSeen, false);
  assert.deepEqual(profile.completed, []);
  assert.equal(profile.currentMission, 'arrival');
  assert.deepEqual(profile.legacyProgress, { completed: 2, xp: 260, notes: { evidence: 'Read the file before acting.' } });
  assert.equal(storage.values.get('terminal-trails-v2-slot-1'), legacy);
  assert.deepEqual(saves.migrateLegacy(), { migrated: [], warnings: [] });
  const imported = saves.import(2, legacy);
  assert.equal(imported.settings.tutorialSeen, false);
  assert.deepEqual(imported.legacyProgress, profile.legacyProgress);
  assert.deepEqual(imported.completed, []);
  assert.equal(saves.import(3, saves.export(1)).migrationNotice, true);
});

test('migration skips current saves and reports malformed legacy sources individually', () => {
  const legacy = JSON.stringify({ cleared: [], xp: 0, notes: {}, files: {} });
  const existing = JSON.stringify(validProgress());
  const storage = memoryStorage({ [key(1)]: existing, 'terminal-trails-v2-slot-1': legacy, 'terminal-trails-v2-slot-2': '{', 'terminal-trails-v1': legacy });
  const saves = createStorage(storage, missions);
  const report = saves.migrateLegacy();
  assert.deepEqual(report.migrated, []);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].slot, 2);
  assert.equal(report.warnings[0].code, 'INVALID_JSON');
  assert.equal(storage.values.get(key(1)), existing);
  assert.equal(storage.values.get('terminal-trails-v2-slot-2'), '{');
  assert.equal(saves.read(2), null);
});

test('v1 migration and remembered active-slot validation preserve original metadata', () => {
  const legacy = JSON.stringify({ cleared: [0], xp: 100, files: {}, notes: {} });
  const storage = memoryStorage({ 'terminal-trails-v1': legacy, 'terminal-trails-v2-active-slot': '3' });
  const saves = createStorage(storage, missions);
  assert.deepEqual(saves.migrateLegacy().migrated, [1]);
  assert.equal(saves.activeSlot(), 3);
  assert.equal(storage.values.get('terminal-trails-v1'), legacy);
  storage.values.set('terminal-trails-v5-active-slot', '99');
  assert.throws(() => saves.activeSlot(), code('INVALID_ACTIVE_SLOT'));
  saves.setActiveSlot(2);
  assert.equal(saves.activeSlot(), 2);
});
