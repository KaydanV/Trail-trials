/** Local saves contain text and simulated files only. Render their strings with textContent. */
export const SAVE_VERSION = 5;
export const MAX_SAVE_BYTES = 1024 * 1024;

const SLOT_PREFIX = 'terminal-trails-v5-slot-';
const ACTIVE_KEY = 'terminal-trails-v5-active-slot';
const LEGACY_PREFIX = 'terminal-trails-v2-slot-';
const LEGACY_ACTIVE_KEY = 'terminal-trails-v2-active-slot';
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PROFILE_KEYS = ['version', 'currentMission', 'completed', 'notes', 'scores', 'settings', 'sessions', 'practiceSessions', 'updatedAt', 'migrationNotice', 'legacyProgress'];
const encoder = new TextEncoder();

export class SaveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

function fail(code, message) { throw new SaveError(code, message); }
function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail('INVALID_SAVE', `${label} must be a plain object.`);
  }
  return value;
}
function allowedKeys(value, keys, label) {
  record(value, label);
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) fail('UNKNOWN_FIELD', `${label} contains an unsupported field: ${key}.`);
  }
}
function safeTree(input) {
  let visited = 0;
  const ancestors = new Set();
  function visit(value, depth) {
    if (++visited > 20000 || depth > 12) fail('INVALID_SAVE', 'The save contains too much nested data.');
    if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) return;
    if (typeof value !== 'object') fail('INVALID_SAVE', 'Saves may contain only JSON data.');
    if (ancestors.has(value)) fail('INVALID_SAVE', 'Saves may not contain circular data.');
    if (!Array.isArray(value)) record(value, 'Save data');
    else if (Object.getPrototypeOf(value) !== Array.prototype) fail('INVALID_SAVE', 'Save arrays must be plain arrays.');
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (FORBIDDEN_KEYS.has(key)) fail('UNSAFE_KEY', `The save contains a reserved key: ${key}.`);
      if (!Object.hasOwn(descriptor, 'value')) fail('INVALID_SAVE', 'Save data may not contain accessor properties.');
      if (Array.isArray(value) && key === 'length') continue;
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
  }
  visit(input, 0);
}
function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) {
    fail('INVALID_SAVE', `${label} must be text of at most ${max} characters without null bytes.`);
  }
  return value;
}
function number(value, max, label, { min = 0, integer = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    fail('INVALID_SAVE', `${label} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`);
  }
  return value;
}
function boolean(value, label) {
  if (typeof value !== 'boolean') fail('INVALID_SAVE', `${label} must be true or false.`);
  return value;
}
function array(value, max, label) {
  if (!Array.isArray(value) || value.length > max) fail('INVALID_SAVE', `${label} must be a list of at most ${max} entries.`);
  return value;
}
function missionList(missions) {
  if (!Array.isArray(missions) || !missions.length) fail('INVALID_MISSIONS', 'At least one mission is needed to prepare a save.');
  const ids = missions.map(mission => typeof mission === 'string' ? mission : mission?.id);
  if (ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id) || FORBIDDEN_KEYS.has(id)) || new Set(ids).size !== ids.length) {
    fail('INVALID_MISSIONS', 'Mission IDs must be unique, safe text identifiers.');
  }
  return ids;
}
function missionMap(value, ids, label, normalize) {
  record(value, label);
  const result = {};
  for (const [id, data] of Object.entries(value)) {
    if (!ids.includes(id)) fail('UNKNOWN_MISSION', `${label} refers to an unknown mission: ${id}.`);
    result[id] = normalize(data, id);
  }
  return result;
}
function path(value, label) {
  text(value, 240, label);
  if (!value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value) || value.includes('//') || (value.length > 1 && value.endsWith('/')) || value.split('/').some(part => part === '.' || part === '..')) {
    fail('UNSAFE_PATH', `${label} must be a canonical absolute path in the simulated filesystem.`);
  }
  // A leading scheme, drive letter, relative path, or traversal can never become a host path.
  return value;
}
function shell(value) {
  allowedKeys(value, ['cwd', 'files', 'directories', 'history', 'directoryModes'], 'Mission shell');
  const cwd = path(value.cwd, 'Current directory');
  const directories = [...new Set(array(value.directories, 512, 'Simulated directories').map(item => path(item, 'Directory path')))];
  if (!directories.includes('/') || !directories.includes(cwd)) fail('INVALID_SAVE', 'The simulated root and current directory must exist.');
  for (const directory of directories) {
    const parent = directory.slice(0, directory.lastIndexOf('/')) || '/';
    if (!directories.includes(parent)) fail('INVALID_SAVE', `The parent directory of ${directory} is missing.`);
  }
  record(value.directoryModes ?? {}, 'Directory permissions');
  const directoryModes = {};
  for (const [directory, mode] of Object.entries(value.directoryModes ?? {})) {
    if (!directories.includes(directory)) fail('INVALID_SAVE', 'Directory permissions refer to a missing simulated directory.');
    directoryModes[directory] = normalizeMode(mode);
  }
  record(value.files, 'Simulated files');
  if (Object.keys(value.files).length > 512) fail('INVALID_SAVE', 'A mission may contain at most 512 simulated files.');
  const files = {};
  for (const [name, file] of Object.entries(value.files)) {
    path(name, 'File path');
    if (name === '/' || directories.includes(name)) fail('INVALID_SAVE', 'A simulated file cannot also be a directory.');
    const parent = name.slice(0, name.lastIndexOf('/')) || '/';
    if (!directories.includes(parent)) fail('INVALID_SAVE', `The parent directory of ${name} is missing.`);
    allowedKeys(file, ['content', 'mode', 'mtime'], 'Simulated file');
    files[name] = {
      content: text(file.content, 32768, 'Simulated file content'),
      mode: file.mode === undefined ? '644' : normalizeMode(file.mode),
      mtime: file.mtime === undefined ? 0 : number(file.mtime, 1e15, 'File modification time', { integer: false })
    };
  }
  const history = array(value.history ?? [], 100, 'Command history').map(item => text(item, 2048, 'History command'));
  return { cwd, files, directories, history, directoryModes };
}
function normalizeMode(value) {
  if (typeof value === 'string' && /^[0-7]{3,4}$/.test(value)) return value;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0o7777) return value.toString(8).padStart(3, '0');
  fail('INVALID_SAVE', 'File permissions must be a valid octal mode.');
}
function legacySummary(value) {
  allowedKeys(value, ['completed', 'xp', 'notes'], 'Previous-edition progress');
  record(value.notes ?? {}, 'Previous-edition notes');
  const notes = {};
  if (Object.keys(value.notes ?? {}).length > 64) fail('INVALID_SAVE', 'Previous-edition notes contain too many entries.');
  for (const [id, note] of Object.entries(value.notes ?? {})) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id)) fail('INVALID_SAVE', 'A previous-edition note has an invalid identifier.');
    notes[id] = text(note, 10000, 'Previous-edition note');
  }
  return { completed: number(value.completed ?? 0, 100, 'Previous-edition completions'), xp: number(value.xp ?? 0, 10000000, 'Previous-edition XP'), notes };
}
function parseJSON(json) {
  if (typeof json !== 'string') fail('INVALID_JSON', 'Choose a JSON progress file.');
  if (encoder.encode(json).byteLength > MAX_SAVE_BYTES) fail('SAVE_TOO_LARGE', 'Progress files must be smaller than 1 MB.');
  let parsed;
  try { parsed = JSON.parse(json); }
  catch { fail('INVALID_JSON', 'The progress file is not valid JSON.'); }
  safeTree(parsed);
  return parsed;
}
function serialize(profile) {
  const json = JSON.stringify(profile);
  if (encoder.encode(json).byteLength > MAX_SAVE_BYTES) fail('SAVE_TOO_LARGE', 'This save exceeds the 1 MB limit. Shorten notes or simulated files.');
  return json;
}

export function createProgress(missions) {
  const ids = missionList(missions);
  return {
    version: SAVE_VERSION, currentMission: ids[0], completed: [], notes: {}, scores: {},
    settings: { motion: true, practice: true, tutorialSeen: false }, sessions: {}, practiceSessions: {}, updatedAt: new Date().toISOString()
  };
}

/** Validates all data, fills absent defaults, and clamps selection to sequential unlocks. */
export function normalizeProgress(input, missions) {
  const ids = missionList(missions);
  safeTree(input);
  allowedKeys(input, PROFILE_KEYS, 'Progress');
  if (input.version !== undefined && input.version !== SAVE_VERSION) fail('UNSUPPORTED_VERSION', `This progress version is not supported. Expected version ${SAVE_VERSION}.`);
  const result = createProgress(missions);
  const completed = array(input.completed ?? [], ids.length, 'Completed missions');
  for (const id of completed) if (!ids.includes(id)) fail('UNKNOWN_MISSION', 'Completed progress refers to an unknown mission.');
  result.completed = ids.filter(id => completed.includes(id));
  const firstIncomplete = ids.findIndex(id => !result.completed.includes(id));
  const maxUnlocked = firstIncomplete < 0 ? ids.length - 1 : firstIncomplete;
  const requestedMission = input.currentMission ?? ids[0];
  if (!ids.includes(requestedMission)) fail('UNKNOWN_MISSION', 'The selected mission is unknown.');
  result.currentMission = ids[Math.min(ids.indexOf(requestedMission), maxUnlocked)];
  result.notes = missionMap(input.notes ?? {}, ids, 'Notes', note => text(note, 10000, 'Mission note'));
  result.scores = missionMap(input.scores ?? {}, ids, 'Scores', value => {
    allowedKeys(value, ['stars', 'hints', 'commands', 'seconds'], 'Mission score');
    return {
      stars: number(value.stars, 3, 'Stars', { min: 1 }),
      hints: number(value.hints, 10000, 'Hint count'), commands: number(value.commands, 100000, 'Command count'),
      seconds: number(value.seconds, 31536000, 'Mission time', { integer: false })
    };
  });
  allowedKeys(input.settings ?? {}, ['motion', 'practice', 'tutorialSeen'], 'Settings');
  result.settings = {
    motion: input.settings?.motion === undefined ? true : boolean(input.settings.motion, 'Motion setting'),
    practice: input.settings?.practice === undefined ? true : boolean(input.settings.practice, 'Practice setting'),
    tutorialSeen: input.settings?.tutorialSeen === undefined ? false : boolean(input.settings.tutorialSeen, 'Tutorial setting')
  };
  const normalizeSession = (value, id) => {
    allowedKeys(value, ['shell', 'tasks', 'started', 'commands', 'hints', 'elapsed', 'hintState', 'hintLevel'], 'Mission session');
    const mission = missions[ids.indexOf(id)];
    const objectiveCount = typeof mission === 'object' && Array.isArray(mission.objectives) ? mission.objectives.length : null;
    const maxTasks = objectiveCount ?? (typeof mission === 'object' && Array.isArray(mission.tasks) ? mission.tasks.length : 100);
    const tasks = array(value.tasks ?? [], maxTasks, 'Mission tasks').map(item => boolean(item, 'Task status'));
    if (objectiveCount !== null && tasks.length !== objectiveCount) fail('INVALID_SAVE', `Mission ${id} must contain exactly ${objectiveCount} objective statuses.`);
    const hints = number(value.hints ?? 0, 10000, 'Session hint count');
    const hintState = value.hintState === undefined ? { targetId: null, depth: 0 } : value.hintState;
    allowedKeys(hintState, ['targetId', 'depth'], 'Hint state');
    const targetId = hintState.targetId ?? null;
    if (targetId !== null) {
      text(targetId, 80, 'Hint objective');
      if (!mission?.objectives?.some(objective => objective.id === targetId)) fail('INVALID_SAVE', 'Hints refer to an unknown mission objective.');
    }
    return {
      shell: shell(value.shell), tasks, started: boolean(value.started ?? false, 'Session status'),
      commands: number(value.commands ?? 0, 100000, 'Session command count'),
      hints, elapsed: number(value.elapsed ?? 0, 31536000, 'Session time', { integer: false }),
      hintState: { targetId, depth: number(hintState.depth === undefined ? 0 : hintState.depth, 3, 'Hint depth') },
      hintLevel: number(value.hintLevel === undefined ? Math.min(3, hints) : value.hintLevel, 3, 'Hint level')
    };
  };
  result.sessions = missionMap(input.sessions ?? {}, ids, 'Sessions', normalizeSession);
  // Practice stores its own shell and objective evidence; it never grants journey credit.
  result.practiceSessions = missionMap(input.practiceSessions ?? {}, ids, 'Practice sessions', (value, id) => {
    allowedKeys(value, ['variant', 'session', 'completed', 'note'], 'Practice session');
    return {
      variant: number(value.variant, 100000, 'Practice variant', { min: 1 }),
      session: normalizeSession(value.session, id),
      completed: value.completed === undefined ? false : boolean(value.completed, 'Practice completion'),
      note: text(value.note === undefined ? '' : value.note, 2000, 'Practice reflection')
    };
  });
  if (input.updatedAt !== undefined) {
    const date = text(input.updatedAt, 40, 'Save date');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 19) !== date.slice(0, 19)) fail('INVALID_SAVE', 'The save date must be a valid UTC ISO timestamp.');
    result.updatedAt = new Date(date).toISOString();
  }
  if (input.migrationNotice !== undefined) result.migrationNotice = boolean(input.migrationNotice, 'Migration notice');
  if (input.legacyProgress !== undefined) result.legacyProgress = legacySummary(input.legacyProgress);
  serialize(result);
  return result;
}

function migrateProfile(input, missions) {
  record(input, 'Previous-edition progress');
  if (!Array.isArray(input.cleared) || !input.files || typeof input.files !== 'object') fail('INVALID_LEGACY_SAVE', 'The previous-edition save is missing its progress or files.');
  const cleared = array(input.cleared, 100, 'Previous-edition completions');
  for (const index of cleared) number(index, 99, 'Previous-edition mission index');
  const progress = createProgress(missions);
  progress.migrationNotice = true;
  progress.legacyProgress = legacySummary({ completed: new Set(cleared).size, xp: input.xp ?? 0, notes: input.notes ?? {} });
  return progress;
}
function validSlot(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) fail('INVALID_SLOT', 'Choose a save slot from 1 to 3.');
  return slot;
}

/** Storage failures keep this page's progress in memory; inspect available to show a notice. */
export function createStorage(storage, missions) {
  missionList(missions);
  const memory = new Map();
  let available = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function' && typeof storage.removeItem === 'function');
  function get(key) {
    if (available) {
      try {
        const value = storage.getItem(key);
        if (value === null) memory.delete(key);
        else memory.set(key, String(value));
      } catch { available = false; }
    }
    return memory.get(key) ?? null;
  }
  function put(key, value) {
    memory.set(key, value);
    if (available) try { storage.setItem(key, value); } catch { available = false; }
  }
  function remove(key) {
    memory.delete(key);
    if (available) try { storage.removeItem(key); } catch { available = false; }
  }
  // Keep readable existing saves if a later write or quota error makes storage unavailable.
  for (const key of [ACTIVE_KEY, LEGACY_ACTIVE_KEY, 'terminal-trails-v1', ...[1, 2, 3].flatMap(slot => [SLOT_PREFIX + slot, LEGACY_PREFIX + slot])]) get(key);
  if (available) {
    const probe = `${SLOT_PREFIX}probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { storage.setItem(probe, '1'); storage.removeItem(probe); }
    catch { available = false; }
  }
  const api = {
    get available() { return available; },
    read(slot) {
      const json = get(SLOT_PREFIX + validSlot(slot));
      return json === null ? null : normalizeProgress(parseJSON(json), missions);
    },
    write(slot, input) {
      validSlot(slot);
      const progress = normalizeProgress(input, missions);
      progress.updatedAt = new Date().toISOString();
      put(SLOT_PREFIX + slot, serialize(progress));
      return progress;
    },
    remove(slot) { remove(SLOT_PREFIX + validSlot(slot)); },
    export(slot) {
      const progress = api.read(slot);
      if (!progress) fail('EMPTY_SLOT', 'This save slot is empty. Start a journey before exporting.');
      const readable = JSON.stringify(progress, null, 2);
      // Pretty-printing must not push an otherwise valid save beyond the import limit.
      return encoder.encode(readable).byteLength <= MAX_SAVE_BYTES ? readable : serialize(progress);
    },
    import(slot, json) {
      validSlot(slot);
      const input = parseJSON(json);
      const progress = input && input.version === undefined && Object.hasOwn(input, 'cleared') ? migrateProfile(input, missions) : normalizeProgress(input, missions);
      return api.write(slot, progress);
    },
    activeSlot() {
      const value = get(ACTIVE_KEY);
      if (value === null) return 1;
      if (!/^[123]$/.test(value)) fail('INVALID_ACTIVE_SLOT', 'The remembered save slot is invalid. Choose a slot to continue.');
      return Number(value);
    },
    setActiveSlot(slot) { put(ACTIVE_KEY, String(validSlot(slot))); return slot; },
    migrateLegacy() {
      const report = { migrated: [], warnings: [] };
      for (const slot of [1, 2, 3]) {
        if (get(SLOT_PREFIX + slot) !== null) continue;
        const source = get(LEGACY_PREFIX + slot) ?? (slot === 1 ? get('terminal-trails-v1') : null);
        if (source === null) continue;
        try {
          api.write(slot, migrateProfile(parseJSON(source), missions));
          report.migrated.push(slot);
        } catch (error) {
          report.warnings.push({ slot, code: error.code ?? 'INVALID_LEGACY_SAVE', message: error.message });
        }
      }
      if (get(ACTIVE_KEY) === null) {
        const oldActive = get(LEGACY_ACTIVE_KEY);
        if (oldActive !== null && /^[123]$/.test(oldActive)) api.setActiveSlot(Number(oldActive));
      }
      return report;
    }
  };
  return api;
}
