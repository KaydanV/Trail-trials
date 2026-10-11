import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { missions } from '../src/curriculum.js';
import { getPresentation, renderPropIcon } from '../src/presentation.js';

const positions = new Set(['0% 0%', '50% 0%', '100% 0%', '0% 100%', '50% 100%', '100% 100%']);
const assets = new Set(['assets/scenes/trail-act1-atlas.webp', 'assets/scenes/trail-later-atlas.webp']);

test('all 24 missions have explicit story scenes and the speaking character matches each frame', () => {
  assert.equal(missions.length, 24);
  const ids = new Set();
  for (const mission of missions) {
    for (let index = 0; index < mission.story.length; index += 1) {
      const presentation = getPresentation(mission, index);
      const { scene, speaker, clue } = presentation;
      assert.ok(scene.id.startsWith(`${mission.id}-`), `${mission.id} needs an explicit mapping`);
      assert.ok(!ids.has(scene.id), `${scene.id} should identify its own story focus`);
      ids.add(scene.id);
      assert.ok(assets.has(scene.asset), scene.asset);
      assert.ok(positions.has(scene.position), scene.position);
      assert.ok(['dawn', 'canopy', 'storm', 'signal'].includes(scene.palette));
      assert.ok(scene.label.length > 10 && scene.alt.length > 20);
      assert.equal(speaker.name, mission.story[index].speaker);
      assert.equal(speaker.position, speaker.name === 'PATCH' ? '100% 50%' : '0% 50%');
      assert.equal(speaker.role, speaker.name === 'PATCH' ? 'FIELD COMPANION' : 'FIELD GUIDE');
      assert.ok(clue.title && clue.text && clue.icon === scene.prop);
      assert.match(renderPropIcon(scene.prop), /^<svg /);
    }
  }
  assert.equal(ids.size, 72);
});

test('early atlas panels match the welcome, map, owl, squirrel, evidence, and lantern story scenes', () => {
  for (let index = 0; index < 6; index += 1) {
    const scene = getPresentation(missions[index], 0).scene;
    assert.equal(scene.asset, 'assets/scenes/trail-act1-atlas.webp');
    assert.equal(scene.position, [...positions][index]);
  }
  assert.equal(getPresentation(missions[2]).scene.prop, 'owl');
  assert.equal(getPresentation(missions[3]).scene.prop, 'squirrel');
});

test('map and owl story beats change the illustrated location when the narrative focus changes', () => {
  const mapOpening = getPresentation(missions[1], 0);
  const mapRoute = getPresentation(missions[1], 2);
  assert.notEqual(mapOpening.scene.position, mapRoute.scene.position);
  assert.equal(mapOpening.speaker.name, 'PATCH');
  assert.equal(mapRoute.speaker.name, 'NOVA');
  const owlShots = [0, 1, 2].map(index => getPresentation(missions[2], index));
  assert.equal(new Set(owlShots.map(item => item.scene.position)).size, 3);
  assert.deepEqual(owlShots.map(item => item.speaker.name), ['PATCH', 'NOVA', 'NOVA']);
});

test('invalid story indices and unknown missions have a safe deterministic fallback', () => {
  const opening = getPresentation(missions[1], 0);
  for (const index of [-1, 3, 999, NaN, Infinity, '2', null]) {
    assert.deepEqual(getPresentation(missions[1], index), opening);
  }
  assert.deepEqual(getPresentation(undefined), getPresentation({}));
  assert.match(getPresentation({ id: 'unmapped', story: [] }).scene.id, /^hike-01-/);
  assert.equal(getPresentation({ id: 'hike-01', story: [{ speaker: '<script>' }] }).speaker.name, 'NOVA');
});

test('prop illustrations accept only static known markup and cannot reflect untrusted input', () => {
  const fallback = renderPropIcon('signal');
  for (const input of ['<script>alert(1)</script>', '" onload="alert(1)', '__proto__', undefined]) {
    const svg = renderPropIcon(input);
    assert.equal(svg, fallback);
    assert.doesNotMatch(svg, /<script|onload|javascript:|<foreignObject|<image/i);
    assert.match(svg, /aria-hidden="true"/);
  }
  assert.notEqual(renderPropIcon('owl'), renderPropIcon('squirrel'));
});

test('all referenced scene and companion artwork exists in the shipped application', () => {
  for (const asset of [...assets, 'assets/characters/companions.webp']) {
    const resolved = fileURLToPath(new URL(`../${asset}`, import.meta.url));
    assert.ok(existsSync(resolved), `Missing presentation asset: ${asset}`);
  }
});
