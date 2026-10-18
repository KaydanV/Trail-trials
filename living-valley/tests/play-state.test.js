import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAY_SAVE_KEY, PLAY_SPAWN, MAX_PLAY_BYTES, catalog,
  createPlayState, validatePlayState, loadPlayState, savePlayState,
  syncPlayRewards, interactPlay, equipPlayItem, resetPlayMission,
  advancePlayTutorial, movePlayPlayer,
} from '../play-state.js';

const freshProfile = () => ({completed: [], currentMission: 'c01-01', records: {}, sessions: {}});
const chapterOne = ['c01-01', 'c01-02', 'c01-03', 'c01-04', 'c01-05', 'c01-06', 'c01-07', 'c01-boss'];
const profileThroughChapterOne = () => ({...freshProfile(), completed: [...chapterOne], currentMission: 'c02-01'});
function memory(initial = null) {
  const values = new Map(initial == null ? [] : [[PLAY_SAVE_KEY, initial]]);
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
}

test('new adventure has usable gear without invented knowledge, trophies, or money', () => {
  const profile = freshProfile(), before = JSON.stringify(profile), state = createPlayState(profile);
  assert.deepEqual(state.position, PLAY_SPAWN);
  assert.equal(state.tutorialStage, 0);
  assert.equal(state.coins, 0);
  assert.deepEqual(state.badges, []);
  assert.deepEqual(state.equipped, {hat: 'starter-cap', trail: 'none'});
  assert.deepEqual(state.bag, ['starter-cap', 'none', 'pocket-torch']);
  assert.equal(JSON.stringify(profile), before);
  assert.deepEqual(validatePlayState(state, profile), state);
});

test('existing learning progress migrates to one-time cosmetic rewards without changing profile', () => {
  const profile = profileThroughChapterOne(), before = JSON.stringify(profile);
  const state = createPlayState(profile);
  assert.equal(state.tutorialStage, 6);
  assert.equal(state.coins, 7 * 8 + 40);
  assert.deepEqual(state.badges, ['chapter-01']);
  assert.ok(state.bag.includes('acorn-crown'));
  assert.equal(state.activeMission, 'c02-01');
  assert.equal(JSON.stringify(profile), before);
  assert.deepEqual(validatePlayState(state, profile), state);
});

test('completed encounter rewards remain idempotent across repeated sync and save/load', () => {
  const profile = freshProfile(), state = createPlayState(profile), backend = memory();
  profile.completed.push('c01-01');
  profile.currentMission = 'c01-02';
  assert.equal(syncPlayRewards(state, profile).coins, 8);
  assert.equal(syncPlayRewards(state, profile).changed, false);
  assert.equal(state.coins, 8);
  assert.equal(savePlayState(backend, state, profile).ok, true);
  const restored = loadPlayState(backend, profile);
  assert.equal(restored.restored, true);
  assert.equal(restored.state.coins, 8);
  assert.equal(syncPlayRewards(restored.state, profile).coins, 0);
});

test('crate loot survives reset and cannot be farmed with review variants', () => {
  const profile = freshProfile(), state = createPlayState(profile);
  const first = interactPlay(state, {id: 'c01-01'}, 'cache');
  assert.equal(first.reward.coins, 3);
  assert.deepEqual(first.reward.items, ['antenna-cap', 'emergency-biscuit']);
  resetPlayMission(state, 'c01-01');
  assert.equal(interactPlay(state, {id: 'c01-01'}, 'cache').reward, undefined);
  assert.equal(interactPlay(state, {id: 'c01-01', reviewVariant: 1}, 'cache').reward, undefined);
  assert.equal(interactPlay(state, {id: 'c01-01', reviewVariant: 2}, 'supply-crate').reward, undefined);
  assert.equal(state.coins, 3);
  assert.deepEqual(state.collected, ['c01-01:cache']);
  assert.deepEqual(validatePlayState(state, profile), state);
});

test('a newly unlocked location has one cache, independent of the first location', () => {
  const profile = {...freshProfile(), completed: ['c01-01'], currentMission: 'c01-02'}, state = createPlayState(profile);
  interactPlay(state, {id: 'c01-01'}, 'cache');
  const second = interactPlay(state, {id: 'c01-02'}, 'cache');
  assert.equal(second.reward.coins, 3);
  assert.deepEqual(second.reward.items, []);
  assert.equal(state.coins, 14);
  assert.deepEqual(validatePlayState(state, profile), state);
});

test('tutorial waits for actual movement, meeting Patch, loot, equipping and real-work callbacks', () => {
  const state = createPlayState(freshProfile());
  assert.equal(advancePlayTutorial(state, 'move').changed, false);
  assert.equal(advancePlayTutorial(state, 'talk-nova').changed, false);
  assert.equal(movePlayPlayer(state, 20, 72).tutorialStage, 0);
  assert.equal(movePlayPlayer(state, 24, 72).tutorialStage, 1);
  interactPlay(state, {id: 'c01-01'}, 'patch');
  assert.equal(state.tutorialStage, 2);
  assert.equal(advancePlayTutorial(state, 'collect-part').changed, false);
  interactPlay(state, {id: 'c01-01'}, 'cache');
  assert.equal(state.tutorialStage, 3);
  assert.equal(advancePlayTutorial(state, 'open-pack').changed, false);
  assert.equal(equipPlayItem(state, 'antenna-cap').ok, true);
  assert.equal(state.tutorialStage, 4);
  assert.equal(advancePlayTutorial(state, 'talk-nova').changed, false);
  assert.equal(advancePlayTutorial(state, 'fit-part').stage, 5);
  assert.equal(advancePlayTutorial(state, 'talk-nova').stage, 6);
  assert.equal(advancePlayTutorial(state, 'move').changed, false);
  assert.equal(state.rewarded.length, 0, 'tutorial does not mark an encounter learned');
});

test('opening the crate early remains recoverable without another reward', () => {
  const state = createPlayState(freshProfile());
  interactPlay(state, {id: 'c01-01'}, 'cache');
  assert.equal(state.tutorialStage, 0);
  movePlayPlayer(state, 30, 72);
  interactPlay(state, {id: 'c01-01'}, 'patch');
  interactPlay(state, {id: 'c01-01'}, 'cache');
  assert.equal(state.tutorialStage, 3);
  assert.equal(state.coins, 3);
});

test('movement bounds positions and rejects NaN rather than corrupting an export', () => {
  const state = createPlayState(freshProfile());
  movePlayPlayer(state, -20, 120);
  assert.deepEqual(state.position, {x: 0, y: 100});
  const before = JSON.stringify(state);
  assert.equal(movePlayPlayer(state, NaN, 50).ok, false);
  assert.equal(movePlayPlayer(state, 50, Infinity).ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(validatePlayState(state, freshProfile()), state);
});

test('shop purchases charge once and equipping owned gear is free', () => {
  const profile = profileThroughChapterOne(), state = createPlayState(profile);
  const purchase = equipPlayItem(state, 'starry-cap');
  assert.equal(purchase.ok, true);
  assert.equal(purchase.cost, 64);
  assert.equal(state.coins, 32);
  equipPlayItem(state, 'starter-cap');
  assert.equal(equipPlayItem(state, 'starry-cap').cost, 0);
  assert.equal(state.coins, 32);
  assert.deepEqual(state.purchased, ['starry-cap']);
  assert.deepEqual(validatePlayState(state, profile), state);
});

test('unaffordable, unearned and kit items do not change inventory or coins', () => {
  const state = createPlayState(freshProfile()), before = JSON.stringify(state);
  for (const id of ['starry-cap', 'acorn-crown', 'antenna-cap', 'pocket-torch', 'made-up-cape']) assert.equal(equipPlayItem(state, id).ok, false);
  assert.equal(JSON.stringify(state), before);
});

test('hat and trail slots stay independent and all catalog entries have honest cosmetic descriptions', () => {
  const profile = profileThroughChapterOne(), state = createPlayState(profile);
  equipPlayItem(state, 'acorn-crown');
  equipPlayItem(state, 'firefly-trail');
  assert.deepEqual(state.equipped, {hat: 'acorn-crown', trail: 'firefly-trail'});
  assert.equal(catalog.length, 12);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  assert.ok(catalog.every(item => item.label && item.description && item.reaction));
  assert.deepEqual(validatePlayState(state, profile), state);
});

test('strict import rejects invented cash, gear, boss trophies and locked-world caches', () => {
  const profile = freshProfile(), original = createPlayState(profile);
  const cases = [
    state => { state.coins = 999; },
    state => { state.bag.push('acorn-crown'); },
    state => { state.badges.push('chapter-01'); },
    state => { state.rewarded.push('c01-boss'); },
    state => { state.collected.push('c12-boss:cache'); state.coins = 3; },
    state => { state.activeMission = 'c12-boss'; },
    state => { state.equipped.hat = 'none'; },
    state => { state.bag.push('starter-cap'); },
    state => { state.tutorialStage = 7; },
    state => { state.position.y = -1; },
    state => { state.unexpected = 'field'; },
  ];
  for (const mutate of cases) {
    const candidate = structuredClone(original);
    mutate(candidate);
    assert.throws(() => validatePlayState(candidate, profile));
  }
});

test('validation rejects accessors, inherited prototypes, reserved keys, cycles and sparse arrays without executing getters', () => {
  const profile = freshProfile();
  let getterExecuted = false;
  const accessor = createPlayState(profile);
  Object.defineProperty(accessor, 'coins', {get() { getterExecuted = true; return 0; }, enumerable: true});
  assert.throws(() => validatePlayState(accessor, profile));
  assert.equal(getterExecuted, false);
  const inherited = Object.assign(Object.create({anything: true}), createPlayState(profile));
  assert.throws(() => validatePlayState(inherited, profile));
  const unsafe = JSON.parse(JSON.stringify(createPlayState(profile)).replace('"version":1', '"version":1,"__proto__":{}'));
  assert.throws(() => validatePlayState(unsafe, profile));
  const circular = createPlayState(profile); circular.position.x = circular;
  assert.throws(() => validatePlayState(circular, profile));
  const sparse = createPlayState(profile); delete sparse.bag[0];
  assert.throws(() => validatePlayState(sparse, profile));
});

test('validated state is detached from imported objects', () => {
  const profile = freshProfile(), imported = createPlayState(profile), clean = validatePlayState(imported, profile);
  clean.position.x = 80;
  clean.bag.push('antenna-cap');
  assert.equal(imported.position.x, PLAY_SPAWN.x);
  assert.ok(!imported.bag.includes('antenna-cap'));
});

test('invalid stored adventure data is not overwritten and does not touch learning saves', () => {
  const backend = memory('{broken'), profile = freshProfile();
  backend.setItem('terminal-trails-living-valley-v1', 'learning stays here');
  const result = loadPlayState(backend, profile);
  assert.equal(result.restored, false);
  assert.match(result.error, /kept/);
  assert.equal(backend.getItem(PLAY_SAVE_KEY), '{broken');
  assert.equal(backend.getItem('terminal-trails-living-valley-v1'), 'learning stays here');
  assert.equal(result.state.coins, 0);
});

test('oversized, unknown-version, malformed and unavailable storage fall back to a playable backpack', () => {
  for (const raw of [' '.repeat(MAX_PLAY_BYTES + 1), 'null', '{"version":99}', '[]']) {
    const result = loadPlayState(memory(raw), freshProfile());
    assert.equal(result.restored, false);
    assert.ok(result.error);
    assert.equal(result.state.equipped.hat, 'starter-cap');
  }
  const backend = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }};
  assert.ok(loadPlayState(backend, freshProfile()).error);
  assert.equal(savePlayState(backend, createPlayState(freshProfile()), freshProfile()).ok, false);
  assert.equal(savePlayState(null, createPlayState(freshProfile()), freshProfile()).ok, false);
});

test('invalid state cannot replace a previously valid stored backpack', () => {
  const profile = freshProfile(), state = createPlayState(profile), backend = memory();
  assert.equal(savePlayState(backend, state, profile).ok, true);
  const before = backend.getItem(PLAY_SAVE_KEY);
  state.coins = 1000;
  assert.equal(savePlayState(backend, state, profile).ok, false);
  assert.equal(backend.getItem(PLAY_SAVE_KEY), before);
});

test('reset moves the player but preserves equipment, trophies and supplies', () => {
  const profile = profileThroughChapterOne(), state = createPlayState(profile);
  interactPlay(state, {id: 'c01-01'}, 'cache');
  equipPlayItem(state, 'acorn-crown');
  movePlayPlayer(state, 90, 20);
  const before = {coins: state.coins, bag: [...state.bag], badges: [...state.badges], collected: [...state.collected]};
  assert.equal(resetPlayMission(state, 'c02-01').ok, true);
  assert.deepEqual(state.position, PLAY_SPAWN);
  assert.equal(state.activeMission, 'c02-01');
  for (const field of Object.keys(before)) assert.deepEqual(state[field], before[field]);
  assert.equal(state.equipped.hat, 'acorn-crown');
  assert.deepEqual(validatePlayState(state, profile), state);
});

test('all 104 authored encounters can migrate, award one trophy per boss, and retain every cache once', async () => {
  const {missions} = await import('../curriculum.js');
  const profile = {...freshProfile(), completed: missions.map(mission => mission.id), currentMission: missions.at(-1).id};
  const state = createPlayState(profile);
  assert.equal(missions.length, 104);
  assert.equal(state.rewarded.length, 104);
  assert.equal(state.badges.length, 12);
  assert.equal(state.coins, 92 * 8 + 12 * 40);
  for (const mission of missions) {
    assert.equal(interactPlay(state, mission, 'cache').reward.coins, 3);
    assert.equal(interactPlay(state, {...mission, reviewVariant: 1}, 'cache').reward, undefined);
  }
  assert.equal(state.collected.length, 104);
  assert.equal(state.coins, 92 * 8 + 12 * 40 + 104 * 3);
  assert.equal(syncPlayRewards(state, profile).changed, false);
  assert.deepEqual(validatePlayState(state, profile), state);
});
