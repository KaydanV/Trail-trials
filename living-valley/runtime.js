/** Shared Living Valley state. Everything here is a local, bounded simulation. */
import {createShell, execute, matchesObjective} from './shell.js';
import {makeReviewMission} from './review.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'terminal-trails-living-valley-v1';
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
const MAX_TRANSCRIPT = 300;
const MAX_TEXT = 65536;
const pending = new WeakSet();
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
const transcriptKinds = new Set(['system', 'command', 'output', 'feedback', 'error']);
const phases = new Set(['discover', 'practice', 'prove', 'boss']);
const clone = value => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();

export class JourneyError extends Error {
  constructor(code, message) { super(message); this.name = 'JourneyError'; this.code = code; }
}
function fail(code, message) { throw new JourneyError(code, message); }
function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('INVALID_SAVE', `${label} must be a plain object.`);
  return value;
}
function keys(value, allowed, label) {
  plain(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('UNKNOWN_FIELD', `${label} contains an unsupported field: ${key}.`);
}
function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) fail('INVALID_SAVE', `${label} must be text of at most ${max} characters without null bytes.`);
  return value;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_SAVE', `${label} must be a whole number between ${min} and ${max}.`);
  return value;
}
function duration(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 31536000) fail('INVALID_SAVE', `${label} must be a duration between zero and one year.`);
  return value;
}
function bool(value, label) {
  if (typeof value !== 'boolean') fail('INVALID_SAVE', `${label} must be true or false.`);
  return value;
}
function list(value, max, label) {
  if (!Array.isArray(value) || value.length > max) fail('INVALID_SAVE', `${label} must be a list with at most ${max} entries.`);
  return value;
}
function exactList(value, length, label) {
  list(value, length, label);
  if (value.length !== length) fail('INVALID_SAVE', `${label} has the wrong length for this encounter.`);
  return value;
}
function stamp(value, label) {
  text(value, 40, label);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) fail('INVALID_SAVE', `${label} must be an ISO date.`);
  return value;
}
function safeTree(input) {
  const ancestors = new Set();
  let count = 0;
  function visit(value, depth) {
    if (++count > 250000 || depth > 24) fail('INVALID_SAVE', 'The journey contains too much nested data.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('INVALID_SAVE', 'Journey numbers must be finite.'); return; }
    if (typeof value !== 'object') fail('INVALID_SAVE', 'A journey may contain only plain JSON data.');
    if (ancestors.has(value)) fail('INVALID_SAVE', 'A journey cannot contain circular data.');
    if (Array.isArray(value)) { if (Object.getPrototypeOf(value) !== Array.prototype) fail('INVALID_SAVE', 'Journey arrays must be plain arrays.'); }
    else plain(value, 'Journey data');
    if (Object.getOwnPropertySymbols(value).length) fail('INVALID_SAVE', 'A journey cannot contain symbol keys.');
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (reserved.has(key)) fail('UNSAFE_KEY', `The journey contains a reserved key: ${key}.`);
      if (!Object.hasOwn(descriptor, 'value')) fail('INVALID_SAVE', 'A journey cannot contain accessor properties.');
      if (Array.isArray(value) && key === 'length') continue;
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
  }
  visit(input, 0);
}
function missionMap(missions) {
  if (!Array.isArray(missions) || !missions.length || missions.length > 256) fail('INVALID_CURRICULUM', 'A journey needs between one and 256 authored encounters.');
  const result = new Map();
  for (const mission of missions) {
    if (!mission || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(mission.id) || reserved.has(mission.id) || result.has(mission.id)) fail('INVALID_CURRICULUM', 'Encounter identifiers must be unique, safe text.');
    if (!Array.isArray(mission.steps) || !mission.steps.length || mission.steps.length > 32 || !Array.isArray(mission.questions) || mission.questions.length > 12) fail('INVALID_CURRICULUM', 'Each encounter needs bounded steps and questions.');
    if (!phases.has(mission.phase)) fail('INVALID_CURRICULUM', 'Each encounter needs a known learning phase.');
    result.set(mission.id, mission);
  }
  return result;
}
function append(session, kind, value, stepId) {
  const entry = {kind, text: String(value).slice(0, MAX_TEXT)};
  if (stepId) entry.stepId = stepId;
  session.transcript.push(entry);
  if (session.transcript.length > MAX_TRANSCRIPT) session.transcript.splice(0, session.transcript.length - MAX_TRANSCRIPT);
}
function gate(mission, session, index) {
  if (session.completed) return 'This encounter is complete. Start a return trip for fresh practice.';
  if (!Number.isInteger(index) || index < 0 || index >= mission.steps.length) return 'Choose a valid encounter step.';
  if (index !== currentStep(mission, session)) return 'Follow the current clue before moving to another step.';
  if (pending.has(session)) return 'Wait for the current command to finish.';
  return null;
}
function mark(mission, session, index) {
  session.done[index] = true;
  const feedback = mission.steps[index].feedback;
  if (feedback?.text) append(session, 'feedback', `${feedback.speaker || 'NOVA'}: ${feedback.text}`, mission.steps[index].id);
  return {ok: true, completedStep: index, feedback};
}

export function createSession(mission) {
  return {
    shell: createShell(mission.fixtures || {}, mission.shell),
    done: mission.steps.map(() => false),
    hints: mission.steps.map(() => 0),
    attempts: mission.steps.map(() => 0),
    activity: mission.steps.map(() => ({inspected: []})),
    answers: mission.questions.map(() => null),
    transcript: [{kind: 'system', text: String(mission.briefing?.why || mission.summary || 'Your field tools are ready.').slice(0, MAX_TEXT)}],
    elapsed: 0,
    started: false,
    completed: false,
  };
}

export function currentStep(mission, session) {
  const index = session.done.findIndex(value => value !== true);
  return index < 0 ? mission.steps.length : index;
}

export async function runCommand(mission, session, raw) {
  const index = currentStep(mission, session);
  // Evidence collection is not a command lock: before the debrief, the player
  // may still inspect the artifacts they just created. Completed story attempts
  // remain unchanged; fresh work belongs in a separate return trip.
  const allCollected = index === mission.steps.length;
  const reason = allCollected && !session.completed
    ? (pending.has(session) ? 'Wait for the current command to finish.' : null)
    : gate(mission, session, index);
  if (reason) return {ok: false, error: true, output: '', reason};
  const step = mission.steps[Math.min(index, mission.steps.length - 1)];
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2048 || raw.includes('\0')) return {ok: false, error: true, output: '', reason: 'Enter a command of at most 2048 characters.'};
  pending.add(session);
  session.attempts[Math.min(index, mission.steps.length - 1)]++;
  append(session, 'command', raw, step.id);
  try {
    const result = await execute(session.shell, raw);
    const output = String(result.output || '');
    if (output) append(session, result.error ? 'error' : 'output', output, step.id);
    // The wrapper can verify an intentional stderr-capture file even when the source
    // command fails. Its matcher still rejects failed command/read objectives.
    if (!allCollected && step.check?.type !== 'activity' && matchesObjective({check: step.check}, result, session.shell)) return {...mark(mission, session, index), error: !!result.error, output};
    if (result.error) return {ok: false, error: true, output, reason: output.trim() || 'The command could not run.'};
    return {ok: true, error: false, output, reason: step.check?.type !== 'activity' ? 'Command completed. Compare its result with your current clue.' : 'Command completed. Use the current field tool to examine this clue.'};
  } catch (error) {
    const output = `Field terminal: ${error?.message || 'The command could not run.'}`;
    append(session, 'error', output, step.id);
    return {ok: false, error: true, output, reason: output};
  } finally { pending.delete(session); }
}

function requiredItems(step) {
  const activity = step.activity;
  if (Array.isArray(activity.requiredInspect)) return activity.requiredInspect;
  const authored = (activity.items || []).filter(item => item.correct === true).map(item => item.id);
  if (authored.length) return authored;
  // Compatibility for early authored inspect activities; never used for choices.
  if (activity.kind === 'inspect' && Array.isArray(step.solution?.inspect)) return step.solution.inspect;
  return [];
}
function allInspected(step, state) { return requiredItems(step).every(id => state.inspected.includes(id)); }

export function inspectItem(mission, session, index, itemId) {
  const reason = gate(mission, session, index);
  if (reason) return {ok: false, reason};
  const step = mission.steps[index], activity = step.activity;
  if (!activity) return {ok: false, reason: 'This clue uses the terminal, not an inspection panel.'};
  const item = activity.items?.find(item => item.id === itemId);
  if (!item) return {ok: false, reason: 'That item is not part of this scene.'};
  session.attempts[index]++;
  if (!session.activity[index].inspected.includes(itemId)) session.activity[index].inspected.push(itemId);
  const result = {ok: true, text: String(item.detail || '')};
  append(session, 'output', `${item.label || item.id}\n${result.text}`, step.id);
  if (activity.kind === 'inspect' && requiredItems(step).length > 0 && allInspected(step, session.activity[index])) return {...result, ...mark(mission, session, index)};
  return result;
}

function sameOrder(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function containsAnchor(value, anchor) {
  const needle = String(anchor).trim().toLocaleLowerCase('en-US');
  const source = value.toLocaleLowerCase('en-US');
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(source);
}

/** Pure assessment: no execution, progression changes, or invented observations. */
function gradeActivity(step, state, submission) {
  const activity = step.activity;
  if (!activity) return {ok: false, reason: 'Use the terminal to investigate this clue.'};
  if (!allInspected(step, state)) return {ok: false, reason: 'Inspect the relevant evidence before making this call.'};
  let correct = false, accepted, explanation = 'Compare your response with the evidence and try again.';
  switch (activity.kind) {
    case 'inspect':
      return {ok: false, reason: 'Open the relevant evidence item to inspect it.'};
    case 'choose':
    case 'compare': {
      const choice = activity.choices?.find(choice => choice.id === submission.choice);
      correct = choice?.correct === true;
      accepted = {choice: submission.choice};
      explanation = choice?.feedback || 'Choose an action from the available options.';
      break;
    }
    case 'classify': {
      const assignments = submission.classifications;
      const items = activity.items || [];
      correct = !!assignments && typeof assignments === 'object' && !Array.isArray(assignments) && items.length > 0 && Object.keys(assignments).length === items.length && items.every(item => assignments[item.id] === item.category && activity.categories?.some(category => category.id === item.category));
      accepted = {classifications: assignments};
      explanation = 'Match every item with the category supported by its evidence.';
      break;
    }
    case 'sequence':
    case 'connect':
      correct = Array.isArray(activity.order) && activity.order.length > 0 && sameOrder(submission.order, activity.order);
      accepted = {order: submission.order};
      explanation = activity.kind === 'connect' ? 'Check each connection against the route evidence.' : 'Check which step depends on the one before it.';
      break;
    case 'report': {
      const fields = submission.fields;
      const expected = activity.fields || [];
      correct = !!fields && typeof fields === 'object' && !Array.isArray(fields) && expected.length > 0 && Object.keys(fields).length === expected.length && expected.every(field => typeof fields[field.id] === 'string' && fields[field.id].length <= 4000 && fields[field.id].trim().length > 0 && (field.required || []).every(anchor => containsAnchor(fields[field.id], anchor)));
      accepted = {fields};
      explanation = 'Use the observed facts in each field. Keep pending actions and unknowns explicit.';
      break;
    }
    case 'repair': {
      // A text review is not execution. Real script lessons run the bounded terminal interpreter.
      if (activity.tests?.length) return {ok: false, reason: 'This repair needs a terminal execution check; text alone cannot demonstrate its behavior.'};
      correct = typeof submission.text === 'string' && submission.text.length <= MAX_TEXT && Array.isArray(activity.expected) && activity.expected.length > 0 && activity.expected.every(fragment => submission.text.includes(fragment));
      accepted = {text: submission.text};
      explanation = 'Compare the text with the stated review requirements. This checks text, not script execution.';
      break;
    }
    default:
      return {ok: false, reason: 'This field tool has no supported assessment yet.'};
  }
  if (!correct) return {ok: false, reason: explanation};
  return {ok: true, submission: clone(accepted), ...(activity.kind === 'repair' ? {validation: 'text-only'} : {})};
}

export function submitActivity(mission, session, index, submission) {
  const reason = gate(mission, session, index);
  if (reason) return {ok: false, reason};
  const step = mission.steps[index];
  if (!step.activity) return {ok: false, reason: 'Use the terminal to investigate this clue.'};
  try { safeTree(submission); plain(submission, 'Activity response'); }
  catch { return {ok: false, reason: 'Choose a valid response in this field tool.'}; }
  session.attempts[index]++;
  const assessed = gradeActivity(step, session.activity[index], submission);
  if (!assessed.ok) { append(session, 'feedback', assessed.reason, step.id); return assessed; }
  session.activity[index].submission = assessed.submission;
  return {...mark(mission, session, index), ...(assessed.validation ? {validation: assessed.validation} : {})};
}

export function requestHint(mission, session, index = currentStep(mission, session)) {
  const reason = gate(mission, session, index);
  if (reason) return {text: reason, depth: 0};
  session.hints[index]++;
  const depth = Math.min(session.hints[index], 4);
  const hints = mission.steps[index].hints || [];
  const hint = hints[depth - 1] || hints.at(-1) || 'Revisit the current clue and the evidence you have already collected.';
  append(session, 'feedback', `PATCH: ${hint}`, mission.steps[index].id);
  return {text: hint, depth};
}

export function answerQuestion(mission, session, index, answer) {
  if (session.completed || currentStep(mission, session) < mission.steps.length || !Number.isInteger(index) || !mission.questions[index] || !Number.isInteger(answer) || answer < 0 || answer >= mission.questions[index].options.length) return {correct: false, explanation: 'Collect the current evidence, then choose an available answer.'};
  session.answers[index] = answer;
  const question = mission.questions[index];
  const correct = answer === question.answer;
  return {correct, explanation: correct ? question.explanation : `Not yet. ${question.explanation}`};
}

export function canComplete(mission, session) {
  return session.done.length === mission.steps.length && session.done.every(value => value === true) && session.answers.length === mission.questions.length && mission.questions.every((question, index) => session.answers[index] === question.answer);
}

export function completeMission(mission, session, reflection = '') {
  if (!canComplete(mission, session)) fail('INCOMPLETE_ENCOUNTER', 'Collect every clue and answer every debrief question before completing this encounter.');
  text(reflection, 4000, 'Reflection');
  const hints = session.hints.reduce((total, count) => total + count, 0);
  session.completed = true;
  return {
    missionId: mission.id, phase: mission.phase,
    introduced: mission.phase === 'discover',
    independent: mission.phase !== 'discover' && hints === 0,
    hints, attempts: session.attempts.reduce((total, count) => total + count, 0),
    reflection: reflection.trim(), elapsed: duration(session.elapsed ?? 0, 'Practice time'), completedAt: now(),
  };
}

export function createProfile(missions) {
  const map = missionMap(missions);
  return {version: SAVE_VERSION, currentMission: map.keys().next().value, completed: [], sessions: {}, records: {}, practiceSessions: {}, settings: {motion: true, sound: false, textSize: 'normal', timer: false}, updatedAt: now()};
}

function canonicalPath(value, label) {
  text(value, 240, label);
  if (!value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value) || value.includes('//') || (value.length > 1 && value.endsWith('/')) || value.split('/').some(part => part === '.' || part === '..')) fail('UNSAFE_PATH', `${label} must be a canonical path inside the simulation.`);
  return value;
}
function mode(value, label) {
  if (typeof value !== 'string' || !/^[0-7]{3,4}$/.test(value)) fail('INVALID_SAVE', `${label} must be an octal permission mode.`);
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function validateShell(value, mission) {
  keys(value, ['cwd', 'files', 'directories', 'directoryModes', 'history', 'config', 'platform', 'variables', 'exported', 'lastStatus', 'processes', 'services'], 'Field shell');
  const trusted = createShell(mission.fixtures || {}, mission.shell || {});
  if (stable(value.config) !== stable(trusted.config) || value.platform !== trusted.platform) fail('INVALID_SAVE', 'A journey cannot change the scenario permissions, network configuration, or operating-system model.');
  const cwd = canonicalPath(value.cwd, 'Working directory');
  const directories = list(value.directories, 512, 'Simulated directories').map(path => canonicalPath(path, 'Directory'));
  if (new Set(directories).size !== directories.length || !directories.includes('/') || !directories.includes(cwd)) fail('INVALID_SAVE', 'The shell needs its root and current directory without duplicate directories.');
  for (const directory of directories) if (directory !== '/' && !directories.includes(directory.slice(0, directory.lastIndexOf('/')) || '/')) fail('INVALID_SAVE', 'A simulated directory is missing its parent.');
  plain(value.files, 'Simulated files');
  if (Object.keys(value.files).length > 512) fail('INVALID_SAVE', 'An encounter has too many simulated files.');
  const files = {};
  for (const [path, file] of Object.entries(value.files)) {
    canonicalPath(path, 'File');
    if (path === '/' || directories.includes(path) || !directories.includes(path.slice(0, path.lastIndexOf('/')) || '/')) fail('INVALID_SAVE', 'A simulated file needs an existing parent and cannot also be a directory.');
    keys(file, ['content', 'mode', 'mtime', 'owner', 'group'], 'Simulated file');
    if (!Number.isFinite(file.mtime) || file.mtime < 0 || file.mtime > 1e15) fail('INVALID_SAVE', 'File modification time is invalid.');
    const owner = text(file.owner ?? 'trainee', 80, 'File owner'), group = text(file.group ?? 'trainee', 80, 'File group');
    if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(group)) fail('INVALID_SAVE', 'File ownership must use fictional account identifiers.');
    files[path] = {content: text(file.content, 32768, 'File content'), mode: mode(file.mode, 'File permissions'), mtime: file.mtime, owner, group};
  }
  plain(value.directoryModes, 'Directory permissions');
  const directoryModes = {};
  for (const [path, permissions] of Object.entries(value.directoryModes)) {
    if (!directories.includes(path)) fail('INVALID_SAVE', 'Directory permissions refer to a missing directory.');
    directoryModes[path] = mode(permissions, 'Directory permissions');
  }
  const history = list(value.history, 100, 'Command history').map(command => text(command, 2048, 'Previous command'));
  plain(value.variables, 'Training variables');
  if (Object.keys(value.variables).length > 64) fail('INVALID_SAVE', 'The shell contains too many training variables.');
  const variables = {};
  for (const [name, content] of Object.entries(value.variables)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,79}$/.test(name)) fail('INVALID_SAVE', 'A training variable has an invalid name.');
    variables[name] = text(content, 32768, 'Training variable');
  }
  const exported = list(value.exported ?? trusted.exported ?? ['HOME', 'USER'], 64, 'Exported variable names').map(name => {
    if (typeof name !== 'string' || !Object.hasOwn(variables, name)) fail('INVALID_SAVE', 'An exported variable must name an existing training variable.');
    return name;
  });
  if (new Set(exported).size !== exported.length) fail('INVALID_SAVE', 'Exported variable names contain duplicates.');
  const lastStatus = integer(value.lastStatus, 0, 2, 'Last command status');
  const processes = list(value.processes, 256, 'Simulated processes');
  const processIds = new Set();
  for (const process of processes) {
    const original = trusted.processes.find(item => item.pid === process.pid);
    if (!original || stable(original) !== stable(process) || processIds.has(process.pid)) fail('INVALID_SAVE', 'The process inventory contains an invented or changed process.');
    processIds.add(process.pid);
  }
  const authorized = Array.isArray(trusted.config.authorizedActions) ? trusted.config.authorizedActions : [];
  for (const process of trusted.processes) if (!processIds.has(process.pid) && (process.protected || !authorized.includes(`kill:${process.pid}`))) fail('INVALID_SAVE', 'A protected or unauthorized process is missing.');
  plain(value.services, 'Simulated services');
  if (Object.keys(value.services).length !== Object.keys(trusted.services).length) fail('INVALID_SAVE', 'The service inventory does not match this scenario.');
  const services = {};
  for (const [name, original] of Object.entries(trusted.services)) {
    const service = value.services[name];
    keys(service, ['active', 'description', 'log'], 'Simulated service');
    bool(service.active, 'Service state');
    if (service.description !== original.description) fail('INVALID_SAVE', 'A service description was changed outside the scenario.');
    const log = text(service.log ?? '', MAX_TEXT, 'Service log');
    const initialLog = original.log || '';
    if (!log.startsWith(initialLog)) fail('INVALID_SAVE', 'The original service evidence must be retained.');
    const additions = log.slice(initialLog.length);
    const appended = additions ? additions.split('\n').slice(0, -1) : [];
    if (additions && !additions.endsWith('\n')) fail('INVALID_SAVE', 'A service state change has an incomplete log record.');
    let expectedActive = original.active;
    for (const line of appended) {
      const action = ['start', 'stop', 'restart'].find(action => line === `Authorized ${action}: ${name}`);
      const alias = name.replace(/\.service$/, '');
      if (!action || (!authorized.includes(`service:${name}:${action}`) && !authorized.includes(`service:${alias}:${action}`))) fail('INVALID_SAVE', 'The service log includes an unauthorized change.');
      expectedActive = action !== 'stop';
    }
    if (service.active !== expectedActive) fail('INVALID_SAVE', 'The service state does not match its authorized changes.');
    services[name] = clone(service);
  }
  return {cwd, files, directories, directoryModes, history, config: trusted.config, platform: trusted.platform, variables, exported, lastStatus, processes: clone(processes), services};
}

function validateSession(value, mission) {
  keys(value, ['shell', 'done', 'hints', 'attempts', 'activity', 'answers', 'transcript', 'elapsed', 'started', 'completed'], 'Encounter session');
  const count = mission.steps.length;
  const done = exactList(value.done, count, 'Verified steps').map(item => bool(item, 'Verified step'));
  let gap = false;
  for (const complete of done) { if (!complete) gap = true; else if (gap) fail('INVALID_SAVE', 'Verified encounter steps must form a continuous route.'); }
  const hints = exactList(value.hints, count, 'Hints').map(item => integer(item, 0, 100000, 'Hint count'));
  const attempts = exactList(value.attempts, count, 'Attempts').map(item => integer(item, 0, 1000000, 'Attempt count'));
  const activity = exactList(value.activity, count, 'Field tool state').map((state, index) => {
    keys(state, ['inspected', 'submission'], 'Inspected evidence');
    const allowed = mission.steps[index].activity?.items?.map(item => item.id) || [];
    const inspected = list(state.inspected, allowed.length, 'Inspected items').map(id => {
      if (!allowed.includes(id)) fail('INVALID_SAVE', 'An inspected item is not part of this clue.');
      return id;
    });
    if (new Set(inspected).size !== inspected.length) fail('INVALID_SAVE', 'Inspected evidence contains duplicates.');
    const normalized = {inspected};
    const step = mission.steps[index];
    if (state.submission !== undefined) {
      if (!step.activity || step.activity.kind === 'inspect' || !done[index]) fail('INVALID_SAVE', 'Only a verified field activity can contain an accepted response.');
      plain(state.submission, 'Accepted field response');
      const assessed = gradeActivity(step, normalized, state.submission);
      if (!assessed.ok || stable(assessed.submission) !== stable(state.submission)) fail('INVALID_SAVE', 'A saved field response does not satisfy its authored evidence requirements.');
      normalized.submission = assessed.submission;
    }
    if (done[index] && step.activity && step.activity.kind !== 'inspect' && !normalized.submission) fail('INVALID_SAVE', 'A completed field activity is missing the player’s accepted response.');
    return normalized;
  });
  const answers = exactList(value.answers, mission.questions.length, 'Debrief answers').map((answer, index) => answer === null ? null : integer(answer, 0, mission.questions[index].options.length - 1, 'Debrief answer'));
  const transcript = list(value.transcript, MAX_TRANSCRIPT, 'Field transcript').map(entry => {
    keys(entry, ['kind', 'text', 'stepId'], 'Transcript entry');
    if (!transcriptKinds.has(entry.kind)) fail('INVALID_SAVE', 'A transcript entry has an unknown type.');
    const result = {kind: entry.kind, text: text(entry.text, MAX_TEXT, 'Transcript text')};
    if (entry.stepId !== undefined) {
      if (!mission.steps.some(step => step.id === entry.stepId)) fail('INVALID_SAVE', 'A transcript entry refers to an unknown clue.');
      result.stepId = entry.stepId;
    }
    return result;
  });
  const result = {shell: validateShell(value.shell, mission), done, hints, attempts, activity, answers, transcript, elapsed: duration(value.elapsed ?? 0, 'Practice time'), started: bool(value.started, 'Encounter start'), completed: bool(value.completed, 'Encounter completion')};
  if (result.completed && !canComplete(mission, result)) fail('INVALID_SAVE', 'A completed encounter is missing evidence or a correct debrief.');
  if (answers.some(answer => answer !== null) && !done.every(Boolean)) fail('INVALID_SAVE', 'Debrief answers cannot precede the required evidence.');
  for (let index = 0; index < count; index++) {
    if (done[index] && mission.steps[index].activity && !allInspected(mission.steps[index], activity[index])) fail('INVALID_SAVE', 'A completed field tool is missing its required inspected evidence.');
    if (index > currentStep(mission, result) && (hints[index] || attempts[index] || activity[index].inspected.length)) fail('INVALID_SAVE', 'A future clue contains actions before its prerequisites.');
  }
  return result;
}

function validateRecord(value, mission, session) {
  keys(value, ['missionId', 'phase', 'introduced', 'independent', 'hints', 'attempts', 'reflection', 'elapsed', 'completedAt'], 'Completion record');
  if (value.missionId !== mission.id || value.phase !== mission.phase) fail('INVALID_SAVE', 'A completion record does not match its encounter.');
  const hints = integer(value.hints, 0, 3200000, 'Recorded hint count');
  const attempts = integer(value.attempts, 0, 32000000, 'Recorded attempt count');
  if (!session?.completed || hints !== session.hints.reduce((sum, count) => sum + count, 0) || attempts !== session.attempts.reduce((sum, count) => sum + count, 0)) fail('INVALID_SAVE', 'A completion record does not match its saved attempt.');
  if (bool(value.introduced, 'Introduction record') !== (mission.phase === 'discover') || bool(value.independent, 'Independent record') !== (mission.phase !== 'discover' && hints === 0)) fail('INVALID_SAVE', 'Learning evidence must distinguish introduction, help, and independent completion.');
  const elapsed = duration(value.elapsed ?? 0, 'Recorded practice time');
  if (elapsed !== session.elapsed) fail('INVALID_SAVE', 'The recorded practice time does not match its saved attempt.');
  return {missionId: mission.id, phase: mission.phase, introduced: value.introduced, independent: value.independent, hints, attempts, reflection: text(value.reflection, 4000, 'Reflection'), elapsed, completedAt: stamp(value.completedAt, 'Completion date')};
}

export function validateProfile(input, missions) {
  safeTree(input);
  keys(input, ['version', 'currentMission', 'completed', 'sessions', 'records', 'practiceSessions', 'settings', 'updatedAt'], 'Living Valley journey');
  if (input.version !== SAVE_VERSION) fail('UNSUPPORTED_VERSION', `This is not a Living Valley version ${SAVE_VERSION} journey. Your original Hike Trail saves remain separate.`);
  const map = missionMap(missions), ids = [...map.keys()];
  const completed = list(input.completed, ids.length, 'Completed encounters');
  if (!completed.every((id, index) => id === ids[index])) fail('INVALID_SAVE', 'Completed encounters must follow the authored chapter route without gaps or duplicates.');
  const maxUnlocked = Math.min(completed.length, ids.length - 1);
  if (!map.has(input.currentMission) || ids.indexOf(input.currentMission) > maxUnlocked) fail('LOCKED_ENCOUNTER', 'The selected encounter has not been unlocked.');
  keys(input.settings, ['motion', 'sound', 'textSize', 'timer'], 'Journey settings');
  if (!['normal', 'large'].includes(input.settings.textSize)) fail('INVALID_SAVE', 'Choose a supported reading size.');
  const settings = {motion: bool(input.settings.motion, 'Motion setting'), sound: bool(input.settings.sound, 'Sound setting'), textSize: input.settings.textSize, timer: bool(input.settings.timer, 'Timer setting')};
  plain(input.sessions, 'Encounter sessions'); plain(input.records, 'Completion records');
  const sessions = {}, records = {};
  for (const [id, session] of Object.entries(input.sessions)) {
    if (!map.has(id) || ids.indexOf(id) > maxUnlocked) fail('UNKNOWN_ENCOUNTER', 'The journey contains an unknown or locked encounter session.');
    sessions[id] = validateSession(session, map.get(id));
  }
  for (const [id, record] of Object.entries(input.records)) {
    if (!map.has(id) || !completed.includes(id)) fail('UNKNOWN_ENCOUNTER', 'The journey contains a record for an uncompleted or unknown encounter.');
    records[id] = validateRecord(record, map.get(id), sessions[id]);
  }
  if (!completed.every(id => sessions[id]?.completed && records[id])) fail('INVALID_SAVE', 'Completed progress needs its saved evidence and completion record.');
  for (const [id, session] of Object.entries(sessions)) if (session.completed && !completed.includes(id)) fail('INVALID_SAVE', 'A completed attempt must have its chapter progress and record.');
  plain(input.practiceSessions || {}, 'Return trips');
  const practiceSessions = {};
  for (const [id, entry] of Object.entries(input.practiceSessions || {})) {
    if (!map.has(id) || !completed.includes(id)) fail('LOCKED_ENCOUNTER', 'Return trips are available only for completed story encounters.');
    keys(entry, ['variant', 'session', 'record'], 'Return trip');
    const variant = integer(entry.variant, 1, 10000, 'Return-trip number');
    const reviewed = makeReviewMission(map.get(id), variant);
    const session = validateSession(entry.session, reviewed);
    const normalized = {variant, session};
    if (entry.record !== undefined) normalized.record = validateRecord(entry.record, reviewed, session);
    if (session.completed && !normalized.record) fail('INVALID_SAVE', 'A completed return trip needs its own completion record.');
    practiceSessions[id] = normalized;
  }
  return {version: SAVE_VERSION, currentMission: input.currentMission, completed: [...completed], sessions, records, practiceSessions, settings, updatedAt: stamp(input.updatedAt, 'Save date')};
}

function serialize(profile, missions) {
  const normalized = validateProfile(profile, missions);
  const json = JSON.stringify(normalized, null, 2);
  if (new TextEncoder().encode(json).byteLength > MAX_SAVE_BYTES) fail('SAVE_TOO_LARGE', 'This journey is larger than 8 MB. Shorten your saved notes or simulated files.');
  return {json, profile: normalized};
}
function parse(textValue, missions) {
  if (typeof textValue !== 'string') fail('INVALID_JSON', 'Choose a JSON Living Valley journey file.');
  if (new TextEncoder().encode(textValue).byteLength > MAX_SAVE_BYTES) fail('SAVE_TOO_LARGE', 'Living Valley journey files must be smaller than 8 MB.');
  let value;
  try { value = JSON.parse(textValue); } catch { fail('INVALID_JSON', 'The selected file is not valid JSON.'); }
  return validateProfile(value, missions);
}

export function createStorage(missions, backend) {
  missionMap(missions);
  let memory = createProfile(missions), available = true, warning = '';
  let store = backend;
  if (arguments.length < 2) {
    try { store = globalThis.localStorage; } catch { store = null; }
  }
  if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') {
    available = false; warning = 'Browser storage is unavailable. Export your journey before closing this tab.';
  }
  function fallback(message) { available = false; warning = message; }
  return {
    get available() { return available; },
    get warning() { return warning; },
    read() {
      if (!available) return clone(memory);
      let raw;
      try { raw = store.getItem(SAVE_KEY); }
      catch { fallback('Browser storage could not be read. This temporary journey can still be exported.'); return clone(memory); }
      if (raw === null) return clone(memory);
      try { memory = parse(raw, missions); }
      catch (error) { fallback(`The saved journey could not be loaded: ${error.message} The stored copy was preserved; this tab uses a temporary journey.`); }
      return clone(memory);
    },
    write(profile) {
      const saved = serialize({...profile, updatedAt: now()}, missions);
      memory = clone(saved.profile);
      if (!available) return;
      try { store.setItem(SAVE_KEY, saved.json); }
      catch { fallback('Browser storage could not save this journey. Keep the tab open and export a backup.'); }
    },
    export(profile) { return serialize(profile, missions).json; },
    import(json) { return parse(json, missions); },
    reset() {
      const profile = createProfile(missions);
      // An explicit reset may replace an unreadable Living Valley save. Ordinary
      // writes in temporary mode preserve it until the player makes that choice.
      if (store && typeof store.getItem === 'function' && typeof store.setItem === 'function') { available = true; warning = ''; }
      this.write(profile);
      return clone(profile);
    },
  };
}
