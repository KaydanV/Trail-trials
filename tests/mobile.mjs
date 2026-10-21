import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Complete the same first mission through touch controls at narrow, landscape,
// and tablet sizes. Saves and objective credit change only through the public UI.
const origin = (process.env.TRAILS_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const baseURL = process.env.LEGACY_URL || origin + '/classic.html';
const results = new URL('../test-results/mobile/', import.meta.url);
await mkdir(results, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const sizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
];

try {
  for (const size of sizes) {
    const label = `${size.width}x${size.height}`;
    const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage();
    const errors = [], resourceErrors = [], unexpectedDialogs = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { unexpectedDialogs.push(dialog.message()); await dialog.dismiss(); });
    page.on('response', response => {
      if (response.url().startsWith(new URL(baseURL).origin) && response.status() >= 400) resourceErrors.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => {
      if (request.url().startsWith(new URL(baseURL).origin)) resourceErrors.push(`${request.failure()?.errorText} ${request.url()}`);
    });
    const ui = id => page.getByTestId(id);
    const tap = async id => { await ui(id).waitFor({ state: 'visible' }); await ui(id).tap(); };
    const shot = async name => page.screenshot({ path: new URL(`${label}-${name}.png`, results).pathname });
    const statuses = () => page.locator('[data-testid^="objective-"]').evaluateAll(elements => elements.map(element => element.dataset.complete === 'true'));

    async function noOverflow(name) {
      const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(dimensions.document <= dimensions.width + 1 && dimensions.body <= dimensions.width + 1, `${label} ${name}: no sideways scrolling ${JSON.stringify(dimensions)}`);
    }
    async function onscreen(locator, name) {
      const rect = await locator.boundingBox(), viewport = page.viewportSize();
      assert.ok(rect && rect.width > 0 && rect.height > 0 && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1, `${label} ${name} fits the visible screen: ${JSON.stringify(rect)}`);
      return rect;
    }
    async function tourGeometry() {
      const card = await onscreen(page.locator('.tour-card'), 'tour explanation');
      for (const id of ['tour-next', 'tour-back', 'tour-skip']) {
        const button = await onscreen(ui(id), id);
        assert.ok(button.height >= 44, `${label} ${id} has a finger-sized touch target`);
      }
      const spotlight = await onscreen(page.locator('.tour-spotlight'), 'highlighted mission area');
      assert.ok(spotlight.width >= 70 && spotlight.height >= 35, `${label} the tour exposes a useful piece of the section it explains`);
      assert.ok(spotlight.y + spotlight.height <= card.y + 2, `${label} the compact tour leaves its highlighted section visible above the explanation`);
      await noOverflow('guided tour');
    }
    async function commandInputVisible() {
      const input = await onscreen(ui('terminal-input'), 'focused command entry');
      assert.equal(await ui('terminal-input').evaluate(element => document.activeElement === element), true, 'Terminal shortcut focuses typing');
      const dock = page.locator('.mobile-field-nav');
      if (await dock.isVisible()) {
        const dockBox = await dock.boundingBox();
        assert.ok(input.y + input.height <= dockBox.y + 1, `${label} command entry stays above the navigation dock`);
      }
    }
    async function run(command) {
      await ui('terminal-input').fill(command);
      await tap('run-command');
      await page.waitForFunction(() => !document.querySelector('[data-testid="run-command"]').disabled);
      const last = page.locator('#terminal-output .terminal-line').last();
      assert.ok(!(await last.getAttribute('class')).split(' ').includes('error'), `The mobile terminal accepts ${command}`);
    }
    async function closeDialog() { await tap('dialog-close'); await page.locator('#dialog-backdrop').waitFor({ state: 'hidden' }); }

    assert.equal((await page.goto(baseURL, { waitUntil: 'networkidle' })).status(), 200);
    await page.evaluate(() => document.fonts.ready);
    await noOverflow('home');
    await tap('start-journey');
    for (let frame = 0; frame < 3; frame++) {
      await ui('scene-next').waitFor({ state: 'visible' });
      await onscreen(page.locator('.cinematic'), 'story window');
      await onscreen(ui('scene-next'), 'continue story');
      await onscreen(ui('scene-skip'), 'skip story');
      const badge = await page.locator('.cinematic-label').evaluate(element => {
        const style = getComputedStyle(element);
        const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
        const luminance = color => color.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const text = luminance(rgb(style.color)), background = luminance(rgb(style.backgroundColor));
        return { font: parseFloat(style.fontSize), alpha: rgb(style.backgroundColor)[3] ?? 1, contrast: (Math.max(text, background) + .05) / (Math.min(text, background) + .05) };
      });
      assert.ok(badge.font >= 11 && badge.alpha === 1 && badge.contrast >= 4.5, `${label} the cutscene label stays readable over bright artwork: ${JSON.stringify(badge)}`);
      const portrait = await page.locator('.speaking-character').boundingBox(), caption = await page.locator('.cinematic-location').boundingBox();
      assert.ok(portrait && caption && (Math.min(portrait.x + portrait.width, caption.x + caption.width) <= Math.max(portrait.x, caption.x) + 1 || Math.min(portrait.y + portrait.height, caption.y + caption.height) <= Math.max(portrait.y, caption.y) + 1), `${label} the location caption does not cover the speaking character`);
      await page.locator('.cinematic').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await onscreen(ui('scene-next'), 'story controls after reading to the bottom');
      await shot(`story-${frame + 1}`);
      await tap('scene-next');
    }

    await ui('tour-next').waitFor({ state: 'visible' });
    const beforeTour = {
      tasks: await statuses(), hints: await page.locator('#hint-button').innerText(),
      commands: await page.locator('#terminal-output .command').count(), timer: await page.locator('#session-timer').innerText(),
    };
    assert.ok(await ui('terminal-input').isDisabled(), 'The tour explains the game before starting the mission');
    await tap('tour-next');
    assert.match(await ui('tour-progress').innerText(), /2\s*\/\s*6/);
    await tap('tour-back');
    assert.match(await ui('tour-progress').innerText(), /1\s*\/\s*6/);
    for (let step = 0; step < 6; step++) {
      assert.match(await ui('tour-progress').innerText(), new RegExp(`${step + 1}\\s*\\/\\s*6`));
      await tourGeometry();
      if (step === 1 && size.width === 390) {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await tourGeometry();
        await page.setViewportSize(size);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await tourGeometry();
        assert.match(await ui('tour-progress').innerText(), /2\s*\/\s*6/, 'Rotating the phone keeps the current guide step');
      }
      if (step === 2) {
        for (const [index, output] of [[0, /\/home\/trainee/], [1, /trainee/], [2, /trail note/i]]) {
          await tap(`tour-demo-${index}`);
          assert.match(await page.locator('.tour-demo-output').innerText(), output);
          assert.ok((await page.locator('.tour-demo-meaning').innerText()).length > 10, 'The preview explains the meaning of the command');
          await onscreen(ui('tour-next'), 'tour navigation while trying command previews');
        }
      }
      await page.locator('.tour-card').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await onscreen(ui('tour-next'), 'tour controls after scrolling a long explanation');
      await shot(`tour-${step + 1}`);
      await tap('tour-next');
    }
    await page.locator('#tutorial-backdrop').waitFor({ state: 'hidden' });
    assert.deepEqual({ tasks: await statuses(), hints: await page.locator('#hint-button').innerText(), commands: await page.locator('#terminal-output .command').count(), timer: await page.locator('#session-timer').innerText() }, beforeTour, 'The mobile tour and previews award no evidence and leave the timer and hints untouched');

    await tap('start-mission');
    assert.equal(await page.locator('.field-toolbar').count(), 1, 'One current-objective toolbar is rendered');
    assert.ok(await ui('terminal-input').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16), 'Phone and tablet typing uses at least 16px text to avoid focus zoom');
    await tap('field-scene');
    await tap('field-terminal');
    await commandInputVisible();
    if (size.width === 390) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await commandInputVisible();
      await page.setViewportSize(size);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await commandInputVisible();
    }
    await run('pwd');
    await page.waitForFunction(() => document.querySelector('[data-testid="objective-0"]').dataset.complete === 'true');
    assert.match(await ui('current-objective').innerText(), /Check your lab identity/, 'The single mobile toolbar immediately advances after the verified command');
    const beforeTouchTools = {
      tasks: await statuses(), commands: await page.locator('#terminal-output .command').count(),
      hints: await page.locator('#hint-button').innerText(),
    };
    for (const id of ['terminal-previous', 'terminal-next', 'terminal-complete']) {
      await ui(id).waitFor({ state: 'visible' });
      const rect = await ui(id).boundingBox();
      assert.ok(rect.width >= 44 && rect.height >= 44, `${label} ${id} has a finger-sized touch target`);
    }
    await tap('terminal-previous');
    assert.equal(await ui('terminal-input').inputValue(), 'pwd', 'The phone history button recalls the actual previous command');
    await commandInputVisible();
    await tap('terminal-next');
    assert.equal(await ui('terminal-input').inputValue(), '', 'The phone forward-history button returns to a blank command');
    await commandInputVisible();
    await ui('terminal-input').fill('who');
    await tap('terminal-complete');
    assert.equal(await ui('terminal-input').inputValue(), 'whoami', 'Touch completion offers the same command as the Tab key');
    await commandInputVisible();
    await ui('terminal-input').fill('cat bri');
    await tap('terminal-complete');
    assert.equal(await ui('terminal-input').inputValue(), 'cat briefing.txt', 'Touch completion fills the real local file path');
    await commandInputVisible();
    assert.deepEqual({ tasks: await statuses(), commands: await page.locator('#terminal-output .command').count(), hints: await page.locator('#hint-button').innerText() }, beforeTouchTools, 'Mobile history and completion never execute commands, consume hints, or award evidence');
    await ui('terminal-input').fill('');
    await page.locator('#hint-button').tap();
    assert.match(await page.locator('#hint-button').innerText(), /\(1\)/, 'Touching Ask Patch gives one hint');
    assert.match(await page.locator('#hint-text').innerText(), /account|identity/i, 'Patch follows the current unfinished clue on the phone');
    await page.reload({ waitUntil: 'networkidle' });
    await tap('start-journey');
    assert.deepEqual(await statuses(), [true, false, false, false], 'Reload preserves the phone attempt without inventing evidence');
    assert.match(await page.locator('#hint-button').innerText(), /\(1\)/, 'Reload preserves the hint count');
    await page.locator('#restart-mission').tap();
    await page.locator('#confirm-restart').tap();
    await tap('scene-skip');
    assert.deepEqual(await statuses(), [false, false, false, false], 'Restart clears this attempt on the phone');
    await tap('start-mission');
    for (const command of ['pwd', 'whoami', 'cat briefing.txt']) await run(command);
    await tap('field-decision');
    await tap('decision-scope');
    assert.ok((await statuses()).every(Boolean), 'Touch commands and the evidence-backed decision complete the same four objectives');
    await tap('debrief');
    await onscreen(page.locator('#dialog-backdrop .dialog'), 'reflection dialog');
    assert.ok(await ui('complete-mission').isDisabled(), 'The phone knowledge check gates mission completion');
    await tap('quiz-0');
    assert.ok(await ui('complete-mission').isDisabled(), 'An incorrect quiz answer cannot clear the stop');
    await tap('quiz-1');
    const note = `Phone test ${label}: scope comes first.`;
    await page.locator('#reflection').fill(note);
    await tap('complete-mission');
    assert.equal(await page.locator('.result-stats > div').last().locator('strong').innerText(), '1/24');
    await onscreen(page.locator('#dialog-backdrop .dialog'), 'completion dialog');
    await noOverflow('completed mission');
    await shot('complete');
    await closeDialog();

    await tap('notebook');
    await onscreen(page.locator('#dialog-backdrop .dialog'), 'notebook dialog');
    assert.equal(await page.locator('.notebook-note p').innerText(), note, 'The notebook keeps the reflection entered on the phone');
    await closeDialog();
    await tap('settings');
    await onscreen(page.locator('#dialog-backdrop .dialog'), 'settings dialog');
    assert.equal(await page.locator('.mobile-field-nav').isVisible(), false, 'The dock does not cover settings');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-save').tap();
    const download = await downloadPromise;
    const backup = new URL(`${label}-journey.json`, results).pathname;
    await download.saveAs(backup);
    const exported = JSON.parse(await readFile(backup, 'utf8'));
    assert.deepEqual(exported.completed, ['hike-01']);
    assert.equal(exported.notes['hike-01'], note);
    await page.locator('#import-file').setInputFiles(backup);
    await onscreen(page.locator('#dialog-backdrop .dialog'), 'import confirmation');
    await page.locator('#confirm-import').tap();
    await ui('start-journey').waitFor({ state: 'visible' });
    await noOverflow('restored journey');
    await tap('start-journey');
    assert.equal(await ui('tour-next').isVisible(), false, 'Imported progress remembers the completed tutorial');
    assert.match(await page.locator('.trail-progress > p').innerText(), /1\s*\/\s*24/);
    assert.ok((await statuses()).every(Boolean), 'Import restores the same completed mission through the mobile UI');
    await noOverflow('restored mission');
    assert.deepEqual(errors, [], `${label} no uncaught application errors`);
    assert.deepEqual(resourceErrors, [], `${label} local scripts, fonts, and artwork load`);
    assert.deepEqual(unexpectedDialogs, [], `${label} no unexpected browser dialogs`);
    await context.close();
    console.log(`Mobile ${label} passed: story, guide, touch terminal, hints, restart/reload, decision, quiz, reflection, notebook, and backup restore.`);
  }
} finally {
  await browser.close();
}
