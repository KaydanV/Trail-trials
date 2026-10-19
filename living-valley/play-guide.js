/** The controls rehearsal never receives or mutates a learning session. */
import { controlsTutorial } from './play-script.js?v=20261018-immersive';
import { renderPortrait } from './world.js';
import { createShell, execute } from './shell.js';

export const CONTROLS_GUIDE_KEY = 'terminal-trails-controls-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

export function hasSeenControls(backend) {
  try {
    const saved = JSON.parse(backend?.getItem(CONTROLS_GUIDE_KEY) || 'null');
    return saved?.version === 1 && saved.completed === true;
  } catch { return false; }
}
export function saveControlsSeen(backend) {
  try { backend?.setItem(CONTROLS_GUIDE_KEY, JSON.stringify({version:1, completed:true})); } catch {}
}
export function createGuidePractice() {
  return {
    shell: createShell({'welcome.txt':'Patch’s practice kit. Everything here is safe to try.\nNo mission credit is recorded in this console.\n'}),
    seen: [],
    lines: [{kind:'system',text:'PATCH: A rehearsal console. Try help, then pwd. This kit has no connection to your mission files.'}],
  };
}
export async function runGuidePractice(practice, raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2048) return false;
  practice.lines.push({kind:'command', text:'ranger@practice:~$ ' + raw});
  const result = await execute(practice.shell, raw);
  practice.lines.push({kind:result.error?'error':'output',text:result.output || (result.error?'Try help for a safe place to start.':'Done.')});
  const command = raw.trim();
  if (!result.error && ['help','pwd'].includes(command) && !practice.seen.includes(command)) practice.seen.push(command);
  practice.lines = practice.lines.slice(-30);
  return practice.seen.includes('help') && practice.seen.includes('pwd');
}
export function renderControlsGuide(index, {returning=false, practicing=false}={}) {
  const beat = controlsTutorial[index];
  if (!beat || practicing) return '';
  const first = beat.gate === 'continue', last = beat.gate === 'start-adventure';
  const touch = globalThis.matchMedia?.('(pointer: coarse)').matches || globalThis.innerWidth <= 760;
  const tip = (touch ? beat.touchTip : beat.keyboardTip) || beat.tip;
  let action = '';
  if (first || last) action = '<button type="button" class="button primary" data-guide-action="next" data-testid="guide-next">' + esc(returning && beat.returningAction || beat.action) + '</button>';
  else if (beat.gate === 'equip-hat') action = '<button type="button" class="button primary" data-guide-action="pack" data-testid="guide-pack-open">Open Backpack</button>';
  else if (beat.gate === 'practice-console') action = '<button type="button" class="button primary" data-guide-action="practice" data-testid="guide-practice-open">Open practice gadget</button>';
  else action = '<strong class="onboarding-task">' + esc(beat.action) + '</strong>';
  return '<aside class="play-onboarding" data-guide-step="' + esc(beat.id) + '" data-guide-gate="' + esc(beat.gate) + '" data-world-blocked="' + (first || last) + '" role="region" aria-label="How to play"><div class="onboarding-card"><div class="onboarding-heading">' + renderPortrait(beat.speaker, 'speaking') + '<div><span class="eyebrow">FIELD TRAINING ' + (index+1) + ' / ' + controlsTutorial.length + '</span><h2>' + esc(returning && beat.returningTitle || beat.title) + '</h2></div></div><p class="onboarding-story">' + esc(returning && beat.returningText || beat.text) + '</p><details class="onboarding-context"><summary>Why this step?</summary><p>' + esc(returning && beat.returningText || beat.text) + '</p></details><p class="onboarding-tip">' + esc(tip) + '</p><div class="onboarding-actions">' + action + '<button type="button" class="button secondary" data-guide-action="skip" data-testid="guide-skip">Skip tutorial</button></div></div></aside>';
}
export function renderGuidePractice(practice) {
  const done = practice.seen.includes('help') && practice.seen.includes('pwd');
  return '<aside id="game-panel" class="play-panel practice-panel" role="dialog" aria-modal="true" aria-label="Practice gadget"><header><div><span class="eyebrow">FIELD TRAINING · REHEARSAL</span><h2>Your pocket console</h2></div><button type="button" data-game-action="close-panel" data-testid="close-game-panel" aria-label="Put practice gadget away">×</button></header><p class="gadget-cue">Type <code>help</code>, press Enter and read the reply. Then try <code>pwd</code>. The first shows what you can ask; the second tells you where you are.</p><p class="onboarding-tip">This is a separate practice kit. Your mission files and progress stay where you left them.</p><div class="terminal-frame"><div class="terminal-title">PATCH’S REHEARSAL CONSOLE</div><div class="terminal-output" id="guide-practice-output" role="log" aria-label="Practice console replies">' + practice.lines.map(line => '<div class="terminal-line ' + esc(line.kind) + '">' + esc(line.text) + '</div>').join('') + '</div><form id="guide-practice-form"><label for="guide-practice-input">ranger@practice:~$</label><input id="guide-practice-input" data-testid="guide-practice-input" type="text" autocomplete="off" spellcheck="false" placeholder="Try help" enterkeyhint="send"><button type="submit" class="button primary" aria-label="Run practice command">Run ↵</button></form></div><p id="guide-practice-status" role="status">' + (done ? 'Both commands tried. Put the gadget away when you are ready.' : 'Tried: ' + (practice.seen.join(', ') || 'none yet') + '. Give help and pwd a go.') + '</p><p class="onboarding-tip">Other gadgets let you open files, fit parts and connect routes. Their “How does this work?” flap explains each new tool. Notebook keeps your learned commands; Patch’s hint button offers a nudge.</p><div class="onboarding-actions"><button type="button" class="button primary" data-guide-action="practice-done" data-testid="guide-practice-done" ' + (done ? '' : 'disabled') + '>Put the gadget away</button><button type="button" class="button secondary" data-guide-action="skip" data-testid="guide-skip">Skip tutorial</button></div></aside>';
}
