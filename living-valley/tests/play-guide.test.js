import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROLS_GUIDE_KEY, hasSeenControls, saveControlsSeen, createGuidePractice, runGuidePractice} from '../play-guide.js';
import {createSession} from '../runtime.js';
import {missions} from '../curriculum.js';

test('the control guide is optional per-device state and never replaces journey storage', () => {
  const store = new Map([['journey','unchanged']]);
  const backend = {getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
  assert.equal(hasSeenControls(backend),false);
  saveControlsSeen(backend);
  assert.equal(hasSeenControls(backend),true);
  assert.equal(store.get('journey'),'unchanged');
  store.set(CONTROLS_GUIDE_KEY,'{bad');
  assert.equal(hasSeenControls(backend),false);
  assert.equal(store.get(CONTROLS_GUIDE_KEY),'{bad');
});

test('blocked browser storage cannot prevent the controls rehearsal', () => {
  const backend = {getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.equal(hasSeenControls(backend),false);
  assert.doesNotThrow(()=>saveControlsSeen(backend));
});

test('help and pwd must both succeed in the isolated practice console', async () => {
  const practice = createGuidePractice();
  assert.equal(await runGuidePractice(practice,'powder'),false);
  assert.deepEqual(practice.seen,[]);
  assert.equal(await runGuidePractice(practice,'help'),false);
  assert.deepEqual(practice.seen,['help']);
  assert.equal(await runGuidePractice(practice,'pwd'),true);
  assert.match(practice.lines.at(-1).text,/\/home\/trainee/);
  assert.equal(await runGuidePractice(practice,'help'),true);
  assert.deepEqual(practice.seen,['help','pwd']);
});

test('practice can change its own files without changing a learning session', async () => {
  const session = createSession(missions[0]), before = JSON.stringify(session);
  const practice = createGuidePractice();
  await runGuidePractice(practice,'echo biscuits > welcome.txt');
  assert.equal(practice.shell.files['/home/trainee/welcome.txt'].content,'biscuits\n');
  assert.equal(JSON.stringify(session),before);
  assert.equal(await runGuidePractice(practice,''),false);
  assert.equal(await runGuidePractice(practice,'x'.repeat(2049)),false);
});
