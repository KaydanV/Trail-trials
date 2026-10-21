import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { missions } from '../src/curriculum.js';
import { getHint } from '../src/coach.js';
import { createPracticeMission } from '../src/practice.js';

// Drive the public UI with curriculum solutions. Never edit saves or application state.
const origin = (process.env.TRAILS_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const baseURL = process.env.LEGACY_URL || origin + '/classic.html';
const results = new URL('../test-results/', import.meta.url);
await mkdir(results, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
const unexpectedDialogs = [];
const resourceErrors = [];
const fontAssets = new Set();
page.on('pageerror', error => pageErrors.push(error.message));
page.on('dialog', async dialog => { unexpectedDialogs.push(dialog.message()); await dialog.dismiss(); });
page.on('response', response => {
  if (response.url().startsWith(new URL(baseURL).origin) && response.status() >= 400) resourceErrors.push(`${response.status()} ${response.url()}`);
  if (response.request().resourceType() === 'font' && response.status() === 200) fontAssets.add(response.url());
});
page.on('requestfailed', request => {
  if (request.url().startsWith(new URL(baseURL).origin)) resourceErrors.push(`${request.failure()?.errorText} ${request.url()}`);
});
const ui = id => page.getByTestId(id);
const reflection = 'Follow the evidence before making the call. <img src=x onerror=alert(1)>';

async function click(id) {
  await ui(id).waitFor({ state: 'visible' });
  await ui(id).click();
}

async function visible(id) {
  return ui(id).isVisible();
}

async function assertNoOverflow(label) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, `${label}: document overflow ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.body <= dimensions.viewport + 1, `${label}: body overflow ${JSON.stringify(dimensions)}`);
}

async function screenshot(label, width) {
  await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await assertNoOverflow(`${label} at ${width}px`);
  if (await page.locator('#cinematic-backdrop .speaking-character').isVisible()) await assertCinematicSeparation();
  await page.screenshot({ path: new URL(`${label}-${width}.png`, results).pathname, fullPage: true });
}

async function runCommand(command, requireSuccess = false, pointer = false) {
  await ui('terminal-input').fill(command);
  if (pointer) await click('run-command');
  else await ui('terminal-input').press('Enter');
  await page.waitForFunction(() => !document.querySelector('[data-testid="run-command"]').disabled);
  if (requireSuccess) {
    const line = page.locator('#terminal-output .terminal-line').last();
    assert.ok(!(await line.getAttribute('class')).split(' ').includes('error'), `Documented solution failed: ${command}\n${await line.innerText()}`);
  }
}

async function closeStory(watchStory = false) {
  if (watchStory) {
    let frames = 0;
    while (await visible('scene-next')) {
      assert.ok(frames++ < 10, 'Story frames eventually lead to the mission');
      await click('scene-next');
    }
  } else if (await visible('scene-skip')) await click('scene-skip');
}

async function walkTutorial() {
  const guide = page.locator('#tutorial-backdrop');
  await ui('tour-next').waitFor({ state: 'visible' });
  const titles = new Set();
  for (let step = 0; step < 6; step++) {
    assert.match(await ui('tour-progress').innerText(), new RegExp(`0?${step + 1}\\s*(?:/|of)\\s*0?6`, 'i'), 'The guide shows the current step');
    titles.add(await guide.locator('h2').innerText());
    await click('tour-next');
  }
  assert.equal(titles.size, 6, 'All six guide steps explain a different part of the mission');
  await guide.waitFor({ state: 'hidden' });
}

async function tutorialSnapshot() {
  return {
    objectives: await objectiveStatus(),
    hints: await page.locator('#hint-button').innerText(),
    timer: await page.locator('#session-timer').innerText(),
    commands: await page.locator('#terminal-output .terminal-line.command').count(),
    completed: await page.locator('.trail-progress > p').innerText(),
    terminalDisabled: await ui('terminal-input').isDisabled(),
  };
}

async function assertOnscreen(locator, label) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1, `${label} fits within the viewport: ${JSON.stringify(box)}`);
}

async function exerciseFirstTutorial() {
  const guide = page.locator('#tutorial-backdrop');
  await ui('tour-next').waitFor({ state: 'visible' });
  const before = await tutorialSnapshot();
  assert.ok(before.objectives.every(status => !status), 'The guide begins before any objective is awarded');
  assert.equal(before.terminalDisabled, true, 'The guide does not start the mission');
  assert.match(before.timer, /0:00/, 'The learning timer has not started');
  assert.equal(before.commands, 0, 'The guide does not execute sample commands');
  const title = await guide.locator('h2').innerText();
  await click('tour-next');
  assert.notEqual(await guide.locator('h2').innerText(), title, 'Next explains the following part of the mission');
  await click('tour-back');
  assert.equal(await guide.locator('h2').innerText(), title, 'Back returns to the previous explanation');
  for (let step = 0; step < 8; step++) {
    assert.ok(await guide.evaluate(element => element.contains(document.activeElement)), 'The guide keeps keyboard focus in its controls');
    await page.keyboard.press('Tab');
  }
  await screenshot('tutorial', 1440);
  await screenshot('tutorial', 390);
  await assertOnscreen(guide.locator('[role="dialog"]'), 'The mobile guide card');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.dataset.motion === 'off');
  await click('tour-next');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await click('tour-next');
  assert.match(await ui('tour-progress').innerText(), /0?3\s*(?:\/|of)\s*0?6/i, 'The third step explains the terminal');
  for (const [preview, output] of [[0, /\/home\/trainee/], [1, /trainee/], [2, /trail note/i]]) {
    await click(`tour-demo-${preview}`);
    assert.match(await guide.locator('.tour-demo-output').innerText(), output, 'A preview explains the result of its command');
    assert.ok((await guide.locator('.tour-demo-meaning').innerText()).length > 10, 'Each preview explains what its command means');
  }
  assert.deepEqual(await tutorialSnapshot(), before, 'Trying command previews never executes mission commands or changes progress');
  const terminal = await page.locator('.terminal-window').boundingBox();
  assert.ok(terminal && terminal.y < page.viewportSize().height && terminal.y + terminal.height > 0, 'The mobile guide scrolls an offscreen terminal into view');
  await assertOnscreen(guide.locator('[role="dialog"]'), 'The anchored mobile guide card');
  await assertNoOverflow('Mobile guided tutorial');
  for (let step = 3; step <= 6; step++) {
    await click('tour-next');
    if (step < 6) await assertOnscreen(guide.locator('[role="dialog"]'), 'Each mobile guide explanation');
  }
  await guide.waitFor({ state: 'hidden' });
  assert.deepEqual(await tutorialSnapshot(), before, 'Reading every guide step changes no tasks, hints, commands, timer, or mission progress');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const replay = ui('tour-replay').filter({ visible: true }).first();
  await replay.click();
  await ui('tour-next').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await guide.waitFor({ state: 'hidden' });
  assert.ok(await replay.evaluate(element => document.activeElement === element), 'Escape from a replay restores the replay button focus');
  await replay.click();
  await click('tour-skip');
  await guide.waitFor({ state: 'hidden' });
  assert.deepEqual(await tutorialSnapshot(), before, 'Replaying or skipping the guide leaves the mission untouched');
}

async function enterMission(watchStory = false) {
  await closeStory(watchStory);
  if (await visible('tour-next')) await walkTutorial();
  if (await visible('start-mission')) await click('start-mission');
  await ui('terminal-input').waitFor({ state: 'visible' });
}

async function assertRenderedIllustration(locator, label) {
  await locator.waitFor({ state: 'visible' });
  await locator.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  const rendered = await locator.evaluate(element => {
    const images = [...element.querySelectorAll('img')];
    const imageReady = images.some(image => image.complete && image.naturalWidth > 0 && image.getBoundingClientRect().width > 0);
    const layers = [element, ...element.querySelectorAll('*')].map(node => getComputedStyle(node).backgroundImage);
    return imageReady || layers.some(layer => /url\(/.test(layer));
  });
  assert.ok(rendered, `${label} uses a visible image or sprite`);
}

async function assertCinematicSpeaker(expected) {
  const character = page.locator('#cinematic-backdrop .speaking-character');
  assert.equal(await character.getAttribute('data-speaker'), expected, 'The portrait matches the current speaker');
  await assertRenderedIllustration(character, `${expected} speaking portrait`);
  await assertCinematicSeparation();
}

async function assertCinematicSeparation() {
  const art = page.locator('#cinematic-backdrop .cinematic-art');
  await art.evaluate(async element => {
    const finite = element.querySelector('.speaking-character').getAnimations({ subtree: true }).filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await Promise.all(finite.map(animation => animation.finished.catch(() => {})));
  });
  const portrait = await art.locator('.speaking-character').boundingBox();
  const caption = await art.locator('.cinematic-location').boundingBox();
  assert.ok(portrait && caption, 'The cinematic portrait and location caption both render');
  const overlapWidth = Math.min(portrait.x + portrait.width, caption.x + caption.width) - Math.max(portrait.x, caption.x);
  const overlapHeight = Math.min(portrait.y + portrait.height, caption.y + caption.height) - Math.max(portrait.y, caption.y);
  assert.ok(overlapWidth <= 1 || overlapHeight <= 1, `The location caption stays clear of the speaking portrait: ${JSON.stringify({ portrait, caption })}`);
}

async function cinematicPicture() {
  return page.locator('#cinematic-backdrop .cinematic-art').evaluate(element => {
    const painting = element.querySelector('.scene-viewport') || element;
    const style = getComputedStyle(painting);
    return { key: element.dataset.scene, image: style.backgroundImage, position: style.backgroundPosition };
  });
}

async function assertMissionArtwork(index) {
  const scene = page.locator('#app .mission-scene[data-scene]').first();
  await scene.waitFor({ state: 'visible' });
  const key = await scene.getAttribute('data-scene');
  assert.ok(key, `Mission ${index + 1} has an assigned story location`);
  if (index === 2) assert.match(key, /owl|porch/i, 'The owl mission uses its message-porch scene');
  if (index === 3) assert.match(key, /squirrel|burrow/i, 'The squirrel mission uses its supply-burrow scene');
  await assertRenderedIllustration(scene, `Mission ${index + 1} scene`);
  return key;
}

async function assertDialogKeyboard(opener) {
  await click(opener);
  const dialog = page.getByRole('dialog').filter({ visible: true });
  await dialog.waitFor({ state: 'visible' });
  for (let step = 0; step < 10; step++) {
    assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), `${opener}: dialog traps keyboard focus`);
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), opener, `${opener}: Escape restores focus`);
}

async function assertLockedChapter(id) {
  const button = ui(id);
  await button.waitFor({ state: 'visible' });
  assert.ok(await button.isDisabled() || await button.getAttribute('aria-disabled') === 'true', `${id} remains locked until a future release`);
}

async function objectiveStatus() {
  return page.locator('[data-testid^="objective-"]').evaluateAll(elements => elements.map(element => element.dataset.complete === 'true'));
}

async function worldSnapshot() {
  return page.locator('#app .world-reactor').evaluate(element => ({
    kind: element.dataset.kind,
    phase: element.dataset.phase,
    stage: element.dataset.stage,
    verified: element.dataset.verified,
    figurePhase: element.closest('figure').dataset.worldPhase,
    bits: [...element.querySelectorAll('[data-world-task]')].map(bit => ({
      objective: bit.dataset.worldTask,
      revealed: bit.dataset.revealed,
    })),
  }));
}

async function assertWorldMatchesEvidence(mission, completed = false) {
  const reactor = page.locator('#app .world-reactor');
  assert.equal(await reactor.locator('svg').evaluate(element => element.namespaceURI), 'http://www.w3.org/2000/svg', 'The living scene contains an actual SVG illustration');
  assert.ok(await reactor.locator('path, circle, rect, line, polygon, polyline, ellipse').count() > 3, 'The living illustration contains drawn objects');
  const statuses = await objectiveStatus();
  const world = await worldSnapshot();
  assert.equal(world.figurePhase, world.phase, 'The illustrated location and reactor describe the same state');
  for (const [index, objective] of mission.objectives.entries()) {
    const bits = world.bits.filter(bit => bit.objective === objective.id);
    assert.ok(bits.length > 0, `The living illustration depicts ${objective.id}`);
    assert.ok(bits.every(bit => bit.revealed === String(statuses[index])), `Only verified ${objective.id} evidence reveals its drawn objects`);
  }
  assert.ok(world.bits.filter(bit => bit.objective === 'complete').every(bit => bit.revealed === String(completed)), 'Restoration waits for the successful knowledge check');
  await page.waitForFunction(() => [...document.querySelectorAll('#app .world-reactor [data-world-task]')].every(bit => {
    const style = getComputedStyle(bit);
    return bit.dataset.revealed === 'true'
      ? style.visibility === 'visible' && style.display !== 'none' && Number(style.opacity) > 0.05
      : style.visibility === 'hidden' && Number(style.opacity) === 0;
  }), null, { timeout: 5000 });
  return world;
}

async function assertCurrentClue(mission) {
  const statuses = await objectiveStatus();
  const objective = mission.objectives.find((_, index) => !statuses[index]);
  if (objective) {
    assert.ok((await page.locator('#current-objective').innerText()).includes(objective.label), 'The field toolbar names the next unfinished clue');
    assert.ok((await page.locator('#current-objective-detail').innerText()).includes(objective.detail), 'The current clue explains the next evidence to collect');
  }
}

async function expectedHint(mission, strength = 0) {
  return getHint(mission, { tasks: await objectiveStatus() }, strength).text;
}

async function assertTextContrast(locator, label) {
  const colors = await locator.evaluate(element => {
    const parse = value => (value.match(/[\d.]+/g) || []).map(Number);
    const style = getComputedStyle(element);
    let current = element, background = parse(style.backgroundColor);
    while (background.length === 4 && background[3] === 0 && current.parentElement) {
      current = current.parentElement;
      background = parse(getComputedStyle(current).backgroundColor);
    }
    return { text: parse(style.color), background };
  });
  const luminance = color => color.slice(0, 3).map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const text = luminance(colors.text), background = luminance(colors.background);
  const contrast = (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
  assert.ok(contrast >= 4.5, `${label} text contrast is ${contrast.toFixed(2)}:1, at least 4.5:1`);
}

function browserSolutions(mission) {
  if (mission.id === 'hike-03') return [
    'cat /home/trainee/porch/guide.txt', 'cd porch', 'head -2 ./relay.log',
    'head -2 /home/trainee/porch/relay.log', 'tail -2 /home/trainee/porch/relay.log', 'cd ..',
  ];
  if (mission.id === 'hike-07') return mission.solutions.map(command => command === 'ls -l private' ? 'ls -la private' : command);
  if (mission.id === 'hike-16') return mission.solutions.map(command => command === 'ss -tuln' ? 'ss -tlnu' : command);
  if (mission.id === 'hike-21') return mission.solutions.map(command => command === 'grep AUTH_FAIL logs/auth.log | wc -l' ? 'cat logs/auth.log | grep AUTH_FAIL | wc -l' : command);
  return mission.solutions;
}

async function rejectUnrelatedCount(mission, prepare = false) {
  const before = await objectiveStatus();
  const world = await worldSnapshot();
  if (prepare) await runCommand('head -n 3 logs/auth.log > unrelated.txt', true);
  await runCommand('wc -l unrelated.txt', true);
  assert.equal((await page.locator('#terminal-output .terminal-line').last().innerText()).trim().split(/\s+/)[0], '3', 'The unrelated file genuinely contains the matching number of lines');
  assert.deepEqual(await objectiveStatus(), before, 'A matching count from an unrelated file awards no authentication pipeline evidence');
  assert.deepEqual(await worldSnapshot(), world, 'A matching unrelated count cannot advance the living scene');
  await assertCurrentClue(mission);
}

async function assertMobileFieldControls(mission) {
  await page.setViewportSize({ width: 390, height: 900 });
  const before = await objectiveStatus();
  const world = await worldSnapshot();
  const hints = await page.locator('#hint-button').innerText();
  const hintText = await page.locator('#hint-text').innerText();
  const destinations = {
    scene: '.mission-scene',
    objectives: '.objectives-card',
    terminal: '.terminal-window',
    decision: '.decision-card',
    patch: '.hint-companion',
  };
  async function jump(button, target, keyboard = false) {
    await button.waitFor({ state: 'visible' });
    if (keyboard) {
      await button.focus();
      await button.press('Enter');
    } else await button.click();
    assert.ok(await page.locator(destinations[target]).evaluate(element => element === document.activeElement || element.contains(document.activeElement)), `Jumping to ${target} moves keyboard focus into that section`);
    await assertNoOverflow(`Mobile jump to ${target}`);
    await assertCurrentClue(mission);
  }
  for (const [button, target] of [['#jump-clues', 'objectives'], ['#jump-patch', 'patch'], ['#jump-decision', 'decision']]) {
    await jump(page.locator(button), target, true);
  }
  for (const target of ['scene', 'objectives', 'decision', 'terminal']) {
    await jump(page.locator(`.mobile-field-nav button[data-target="${target}"]`), target);
  }
  assert.equal(await ui('terminal-input').evaluate(element => document.activeElement === element), true, 'The mobile terminal shortcut focuses command entry');
  assert.deepEqual(await objectiveStatus(), before, 'Moving around a mission awards no clue evidence');
  assert.deepEqual(await worldSnapshot(), world, 'Mobile navigation never advances the illustrated world');
  assert.equal(await page.locator('#hint-button').innerText(), hints, 'Jumping to Patch consumes no hint');
  assert.equal(await page.locator('#hint-text').innerText(), hintText, 'Mobile moves preserve the clue strength for the current objective');
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function exportJourney(label) {
  await click('settings');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-save').click();
  const download = await downloadPromise;
  const path = new URL(`${label}.json`, results).pathname;
  await download.saveAs(path);
  await page.keyboard.press('Escape');
  return { path, profile: JSON.parse(await readFile(path, 'utf8')) };
}

function canonicalProgress(profile) {
  return {
    currentMission: profile.currentMission,
    completed: profile.completed,
    notes: profile.notes,
    scores: profile.scores,
    sessions: profile.sessions,
  };
}

async function finishPractice(mission) {
  assert.ok((await objectiveStatus()).every(Boolean), 'Practice also requires every evidence objective');
  await click('debrief');
  assert.ok(await ui('complete-mission').isDisabled(), 'A practice case still requires its knowledge check');
  const beforeQuiz = await worldSnapshot();
  await click(`quiz-${(mission.quiz.answer + 1) % mission.quiz.options.length}`);
  assert.ok(await ui('complete-mission').isDisabled(), 'An incorrect practice answer cannot finish the case');
  assert.deepEqual(await worldSnapshot(), beforeQuiz, 'An incorrect practice answer cannot restore the illustrated scene');
  await click(`quiz-${mission.quiz.answer}`);
  await page.locator('#reflection').fill('A note for this practice case only.');
  await click('complete-mission');
  await assertWorldMatchesEvidence(mission, true);
  await assertTextContrast(page.locator('#dialog-backdrop .field-return-message'), 'The practice completion field message');
  await page.keyboard.press('Escape');
  await page.locator('.practice-banner').waitFor({ state: 'visible' });
}

async function exercisePractice() {
  for (const [index, mission] of missions.entries()) {
    await page.locator(`.trail-node[data-mission="${index}"]`).click();
    assert.equal(await visible('practice-mission'), true, `Completed stop ${index + 1} offers optional practice`);
    assert.ok((await objectiveStatus()).every(Boolean), `Visiting completed ${mission.id} preserves its canonical evidence`);
  }
  await page.locator('.trail-node[data-mission="0"]').click();
  const firstBaseline = await exportJourney('canonical-before-practice');
  const xp = await page.locator('.xp-badge').innerText();
  const unlocked = await page.locator('.trail-node:not([disabled])').count();
  const first = createPracticeMission(missions[0], 1);
  const second = createPracticeMission(missions[0], 2);
  assert.notDeepEqual(first.solutions, missions[0].solutions, 'Practice uses fresh evidence and commands');
  assert.notDeepEqual(second.solutions, first.solutions, 'Another practice case changes the evidence again');
  await click('practice-mission');
  await enterMission();
  assert.match(await ui('practice-variant').innerText(), /\b1\b/, 'The first remix identifies its case number');
  assert.ok((await objectiveStatus()).every(status => !status), 'Practice starts with independent unfinished objectives');
  const firstWorld = await assertWorldMatchesEvidence(first);
  await runCommand(missions[0].solutions.at(-1));
  assert.deepEqual(await worldSnapshot(), firstWorld, 'A memorized canonical filename cannot reveal practice evidence');
  assert.ok((await objectiveStatus()).every(status => !status), 'Practice requires reading this case’s changed evidence');
  await runCommand(first.solutions[0], true);
  const partial = await objectiveStatus();
  await assertCurrentClue(first);
  const partialSave = await exportJourney('practice-partial');
  assert.deepEqual(canonicalProgress(partialSave.profile), canonicalProgress(firstBaseline.profile), 'Practice commands leave canonical files, clues, notes, scores, and progression unchanged');
  assert.equal(partialSave.profile.practiceSessions[first.id].variant, 1, 'The public backup contains the active practice variant');
  assert.deepEqual(partialSave.profile.practiceSessions[first.id].session.tasks, partial, 'Practice evidence saves separately from canonical objectives');

  await page.reload({ waitUntil: 'networkidle' });
  if (await visible('start-journey')) await click('start-journey');
  await enterMission();
  if (!(await page.locator('.practice-banner').isVisible())) await click('practice-mission');
  await enterMission();
  assert.match(await ui('practice-variant').innerText(), /\b1\b/, 'Reload resumes the saved practice case');
  assert.deepEqual(await objectiveStatus(), partial, 'Reload retains independent practice evidence');
  await page.locator('#hint-button').click();
  assert.equal(await page.locator('.patch-speech').innerText(), await expectedHint(first), 'Patch follows unfinished evidence in a remixed case');
  await page.locator('#hint-button').click();
  assert.equal(await page.locator('.patch-speech').innerText(), await expectedHint(first, 1), 'Another request deepens the clue for the same unfinished objective');
  const beforeInvalid = await worldSnapshot();
  await runCommand('warp practice');
  assert.deepEqual(await worldSnapshot(), beforeInvalid, 'An invalid practice command reveals no drawn evidence');
  assert.equal(await page.locator('#hint-text').innerText(), await expectedHint(first, 1), 'A failed command preserves the current clue strength');
  await runCommand(first.solutions[1], true);
  await page.locator('#hint-button').click();
  assert.equal(await page.locator('.patch-speech').innerText(), await expectedHint(first), 'Verified practice evidence resets clue strength for the next objective');
  for (const command of first.solutions.slice(2)) await runCommand(command, true);
  await chooseDecision(first, true);
  await finishPractice(first);
  const firstComplete = await exportJourney('practice-first-complete');
  assert.equal(firstComplete.profile.practiceSessions[first.id].completed, true, 'Completing a practice case persists its own completion');
  assert.equal(firstComplete.profile.practiceSessions[first.id].note, 'A note for this practice case only.', 'Practice reflection saves with its own case');
  assert.deepEqual(canonicalProgress(firstComplete.profile), canonicalProgress(firstBaseline.profile), 'Completing practice grants no canonical score, XP, reflection, or completion');

  await click('practice-next');
  await enterMission();
  assert.match(await ui('practice-variant').innerText(), /\b2\b/, 'New case advances to another practice variant');
  assert.ok((await objectiveStatus()).every(status => !status), 'Another case clears only its own practice evidence');
  const secondWorld = await assertWorldMatchesEvidence(second);
  await runCommand(first.solutions.at(-1));
  assert.deepEqual(await worldSnapshot(), secondWorld, 'The previous case’s answer cannot advance a fresh case');
  await runCommand(second.solutions.at(-1), true);
  assert.ok((await objectiveStatus()).some(Boolean), 'The fresh filename verifies this practice case');
  await assertCurrentClue(second);
  await screenshot('practice-remix', 390);
  await screenshot('practice-remix', 320);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#hint-button').click();
  await page.locator('#restart-mission').click();
  await page.locator('#confirm-restart').click();
  await enterMission();
  assert.match(await ui('practice-variant').innerText(), /\b2\b/, 'Restart keeps the same practice case');
  assert.ok((await objectiveStatus()).every(status => !status), 'Practice restart clears only this case’s evidence');
  assert.doesNotMatch(await page.locator('#hint-button').innerText(), /\(\d+\)/, 'Practice restart clears its own hint count');
  await runCommand(second.solutions.at(-1), true);
  await click('practice-exit');
  const secondPartial = await exportJourney('practice-second-partial');
  assert.equal(secondPartial.profile.practiceSessions[first.id].variant, 2, 'The second case saves independently of canonical progress');
  assert.equal(secondPartial.profile.practiceSessions[first.id].completed, false, 'Partial practice is never reported as complete');
  assert.deepEqual(canonicalProgress(secondPartial.profile), canonicalProgress(firstBaseline.profile), 'Exiting practice restores the untouched canonical stop');

  const finalIndex = missions.length - 1;
  await page.locator(`.trail-node[data-mission="${finalIndex}"]`).click();
  const finalBaseline = await exportJourney('canonical-before-final-practice');
  const final = createPracticeMission(missions[finalIndex], 1);
  assert.notDeepEqual(final.solutions, missions[finalIndex].solutions, 'The later capstone also has changed practice evidence');
  await click('practice-mission');
  await enterMission();
  await assertWorldMatchesEvidence(final);
  for (const command of final.solutions) {
    await runCommand(command, true);
    await assertWorldMatchesEvidence(final);
    await assertCurrentClue(final);
  }
  await chooseDecision(final, true);
  await finishPractice(final);
  await click('practice-exit');
  const finalSave = await exportJourney('practice-final-complete');
  assert.equal(finalSave.profile.practiceSessions[final.id].completed, true, 'Later practice completion is saved separately');
  assert.deepEqual(canonicalProgress(finalSave.profile), canonicalProgress(finalBaseline.profile), 'Later practice leaves all canonical achievements and scores unchanged');
  for (const index of [7, 17]) {
    const base = missions[index];
    const remixed = createPracticeMission(base, 2);
    const originalChoice = base.decision.options.find(option => option.correct);
    const newChoice = remixed.decision.options.find(option => option.correct);
    assert.notEqual(newChoice.id, originalChoice.id, `${base.id} changes its evidence-backed practice decision`);
    await page.locator(`.trail-node[data-mission="${index}"]`).click();
    const baseline = await exportJourney(`${base.id}-canonical-before-flipped-practice`);
    await click('practice-mission');
    await click('practice-next');
    await enterMission();
    assert.match(await ui('practice-variant').innerText(), /\b2\b/, `${base.id} identifies its second practice case`);
    assert.equal(await ui(`decision-${newChoice.id}`).innerText(), newChoice.label, 'The decision options follow current practice evidence');
    for (const command of remixed.solutions) {
      await runCommand(command, true);
      await assertWorldMatchesEvidence(remixed);
      await assertCurrentClue(remixed);
    }
    if (index === 7) {
      assert.equal(await page.locator('.world-bit[data-world-task="reuse"] .world-warning').count(), 0, 'A healthy practice account is not illustrated as password reuse');
      assert.ok(await page.locator('.world-bit[data-world-task="reuse"] .world-tick').count() > 0, 'The healthy practice audit shows a verified control');
    } else {
      assert.ok(await page.locator('.world-fingerprint-mismatch').count() > 0, 'The differing practice hash has an actual changed fingerprint drawing');
    }
    await chooseDecision(remixed, true);
    await finishPractice(remixed);
    await click('practice-exit');
    const saved = await exportJourney(`${base.id}-flipped-practice-complete`);
    assert.equal(saved.profile.practiceSessions[base.id].completed, true, 'A changed practice decision can complete through the public UI');
    assert.deepEqual(canonicalProgress(saved.profile), canonicalProgress(baseline.profile), 'Changed practice decisions preserve every canonical achievement');
  }
  const allPractice = await exportJourney('all-practice-cases');
  assert.equal(await page.locator('.xp-badge').innerText(), xp, 'Practice grants no additional XP');
  assert.equal(await page.locator('.trail-node:not([disabled])').count(), unlocked, 'Practice changes no canonical unlocks');
  await click('home');
  await assertLockedChapter('chapter-office');
  await assertLockedChapter('chapter-night');
  await click('start-journey');
  await enterMission();
  return allPractice.profile.practiceSessions;
}

async function chooseDecision(mission, probeWrong = false) {
  if (!mission.decision) return;
  const { options } = mission.decision;
  const correct = options.find(option => option.correct).id;
  if (probeWrong) {
    const wrong = options.find(option => option.id !== correct);
    const before = await objectiveStatus();
    const world = await worldSnapshot();
    await click(`decision-${wrong.id}`);
    assert.deepEqual(await objectiveStatus(), before, 'An unsafe decision does not satisfy the objective');
    assert.deepEqual(await worldSnapshot(), world, 'An unsafe decision does not advance the living illustration');
  }
  await click(`decision-${correct}`);
  await assertWorldMatchesEvidence(mission);
}

async function finishMission(mission, index, probeWrong = false) {
  const statuses = await objectiveStatus();
  assert.equal(statuses.length, mission.objectives.length, `Mission ${index + 1} shows each objective`);
  assert.ok(statuses.every(Boolean), `Mission ${index + 1} unverified objectives: ${mission.objectives.filter((_, objective) => !statuses[objective]).map(objective => objective.label).join(', ')}`);
  await click('debrief');
  await ui('complete-mission').waitFor({ state: 'visible' });
  assert.ok(await ui('complete-mission').isDisabled(), 'The knowledge check gates completion');
  if (probeWrong) {
    const wrong = (mission.quiz.answer + 1) % mission.quiz.options.length;
    const beforeQuiz = await worldSnapshot();
    await click(`quiz-${wrong}`);
    assert.ok(await ui('complete-mission').isDisabled(), 'An incorrect knowledge answer cannot clear a mission');
    assert.deepEqual(await worldSnapshot(), beforeQuiz, 'An incorrect knowledge answer cannot advance the living scene');
  }
  await click(`quiz-${mission.quiz.answer}`);
  assert.ok(await ui('complete-mission').isEnabled(), 'The correct answer unlocks completion');
  if (index === 0) await page.locator('#reflection').fill(reflection);
  await click('complete-mission');
  await assertWorldMatchesEvidence(mission, true);
  await assertTextContrast(page.locator('#dialog-backdrop .field-return-message'), 'The canonical completion field message');
  assert.equal(await page.locator('.result-stats > div').last().locator('strong').innerText(), `${index + 1}/24`, `Mission ${index + 1} is saved as complete`);
  assert.equal(await page.locator('.result-stars').getAttribute('aria-label'), `${index === 0 ? 2 : 3} out of 3 stars`, 'Hint use affects the practice score without blocking progress');
}

try {
  assert.equal(missions.length, 24, 'The foundation contains 24 playable missions');
  assert.ok(missions.every(mission => mission.story.length >= 3), 'Every foundation stop contains a multi-frame story');
  const response = await page.goto(baseURL, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, 'The development server serves the app successfully');
  assert.deepEqual(pageErrors, [], 'The app initializes without uncaught errors');
  assert.deepEqual(resourceErrors, [], 'Initial app scripts, styles, and artwork load successfully');
  await page.evaluate(() => document.fonts.ready);
  assert.ok(fontAssets.size >= 2, 'The upgraded design loads its display and reading fonts');
  assert.ok([...fontAssets].every(url => url.startsWith(new URL(baseURL).origin)), 'The design fonts load from the local application');
  const fonts = await page.evaluate(() => [...document.fonts].map(face => ({ family: face.family, status: face.status })));
  assert.ok(new Set(fonts.filter(face => face.status === 'loaded').map(face => face.family)).size >= 2, 'The local fonts decode successfully and replace fallback typography');
  assert.ok(fonts.every(face => face.status !== 'error'), 'No local font fails decoding');
  for (const width of [1440, 768, 390]) await screenshot('landing', width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await assertLockedChapter('chapter-office');
  await assertLockedChapter('chapter-night');
  await assertDialogKeyboard('settings');
  await click('settings');
  await page.locator('#reset-slot').click();
  await page.locator('#cancel-reset').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'settings', 'Replacing nested dialogs preserves the original focus return target');
  await click('slot-1');
  await click('start-journey');
  await ui('scene-next').waitFor({ state: 'visible' });
  await assertCinematicSpeaker(missions[0].story[0].speaker);
  await screenshot('cutscene', 1440);
  await screenshot('cutscene', 390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const openingScene = await page.getByRole('dialog').filter({ visible: true }).innerText();
  await click('scene-next');
  assert.notEqual(await page.getByRole('dialog').filter({ visible: true }).innerText(), openingScene, 'Cutscenes progress through story frames');
  await assertCinematicSpeaker(missions[0].story[1].speaker);
  await closeStory();
  await exerciseFirstTutorial();
  await enterMission();

  assert.ok(await ui('debrief').isDisabled(), 'Unfinished evidence cannot open a debrief');
  assert.equal(await visible('practice-mission'), false, 'An unfinished mission offers no optional practice variant');
  await assertCurrentClue(missions[0]);
  const unverifiedWorld = await assertWorldMatchesEvidence(missions[0]);
  await click(`decision-${missions[0].decision.options.find(option => option.correct).id}`);
  assert.ok((await objectiveStatus()).every(status => !status), 'Guessing the right decision before collecting evidence awards no objectives');
  assert.deepEqual(await worldSnapshot(), unverifiedWorld, 'A guessed decision cannot light or repair an unverified scene');
  await ui('terminal-input').fill('who');
  await ui('terminal-input').press('Tab');
  assert.equal(await ui('terminal-input').inputValue(), 'whoami', 'Tab completes a supported command');
  await ui('terminal-input').fill('mkd');
  await ui('terminal-input').press('Tab');
  assert.equal(await ui('terminal-input').inputValue(), 'mkdir', 'Tab completes filesystem commands');
  await ui('terminal-input').fill('cat bri');
  await ui('terminal-input').press('Tab');
  assert.equal(await ui('terminal-input').inputValue(), 'cat briefing.txt', 'Tab completes local file paths');
  await ui('terminal-input').fill('');

  await click('settings');
  await ui('setting-motion').uncheck();
  await ui('setting-untimed').uncheck();
  assert.equal(await page.locator('body').getAttribute('data-motion'), 'off', 'Motion preference disables animated scenes');
  await page.keyboard.press('Escape');
  assert.match(await page.locator('#session-timer').innerText(), /personal.best|timed|challenge/i, 'The optional timing preference updates the visible learning clock');

  const beforeUnknownCommand = await worldSnapshot();
  await runCommand('warp drive');
  assert.ok((await objectiveStatus()).every(status => !status), 'Unknown commands do not award learning objectives');
  assert.deepEqual(await worldSnapshot(), beforeUnknownCommand, 'An invalid command cannot advance the living illustration');
  await runCommand("echo '<img src=x onerror=alert(1)>'");
  assert.equal(await page.locator('#terminal-output img').count(), 0, 'Terminal user text cannot create HTML elements');
  await ui('terminal-input').press('ArrowUp');
  assert.equal(await ui('terminal-input').inputValue(), "echo '<img src=x onerror=alert(1)>'", 'Keyboard command history recalls the actual previous command');
  await ui('terminal-input').fill('');
  const originalHint = await page.locator('#hint-text').innerText();
  await page.locator('#hint-button').click();
  assert.notEqual(await page.locator('#hint-text').innerText(), originalHint, 'Patch provides a useful hint');
  assert.equal(await page.locator('.hint-companion').getAttribute('data-emotion'), 'hint', 'Asking for help changes Patch’s expression');
  assert.equal(await page.locator('.patch-speech').getAttribute('role'), 'status', 'Patch’s reply is announced accessibly');
  assert.equal(await page.locator('.patch-speech').innerText(), await expectedHint(missions[0]), 'Patch guides the first unfinished objective');
  assert.ok((await objectiveStatus()).every(status => !status), 'Hints guide learning without awarding objective evidence');
  assert.deepEqual(await worldSnapshot(), beforeUnknownCommand, 'Asking Patch never changes the illustrated evidence');

  await page.setViewportSize({ width: 390, height: 900 });
  await assertCurrentClue(missions[0]);
  await runCommand(missions[0].solutions[0], true, true);
  await assertNoOverflow('Mobile terminal interaction');
  await assertCurrentClue(missions[0]);
  const firstVerifiedWorld = await assertWorldMatchesEvidence(missions[0]);
  assert.notDeepEqual(firstVerifiedWorld, unverifiedWorld, 'Verified evidence visibly changes the SVG scene');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const partialObjectives = await objectiveStatus();
  assert.ok(partialObjectives.some(Boolean), 'A valid command completes its matching objective');
  await page.reload({ waitUntil: 'networkidle' });
  if (await visible('start-journey')) await click('start-journey');
  assert.equal(await visible('tour-next'), false, 'A completed guide is remembered when the journey resumes');
  await enterMission();
  assert.deepEqual(await objectiveStatus(), partialObjectives, 'Reload preserves in-progress objective evidence');
  assert.deepEqual(await worldSnapshot(), firstVerifiedWorld, 'Reload restores the drawn evidence state');
  await assertCurrentClue(missions[0]);
  assert.match(await page.locator('#hint-button').innerText(), /\(1\)/, 'Reload retains the number of hints used');
  await click('settings');
  assert.equal(await ui('setting-motion').isChecked(), false, 'Motion preference survives reload');
  assert.equal(await ui('setting-untimed').isChecked(), false, 'Optional challenge preference survives reload');
  await ui('setting-motion').check();
  await ui('setting-untimed').check();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.dataset.motion === 'off');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.body.dataset.motion === 'on');
  await ui('tour-replay').filter({ visible: true }).first().click();
  await ui('tour-next').waitFor({ state: 'visible' });
  const activeTourState = await tutorialSnapshot();
  await page.waitForTimeout(1250); // Cross an actual one-second learning-clock tick.
  assert.deepEqual(await tutorialSnapshot(), activeTourState, 'Replaying a guide pauses an already running mission clock and consumes no hint or evidence');
  await page.keyboard.press('Escape');
  await page.locator('#tutorial-backdrop').waitFor({ state: 'hidden' });
  const hintEvidence = await objectiveStatus();
  await page.locator('#patch-chat').click();
  assert.ok((await page.locator('.patch-response').innerText()).length > 10, 'Clicking Patch opens a conversational check-in');
  assert.match(await page.locator('#hint-button').innerText(), /\(1\)/, 'A companion check-in consumes no hint');
  assert.deepEqual(await objectiveStatus(), hintEvidence, 'A companion check-in awards no objective');
  await page.locator('#hint-button').click();
  assert.equal(await page.locator('.patch-speech').innerText(), await expectedHint(missions[0]), 'New evidence resets Patch to a gentle clue for the next unfinished objective');
  assert.match(await page.locator('#hint-button').innerText(), /\(2\)/, 'Resetting clue strength preserves the total hints used');
  assert.equal(await page.locator('.hint-companion').getAttribute('data-emotion'), 'hint', 'Patch reacts to a second hint request');
  assert.deepEqual(await objectiveStatus(), hintEvidence, 'Graduated hints still require the player to collect evidence');
  await assertMobileFieldControls(missions[0]);
  await assertDialogKeyboard('notebook');
  for (const width of [1440, 768, 390, 360, 320]) {
    await screenshot('mission', width);
    if (width < 800) {
      const toolbar = page.locator('.field-toolbar');
      await toolbar.scrollIntoViewIfNeeded();
      await assertOnscreen(toolbar, `Current clue toolbar at ${width}px`);
      for (const id of ['#jump-clues', '#jump-patch', '#jump-decision']) {
        const box = await page.locator(id).boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44, `${id} provides a comfortable touch target at ${width}px`);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (let index = 0; index < missions.length; index++) {
    const mission = missions[index];
    await assertMissionArtwork(index);
    await assertWorldMatchesEvidence(mission);
    await assertCurrentClue(mission);
    assert.equal(await visible('practice-mission'), false, `Unfinished stop ${index + 1} cannot start optional practice`);
    assert.equal(await page.locator('.trail-node:not([disabled])').count(), index + 1, `Mission ${index + 1} unlocks after its predecessor`);
    if (mission.id === 'hike-21') await rejectUnrelatedCount(mission, true);
    for (const command of browserSolutions(mission).slice(index === 0 ? 1 : 0)) {
      const statuses = await objectiveStatus();
      const next = mission.objectives.find((_, objective) => !statuses[objective]);
      if ([18, 19, 22].includes(index) && next?.check.type === 'write') {
        for (const width of [390, 320]) {
          await screenshot(`mission-${index + 1}-field-note`, width);
          await page.locator('.field-toolbar').scrollIntoViewIfNeeded();
          await assertOnscreen(page.locator('.field-toolbar'), `Long current clue in mission ${index + 1} at ${width}px`);
          await assertCurrentClue(mission);
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await runCommand(command, true);
      await assertWorldMatchesEvidence(mission);
      await assertCurrentClue(mission);
      if (mission.id === 'hike-21' && command === 'grep AUTH_FAIL logs/auth.log') await rejectUnrelatedCount(mission);
    }
    if (index === 1) {
      const evidence = await objectiveStatus();
      await page.reload({ waitUntil: 'networkidle' });
      await click('start-journey');
      await enterMission();
      assert.deepEqual(await objectiveStatus(), evidence, 'Reload preserves navigation and file-reading evidence');
      assert.match(await page.locator('.terminal-prompt').innerText(), /:~\/maps\$/, 'The resumed terminal prompt reflects the saved working directory');
    }
    await chooseDecision(mission, true);
    await finishMission(mission, index, index === 0);
    console.log(`✓ ${String(index + 1).padStart(2, '0')}. ${mission.title}`);
    if (index < missions.length - 1) {
      await click('next-mission');
      await assertCinematicSpeaker(missions[index + 1].story[0].speaker);
      if (index === 1 || index === 2) {
        const key = await page.locator('#cinematic-backdrop .cinematic-art').getAttribute('data-scene');
        assert.match(key, index === 1 ? /owl|porch/i : /squirrel|burrow/i, 'The illustration changes to match the owl or squirrel story');
        await screenshot(index === 1 ? 'owl-story' : 'squirrel-story', index === 1 ? 1440 : 390);
        await page.setViewportSize({ width: 1440, height: 1000 });
        const opening = await cinematicPicture();
        await click('scene-next');
        const second = await cinematicPicture();
        assert.notEqual(second.key, opening.key, 'Story advancement changes the illustrated focus');
        await assertCinematicSpeaker(missions[index + 1].story[1].speaker);
        if (index === 1) assert.notEqual(second.position, opening.position, 'The owl story moves from the owl porch to the field desk');
        await click('scene-next');
        const third = await cinematicPicture();
        assert.notEqual(third.key, second.key, 'The final story frame shows its own evidence');
        assert.notEqual(third.position, opening.position, 'The final owl or squirrel frame changes its illustrated location');
        await assertCinematicSpeaker(missions[index + 1].story[2].speaker);
      }
      await enterMission(index === 0);
      if (index === 0) {
        await click('notebook');
        assert.equal(await page.locator('.notebook-note p').innerText(), reflection, 'Reflections persist to the field notebook');
        assert.equal(await page.locator('.notebook-note img').count(), 0, 'Notebook reflections render user text safely');
        await page.keyboard.press('Escape');
      }
    }
  }

  await click('next-mission');
  await assertLockedChapter('chapter-office');
  await assertLockedChapter('chapter-night');
  assert.match(await ui('foundation-status').innerText(), /24\s*[/]\s*24|complete|100%/i, 'The foundation reaches completion');
  await screenshot('foundation-complete', 1440);
  await click('start-journey');
  await enterMission();
  const practiceSessions = await exercisePractice();
  await click('home');
  for (const slot of [2, 3]) {
    await click(`slot-${slot}`);
    await click('start-journey');
    await closeStory();
    assert.equal(await visible('tour-next'), true, `Fresh journey ${slot} gets its own guide`);
    if (slot === 2) await click('tour-skip');
    await enterMission();
    assert.ok((await objectiveStatus()).every(status => !status), `Slot ${slot} starts with independent objective progress`);
    assert.match(await page.locator('.trail-progress > p').innerText(), /0\s*[/]\s*24/, `Slot ${slot} has no completed missions`);
    assert.equal(await visible('practice-mission'), false, `Fresh journey ${slot} cannot inherit another slot’s practice unlock`);
    const freshSave = await exportJourney(`fresh-slot-${slot}`);
    assert.deepEqual(freshSave.profile.practiceSessions, {}, `Slot ${slot} has no practice files or evidence from another journey`);
    await click('home');
    if (slot === 2) {
      await click('start-journey');
      assert.equal(await visible('tour-next'), false, 'Skipping the guide persists only for the selected journey');
      await enterMission();
      await click('home');
    }
  }
  await click('slot-1');
  await click('start-journey');
  await enterMission();
  assert.match(await page.locator('.trail-progress > p').innerText(), /24\s*[/]\s*24/, 'Changing slots retains the completed foundation');
  assert.equal(await page.locator('.trail-node:not([disabled])').count(), 24, 'Completing the foundation makes every hike mission available to revisit');
  await page.reload({ waitUntil: 'networkidle' });
  if (await visible('start-journey')) await click('start-journey');
  await enterMission();
  assert.match(await page.locator('.trail-progress > p').innerText(), /24\s*[/]\s*24/, 'Completed foundation survives a fresh page load');

  await click('settings');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-save').click();
  const download = await downloadPromise;
  const backupPath = new URL('journey-backup.json', results).pathname;
  await download.saveAs(backupPath);
  await page.keyboard.press('Escape');
  await click('home');
  await click('slot-3');
  await click('settings');
  await page.locator('#import-file').setInputFiles(backupPath);
  await page.locator('#confirm-import').click();
  await click('start-journey');
  assert.equal(await visible('tour-next'), false, 'An imported completed guide is remembered');
  await enterMission();
  assert.match(await page.locator('.trail-progress > p').innerText(), /24\s*[/]\s*24/, 'A downloaded journey restores through the public import flow');
  await click('notebook');
  assert.equal(await page.locator('.notebook-note p').innerText(), reflection, 'Imported backups retain reflections');
  await page.keyboard.press('Escape');
  const importedPractice = await exportJourney('imported-practice');
  assert.deepEqual(importedPractice.profile.practiceSessions, practiceSessions, 'The public export and import flow preserves every independent practice case');

  // Simulate a pre-tutorial V5 export by omitting only the newly optional preference.
  // All completed missions, sessions, files, scores, and notes stay exactly as exported.
  const returningBackup = JSON.parse(await readFile(backupPath, 'utf8'));
  delete returningBackup.settings.tutorialSeen;
  const returningPath = new URL('returning-v5-backup.json', results).pathname;
  await writeFile(returningPath, JSON.stringify(returningBackup));
  await click('settings');
  await page.locator('#import-file').setInputFiles(returningPath);
  await page.locator('#confirm-import').click();
  await click('start-journey');
  assert.equal(await visible('tour-next'), true, 'A returning V5 journey receives the new guide once');
  const returningState = await tutorialSnapshot();
  await walkTutorial();
  assert.deepEqual(await tutorialSnapshot(), returningState, 'A returning-player guide preserves existing evidence, hints, timer, and progress');
  assert.match(await page.locator('.trail-progress > p').innerText(), /24\s*[/]\s*24/, 'The new guide preserves the returning player’s completed foundation');
  await page.reload({ waitUntil: 'networkidle' });
  await click('start-journey');
  assert.equal(await visible('tour-next'), false, 'A returning player’s completed guide persists across reload');
  await enterMission();
  await click('settings');
  await page.locator('#reset-slot').click();
  await page.locator('#confirm-reset').click();
  assert.match(await ui('slot-3').innerText(), /0\s*[/]\s*24/, 'Reset clears only the selected journey');
  assert.match(await ui('slot-1').innerText(), /24\s*[/]\s*24/, 'Reset preserves the other completed journey');
  assert.match(await ui('slot-2').innerText(), /0\s*[/]\s*24/, 'Reset preserves the independent fresh journey');
  assert.deepEqual(pageErrors, [], 'No uncaught browser errors');
  assert.deepEqual(unexpectedDialogs, [], 'User terminal text does not invoke browser dialogs');
  assert.deepEqual(resourceErrors, [], 'All requested local game resources load successfully');
  await rm(new URL('failure.png', results), { force: true });
  console.log('Browser regression passed: 24 canonical missions, verified SVG scenes, objective-aware Patch, mobile jump focus and 320–1440px layouts, changing practice cases, independent canonical/practice saves, tutorial, profiles, backups, and progression gates.');
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', results).pathname, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
