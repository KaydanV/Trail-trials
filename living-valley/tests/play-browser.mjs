/**
 * Targeted public-play regression for the adventure controls.
 * Authored solutions and earned, validated runtime fixtures are software QA;
 * they do not demonstrate that beginners enjoy or retain the lessons.
 */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {missions} from '../curriculum.js';
import {
  createProfile, createSession, validateProfile, runCommand, inspectItem,
  submitActivity, answerQuestion, completeMission,
} from '../runtime.js';

const origin = (process.env.TRAILS_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const baseURL = origin.endsWith('/living-valley') ? origin + '/' : origin + '/living-valley/';
const artifacts = new URL('../../test-results/living-valley-play/', import.meta.url);
await mkdir(artifacts, {recursive: true});
for (const file of ['failure.png', 'failure.txt', 'report.json']) await rm(new URL(file, artifacts), {force: true});

// Every prior lesson and every prerequisite step in these targeted fixtures is
// genuinely executed and graded by the same runtime used by the application.
async function earnedFixture(missionId, stepIndex = 0) {
  const profile = createProfile(missions);
  for (const mission of missions) {
    const session = createSession(mission);
    session.started = true;
    profile.sessions[mission.id] = session;
    const limit = mission.id === missionId ? stepIndex : mission.steps.length;
    for (let index = 0; index < limit; index++) {
      const step = mission.steps[index];
      if (step.check.type === 'activity') {
        for (const id of step.solution?.inspect || step.activity.requiredInspect || []) inspectItem(mission, session, index, id);
        if (!session.done[index]) submitActivity(mission, session, index, step.solution);
      } else {
        for (const raw of Array.isArray(step.solution) ? step.solution : [step.solution]) await runCommand(mission, session, raw);
      }
      assert.equal(session.done[index], true, `${mission.id}/${step.id}: targeted fixture action is actually graded`);
    }
    if (mission.id === missionId) {
      profile.currentMission = mission.id;
      return validateProfile(profile, missions);
    }
    for (const [index, question] of mission.questions.entries()) answerQuestion(mission, session, index, question.answer);
    profile.records[mission.id] = completeMission(mission, session, 'Targeted QA fixture: prior actions were executed through the normal runtime.');
    profile.completed.push(mission.id);
  }
  assert.fail(`Unknown target mission ${missionId}`);
}

const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox']});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
let page = await context.newPage();
const errors = [], failedResources = [], checks = [];
const ui = id => page.getByTestId(id);
const action = name => page.locator(`[data-action="${name}"]`).filter({visible: true}).first();
function observe(target) {
  target.on('pageerror', error => errors.push(error.message));
  target.on('response', response => {if (response.url().startsWith(new URL(baseURL).origin) && response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);});
}
observe(page);
async function noOverflow(label) {
  const size = await page.evaluate(() => ({viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
  assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `${label}: no sideways page overflow ${JSON.stringify(size)}`);
}
async function screenshot(label, width = 1440, height = 1000) {
  await page.setViewportSize({width, height});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await noOverflow(`${label} ${width}×${height}`);
  await page.screenshot({path: new URL(`${label}-${width}x${height}.png`, artifacts).pathname, fullPage: true});
}
async function stories() {
  for (let remaining = 50; remaining > 0; remaining--) {
    if (await ui('story-next').isVisible()) await ui('story-next').click();
    else if (await ui('guide-skip').isVisible()) await ui('guide-skip').click();
    else return;
  }
  assert.fail('Story transmissions must give control back to the player.');
}
async function openGadget() {
  if (!await page.locator('#game-panel .tool-tabs').count()) await ui('open-gadget').click();
}
async function closeGadget() {
  const close = ui('close-game-panel');
  if (await close.isVisible()) await close.click();
}
async function isDone(index) {
  return await ui(`objective-${index}`).getAttribute('data-complete') === 'true';
}
async function solveActivity(mission, index, {negative = false} = {}) {
  const step = mission.steps[index], activity = step.activity, solution = step.solution;
  await openGadget();
  assert.equal(await page.locator('#game-panel select[data-category]').count(), 0, 'The playable sorting activity has no worksheet category selects.');
  for (const id of solution.inspect || activity.requiredInspect || []) {
    if (await isDone(index)) break;
    await ui(`inspect-${id}`).click();
    await stories();
  }
  if (await isDone(index)) {checks.push(`activity:${activity.kind}`); return;}
  if (negative && (activity.kind === 'choose' || activity.kind === 'compare')) {
    const wrong = activity.choices.find(choice => !choice.correct);
    await ui(`choice-${wrong.id}`).click();
    assert.equal(await isDone(index), false, 'A wrong conversation move does not earn a clue.');
    assert.ok((await page.locator('#game-panel .gadget-reaction').innerText()).length > 5, 'Rejected choices explain the problem inside the gadget rather than behind it.');
  } else if (negative && ['classify', 'sequence', 'connect', 'report', 'repair'].includes(activity.kind)) {
    await ui('submit-activity').click();
    assert.equal(await isDone(index), false, `An empty ${activity.kind} attempt does not earn a clue.`);
    assert.ok((await page.locator('#game-panel .gadget-reaction').innerText()).length > 5, 'An incomplete move gets visible in-gadget feedback.');
  }
  if (activity.kind === 'choose' || activity.kind === 'compare') {
    await ui(`choice-${solution.choice}`).click();
  } else if (activity.kind === 'classify') {
    for (const [id, category] of Object.entries(solution.classifications)) {
      await ui(`classify-item-${id}`).click();
      await ui(`classify-target-${category}`).click();
    }
    await ui('submit-activity').click();
  } else if (activity.kind === 'sequence' || activity.kind === 'connect') {
    for (const id of solution.order) await ui(`sequence-add-${id}`).click();
    await ui('submit-activity').click();
  } else if (activity.kind === 'report') {
    await page.setViewportSize({width: 390, height: 520});
    const before = await avatar();
    await page.locator('[data-report-field]').first().fill('WASD are words in this dispatch.');
    await page.locator('[data-report-field]').first().press('ArrowLeft');
    assert.deepEqual(await avatar(), before, 'Typing movement letters and arrows inside a dispatch never moves the ranger.');
    await page.waitForFunction(() => {
      const field = document.activeElement, box = field?.getBoundingClientRect();
      return field?.matches('[data-report-field]') && box.top >= 0 && box.bottom <= innerHeight - 4;
    }, null, {timeout: 5000});
    checks.push('phone keyboard dispatch visibility');
    for (const [id, text] of Object.entries(solution.fields)) await page.locator(`[data-report-field=${JSON.stringify(id)}]`).fill(text);
    await ui('submit-activity').click();
  } else if (activity.kind === 'repair') {
    await page.locator('[data-repair-text]').fill(solution.text);
    await ui('submit-activity').click();
  } else assert.fail(`Unrecognised activity kind ${activity.kind}`);
  await stories();
  assert.equal(await isDone(index), true, `${mission.id}/${step.id}: play controls earn the real underlying evidence.`);
  checks.push(`activity:${activity.kind}`);
}
async function finishEncounter(mission) {
  await ui('finish-encounter').click();
  for (const [index, question] of mission.questions.entries()) {
    await ui(`answer-${question.answer}`).click();
    assert.ok((await page.locator('.question-feedback').innerText()).includes(question.explanation), 'The correct explanation remains readable.');
    await ui('question-next').click();
  }
  await ui('complete-encounter').click();
  await stories();
  assert.equal(await page.locator('#dialog').getAttribute('data-kind'), 'completion');
}
async function exportSave(label) {
  if (await page.locator('#dialog[open]').count()) await action('close-dialog').click();
  await closeGadget();
  await ui('settings').click();
  const pending = page.waitForEvent('download');
  await ui('export-save').click();
  const download = await pending, path = new URL(`${label}.json`, artifacts).pathname;
  await download.saveAs(path);
  await action('close-dialog').click();
  return {path, data: JSON.parse(await readFile(path, 'utf8'))};
}
async function importSave(label, data) {
  const path = new URL(`${label}.json`, artifacts).pathname;
  await writeFile(path, JSON.stringify(data));
  if (await page.locator('#dialog[open]').count()) await action('close-dialog').click();
  await closeGadget();
  await ui('settings').click();
  await page.locator('#import-file').setInputFiles(path);
  await ui('confirm-import').click();
}
async function playState() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('terminal-trails-play-v1') || 'null'));
}
async function avatar() {
  return page.locator('.play-avatar').evaluate(node => ({x: Number(node.dataset.x), y: Number(node.dataset.y)}));
}
async function waitTutorial(stage) {
  await page.waitForFunction(target => JSON.parse(localStorage.getItem('terminal-trails-play-v1') || 'null')?.tutorialStage >= target, stage, {timeout: 10000});
}
async function interact(object) {
  await page.locator(`[data-world-object=${JSON.stringify(object)}]`).click();
}
async function enterCommand(raw) {
  await openGadget();
  const terminal = page.locator('.tool-tabs [data-tool="terminal"]');
  if (!await ui('terminal-input').isVisible()) await terminal.click();
  const input = ui('terminal-input'), handle = await input.elementHandle();
  await input.fill(raw);await input.press('Enter');
  await page.waitForFunction(node => !node.isConnected, handle);await handle.dispose();
  await stories();
}

try {
  await page.goto(baseURL, {waitUntil: 'networkidle'});
  await ui('start-journey').click();
  await stories();
  assert.ok(await page.locator('#game-world').count(), 'Encounters start in a playable world, rather than a worksheet.');
  assert.equal(await page.locator('#dialog[data-kind="tour"][open]').count(), 0, 'Onboarding no longer opens a giant five-page explanatory modal.');
  assert.equal(await page.locator('#game-panel').count(), 0, 'The first view is the world, with gadgets put away.');
  await screenshot('first-play-world');
  const start = await avatar();
  await page.locator('.pw-scene').focus();
  await page.keyboard.down('d');
  try {await page.waitForFunction(origin => {
    const node = document.querySelector('.play-avatar');
    return Math.hypot(Number(node.dataset.x) - origin.x, Number(node.dataset.y) - origin.y) >= 5;
  }, start, {timeout: 10000});} finally {await page.keyboard.up('d');}
  const moved = await avatar();
  assert.ok(Math.hypot(moved.x - start.x, moved.y - start.y) >= 5, 'The first tutorial move requires actual displacement.');
  assert.equal(await isDone(0), false, 'Walking alone gives no learning credit.');
  const priorSpeech = await page.locator('.play-speech-copy').innerText();
  await interact('patch');
  await page.waitForFunction(before => document.querySelector('.play-speech-copy')?.textContent.trim() !== before.trim(), priorSpeech, {timeout: 10000});
  await interact('cache');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('terminal-trails-play-v1') || 'null')?.collected.includes('c01-01:cache'), null, {timeout: 10000});
  const found = await playState();
  assert.equal(found.coins, 3);
  assert.ok(found.bag.includes('antenna-cap') && found.bag.includes('emergency-biscuit'));
  assert.equal(await isDone(0), false, 'Finding cosmetics gives no learning credit.');
  await interact('cache');
  await page.waitForFunction(() => document.querySelector('.play-speech-copy')?.textContent.includes('empty'));
  assert.equal((await playState()).coins, 3, 'Repeated crate interactions do not farm coins.');
  await ui('pack').click();
  const beforeHat = await page.locator('.play-avatar svg').innerHTML();
  await ui('equip-antenna-cap').click();await waitTutorial(4);
  assert.equal((await playState()).equipped.hat, 'antenna-cap');
  assert.notEqual(await page.locator('.play-avatar svg').innerHTML(), beforeHat, 'Equipped gear visibly changes the ranger in the world.');
  await closeGadget();
  await screenshot('antenna-equipped');
  checks.push('actual movement', 'cache no farming', 'visible equipped gear');

  // Repeated native dialog closes must not leave old world/tool listeners behind.
  for (let count = 0; count < 2; count++) {
    await ui('settings').click();
    await action('close-dialog').click();
  }
  checks.push('settings close controller cleanup');

  const first = missions[0];
  await ui('open-gadget').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#game-panel').evaluate(node => node.contains(document.activeElement)), true, 'Keyboard opening places focus inside the gadget.');
  assert.equal(await ui('classify-item-screen').count(), 0, 'Scattered components are not already available on the bench.');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#game-panel').count(), 0, 'Escape puts the gadget away.');
  assert.equal(await page.locator('.pw-scene').evaluate(node => node === document.activeElement), true, 'Closing the gadget returns keyboard control to the world.');
  checks.push('keyboard gadget open and dismiss');
  for (const [index, id] of ['screen', 'linux', 'viewer', 'route'].entries()) {
    await interact(`artifact:${id}`);
    await page.waitForFunction(item => !document.querySelector(`[data-world-object="artifact:${item}"]`), id, {timeout: 10000});
    assert.equal(await page.locator('#game-panel').count(), 0, 'Recovering a physical component stays in the world.');
    assert.equal(await isDone(0), false, 'Picking up parts gives observations, not assembly credit.');
    if (index === 1) {
      const partial = await exportSave('two-parts-recovered');
      assert.deepEqual(new Set(partial.data.journey.sessions[first.id].activity[0].inspected), new Set(['screen', 'linux']));
      assert.equal(partial.data.journey.sessions[first.id].done[0], false);
      await page.reload({waitUntil: 'networkidle'});await ui('start-journey').click();await stories();
      for (const recovered of ['screen', 'linux']) assert.equal(await page.locator(`[data-world-object="artifact:${recovered}"]`).count(), 0, 'Reload does not respawn an already recovered component.');
      for (const remaining of ['viewer', 'route']) assert.equal(await page.locator(`[data-world-object="artifact:${remaining}"]`).count(), 1, 'Unrecovered parts remain available after reload.');
      assert.equal((await playState()).coins, 3, 'A partial collection reload does not repeat cache rewards.');
    }
  }
  checks.push('physical part recovery', 'partial collection reload');
  await openGadget();
  await ui('submit-activity').click();
  assert.equal(await isDone(0), false, 'Pressing the power button without assembling the kit earns no clue.');
  // Real keyboard activation and native drag-and-drop accompany the touch path.
  await ui('classify-item-screen').focus();await page.keyboard.press('Enter');
  await ui('classify-target-hardware').focus();await page.keyboard.press('Enter');
  assert.equal(await ui('classify-target-hardware').evaluate(node => node === document.activeElement), true, 'Keyboard focus survives placing an object.');
  await ui('classify-item-linux').dragTo(page.locator('[data-drop-category="os"]'));
  assert.equal(await page.locator('[data-drop-category="os"] [data-testid="classify-item-linux"]').count(), 1, 'Dragging from the parts tray reaches its socket in the scrolling gadget.');
  for (const [id, target] of [['viewer', 'app'], ['route', 'app']]) {
    await ui(`classify-item-${id}`).click();await ui(`classify-target-${target}`).click();
  }
  await ui('submit-activity').click();
  assert.equal(await isDone(0), false, 'A fully assembled but incorrect setup is not accepted.');
  await ui('classify-item-route').click();await ui('classify-target-file').click();
  await screenshot('assembled-field-computer');
  await ui('submit-activity').click();await stories();await waitTutorial(5);
  assert.equal(await isDone(0), true);
  await page.waitForFunction(() => {
    const crack = document.querySelector('.pw-sign-crack');
    return crack && Number(getComputedStyle(crack).opacity) === 0;
  }, null, {timeout: 5000});
  checks.push('verified physical repair consequence');
  await solveActivity(first, 1, {negative: true});await waitTutorial(6);
  checks.push('activity:classify', 'keyboard placement', 'native drag placement', 'verified assembly and Nova actions');
  await closeGadget();
  await finishEncounter(first);
  const firstSave = await exportSave('first-public-completion');
  assert.equal(firstSave.data.format, 'terminal-trails-adventure');
  assert.equal(firstSave.data.journey.completed.length, 1);
  assert.equal(firstSave.data.play.coins, 11, 'Only the cache and actually completed mission award their cosmetic coins.');
  await page.reload({waitUntil: 'networkidle'});await ui('start-journey').click();await stories();
  assert.equal((await playState()).coins, 11, 'Reload does not repeat mission rewards.');
  assert.equal((await playState()).equipped.hat, 'antenna-cap');
  await action('home').click();
  await page.locator('.lv-map-node[data-chapter="1"]').click();
  await page.locator('[data-action="mission"][data-mission="c01-01"]').click();
  assert.equal(await page.locator('.pw-world').getAttribute('data-complete'), 'true', 'The cleared opening can be revisited without losing completion.');
  await ui('finish-encounter').click();
  assert.equal((await playState()).activeMission, 'c01-02', 'The completed-scene belt continues to the next unlocked encounter.');
  assert.equal(await page.locator('.pw-world').getAttribute('data-complete'), 'false');
  assert.equal((await playState()).coins, 11, 'Revisiting a cleared scene does not repeat its reward.');
  checks.push('completed scene belt progression');

  const samples = {};
  for (const mission of missions) for (const [index, step] of mission.steps.entries()) if (step.activity && !samples[step.activity.kind]) samples[step.activity.kind] = {mission, index};
  for (const kind of ['compare', 'inspect', 'sequence', 'report', 'connect']) {
    const {mission, index} = samples[kind];
    await importSave(`earned-${kind}`, await earnedFixture(mission.id, index));
    await ui('start-journey').click();await stories();
    assert.equal((await playState()).tutorialStage, 6, 'An existing earned learning save migrates without replaying onboarding.');
    await solveActivity(mission, index, {negative: true});
    await screenshot(`${kind}-play-tool`, 390, 900);
    await closeGadget();
  }

  const boss = missions.find(mission => mission.id === 'c01-boss');
  await importSave('earned-first-boss', await earnedFixture(boss.id));
  await ui('start-journey').click();await stories();
  assert.equal(await page.locator('.pw-world').getAttribute('data-boss'), 'true');
  const bossCoins = (await playState()).coins;
  for (const [index, step] of boss.steps.entries()) {
    if (step.check.type === 'activity') await solveActivity(boss, index);
    else for (const command of Array.isArray(step.solution) ? step.solution : [step.solution]) await enterCommand(command);
    assert.equal(await isDone(index), true, `${boss.id}/${step.id}: the boss progresses only with real evidence.`);
    assert.equal(await page.locator('.pw-world').getAttribute('data-progress'), String(index + 1));
  }
  await closeGadget();
  assert.equal(await page.locator('.pw-world').getAttribute('data-complete'), 'false', 'Practical work still requires the final conversation.');
  await finishEncounter(boss);
  assert.equal((await playState()).coins, bossCoins + 40);
  assert.ok((await playState()).badges.includes('chapter-01'));
  const bossSave = await exportSave('first-boss-earned');
  checks.push('boss verified world consequences', 'earned trophy', 'legacy learning-save migration', 'adventure export');

  const importedContext = await browser.newContext({viewport: {width: 390, height: 900}, acceptDownloads: true});
  page = await importedContext.newPage();observe(page);await page.goto(baseURL, {waitUntil: 'networkidle'});
  await importSave('adventure-other-device', firstSave.data);
  const imported = await exportSave('adventure-other-device-restored');
  for (const key of ['completed', 'sessions', 'records', 'settings', 'practiceSessions']) assert.deepEqual(imported.data.journey[key], firstSave.data.journey[key]);
  assert.deepEqual(imported.data.play, firstSave.data.play);
  const forged = structuredClone(imported.data);forged.play.coins++;
  const forgedPath = new URL('invalid-coin-envelope.json', artifacts).pathname;
  await writeFile(forgedPath, JSON.stringify(forged));
  await ui('settings').click();await page.locator('#import-file').setInputFiles(forgedPath);
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('coin balance'));
  assert.equal(await ui('confirm-import').count(), 0, 'An invalid accessory ledger never reaches import confirmation.');
  const afterRejected = await exportSave('after-rejected-adventure');
  for (const key of ['completed', 'sessions', 'records', 'practiceSessions']) assert.deepEqual(afterRejected.data.journey[key], imported.data.journey[key], 'Rejected adventure import leaves learning evidence unchanged.');
  assert.deepEqual(afterRejected.data.play, imported.data.play, 'Rejected adventure import leaves the backpack unchanged.');
  await ui('start-journey').click();await stories();
  for (const [width, height] of [[320, 900], [390, 900], [844, 390], [1440, 1000]]) await screenshot('adventure-responsive', width, height);
  await page.setViewportSize({width: 390, height: 900});
  const pad = page.locator('[data-world-stick]');
  await pad.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const padBox = await pad.boundingBox(), padStart = await avatar();
  assert.ok(padBox && padBox.width >= 44 && padBox.height >= 44, 'Phone walking controls have usable touch targets.');
  assert.equal(await pad.evaluate(node => {
    const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return hit === node || node.contains(hit);
  }), true, 'The fixed adventure belt does not cover the walking control.');
  await page.mouse.move(padBox.x + padBox.width / 2, padBox.y + padBox.height / 2);await page.mouse.down();
  await page.mouse.move(padBox.x + padBox.width * .85, padBox.y + padBox.height / 2);
  try {await page.waitForFunction(x => Number(document.querySelector('.play-avatar')?.dataset.x) >= x + 2, padStart.x, {timeout: 5000});}
  finally {await page.mouse.up();}
  checks.push('phone walking control', 'editor movement isolation');
  checks.push('adventure import on another browser', '320/390/landscape/desktop layouts');

  const damagedContext = await browser.newContext({viewport: {width: 390, height: 900}, acceptDownloads: true});
  page = await damagedContext.newPage();observe(page);
  await damagedContext.addInitScript(() => localStorage.setItem('terminal-trails-play-v1', '{damaged backpack'));
  await page.goto(baseURL, {waitUntil: 'networkidle'});await ui('start-journey').click();await stories();
  await ui('pack').click();await closeGadget();
  assert.equal(await page.evaluate(() => localStorage.getItem('terminal-trails-play-v1')), '{damaged backpack', 'A damaged existing backpack is preserved while the tab uses a temporary replacement.');
  checks.push('invalid adventure import atomicity', 'corrupt local backpack preservation');

  assert.deepEqual(errors, []);
  assert.deepEqual(failedResources, []);
  await writeFile(new URL('report.json', artifacts), JSON.stringify({checks, errors, failedResources, note: 'Targeted public-play QA; not evidence of fun, beginner comprehension or retention.'}, null, 2));
} catch (error) {
  await page.screenshot({path: new URL('failure.png', artifacts).pathname, fullPage: true}).catch(() => {});
  await writeFile(new URL('failure.txt', artifacts), String(error.stack || error));
  throw error;
} finally {await browser.close();}
