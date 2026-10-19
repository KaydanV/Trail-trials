/** Public-UI regression with authored solutions. This is software QA, not learner evidence. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {missions, chapters} from '../curriculum.js';
import {makeReviewMission} from '../review.js';

const origin = (process.env.TRAILS_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const baseURL = origin.endsWith('/living-valley') ? origin + '/' : origin + '/living-valley/';
const artifacts = new URL('../../test-results/living-valley-ui/', import.meta.url);
await mkdir(artifacts, {recursive: true});
for (const name of ['report.json', 'failure.txt', 'failure.png', 'failure-journey.json']) await rm(new URL(name, artifacts), {force: true});
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox']});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
let page = await context.newPage();
const errors = [], resources = [], unexpectedDialogs = [], cinematicModes = {}, speakers = new Set(), negativeKinds = new Set(), completed = [];
let sceneFrames = 0, bossCount = 0;
const reflection = 'The observation is evidence; its cause still needs investigation. <img src=x onerror=alert(1)>';
function observe(target) {
  target.on('pageerror', error => errors.push(error.message));
  target.on('dialog', async dialog => {unexpectedDialogs.push(dialog.message()); await dialog.dismiss();});
  target.on('response', response => {if (response.url().startsWith(new URL(baseURL).origin) && response.status() >= 400) resources.push(`${response.status()} ${response.url()}`);});
  target.on('requestfailed', request => {if (request.url().startsWith(new URL(baseURL).origin)) resources.push(`${request.failure()?.errorText} ${request.url()}`);});
}
observe(page);
const ui = id => page.getByTestId(id);
const action = (name, extra = '') => page.locator(`[data-action="${name}"]${extra}`).filter({visible: true}).first();
const objective = index => ui(`objective-${index}`);
const isDone = async index => await objective(index).getAttribute('data-complete') === 'true';
async function closeGamePanel() {
  if (await ui('close-game-panel').isVisible()) await ui('close-game-panel').click();
}

async function noOverflow(label) {
  const size = await page.evaluate(() => ({viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
  assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `${label}: no page overflow ${JSON.stringify(size)}`);
}
async function dialogFits(label) {
  const dialog = page.locator('#dialog[open]');
  if (!await dialog.count()) return;
  const box = await dialog.boundingBox(), viewport = page.viewportSize();
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${label}: native dialog fits ${JSON.stringify({box, viewport})}`);
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), `${label}: dialog has no sideways overflow`);
}
async function screenshot(label, width = 1440, height = width < 800 ? 900 : 1000) {
  await page.setViewportSize({width, height});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await noOverflow(`${label} ${width}×${height}`);
  await dialogFits(`${label} ${width}×${height}`);
  await page.screenshot({path: new URL(`${label}-${width}x${height}.png`, artifacts).pathname, fullPage: true});
}
async function storiesAndGuide() {
  let remaining = 50;
  while (remaining-- > 0) {
    if (await ui('story-next').isVisible()) {
      const mode = await page.locator('#dialog').getAttribute('data-story-mode') || 'intro';
      cinematicModes[mode] = (cinematicModes[mode] || 0) + 1;
      sceneFrames++;
      const copy = await page.locator('#dialog .story-content').innerText();
      speakers.add(copy.split('·')[0].trim());
      await dialogFits(`${mode} story frame`);
      await ui('story-next').click();
    } else if (await ui('guide-skip').isVisible()) {
      // The complete rehearsal is exercised separately in immersive-browser.
      // This canonical route deliberately uses its public skip control.
      await ui('guide-skip').click();
    } else if (await ui('tour-next').isVisible()) {
      await dialogFits('Field guide');
      await ui('tour-next').click();
    } else return;
  }
  assert.fail('Story and guide frames must eventually return control to the player.');
}
async function openingAdventure() {
  assert.equal(await page.locator('#game-world').count(), 1, 'The opening tutorial takes place in the playable world.');
  assert.equal(await ui('tour-next').count(), 0, 'The old five-page explanatory tour no longer interrupts the opening.');
  const origin = await page.locator('.play-avatar').evaluate(node => ({x: Number(node.dataset.x), y: Number(node.dataset.y)}));
  await page.locator('#game-world .pw-scene').focus();
  await page.keyboard.down('d');
  try {
    await page.waitForFunction(start => {
      const node = document.querySelector('.play-avatar');
      return Math.hypot(Number(node.dataset.x) - start.x, Number(node.dataset.y) - start.y) >= 5;
    }, origin, {timeout: 5000});
  } finally {await page.keyboard.up('d');}
  const priorSpeech = await page.locator('.play-speech-copy').innerText();
  await page.locator('[data-world-object="patch"]').click();
  await page.waitForFunction(before => document.querySelector('.play-speech-copy')?.textContent.trim() !== before.trim(), priorSpeech, {timeout: 10000});
  await page.locator('[data-world-object="cache"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('terminal-trails-play-v1') || 'null')?.collected.includes('c01-01:cache'), null, {timeout: 10000});
  await ui('pack').click();
  await ui('equip-antenna-cap').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('terminal-trails-play-v1') || 'null')?.tutorialStage >= 4);
  await ui('close-game-panel').click();
  await recoverOpeningParts();
}
async function recoverOpeningParts() {
  await closeGamePanel();
  for (const id of ['screen', 'linux', 'viewer', 'route']) {
    const object = page.locator(`[data-world-object="artifact:${id}"]`);
    if (!await object.count()) continue;
    await object.click();
    await page.waitForFunction(item => !document.querySelector(`[data-world-object="artifact:${item}"]`), id, {timeout: 10000});
    assert.equal(await isDone(0), false, 'Recovering a component does not complete its assembly puzzle.');
  }
}
async function selectTool(tool) {
  const gadget = ui('open-gadget');
  if (await gadget.isVisible() && !await page.locator('#game-panel .tool-tabs').count()) await gadget.click();
  const button = page.locator(`.tool-tabs [data-tool=${JSON.stringify(tool)}]`);
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
}
async function enterCommand(raw) {
  if (!await ui('terminal-input').isVisible()) await selectTool('terminal');
  const input = ui('terminal-input'), old = await input.elementHandle();
  await input.fill(raw);
  await input.press('Enter');
  // Every finished command re-renders the public workbench, including failures.
  await page.waitForFunction(node => !node.isConnected, old);
  await old.dispose();
  if (await ui('terminal-input').isVisible() && !await page.locator('#dialog[open]').count()) {
    await page.waitForFunction(() => {
      const input = document.querySelector('[data-testid="terminal-input"]');
      return input && !input.disabled;
    });
    assert.equal(await ui('terminal-input').evaluate(node => node === document.activeElement), true, 'A finished terminal command returns keyboard focus to the enabled command field');
  }
  await storiesAndGuide();
}
async function exportJourney(label) {
  if (await page.locator('#dialog[open]').count()) await action('close-dialog').click();
  await closeGamePanel();
  await ui('settings').click();
  const downloadPromise = page.waitForEvent('download');
  await ui('export-save').click();
  const download = await downloadPromise;
  const path = new URL(`${label}.json`, artifacts).pathname;
  await download.saveAs(path);
  await action('close-dialog').click();
  const data = JSON.parse(await readFile(path, 'utf8'));
  return {path, data, profile: data.journey || data};
}
function canonical(profile) {return {completed: profile.completed, sessions: profile.sessions, records: profile.records};}

async function inspectRequired(step, index) {
  const ids = step.solution?.inspect || step.activity.requiredInspect || [];
  for (const id of ids) {
    if (await isDone(index)) break;
    const button = ui(`inspect-${id}`).filter({visible: true});
    assert.ok(await button.count(), `${step.id}: required evidence ${id} has a usable public inspection control`);
    await button.first().click();
    await storiesAndGuide();
  }
}
async function solveActivity(mission, step, index) {
  const activity = step.activity, solution = step.solution || {};
  if (mission.id === 'c01-01' && index === 0 && activity.kind === 'classify') await recoverOpeningParts();
  await selectTool(step.tool);
  if (activity.kind === 'inspect' && !negativeKinds.has('inspect')) {
    const relevant = activity.requiredInspect || solution.inspect || [];
    const irrelevant = activity.items.find(item => !relevant.includes(item.id));
    if (irrelevant) {
      await ui(`inspect-${irrelevant.id}`).click();
      assert.equal(await isDone(index), false, 'Opening irrelevant evidence cannot finish the observation');
      negativeKinds.add('inspect');
    }
  }
  await inspectRequired(step, index);
  if (await isDone(index)) return;
  if ((activity.kind === 'choose' || activity.kind === 'compare') && !negativeKinds.has(activity.kind)) {
    const wrong = activity.choices.find(choice => !choice.correct);
    await ui(`choice-${wrong.id}`).click();
    assert.equal(await isDone(index), false, 'A plausible but unsupported choice earns no evidence');
    assert.ok((await page.locator('#game-panel .gadget-reaction').innerText()).length > 10, 'Wrong-choice feedback is readable inside the open gadget');
    negativeKinds.add(activity.kind);
  } else if (['classify', 'sequence', 'connect', 'report', 'repair'].includes(activity.kind) && !negativeKinds.has(activity.kind)) {
    if (activity.kind === 'repair') await page.locator('[data-repair-text]').fill('');
    await ui('submit-activity').click();
    assert.equal(await isDone(index), false, `An incomplete ${activity.kind} cannot finish the clue`);
    negativeKinds.add(activity.kind);
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
    for (const [id, value] of Object.entries(solution.fields)) await page.locator(`[data-report-field=${JSON.stringify(id)}]`).fill(value);
    await ui('submit-activity').click();
  } else if (activity.kind === 'repair') {
    await page.locator('[data-repair-text]').fill(solution.text);
    await ui('submit-activity').click();
  } else assert.fail(`Unsupported authored activity kind ${activity.kind}`);
  await storiesAndGuide();
}
async function debrief(mission, note = '') {
  await closeGamePanel();
  assert.ok(await ui('finish-encounter').isEnabled(), `${mission.id}: every practical clue is required`);
  await ui('finish-encounter').click();
  for (const [index, question] of mission.questions.entries()) {
    assert.equal(await ui('complete-encounter').isVisible(), false, 'Unanswered knowledge checks cannot complete the encounter');
    if (mission.id !== 'c01-01') assert.match(await page.locator('#dialog-title').innerText(), new RegExp(question.question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    else assert.ok((await page.locator('#dialog-title').innerText()).length > 15, 'The first knowledge check is voiced as Patch dialogue.');
    for (const [answerIndex, option] of question.options.entries()) assert.equal(await ui(`answer-${answerIndex}`).innerText(), option, 'Conversation answers still match the real knowledge gate.');
    await ui(`answer-${(question.answer + 1) % question.options.length}`).click();
    assert.equal(await ui('question-next').isVisible(), false, 'An incorrect answer keeps the knowledge gate closed');
    await ui(`answer-${question.answer}`).click();
    assert.equal((await page.locator('.question-feedback').innerText()).includes(question.explanation), true, 'The explanation remains visible for the current question');
    assert.equal(await ui('complete-encounter').isVisible(), false, 'Acknowledging the explanation is explicit');
    await ui('question-next').click();
  }
  if (note) {
    const noteDetails = page.locator('#dialog details').filter({has: page.locator('#reflection')});
    if (await noteDetails.count() && !await noteDetails.evaluate(node => node.open)) await noteDetails.locator('summary').click();
    await page.locator('#reflection').fill(note);
  }
  await ui('complete-encounter').click();
  await storiesAndGuide();
  assert.equal(await page.locator('#dialog').getAttribute('data-kind'), 'completion');
}

async function solveMission(mission, {number, review = false, partialReload = false} = {}) {
  await storiesAndGuide();
  for (const [index, step] of mission.steps.entries()) {
    if (await isDone(index)) continue;
    assert.ok(await ui('finish-encounter').isDisabled(), `${mission.id}: incomplete evidence cannot open debrief`);
    if (step.check.type === 'activity') await solveActivity(mission, step, index);
    else if (mission.id === 'c09-06' && step.id === 'repair-list') {
      await selectTool('script');
      await page.locator('#script-path').selectOption(step.check.path);
      await page.locator('#script-editor').fill('#!/bin/bash\nfor station in pine owl burrow; do echo "CHECK $station"; done');
      const old = await ui('terminal-input').elementHandle();
      await action('save-script').click();
      await page.waitForFunction(node => !node.isConnected, old);
      await old.dispose();
      await storiesAndGuide();
    } else if (mission.id === 'c09-06' && step.id === 'validate-loop') {
      await selectTool('script');
      await page.locator('#script-path').selectOption(mission.steps[0].check.path);
      const old = await ui('terminal-input').elementHandle();
      await action('run-script').click();
      await page.waitForFunction(node => !node.isConnected, old);
      await old.dispose();
      await storiesAndGuide();
    }
    else {
      await selectTool(step.tool === 'explorer' ? 'terminal' : step.tool);
      for (const raw of Array.isArray(step.solution) ? step.solution : [step.solution]) await enterCommand(raw);
    }
    assert.equal(await isDone(index), true, `${mission.id}/${step.id}: authored action earns actual evidence`);
    for (let future = index + 1; future < mission.steps.length; future++) assert.equal(await isDone(future), false, 'An action cannot award a future clue');
    await noOverflow(`${mission.id}/${step.id}`);
    if (mission.id === 'c01-01' && index === 0 && !review) {
      await closeGamePanel();
      if (!await ui('ask-patch').isVisible()) await page.locator('[data-game-action="speech-expand"]').click();
      await ui('ask-patch').click();
      assert.ok((await page.locator('.play-speech-copy').innerText()).length > 10, 'Patch offers a contextual nudge');
      const partial = await exportJourney('canonical-partial');
      assert.deepEqual(partial.profile.sessions[mission.id].done, mission.steps.map((_, i) => i === 0));
      await page.reload({waitUntil: 'networkidle'});
      await ui('start-journey').click();
      await storiesAndGuide();
      assert.equal(await isDone(0), true, 'Reload preserves a real partial canonical action');
    }
    if (partialReload && index === 0) {
      const before = await exportJourney(`return-${mission.id}-partial`);
      await page.reload({waitUntil: 'networkidle'});
      await openReview(mission.id);
      assert.equal(await isDone(0), true, 'A return trip resumes its own partial evidence after reload');
      const after = await exportJourney(`return-${mission.id}-resumed`);
      assert.deepEqual(after.profile.practiceSessions[mission.id], before.profile.practiceSessions[mission.id]);
    }
    if (['c01-01', 'c03-boss', 'c09-06', 'c10-03', 'c12-boss'].includes(mission.id) && index === mission.steps.length - 1 && !review) {
      for (const [width, height] of [[390, 900], [320, 900], [844, 390]]) await screenshot(`${mission.id}-evidence`, width, height);
      await page.setViewportSize({width: 1440, height: 1000});
    }
  }
  await debrief(mission, mission.id === 'c01-01' ? reflection : `QA route: ${mission.briefing.plain}`);
  if (!review) {
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('terminal-trails-living-valley-v1')));
    assert.equal(saved.completed.length, number, 'The visible completion persists exactly one newly earned encounter.');
    assert.ok(saved.records[mission.id], 'The earned completion has a saved report.');
    if (mission.phase === 'boss') bossCount++;
    completed.push(mission.id);
    console.log(`✓ ${String(number).padStart(3, '0')}/104 ${mission.id} — ${mission.title}`);
  }
}
async function openReview(id) {
  const mission = missions.find(mission => mission.id === id);
  if (await page.locator('#dialog[open]').count()) await action('close-dialog').click();
  if (!await page.locator(`.lv-map-node[data-chapter="${mission.chapter}"]`).count()) await action('home').click();
  await page.locator(`.lv-map-node[data-chapter="${mission.chapter}"]`).click();
  await page.locator(`[data-action="review"][data-mission=${JSON.stringify(id)}]`).click();
  await storiesAndGuide();
}

try {
  assert.equal(missions.length, 104, 'There are exactly 104 authored encounters');
  assert.equal(chapters.length, 12);
  assert.equal((await page.goto(baseURL, {waitUntil: 'networkidle'})).status(), 200);
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [[1440, 1000], [390, 900], [320, 900], [844, 390]]) await screenshot('valley-home', width, height);
  await page.setViewportSize({width: 1440, height: 1000});
  await page.locator('.lv-map-node[data-chapter="12"]').click();
  assert.equal(await page.locator('[data-action="mission"]:enabled').count(), 0, 'Future locations can be previewed without unlocking their missions');
  await action('home').click();
  await ui('start-journey').click();
  await screenshot('first-story', 390, 900);
  await screenshot('first-story-landscape', 844, 390);
  await page.setViewportSize({width: 1440, height: 1000});
  while (await ui('story-next').isVisible()) {sceneFrames++;cinematicModes.intro = (cinematicModes.intro || 0) + 1;await ui('story-next').click();}
  await storiesAndGuide();
  await openingAdventure();
  for (const [width, height] of [[320, 900], [390, 900], [844, 390]]) await screenshot('playable-field-guide', width, height);
  await page.setViewportSize({width: 1440, height: 1000});

  // Settings are real behavior: reading size, reduced motion, and a paused clock.
  await ui('settings').click();
  await page.locator('#setting-large').check();await page.locator('#setting-timer').check();
  await page.locator('#setting-motion').uncheck();
  await action('close-dialog').click();
  assert.equal(await page.locator('body').getAttribute('data-text-size'), 'large');
  assert.equal(await page.locator('body').getAttribute('data-motion'), 'off');
  const clockBefore = await page.locator('#practice-clock').innerText();
  await page.waitForFunction(previous => document.querySelector('#practice-clock')?.textContent !== previous, clockBefore, {timeout: 5000});
  await ui('settings').click();const paused = await page.locator('#practice-clock').innerText();
  await page.waitForTimeout(1200); // Cross a real clock tick while the settings modal pauses play.
  assert.equal(await page.locator('#practice-clock').innerText(), paused);
  await screenshot('large-reading-settings', 390, 900);
  await page.locator('#setting-timer').uncheck();await page.locator('#setting-large').uncheck();await page.locator('#setting-motion').check();
  await action('close-dialog').click();
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.waitForFunction(() => document.body.dataset.motion === 'off');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.waitForFunction(() => document.body.dataset.motion === 'on');
  await page.setViewportSize({width: 1440, height: 1000});

  for (const [index, mission] of missions.entries()) {
    await solveMission(mission, {number: index + 1});
    if (index === 0 || mission.phase === 'boss') await screenshot(`${mission.id}-completion`, mission.phase === 'boss' ? 390 : 1440, 900);
    await page.setViewportSize({width: 1440, height: 1000});
    if (index < missions.length - 1) await ui('next-encounter').click();
  }
  assert.equal(bossCount, 12);
  const full = await exportJourney('all-104-canonical');
  assert.equal(full.profile.completed.length, 104);
  assert.ok(missions.filter(mission => mission.phase === 'boss').every(mission => full.profile.records[mission.id].independent), 'All twelve bosses were completed without command hints');
  const baseline = canonical(full.profile);
  await action('home').click();
  assert.match(await page.locator('.lv-map-restoration').innerText(), /12\s*\/\s*12/);
  await screenshot('valley-restored', 1440, 1000);

  for (const id of ['c01-04', 'c09-08', 'c10-03', 'c12-boss']) {
    await openReview(id);
    const reviewed = makeReviewMission(missions.find(mission => mission.id === id), 1);
    await solveMission(reviewed, {review: true, partialReload: id === 'c01-04'});
    const result = await exportJourney(`return-${id}-complete`);
    assert.deepEqual(canonical(result.profile), baseline, 'Return-trip actions never change canonical evidence, reports or progress');
    assert.equal(result.profile.practiceSessions[id].session.completed, true);
    assert.equal(result.profile.practiceSessions[id].record.independent, true);
    await action('home').click();
  }
  const withPractice = await exportJourney('all-104-with-return-trips');
  await ui('journal').click();
  assert.equal(await page.locator('.journal-note img').count(), 0, 'A learner reflection is displayed as text, never executable markup');
  assert.ok((await page.locator('#dialog-content').innerText()).includes(reflection));
  await action('close-dialog').click();

  const freshContext = await browser.newContext({viewport: {width: 390, height: 900}, acceptDownloads: true});
  page = await freshContext.newPage();observe(page);
  await page.goto(baseURL, {waitUntil: 'networkidle'});await ui('settings').click();
  await page.locator('#import-file').setInputFiles(withPractice.path);await ui('confirm-import').click();
  const restored = await exportJourney('restored-on-another-browser');
  assert.deepEqual(canonical(restored.profile), baseline);
  assert.deepEqual(restored.profile.practiceSessions, withPractice.profile.practiceSessions);
  await ui('start-journey').click();await storiesAndGuide();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('terminal-trails-living-valley-v1')).completed.length), 104);
  await screenshot('restored-on-phone', 390, 900);
  assert.deepEqual(errors, [], 'No uncaught browser errors across canonical, practice, or imported journeys');
  assert.deepEqual(resources, [], 'Every requested local application resource loaded');
  assert.deepEqual(unexpectedDialogs, [], 'Learner text never invokes browser dialogs');
  const report = {canonical: completed.length, bosses: bossCount, practiceIds: ['c01-04', 'c09-08', 'c10-03', 'c12-boss'], sceneFrames, cinematicModes, speakers: [...speakers], negativeKinds: [...negativeKinds], errors, resources, note: 'Public-UI automation using authored solutions; not evidence of beginner comprehension or retention.'};
  await writeFile(new URL('report.json', artifacts), JSON.stringify(report, null, 2));
  console.log('Living Valley browser regression passed: all 104 public-UI encounters, 12 bosses, all knowledge gates, saved accepted reports, fresh return trips, reload/export/import, stories, phone layouts, readable settings and optional clock.');
} catch (error) {
  await page.screenshot({path: new URL('failure.png', artifacts).pathname, fullPage: true}).catch(() => {});
  await writeFile(new URL('failure.txt', artifacts), String(error.stack || error));
  // Preserve the public export as debugging evidence; never manufacture progress
  // or write application state to make a failed run appear complete.
  try {
    if (await page.locator('#dialog[open]').count()) await action('close-dialog').click();
    if (await ui('settings').isVisible()) await exportJourney('failure-journey');
  } catch {}
  throw error;
} finally {await browser.close();}
