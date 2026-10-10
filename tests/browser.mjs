import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { chromium } from 'playwright';
import { missions } from '../src/curriculum.js';

// Drive the public UI with curriculum solutions. Never edit saves or application state.
const baseURL = process.env.TRAILS_URL || 'http://127.0.0.1:4173';
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
page.on('pageerror', error => pageErrors.push(error.message));
page.on('dialog', async dialog => { unexpectedDialogs.push(dialog.message()); await dialog.dismiss(); });
page.on('response', response => {
  if (response.url().startsWith(baseURL) && response.status() >= 400) resourceErrors.push(`${response.status()} ${response.url()}`);
});
page.on('requestfailed', request => {
  if (request.url().startsWith(baseURL)) resourceErrors.push(`${request.failure()?.errorText} ${request.url()}`);
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
  await assertNoOverflow(`${label} at ${width}px`);
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

async function enterMission(watchStory = false) {
  if (watchStory) {
    let frames = 0;
    while (await visible('scene-next')) {
      assert.ok(frames++ < 10, 'Story frames eventually lead to the mission');
      await click('scene-next');
    }
  } else if (await visible('scene-skip')) await click('scene-skip');
  if (await visible('start-mission')) await click('start-mission');
  await ui('terminal-input').waitFor({ state: 'visible' });
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

async function chooseDecision(mission, probeWrong = false) {
  if (!mission.decision) return;
  const { options } = mission.decision;
  const correct = options.find(option => option.correct).id;
  if (probeWrong) {
    const wrong = options.find(option => option.id !== correct);
    const before = await objectiveStatus();
    await click(`decision-${wrong.id}`);
    assert.deepEqual(await objectiveStatus(), before, 'An unsafe decision does not satisfy the objective');
  }
  await click(`decision-${correct}`);
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
    await click(`quiz-${wrong}`);
    assert.ok(await ui('complete-mission').isDisabled(), 'An incorrect knowledge answer cannot clear a mission');
  }
  await click(`quiz-${mission.quiz.answer}`);
  assert.ok(await ui('complete-mission').isEnabled(), 'The correct answer unlocks completion');
  if (index === 0) await page.locator('#reflection').fill(reflection);
  await click('complete-mission');
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
  await screenshot('cutscene', 1440);
  await screenshot('cutscene', 390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const openingScene = await page.getByRole('dialog').filter({ visible: true }).innerText();
  await click('scene-next');
  assert.notEqual(await page.getByRole('dialog').filter({ visible: true }).innerText(), openingScene, 'Cutscenes progress through story frames');
  await enterMission();

  assert.ok(await ui('debrief').isDisabled(), 'Unfinished evidence cannot open a debrief');
  await click(`decision-${missions[0].decision.options.find(option => option.correct).id}`);
  assert.ok((await objectiveStatus()).every(status => !status), 'Guessing the right decision before collecting evidence awards no objectives');
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
  assert.match(await page.locator('#session-timer').innerText(), /Challenge mode/, 'The optional challenge preference updates the visible timer');

  await runCommand('warp drive');
  assert.ok((await objectiveStatus()).every(status => !status), 'Unknown commands do not award learning objectives');
  await runCommand("echo '<img src=x onerror=alert(1)>'");
  assert.equal(await page.locator('#terminal-output img').count(), 0, 'Terminal user text cannot create HTML elements');
  await ui('terminal-input').press('ArrowUp');
  assert.equal(await ui('terminal-input').inputValue(), "echo '<img src=x onerror=alert(1)>'", 'Keyboard command history recalls the actual previous command');
  await ui('terminal-input').fill('');
  const originalHint = await page.locator('#hint-text').innerText();
  await page.locator('#hint-button').click();
  assert.notEqual(await page.locator('#hint-text').innerText(), originalHint, 'Patch provides a useful hint');
  assert.ok((await objectiveStatus()).every(status => !status), 'Hints guide learning without awarding objective evidence');

  await page.setViewportSize({ width: 390, height: 900 });
  await runCommand(missions[0].solutions[0], true, true);
  await assertNoOverflow('Mobile terminal interaction');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const partialObjectives = await objectiveStatus();
  assert.ok(partialObjectives.some(Boolean), 'A valid command completes its matching objective');
  await page.reload({ waitUntil: 'networkidle' });
  if (await visible('start-journey')) await click('start-journey');
  await enterMission();
  assert.deepEqual(await objectiveStatus(), partialObjectives, 'Reload preserves in-progress objective evidence');
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
  await assertDialogKeyboard('notebook');
  for (const width of [1440, 768, 390]) await screenshot('mission', width);
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (let index = 0; index < missions.length; index++) {
    const mission = missions[index];
    assert.equal(await page.locator('.trail-node:not([disabled])').count(), index + 1, `Mission ${index + 1} unlocks after its predecessor`);
    for (const command of mission.solutions.slice(index === 0 ? 1 : 0)) await runCommand(command, true);
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
  for (const slot of [2, 3]) {
    await click(`slot-${slot}`);
    await click('start-journey');
    await enterMission();
    assert.ok((await objectiveStatus()).every(status => !status), `Slot ${slot} starts with independent objective progress`);
    assert.match(await page.locator('.trail-progress > p').innerText(), /0\s*[/]\s*24/, `Slot ${slot} has no completed missions`);
    await click('home');
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
  await enterMission();
  assert.match(await page.locator('.trail-progress > p').innerText(), /24\s*[/]\s*24/, 'A downloaded journey restores through the public import flow');
  await click('notebook');
  assert.equal(await page.locator('.notebook-note p').innerText(), reflection, 'Imported backups retain reflections');
  await page.keyboard.press('Escape');
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
  console.log('Browser regression passed: 24 missions, progression gates, story scenes, save/resume, independent profiles, backup import/export, motion settings, keyboard dialogs, escaped text, and responsive layouts.');
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', results).pathname, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
