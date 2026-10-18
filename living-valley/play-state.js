/** Cosmetic adventure state. Nothing in this module awards learning credit. */
export const PLAY_SAVE_KEY = 'terminal-trails-play-v1';
export const PLAY_VERSION = 1;
export const MAX_PLAY_BYTES = 128 * 1024;
export const PLAY_SPAWN = Object.freeze({x: 18, y: 72});

const chapterSizes = [7, 8, 8, 7, 9, 8, 7, 8, 8, 7, 8, 7];
const missionIds = chapterSizes.flatMap((size, index) => {
  const chapter = `c${String(index + 1).padStart(2, '0')}`;
  return [...Array.from({length: size}, (_, lesson) => `${chapter}-${String(lesson + 1).padStart(2, '0')}`), `${chapter}-boss`];
});
const missionSet = new Set(missionIds);
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
const tutorialEvents = ['move', 'meet-patch', 'collect-part', 'open-pack', 'fit-part', 'talk-nova'];
const clone = value => JSON.parse(JSON.stringify(value));

/** All prices and rewards are cosmetic. Boss prizes follow completed encounters. */
export const catalog = Object.freeze([
  {id: 'starter-cap', label: 'Rookie ranger cap', slot: 'hat', price: 0, description: 'An excellent hat for someone who has not yet been chased by paperwork.', reaction: 'Patch salutes. The cap is approximately one size more official than either of you.'},
  {id: 'antenna-cap', label: 'Questionable antenna', slot: 'hat', price: 0, cache: 'c01-01:cache', description: 'Recovered from the supply crate. Reception: debatable. Style: undeniable.', reaction: 'Patch: “At last. A colleague with adequate aerial coverage.”'},
  {id: 'acorn-crown', label: 'Acorn crown', slot: 'hat', price: 0, award: 'c01-boss', description: 'The squirrels have recognised your extremely local authority.', reaction: 'Patch: “Your Majesty. Please do not declare war on the picnic table.”'},
  {id: 'mushroom-cap', label: 'Mushroom beret', slot: 'hat', price: 0, award: 'c02-boss', description: 'Archive-approved fungal fashion. Please keep away from the important papers.', reaction: 'Patch: “You look like a very approachable woodland accountant.”'},
  {id: 'ranger-hardhat', label: 'Observatory hard hat', slot: 'hat', price: 0, award: 'c04-boss', description: 'For falling pinecones and ideas that should have stayed ideas.', reaction: 'Patch knocks twice. “Excellent. Your thoughts are now weatherproof.”'},
  {id: 'starry-cap', label: 'Very serious wizard hat', slot: 'hat', price: 64, description: 'Nobody checked your wizard qualifications. The stars are sewn on.', reaction: 'Patch: “Can you cast find-my-biscuit? It is an advanced spell.”'},
  {id: 'none', label: 'Quiet footsteps', slot: 'trail', price: 0, description: 'Just you, your boots, and the occasional suspicious twig.', reaction: 'Patch whispers a dramatic walking soundtrack. It is mostly “dum dum dum”.'},
  {id: 'firefly-trail', label: 'Firefly entourage', slot: 'trail', price: 24, description: 'Tiny enthusiastic lights. Terrible at keeping a low profile.', reaction: 'Patch: “We have acquired a fan club. Six members. All luminous.”'},
  {id: 'lantern-trail', label: 'Lantern sparks', slot: 'trail', price: 0, award: 'c08-boss', description: 'A warm little reminder that you brought the light back.', reaction: 'Patch lowers his voice. “That one looks good on us.”'},
  {id: 'circuit-trail', label: 'Living signal', slot: 'trail', price: 0, award: 'c12-boss', description: 'The valley’s restored signal follows your footsteps.', reaction: 'Patch: “The valley is following you home. Politely. In spark form.”'},
  {id: 'pocket-torch', label: 'Pocket torch', slot: 'kit', price: 0, description: 'Standard ranger equipment. Point the bright end away from your face.', reaction: 'Patch: “I did check which end. Professionally.”'},
  {id: 'emergency-biscuit', label: 'Emergency biscuit tin', slot: 'kit', price: 0, cache: 'c01-01:cache', description: 'Recovered emergency rations. Patch has declared a standing emergency.', reaction: 'Patch: “We should inspect this evidence. With our mouths.”'},
].map(item => Object.freeze(item)));
export const playCatalog = catalog;
const catalogById = new Map(catalog.map(item => [item.id, item]));

export class PlayStateError extends Error {
  constructor(message) { super(message); this.name = 'PlayStateError'; this.code = 'INVALID_PLAY_SAVE'; }
}
function fail(message) { throw new PlayStateError(message); }
function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be a plain object.`);
}
function fields(value, expected, label) {
  plain(value, label);
  const own = Object.keys(value);
  if (own.length !== expected.length || own.some(key => !expected.includes(key))) fail(`${label} has unsupported or missing fields.`);
}
function safeTree(input) {
  const ancestors = new Set();
  let count = 0;
  function visit(value, depth) {
    if (++count > 5000 || depth > 8) fail('The adventure save contains too much nested data.');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') { if (value.length > 256 || value.includes('\0')) fail('Adventure text is too long or contains a null byte.'); return; }
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('Adventure numbers must be finite.'); return; }
    if (typeof value !== 'object') fail('An adventure save may contain only JSON data.');
    if (ancestors.has(value)) fail('An adventure save cannot be circular.');
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 256) fail('Adventure arrays must be plain, bounded lists.');
    } else plain(value, 'Adventure data');
    if (Object.getOwnPropertySymbols(value).length) fail('An adventure save cannot have symbol keys.');
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (reserved.has(key)) fail('An adventure save contains a reserved key.');
      if (!Object.hasOwn(descriptor, 'value')) fail('An adventure save cannot have accessor properties.');
      if (Array.isArray(value) && key === 'length') continue;
      if (!descriptor.enumerable) fail('Adventure properties must be enumerable JSON data.');
      if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) fail('Adventure lists cannot have named properties.');
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(value) && Object.keys(value).length !== value.length) fail('Adventure lists cannot contain empty slots.');
    ancestors.delete(value);
  }
  visit(input, 0);
  if (JSON.stringify(input).length > MAX_PLAY_BYTES) fail('The adventure save is too large.');
}
function uniqueList(value, allowed, label) {
  if (!Array.isArray(value) || value.length > 256 || value.some(item => typeof item !== 'string' || !allowed(item)) || new Set(value).size !== value.length) fail(`${label} contains an unknown or duplicate item.`);
}
function completedIds(profile) {
  const completed = profile?.completed || [];
  uniqueList(completed, id => missionSet.has(id), 'Completed encounters');
  return completed;
}
function canonicalMission(id) {
  if (typeof id !== 'string') return null;
  const base = id.replace(/:return:[1-9]\d{0,2}$/, '');
  return missionSet.has(base) ? base : null;
}
function scopeFor(mission) {
  const base = canonicalMission(typeof mission === 'string' ? mission : mission?.id);
  if (!base) return null;
  if (typeof mission === 'string') return mission;
  return Number.isInteger(mission.reviewVariant) && mission.reviewVariant > 0 && mission.reviewVariant <= 999 ? `${base}:return:${mission.reviewVariant}` : base;
}
function rewardAmount(id) { return id.endsWith('-boss') ? 40 : 8; }
function badgeFor(id) { return `chapter-${id.slice(1, 3)}`; }
function rewardBag(state) {
  return catalog.filter(item => ['starter-cap', 'none', 'pocket-torch'].includes(item.id) || state.purchased.includes(item.id) || item.award && state.rewarded.includes(item.award) || item.cache && state.collected.includes(item.cache)).map(item => item.id);
}
function earnedCoins(state) {
  return state.rewarded.reduce((sum, id) => sum + rewardAmount(id), 0) + state.collected.length * 3 - state.purchased.reduce((sum, id) => sum + catalogById.get(id).price, 0);
}
function sameSet(left, right) { return left.length === right.length && left.every(item => right.includes(item)); }

/** Old learning profiles migrate without altering a single learning record. */
export function createPlayState(profile = {}) {
  const completed = completedIds(profile);
  const state = {
    version: PLAY_VERSION,
    activeMission: missionSet.has(profile.currentMission) ? profile.currentMission : missionIds[Math.min(completed.length, missionIds.length - 1)],
    position: {...PLAY_SPAWN},
    equipped: {hat: 'starter-cap', trail: 'none'},
    bag: ['starter-cap', 'none', 'pocket-torch'],
    purchased: [],
    rewarded: [],
    collected: [],
    badges: [],
    coins: 0,
    tutorialStage: completed.includes('c01-01') ? 6 : 0,
  };
  syncPlayRewards(state, profile);
  return state;
}

/** Returns a detached JSON clone; rejects forged rewards and unsafe objects. */
export function validatePlayState(input, profile = {}) {
  safeTree(input);
  fields(input, ['version', 'activeMission', 'position', 'equipped', 'bag', 'purchased', 'rewarded', 'collected', 'badges', 'coins', 'tutorialStage'], 'Adventure save');
  if (input.version !== PLAY_VERSION) fail('This adventure save version is not supported.');
  const completed = completedIds(profile), completedSet = new Set(completed);
  const unlocked = id => missionIds.indexOf(id) <= completed.length;
  const active = canonicalMission(input.activeMission);
  if (!active || !unlocked(active)) fail('The saved location is not an unlocked encounter.');
  fields(input.position, ['x', 'y'], 'Player position');
  for (const value of Object.values(input.position)) if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) fail('Player coordinates must be between zero and 100.');
  fields(input.equipped, ['hat', 'trail'], 'Equipped accessories');
  uniqueList(input.purchased, id => catalogById.has(id) && catalogById.get(id).price > 0, 'Purchased accessories');
  uniqueList(input.rewarded, id => completedSet.has(id), 'Encounter rewards');
  uniqueList(input.collected, key => typeof key === 'string' && key.endsWith(':cache') && missionSet.has(key.slice(0, -6)) && unlocked(key.slice(0, -6)), 'Collected caches');
  uniqueList(input.badges, id => /^chapter-(0[1-9]|1[0-2])$/.test(id), 'Chapter trophies');
  uniqueList(input.bag, id => catalogById.has(id), 'Backpack');
  if (!sameSet(input.bag, rewardBag(input))) fail('The backpack contains an accessory that has not been acquired.');
  for (const slot of ['hat', 'trail']) {
    const item = catalogById.get(input.equipped[slot]);
    if (!item || item.slot !== slot || !input.bag.includes(item.id)) fail('An equipped accessory is missing from the backpack or belongs in another slot.');
  }
  const badges = input.rewarded.filter(id => id.endsWith('-boss')).map(badgeFor);
  if (!sameSet(input.badges, badges)) fail('Chapter trophies must match completed boss encounters.');
  if (!Number.isSafeInteger(input.coins) || input.coins < 0 || input.coins !== earnedCoins(input)) fail('The cosmetic coin balance does not match its reward ledger.');
  if (!Number.isInteger(input.tutorialStage) || input.tutorialStage < 0 || input.tutorialStage > 6) fail('The opening adventure stage must be between zero and six.');
  return clone(input);
}

/** Award each completed encounter exactly once; return trips do not mint coins. */
export function syncPlayRewards(state, profile = {}) {
  const summary = {changed: false, coins: 0, items: [], badges: []};
  for (const id of completedIds(profile)) {
    if (state.rewarded.includes(id)) continue;
    state.rewarded.push(id);
    state.coins += rewardAmount(id);
    summary.coins += rewardAmount(id);
    summary.changed = true;
    if (id.endsWith('-boss')) {
      const badge = badgeFor(id);
      if (!state.badges.includes(badge)) { state.badges.push(badge); summary.badges.push(badge); }
    }
    for (const item of catalog.filter(item => item.award === id)) {
      if (!state.bag.includes(item.id)) { state.bag.push(item.id); summary.items.push(item.id); }
    }
  }
  return summary;
}

/** Tutorial events are sent only by their actual public game action. */
export function advancePlayTutorial(state, event) {
  if (state.tutorialStage >= 6 || tutorialEvents[state.tutorialStage] !== event) return {changed: false, stage: state.tutorialStage};
  if (event === 'move' && Math.hypot(state.position.x - PLAY_SPAWN.x, state.position.y - PLAY_SPAWN.y) < 5) return {changed: false, stage: state.tutorialStage};
  if (event === 'collect-part' && !state.collected.includes('c01-01:cache')) return {changed: false, stage: state.tutorialStage};
  if (event === 'open-pack' && (state.equipped.hat === 'starter-cap' || !state.bag.includes(state.equipped.hat))) return {changed: false, stage: state.tutorialStage};
  state.tutorialStage++;
  return {changed: true, stage: state.tutorialStage};
}

/** Movement has a bounded world position, not a fake progress percentage. */
export function movePlayPlayer(state, x, y) {
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return {ok: false, changed: false, message: 'Choose a real place on the trail.'};
  const position = {x: Math.round(Math.max(0, Math.min(100, x)) * 100) / 100, y: Math.round(Math.max(0, Math.min(100, y)) * 100) / 100};
  const changed = position.x !== state.position.x || position.y !== state.position.y;
  state.position = position;
  const tutorial = advancePlayTutorial(state, 'move');
  return {ok: true, changed: changed || tutorial.changed, position: {...position}, tutorialStage: state.tutorialStage};
}

/** Buying/equipping never changes assessments, difficulty, or access to help. */
export function equipPlayItem(state, itemId) {
  const item = catalogById.get(itemId);
  if (!item || item.slot === 'kit') return {ok: false, changed: false, message: 'That belongs in your kit, not on your head. Patch has tried.'};
  let cost = 0;
  if (!state.bag.includes(item.id)) {
    if (!item.price) return {ok: false, changed: false, message: item.award ? 'That souvenir comes from a chapter boss. It will be waiting when you finish.' : 'Find that accessory out on the trail first.'};
    if (state.coins < item.price) return {ok: false, changed: false, message: `You need ${item.price - state.coins} more trail coins. The hat has agreed to wait.`};
    state.coins -= item.price;
    state.purchased.push(item.id);
    state.bag.push(item.id);
    cost = item.price;
  }
  const changed = state.equipped[item.slot] !== item.id || cost > 0;
  state.equipped[item.slot] = item.id;
  const tutorial = item.slot === 'hat' ? advancePlayTutorial(state, 'open-pack') : {changed: false};
  return {ok: true, changed: changed || tutorial.changed, cost, item: item.id, message: item.reaction, tutorialStage: state.tutorialStage};
}

const patchLines = [
  'Patch: “I packed a spare plan. It is the same plan, but folded differently.”',
  'Patch: “Good news: I have narrowed the problem down to something somewhere.”',
  'Patch is writing IMPORTANT FIELD NOTES. The first note is “bring more biscuits”.',
  'Patch: “If we get lost, look confident. Trees respect that.”',
];

/** Optional exploration rewards are once per authored place, including reviews. */
export function interactPlay(state, mission, objectId) {
  const scope = scopeFor(mission), base = canonicalMission(scope);
  if (!scope || !base) return {ok: false, changed: false, message: 'That trail is not on Nova’s map.'};
  if (typeof objectId !== 'string') return {ok: false, changed: false, message: 'Choose something on the trail.'};
  let changed = false;
  if (state.activeMission !== scope) { state.activeMission = scope; state.position = {...PLAY_SPAWN}; changed = true; }
  if (objectId === 'patch') {
    const tutorial = advancePlayTutorial(state, 'meet-patch');
    return {ok: true, changed: changed || tutorial.changed, message: state.tutorialStage === 2 ? 'Patch: “Ranger! I dropped a perfectly good antenna in that crate. Rescue it before Nova calls it ‘evidence of poor packing’.”' : patchLines[(missionIds.indexOf(base) + state.collected.length) % patchLines.length], tutorialStage: state.tutorialStage};
  }
  if (['cache', 'supply-crate', 'crate'].includes(objectId)) {
    const key = `${base}:cache`;
    if (state.collected.includes(key)) {
      const tutorial = base === 'c01-01' ? advancePlayTutorial(state, 'collect-part') : {changed: false};
      return {ok: true, changed: changed || tutorial.changed, message: 'The crate is empty. Patch checks anyway. “Still empty. Admirably consistent.”', tutorialStage: state.tutorialStage};
    }
    state.collected.push(key);
    state.coins += 3;
    const items = catalog.filter(item => item.cache === key).map(item => item.id);
    for (const id of items) if (!state.bag.includes(id)) state.bag.push(id);
    if (base === 'c01-01') advancePlayTutorial(state, 'collect-part');
    return {ok: true, changed: true, reward: {coins: 3, items}, message: items.length ? 'Inside: three trail coins, a questionable antenna, and the emergency biscuit tin. Patch: “A treasure chest with excellent priorities. Put the antenna on!”' : 'Three trail coins tumble out. Patch: “At last. Funding for our very serious hat budget.”', tutorialStage: state.tutorialStage};
  }
  const messages = {
    nova: 'Nova: “Bring me what you actually found. Patch’s increasingly elaborate theories are optional.”',
    sign: 'The sign says PLEASE DO NOT FEED THE ROUTERS. Someone has crossed out ROUTERS and written PATCH.',
    campfire: 'The fire crackles. Patch warms his hands, then remembers he is mostly metal. “Ambience still counts.”',
    gate: 'Patch peers down the trail. “New place, new mystery. Same excellent walking technique.”',
    bench: 'A tiny plaque reads: IN MEMORY OF THE BISCUIT PATCH PROMISED NOT TO EAT.',
    pond: 'You see a very capable ranger in the water. Patch sees a robot who could use a biscuit.',
    snack: state.bag.includes('emergency-biscuit') ? 'Patch: “The biscuit tin is safe. I have assigned myself round-the-clock supervision.”' : 'Patch: “I can sense a biscuit nearby. No, this is not one of the official diagnostic tools.”',
    flashlight: 'You flick on your pocket torch. Patch: “Excellent. Now we can make suspicious shadows on purpose.”',
    console: 'The field console blinks awake. Patch: “Your move. I will handle dramatic encouragement.”',
  };
  return Object.hasOwn(messages, objectId) ? {ok: true, changed, message: messages[objectId]} : {ok: false, changed, message: 'Patch squints. “I have no approved theory about that particular object.”'};
}

/** Resetting a place only moves the player; it cannot refill a collected crate. */
export function resetPlayMission(state, missionId) {
  const scope = scopeFor(missionId);
  if (!scope) return {ok: false, changed: false, message: 'Choose a place on the valley map.'};
  const changed = state.activeMission !== scope || state.position.x !== PLAY_SPAWN.x || state.position.y !== PLAY_SPAWN.y;
  state.activeMission = scope;
  state.position = {...PLAY_SPAWN};
  return {ok: true, changed, position: {...state.position}};
}

/** Invalid existing data is preserved for recovery rather than overwritten. */
export function loadPlayState(backend, profile = {}) {
  let raw;
  try { raw = backend?.getItem(PLAY_SAVE_KEY); }
  catch { return {state: createPlayState(profile), restored: false, error: 'The backpack could not be read. You can still play and export a backup.'}; }
  if (raw == null) return {state: createPlayState(profile), restored: false, error: null};
  try {
    if (typeof raw !== 'string' || raw.length > MAX_PLAY_BYTES) fail('The adventure save is too large.');
    const state = validatePlayState(JSON.parse(raw), profile);
    syncPlayRewards(state, profile);
    return {state, restored: true, error: null};
  } catch (error) {
    return {state: createPlayState(profile), restored: false, error: `The saved backpack could not be restored: ${error.message}. Its stored data has been kept.`};
  }
}

export function savePlayState(backend, state, profile = {}) {
  try {
    const clean = validatePlayState(state, profile);
    syncPlayRewards(clean, profile);
    if (!backend || typeof backend.setItem !== 'function') return {ok: false, state: clean, error: 'Backpack storage is unavailable. Export a backup to keep your adventure.'};
    backend.setItem(PLAY_SAVE_KEY, JSON.stringify(clean));
    return {ok: true, state: clean, error: null};
  } catch (error) {
    return {ok: false, state, error: `The backpack could not be saved: ${error.message}`};
  }
}
