/**
 * Real controls and viewport regressions for the fullscreen adventure.
 * This exercises public actions, not manufactured learning progress.
 */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin = (process.env.TRAILS_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const baseURL = origin.endsWith('/living-valley') ? origin + '/' : origin + '/living-valley/';
const artifacts = new URL('../../test-results/living-valley-immersive/', import.meta.url);
await mkdir(artifacts, {recursive: true});
for (const file of ['failure.png', 'failure.txt', 'report.json']) await rm(new URL(file, artifacts), {force: true});
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox']});
const context = await browser.newContext({viewport: {width: 1440, height: 900}});
let page = await context.newPage();
const checks = [], errors = [], resources = [], layouts = [];
function observe(target) {
  target.on('pageerror', error => errors.push(error.message));
  target.on('response', response => {
    if (response.url().startsWith(new URL(baseURL).origin) && response.status() >= 400) resources.push(response.status() + ' ' + response.url());
  });
}
observe(page);
const ui = id => page.getByTestId(id);
const action = name => page.locator('[data-action="' + name + '"]').filter({visible: true}).first();
async function frames() {await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));}
async function learning() {
  return page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('terminal-trails-living-valley-v1') || 'null');
    const profile = value?.profile || value;
    const sessions = Object.fromEntries(Object.entries(profile?.sessions || {}).map(([id, session]) => [id, Object.fromEntries(
      ['shell', 'done', 'hints', 'attempts', 'activity', 'answers', 'transcript', 'completed'].map(key => [key, session[key]])
    )]));
    return {completed: profile?.completed || [], records: profile?.records || {}, sessions};
  });
}
async function state() {return page.evaluate(() => JSON.parse(localStorage.getItem('terminal-trails-play-v1') || 'null'));}
async function avatar() {
  return page.locator('.play-avatar').evaluate(node => ({x: Number(node.dataset.x), y: Number(node.dataset.y)}));
}
async function assertWalkingSettles(label) {
  // The controller deliberately eases out instead of snapping to a stop. Wait
  // for its public stopped state, with a bounded deadline, then require stable
  // coordinates across a further observation window. This catches continuous
  // drift without treating the final braking frame as an input leak.
  await page.waitForFunction(() => document.querySelector('.play-avatar')?.dataset.walking === 'false', null, {timeout: 1000});
  await frames();
  const stopped = await avatar();
  await page.waitForTimeout(180);
  assert.deepEqual(await avatar(), stopped, label);
}
async function guideStep(names) {
  await page.waitForFunction(allowed => allowed.includes(document.querySelector('.play-onboarding')?.dataset.guideStep), names, {timeout: 12000});
}
async function interact(name) {await page.locator('[data-world-object="' + name + '"]').click();}
async function closePanel() {if (await ui('close-game-panel').isVisible()) await ui('close-game-panel').click();}
async function assertViewport(label, width, height, {guide = false} = {}) {
  await page.setViewportSize({width, height});await frames();
  const dimensions = await page.evaluate(() => {
    const scene = document.querySelector('.pw-scene').getBoundingClientRect();
    return {
      width: innerWidth, height: innerHeight, scrollX, scrollY,
      documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight,
      scene: {x: scene.x, y: scene.y, width: scene.width, height: scene.height},
    };
  });
  assert.ok(dimensions.documentWidth <= width + 1 && dimensions.bodyWidth <= width + 1, label + ': no horizontal document overflow ' + JSON.stringify(dimensions));
  assert.ok(dimensions.documentHeight <= height + 1 && dimensions.bodyHeight <= height + 1, label + ': no vertical document scroll ' + JSON.stringify(dimensions));
  assert.equal(dimensions.scrollY, 0, label + ': the game starts at the viewport origin.');
  assert.ok(dimensions.scene.width >= width - 2 && dimensions.scene.height >= height - 2, label + ': the playable scene fills the screen ' + JSON.stringify(dimensions));
  for (const id of ['pack', 'open-gadget', 'settings']) {
    const button = ui(id).filter({visible: true}).first();
    if (guide && await page.locator('.play-onboarding[data-world-blocked="true"]').count()) continue;
    assert.ok(await button.count(), label + ': ' + id + ' has a visible control.');
    const box = await button.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, label + ': ' + id + ' fits on screen ' + JSON.stringify(box));
    assert.ok(box.width >= 40 && box.height >= 40, label + ': ' + id + ' has a usable hit area.');
    assert.equal(await button.evaluate(node => {
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return hit === node || node.contains(hit);
    }), true, label + ': ' + id + ' is not hidden behind another HUD layer.');
  }
  if (!guide) for (const id of ['nova', 'terminal', 'cache', 'artifact:screen', 'artifact:linux', 'artifact:viewer', 'artifact:route']) {
    const object = page.locator('[data-world-object="' + id + '"]');
    if (!await object.count()) continue;
    const reachable = await object.evaluate(node => {
      const b = node.getBoundingClientRect();
      return [.3, .5, .7].some(x => [.3, .5, .7].some(y => {
        const px = b.x + b.width * x, py = b.y + b.height * y;
        if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) return false;
        const hit = document.elementFromPoint(px, py);
        return hit === node || node.contains(hit);
      }));
    });
    assert.equal(reachable, true, label + ': the ' + id + ' story object remains reachable above mobile HUD layers.');
  }
  layouts.push({label, width, height, dimensions});
  await page.screenshot({path: new URL(label + '-' + width + 'x' + height + '.png', artifacts).pathname});
}
async function moveUntilGuideProgress() {
  const before = await avatar();
  await page.locator('.pw-scene').focus();
  await page.keyboard.down('d');
  try {await page.waitForFunction(start => {
    const node = document.querySelector('.play-avatar');
    return Math.hypot(Number(node.dataset.x) - start.x, Number(node.dataset.y) - start.y) >= 5.1;
  }, before, {timeout: 5000});} finally {await page.keyboard.up('d');}
}
async function completeGuide({replay = false, phone = false} = {}) {
  await guideStep(['welcome']);
  const untouched = await learning();
  await ui('guide-next').click();
  await guideStep(['move', 'walk']);
  if (!replay) {
    // A player can touch a story prop while rehearsing. That may walk them
    // there, but the controls lesson must not secretly inspect mission clues.
    await interact('artifact:screen');
    await page.waitForTimeout(900);
    assert.deepEqual(await learning(), untouched, 'Touching a story artifact during the controls guide earns no mission observation or attempt.');
  }
  if (await page.locator('.play-onboarding[data-guide-step="walk"], .play-onboarding[data-guide-step="move"]').count())
  await moveUntilGuideProgress();
  await guideStep(['meet-patch', 'talk']);
  if (!replay) {
    await interact('artifact:screen');
    await page.waitForTimeout(900);
    assert.deepEqual(await learning(), untouched, 'Reaching a story artifact during the talk rehearsal still leaves all learning evidence unchanged.');
  }
  await interact('patch');
  await guideStep(['collect-cache', 'collect']);
  await interact('cache');
  await guideStep(['equip-hat', 'equip']);
  const coins = (await state()).coins;
  assert.equal(coins, 3, 'Guide replays never create another crate reward.');
  await ui('pack').click();
  await ui('equip-antenna-cap').click();
  await closePanel();
  await guideStep(['practice-console', 'tools']);
  const beforeConsole = await learning();
  await ui('guide-practice-open').click();
  const playerBefore = await avatar();
  const input = page.locator('#guide-practice-input');
  assert.ok(await input.isVisible(), 'The console rehearsal has a real command field.');
  if (phone) await page.setViewportSize({width: 390, height: 520});
  await input.fill('help');await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('#guide-practice-status')?.textContent.includes('help'));
  await frames();
  assert.ok((await page.locator('#guide-practice-status').innerText()).length > 5, 'Practice commands produce a visible response.');
  assert.equal(await ui('guide-practice-done').isEnabled(), false, 'The practice asks for both the taught commands.');
  if (phone) {
    const field = await input.boundingBox();
    assert.ok(field && field.y >= 0 && field.y + field.height <= 520, 'The phone rehearsal command line remains visible with the keyboard-height viewport.');
  }
  await input.fill('pwd');await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-testid="guide-practice-done"]')?.disabled === false);
  await ui('guide-practice-done').click();
  if (phone) await page.setViewportSize({width: 390, height: 844});
  await guideStep(['start-adventure', 'ready']);
  assert.deepEqual(await learning(), beforeConsole, 'Rehearsal help/pwd leave mission shell, attempts, answers, transcripts and progress unchanged.');
  assert.deepEqual(await avatar(), playerBefore, 'Practice typing does not walk the ranger.');
  assert.deepEqual(await learning(), untouched, 'The complete controls tutorial earns no curriculum evidence.');
  await ui('guide-next').click();
  await page.waitForFunction(() => !document.querySelector('.play-onboarding'));
  assert.equal((await state()).equipped.hat, 'antenna-cap');
  checks.push(replay ? 'complete controls replay without new rewards or evidence' : 'complete seven-step public controls rehearsal');
}

try {
  await page.goto(baseURL, {waitUntil: 'networkidle'});
  await ui('start-journey').click();
  while (await ui('story-next').isVisible()) await ui('story-next').click();
  await guideStep(['welcome']);
  for (const [width, height] of [[390, 844], [320, 740], [844, 390], [1440, 900]]) await assertViewport('intro', width, height, {guide: true});
  await completeGuide();
  for (const [width, height] of [[390, 844], [320, 740], [844, 390], [1440, 900]]) await assertViewport('play', width, height);
  checks.push('four exact fullscreen viewports without document scroll', 'HUD remains reachable above the playfield');

  const beforeReplay = await learning();
  await action('tour').click();
  await completeGuide({replay: true});
  assert.deepEqual(await learning(), beforeReplay);
  await action('tour').click();await guideStep(['welcome']);
  await ui('guide-skip').click();
  await page.waitForFunction(() => !document.querySelector('.play-onboarding'));
  assert.deepEqual(await learning(), beforeReplay, 'Skipping a replay never changes mission progress.');
  await page.reload({waitUntil: 'networkidle'});await ui('start-journey').click();
  assert.equal(await page.locator('.play-onboarding').count(), 0, 'The observed per-device guide choice persists after reload.');
  checks.push('replay and skip independent of learning', 'per-device onboarding persists');

  // The rendering loop must produce many small updates, not jump on key repeat.
  const original = await avatar();
  await page.locator('.pw-scene').focus();
  await page.keyboard.down('d');
  const samples = await page.evaluate(() => new Promise(resolve => {
    const values = [], start = performance.now();
    function sample(time) {
      const node = document.querySelector('.play-avatar');
      values.push({time, x: Number(node.dataset.x), y: Number(node.dataset.y)});
      if (time - start >= 350) resolve(values);else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  await page.keyboard.up('d');
  assert.ok(new Set(samples.map(sample => sample.x)).size >= 5, 'Held walking advances through animation frames.');
  const horizontalEnd = await avatar();
  assert.ok(horizontalEnd.x > original.x + 1, 'A held direction causes real movement.');
  await assertWalkingSettles('Releasing the key stops the ranger.');
  const sceneSize = await page.locator('.pw-scene').boundingBox();
  const projection = await page.locator('.pw-world').evaluate(node => JSON.parse(node.dataset.walkProjection || '{"scale":1,"offset":0}'));
  const diagonalStart = await avatar();
  await page.keyboard.down('w');await page.keyboard.down('d');await page.waitForTimeout(350);
  await page.keyboard.up('w');await page.keyboard.up('d');
  const diagonalEnd = await avatar();
  const horizontalDistance = Math.hypot((horizontalEnd.x - original.x) * sceneSize.width / 100, (horizontalEnd.y - original.y) * sceneSize.height * projection.scale / 100);
  const diagonalDistance = Math.hypot((diagonalEnd.x - diagonalStart.x) * sceneSize.width / 100, (diagonalEnd.y - diagonalStart.y) * sceneSize.height * projection.scale / 100);
  assert.ok(diagonalDistance <= horizontalDistance * 1.3 && diagonalDistance >= horizontalDistance * .72, 'Diagonal movement keeps the same pixel pace instead of a speed boost: ' + JSON.stringify({horizontalDistance, diagonalDistance}));
  await assertWalkingSettles('Releasing both diagonal directions stops the ranger.');
  checks.push('frame-based held walking', 'key release stops', 'normalized diagonal walking');

  await ui('pack').click();
  const blockedStart = await avatar();
  await page.keyboard.down('d');await page.waitForTimeout(180);await page.keyboard.up('d');
  assert.deepEqual(await avatar(), blockedStart, 'An open backpack consumes controls without moving the world.');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#game-panel').count(), 0, 'Escape closes the backpack.');
  checks.push('overlay movement isolation and keyboard dismissal');

  // Request a point inside the solid hut. The public pointer route must stop
  // outside its footprint and must not tunnel through it on intermediate frames.
  const obstaclePoint = await page.evaluate(() => {
    const world = document.querySelector('.pw-world'), scene = document.querySelector('.pw-scene');
    const obstacles = JSON.parse(world.dataset.walkObstacles || '[]'), b = scene.getBoundingClientRect();
    const projection = JSON.parse(world.dataset.walkProjection || '{"scale":1,"offset":0}');
    for (const obstacle of obstacles) for (const xf of [.5, .35, .65]) for (const yf of [.5, .35, .65]) {
      const x = obstacle.left + (obstacle.right - obstacle.left) * xf;
      const y = obstacle.top + (obstacle.bottom - obstacle.top) * yf;
      const px = b.x + b.width * x / 100, py = b.y + b.height * (y * projection.scale + projection.offset) / 100;
      const hit = document.elementFromPoint(px, py);
      if (hit && !hit.closest('button, input, .play-speech, .play-onboarding')) return {x: px, y: py, obstacles};
    }
    return null;
  });
  assert.ok(obstaclePoint, 'The physical set piece exposes a reachable solid footprint.');
  await page.mouse.click(obstaclePoint.x, obstaclePoint.y);
  const route = await page.evaluate(() => new Promise(resolve => {
    const samples = [], start = performance.now();
    function frame(time) {
      const node = document.querySelector('.play-avatar');samples.push({x: Number(node.dataset.x), y: Number(node.dataset.y)});
      if (time - start > 1900) resolve(samples);else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  for (const point of route) for (const obstacle of obstaclePoint.obstacles) assert.ok(
    point.x <= obstacle.left + .05 || point.x >= obstacle.right - .05 || point.y <= obstacle.top + .05 || point.y >= obstacle.bottom - .05,
    'Autowalk never crosses through a solid hut: ' + JSON.stringify({point, obstacle}),
  );
  checks.push('pointer routing around solid scenery without tunneling');

  await page.setViewportSize({width: 390, height: 844});await frames();
  const pad = page.locator('[data-world-stick]');
  const padBox = await pad.boundingBox();
  assert.ok(padBox && padBox.width >= 44 && padBox.height >= 44, 'Phone movement targets are at least 44 pixels.');
  assert.equal(await pad.evaluate(node => {
    const b = node.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return hit === node || node.contains(hit);
  }), true, 'The phone walking control is reachable above HUD layers.');
  const phoneStart = await avatar();
  await page.mouse.move(padBox.x + padBox.width / 2, padBox.y + padBox.height / 2);await page.mouse.down();
  await page.mouse.move(padBox.x + padBox.width * .85, padBox.y + padBox.height / 2);
  try {await page.waitForFunction(start => Number(document.querySelector('.play-avatar')?.dataset.x) >= start + 2, phoneStart.x, {timeout: 5000});} finally {await page.mouse.up();}
  await assertWalkingSettles('Releasing phone movement stops walking.');
  await assertViewport('phone-controls', 390, 844);
  checks.push('phone press and release walking');
  const stick = page.locator('[data-world-stick]'), stickBox = await stick.boundingBox();
  assert.ok(stickBox && stickBox.width >= 44 && stickBox.height >= 44, 'The analog walking stick has a usable touch area.');
  const stickStart = await avatar();
  await page.mouse.move(stickBox.x + stickBox.width / 2, stickBox.y + stickBox.height / 2);await page.mouse.down();
  await page.mouse.move(stickBox.x + stickBox.width * .18, stickBox.y + stickBox.height / 2);
  try {await page.waitForFunction(start => Number(document.querySelector('.play-avatar')?.dataset.x) < start - 1.5, stickStart.x, {timeout: 5000});}
  finally {await page.mouse.up();}
  assert.equal(await stick.getAttribute('data-active'), 'false', 'Releasing the analog stick clears its captured input.');
  await assertWalkingSettles('Releasing the analog stick stops the ranger.');
  checks.push('analog phone walking and release');

  const phoneContext = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  page = await phoneContext.newPage();observe(page);
  await page.goto(baseURL, {waitUntil: 'networkidle'});await ui('start-journey').click();
  await completeGuide({phone: true});
  await assertViewport('phone-after-training', 390, 844);
  for (const id of ['screen', 'linux', 'viewer', 'route']) {
    await interact('artifact:' + id);
    await page.waitForFunction(item => !document.querySelector('[data-world-object="artifact:' + item + '"]'), id, {timeout: 10000});
    assert.equal(await ui('objective-0').getAttribute('data-complete'), 'false', 'Phone collection is an observation, not automatic assembly credit.');
  }
  await ui('open-gadget').click();
  assert.equal(await page.locator('[data-testid^="classify-item-"]').count(), 4, 'All four recovered parts are available on the phone workbench.');
  await page.screenshot({path: new URL('phone-recovered-workbench-390x844.png', artifacts).pathname});
  checks.push('fresh touch-device complete tutorial', 'phone practice console with keyboard-height viewport', 'phone world collection reaches the real workbench');

  // Import/reset can be requested while a replay is still in progress. Both
  // replace the journey, so an obsolete controls rehearsal must not survive.
  await closePanel();
  const earnedBeforeImport = await learning();
  await ui('settings').click();
  const pendingDownload = page.waitForEvent('download');
  await ui('export-save').click();
  const download = await pendingDownload;
  const backupPath = new URL('phone-earned-backup.json', artifacts).pathname;
  await download.saveAs(backupPath);
  await action('close-dialog').click();
  await action('tour').click();await guideStep(['welcome']);
  await ui('guide-next').click();await guideStep(['move', 'walk']);
  await ui('settings').click();
  await page.locator('#import-file').setInputFiles(backupPath);
  await ui('confirm-import').click();
  assert.equal(await page.locator('.play-onboarding, #game-panel').count(), 0, 'Import discards the pending controls replay and its gadget.');
  await ui('start-journey').click();
  assert.equal(await page.locator('.play-onboarding').count(), 0, 'Imported journeys respect this device’s completed controls tutorial.');
  assert.deepEqual(await learning(), earnedBeforeImport, 'Import during a rehearsal restores the actual exported evidence unchanged.');
  checks.push('import during controls replay clears obsolete rehearsal');

  await action('tour').click();await guideStep(['welcome']);
  await ui('guide-next').click();await guideStep(['move', 'walk']);
  await ui('settings').click();
  await page.locator('.reset-area > summary').click();
  await action('reset').click();await action('confirm-reset').click();
  assert.equal(await page.locator('.play-onboarding, #game-panel').count(), 0, 'Reset discards the pending controls replay and its gadget.');
  assert.deepEqual((await learning()).completed, [], 'A confirmed reset starts with no mission completions.');
  assert.equal((await state()).coins, 0, 'A reset does not retain rehearsal rewards.');
  await ui('start-journey').click();
  assert.equal(await page.locator('.play-onboarding').count(), 0, 'Reset keeps the completed per-device tutorial preference.');
  await ui('open-gadget').click();
  assert.equal(await page.locator('#guide-practice-input').count(), 0, 'A reset opens the real mission gadget instead of a stale rehearsal console.');
  checks.push('reset during controls replay clears obsolete rehearsal');

  assert.deepEqual(errors, []);
  assert.deepEqual(resources, []);
  await writeFile(new URL('report.json', artifacts), JSON.stringify({checks, layouts, errors, resources, note: 'Public UI mechanics regression, not evidence of enjoyment or learning retention.'}, null, 2));
  console.log('Immersive adventure regression passed: fullscreen viewports, real seven-step tutorial, replay/skip isolation and controller behavior.');
} catch (error) {
  await page.screenshot({path: new URL('failure.png', artifacts).pathname}).catch(() => {});
  await writeFile(new URL('failure.txt', artifacts), String(error.stack || error));
  throw error;
} finally {await browser.close();}
