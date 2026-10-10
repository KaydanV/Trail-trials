import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, normalizeProgress, createStorage, SaveError, MAX_SAVE_BYTES } from '../src/storage.js';

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
    tasks: [true, false], started: true, commands: 2, hints: 0, elapsed: 12.5
  };
}
function validProgress() {
  return {
    ...createProgress(missions), completed: ['arrival'], currentMission: 'archive',
    notes: { arrival: 'I checked who and where I was before working.' },
    scores: { arrival: { stars: 3, hints: 0, commands: 2, seconds: 12.5 } },
    sessions: { arrival: session() }, settings: { motion: false, practice: true }
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
  assert.deepEqual(second.settings, { motion: true, practice: true });
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
  assert.deepEqual(profile.completed, []);
  assert.equal(profile.currentMission, 'arrival');
  assert.deepEqual(profile.legacyProgress, { completed: 2, xp: 260, notes: { evidence: 'Read the file before acting.' } });
  assert.equal(storage.values.get('terminal-trails-v2-slot-1'), legacy);
  assert.deepEqual(saves.migrateLegacy(), { migrated: [], warnings: [] });
  const imported = saves.import(2, legacy);
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
