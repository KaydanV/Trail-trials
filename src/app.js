import {missions, acts, skillGuide} from './curriculum.js';
import {createShell, execute, matchesObjective} from './engine.js';
import {createProgress, createStorage} from './storage.js';
import {getPresentation, renderPropIcon} from './presentation.js';
import {createTutorial} from './tutorial.js';
import {describeCommand} from './tools.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let backend;
try { backend = window.localStorage; } catch {}
const storage = createStorage(backend, missions);
const migrationReport = storage.migrateLegacy();
let slot = 1;
try { slot = storage.activeSlot(); }
catch { storage.setActiveSlot(1); setTimeout(() => toast('Your last journey selection could not be read. Journey 1 is selected.'), 200); }
let corruptSlots = new Set();
let profile = readProfile(slot);
let view = 'home';
let current = missions.findIndex(m => m.id === profile.currentMission);
if (current < 0) current = 0;
let session = null, historyIndex = 0, busy = false, dialogReturn = null, sceneIndex = 0, previewScene = false;
let tickAt = performance.now();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const tutorial = createTutorial({
  onComplete() { profile.settings.tutorialSeen = true; persist(); },
  onClose() {
    tickAt = performance.now();
    document.activeElement?.scrollIntoView({block:'nearest', behavior:'instant'});
  }
});

function readProfile(number) {
  try { return storage.read(number) || createProgress(missions); }
  catch (error) {
    corruptSlots.add(number);
    setTimeout(() => toast('Slot ' + number + ': ' + error.message + ' Use settings to import a backup or reset this slot.'), 200);
    return createProgress(missions);
  }
}
function persist() {
  if (corruptSlots.has(slot)) return;
  const hadStorage = storage.available;
  if (session) profile.sessions[missions[current].id] = session;
  profile.currentMission = missions[current].id;
  try { storage.write(slot, profile); } catch (error) { toast(error.message); }
  if (hadStorage && !storage.available) {
    toast('Browser storage is full or unavailable. Your journey continues in this tab; export it before closing.');
    const footerStatus = $('.site-footer span:last-child');
    if (footerStatus) footerStatus.textContent = 'Temporary session — export a backup before closing this tab';
  }
  applySettings();
}
function unlockedIndex() {
  const next = missions.findIndex(m => !profile.completed.includes(m.id));
  return next < 0 ? missions.length - 1 : next;
}
function completedCount() { return profile.completed.length; }
function allComplete() { return missions.every(m => profile.completed.includes(m.id)); }
function xp() { return completedCount() * 120; }
function applySettings() {
  document.body.dataset.motion = profile.settings.motion && !reduceMotion.matches ? 'on' : 'off';
}
function toast(text) {
  const node = $('#toast');
  node.textContent = text;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 4500);
}
function header() {
  return '<header class="site-header"><button class="brand" data-action="home" aria-label="Terminal Trails home"><img class="brand-icon" src="assets/trail-mark.svg" alt=""><span><strong class="brand-name"><span class="brand-terminal">TERMINAL</span><span class="brand-trails">TRAILS</span></strong><small class="brand-sub">THE SIGNAL ACADEMY</small></span></button><nav class="header-nav" aria-label="Main navigation"><button class="nav-button ' + (view === 'home' ? 'active' : '') + '" data-action="home">The adventure</button><button class="nav-button" data-action="map">Your trail</button><button class="nav-button" data-action="notebook" data-testid="notebook">Field notebook</button></nav><div class="header-status"><span class="chip">✦ ' + xp() + ' XP</span><button class="icon-button" data-action="settings" data-testid="settings" aria-label="Save and settings">⚙</button></div></header>';
}
function footer() {
  return '<footer class="site-footer"><span>⌁ TERMINAL TRAILS</span><span>A little adventure. A lot of real skills.</span><span>Saved in this browser · ' + (storage.available ? 'Local save active' : 'Temporary session — export a backup') + '</span></footer>';
}
function worldCard(name, number, description, tags, type) {
  const available = type === 'available';
  const id = number === '02' ? 'chapter-office' : 'chapter-night';
  const lock = allComplete() ? 'FOUNDATION CLEARED · CHAPTER IN DEVELOPMENT' : 'LOCKED · COMPLETE HIKE TRAIL FIRST';
  return '<article class="world-card ' + type + '"><div class="world-art world-art-' + number + '" ' + (available ? 'style="background-image:url(assets/expedition.webp)"' : '') + '><span class="world-number">' + number + '</span><span class="lock-label">' + (available ? 'YOUR FIRST EXPEDITION' : '⌁ NEXT HORIZON') + '</span></div><div class="world-content"><div class="eyebrow">' + tags + '</div><h3>' + name + '</h3><p>' + description + '</p><div class="world-tags">' + (available ? '<span>24 playable missions</span><button class="back-link" data-action="start">Explore trail →</button>' : '<button class="locked-mode" data-testid="' + id + '" disabled aria-disabled="true">' + lock + '</button>') + '</div></div></article>';
}
function renderHome() {
  view = 'home'; session = null;
  $('#app').innerHTML = header() + '<main id="main" class="home-view" tabindex="-1"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> CYBERSECURITY, WITH A LITTLE ADVENTURE</div><h1 class="hero-title">Big adventure.<br>Real skills.<br><em>Your first trail.</em></h1><p class="hero-description">A curious robot. A mountain full of mysteries. And you, figuring it all out one command at a time. This is where your cybersecurity story starts.</p><div class="hero-actions"><button class="button primary" data-action="start" data-testid="start-journey">' + (completedCount() ? 'Continue your adventure' : 'Let’s hit the trail') + ' <span>→</span></button><button class="button secondary" data-action="preview">▷ Meet the story</button></div><div class="hero-proof"><span>✧ Learn by doing</span><span>⌘ No experience needed</span><span>♡ Room to make mistakes</span></div></div><div class="hero-art" role="img" aria-label="Nova and Patch overlooking an alpine lake and distant signal tower"><div class="hero-art-overlay"></div><div class="floating-badge"><span>✦</span> Your next chapter starts here.</div><div class="hero-caption"><span>01 / HIKE TRAIL</span><strong>Every expert starts somewhere.</strong></div></div></section><section class="home-section worlds-section"><div class="section-heading"><div><div class="eyebrow">CHOOSE YOUR JOURNEY</div><h2>A world worth figuring out.</h2></div><p>Start a little silly. Finish a lot more capable.<br>The trail comes first. Bigger challenges follow.</p></div><div class="world-grid">' + worldCard('Hike Trail','01','From finding Patch’s missing snacks to restoring the valley’s signal. Build your foundation through one connected adventure.','FOUNDATION · AVAILABLE NOW','available') + worldCard('The Office','02','The next chapter: teammates, suspicious emails, everyday systems, and decisions that matter at work.','WORKPLACE · PLANNED','locked') + worldCard('The Night Shift','03','Realistic investigations, changing priorities, and time-sensitive tasks when the rest of the world is asleep.','OPERATIONS · PLANNED','locked') + '</div></section><section class="home-section journeys-section" id="journeys"><div class="section-heading"><div><div class="eyebrow">YOUR LITTLE CORNER OF THE WORLD</div><h2>Keep your adventure going.</h2></div><p>Three independent journeys. Pick one and make it yours.</p></div><div class="journey-grid">' + [1,2,3].map(number => {
    let data = null;
    try { data = storage.read(number); } catch { corruptSlots.add(number); }
    const count = data?.completed.length || 0;
    return '<button class="journey-card ' + (slot === number ? 'selected' : '') + '" data-action="slot" data-slot="' + number + '" data-testid="slot-' + number + '" aria-pressed="' + (slot === number) + '"><div class="journey-number">JOURNEY 0' + number + '<span>' + (slot === number ? 'SELECTED' : corruptSlots.has(number) ? 'SAVE NEEDS ATTENTION' : count ? 'IN PROGRESS' : 'A FRESH START') + '</span></div><h3>' + (count ? 'Your story is waiting.' : 'An adventure of your own.') + '</h3><p>' + (data?.currentMission ? escape(missions.find(m => m.id === data.currentMission)?.title || 'Ready for the trail') : 'Meet Nova. Wake up Patch. Find your feet.') + '</p><div class="progress-bar"><span style="width:' + count / missions.length * 100 + '%"></span></div><div class="journey-meta"><span>' + count + ' / ' + missions.length + ' missions</span><span>→</span></div></button>';
  }).join('') + '</div>' + (!storage.available ? '<p class="storage-notice" role="status">Browser storage is unavailable. You can still play, but export your progress before closing this tab.</p>' : '') + (profile.migrationNotice ? '<p class="storage-notice">Your V4 journey is preserved. The new foundation has new challenges, so it starts fresh. Your earlier reflections are in the notebook.</p>' : '') + '</section><section class="home-section curriculum-preview acts-section"><div class="section-heading"><div><div class="eyebrow">24 STOPS. ONE CONTINUOUS STORY.</div><h2>Small steps. Proper foundations.</h2></div><button class="button secondary" data-action="map">See the full trail →</button></div><div class="act-grid">' + acts.map((act, index) => '<article class="act-card"><span class="act-number">0' + (index + 1) + '</span><div class="eyebrow">ACT ' + (index + 1) + ' · 6 MISSIONS</div><h3>' + escape(act.title) + '</h3><p>' + escape(act.description || act.subtitle) + '</p></article>').join('') + '</div><div class="foundation-status" data-testid="foundation-status">' + (allComplete() ? 'Foundation complete. Every Hike Trail mission is cleared. Office and Night Shift remain in development.' : 'Your foundation: ' + completedCount() + ' of ' + missions.length + ' missions cleared. Office and Night Shift stay locked.') + '</div></section></main>' + footer();
  bindActions(); applySettings();
}
function bindActions() {
  $$('[data-action]').forEach(button => button.onclick = () => {
    const action = button.dataset.action;
    if (action === 'home') goHome();
    if (action === 'start') startJourney();
    if (action === 'preview') showScene(true);
    if (action === 'notebook') notebook();
    if (action === 'settings') settings();
    if (action === 'map') fieldMap();
    if (action === 'slot') selectSlot(Number(button.dataset.slot));
  });
}
function selectSlot(number) {
  slot = number; storage.setActiveSlot(slot); profile = readProfile(slot);
  current = Math.max(0, missions.findIndex(m => m.id === profile.currentMission));
  renderHome();
}
function goHome() {
  if (busy) return toast('Patch is finishing your command. One moment.');
  if (session) persist();
  tutorial.close(); closeDialog(); closeScene(false); renderHome(); window.scrollTo({top:0,behavior:'instant'});
}
function startJourney() {
  if (corruptSlots.has(slot)) { settings(); toast('Import a backup or reset this corrupted slot before starting.'); return; }
  loadMission(Math.min(current, unlockedIndex()));
}
function loadMission(index) {
  if (busy) return toast('Patch is finishing your command. One moment.');
  if (index > unlockedIndex()) return toast('This stop opens when you complete the earlier mission.');
  if (session) persist();
  current = index;
  const mission = missions[current];
  session = profile.sessions[mission.id] || {shell:createShell(mission.fixtures), tasks:mission.objectives.map(() => false), started:false, commands:0, hints:0, elapsed:0};
  historyIndex = session.shell.history.length;
  view = 'game'; busy = false;
  persist(); renderGame(); window.scrollTo({top:0,behavior:'instant'});
  if (!session.started) showScene(false);
  else if (!profile.settings.tutorialSeen) tutorial.open();
}
function atlasStyle(scene) {
  return 'background-image:url(' + escape(scene.asset) + ');background-size:300% 200%;background-position:' + escape(scene.position);
}
function portraitStyle(name) {
  return 'background-image:url(assets/characters/companions.webp);background-size:200% 100%;background-position:' + (name === 'PATCH' ? '100% 50%' : '0% 50%');
}
function portrait(name, classes = 'character-portrait') {
  return '<div class="' + classes + '" data-speaker="' + escape(name) + '" role="img" aria-label="' + (name === 'PATCH' ? 'Patch, your robot companion' : 'Nova, your expedition guide') + '" style="' + portraitStyle(name) + '"><span class="character-signal" aria-hidden="true"></span></div>';
}
function sceneMarkup(mission) {
  const presentation = getPresentation(mission, 0), scene = presentation.scene;
  return '<figure class="mission-scene" data-scene="' + escape(scene.id) + '" data-palette="' + escape(scene.palette) + '" data-state="exploring">' +
    '<div class="scene-viewport" role="img" aria-label="' + escape(scene.alt) + '" style="' + atlasStyle(scene) + '"><div class="scene-weather" aria-hidden="true"></div><div class="mission-prop" aria-hidden="true">' + renderPropIcon(scene.prop) + '</div><span class="scene-coordinate">FIELD FEED / ' + String(current+1).padStart(2,'0') + '</span></div>' +
    '<figcaption class="scene-caption"><span>' + escape(scene.label) + '</span><span id="scene-status" class="scene-state">Your next clue is waiting</span></figcaption></figure>';
}
function renderGame() {
  const mission = missions[current], count = session.tasks.filter(Boolean).length, presentation = getPresentation(mission,0);
  $('#app').innerHTML = header() +
    '<main id="main" class="game-view" tabindex="-1"><div class="game-topline"><button class="back-link" data-action="home" data-testid="home">← Back to the adventure</button><span class="mission-counter">HIKE TRAIL / STOP ' + String(current+1).padStart(2,'0') + ' OF ' + missions.length + '</span><span class="xp-badge">✦ ' + xp() + ' XP</span></div>' +
    '<div class="expedition-layout"><aside class="trail-sidebar"><div class="trail-progress"><div class="eyebrow">YOUR EXPEDITION</div><h2>Hike Trail</h2><p>' + completedCount() + ' / ' + missions.length + ' stops cleared</p><div class="progress-bar"><span style="width:' + completedCount()/missions.length*100 + '%"></span></div></div>' +
    '<details class="trail-details" open><summary>Explore the trail <span>⌄</span></summary>' + acts.map((act,actIndex) =>
      '<div class="act-heading">0' + (actIndex+1) + ' / ' + escape(act.title) + '</div>' +
      missions.map((m,index) => m.act === actIndex ?
        '<button class="trail-node ' + (profile.completed.includes(m.id)?'completed ':'') + (index===current?'active ':'') + (index>unlockedIndex()?'locked':'') + '" data-mission="' + index + '" ' + (index>unlockedIndex()?'disabled':'') + ' aria-current="' + (index===current?'step':'false') + '"><span class="node-number">' + (profile.completed.includes(m.id)?'✓':String(index+1).padStart(2,'0')) + '</span><span>' + escape(m.title) + '</span>' + (index>unlockedIndex()?'<span aria-label="Locked">⌁</span>':'') + '</button>' : '').join('')).join('') +
    '</details><div class="sidebar-future"><span>⌁ The Office</span><span>⌁ The Night Shift</span><small>Build the foundation first.<br>These chapters are still in development.</small></div></aside>' +
    '<section class="mission-workspace"><section class="mission-banner scene-banner">' + sceneMarkup(mission) +
    '<div class="mission-overview"><div class="mission-eyebrow">ACT ' + (mission.act+1) + ' · ' + escape(mission.location) + '</div><h1>' + escape(mission.title) + '</h1><p>' + escape(mission.summary) + '</p><div class="mission-meta"><span class="chip">' + escape(mission.difficulty) + '</span><span class="chip">◷ ' + escape(mission.estimate) + '</span><button class="chip replay-story" id="replay-story">▷ Replay story</button><button class="chip tour-replay" id="tour-replay" data-testid="tour-replay">⌘ Show me around</button></div><div class="scene-progress" aria-label="Mission stages"><span data-stage="clues">01 / Follow the clues</span><span data-stage="decision">02 / Make your call</span><span data-stage="reflection">03 / Make it stick</span></div></div></section>' +
    '<div class="ready-banner ' + (session.started?'hidden':'') + '"><div><strong>No rush. You’ve got this.</strong><p>Nova has the brief. Patch has your back. Get comfortable, then wake up your field terminal.</p></div><button class="button primary" id="start-mission" data-testid="start-mission">Start mission →</button></div>' +
    '<div class="mission-grid"><div class="briefing-column"><article class="story-card">' + portrait(presentation.speaker.name) +
    '<div><div class="speaker">' + escape(presentation.speaker.name + ' · ' + presentation.speaker.role) + '</div><p class="story-message">' + escape(mission.story[0]?.text || mission.summary) + '</p><div class="mission-skills">' + mission.skills.map(skill=>'<span class="chip">' + escape(skill) + '</span>').join('') + '</div></div></article>' +
    '<article class="objectives-card"><div class="card-heading"><h2>Your mission</h2><span id="mission-progress" data-testid="mission-progress">' + count + ' / ' + mission.objectives.length + '</span></div><div id="objectives">' + objectivesHtml() + '</div></article>' +
    '<article class="decision-card"><div class="decision-illustration" aria-hidden="true">' + renderPropIcon(presentation.clue.icon) + '</div><div class="eyebrow">YOUR CALL</div><h2>' + escape(mission.decision.title) + '</h2><p>' + escape(mission.decision.context) + '</p><div class="decision-options">' + mission.decision.options.map(option=>'<button class="decision-option" data-decision="' + escape(option.id) + '" data-testid="decision-' + escape(option.id) + '" ' + (!session.started?'disabled':'') + '>' + escape(option.label) + '</button>').join('') + '</div><p id="decision-feedback" role="status"></p></article>' +
    '<article class="field-note"><div class="eyebrow">THIS SKILL GOES PLACES</div><p>' + escape(mission.realWorld) + '</p></article></div>' +
    '<div class="terminal-column"><section class="terminal-window" aria-label="Your training terminal"><div class="terminal-header"><div class="terminal-dots"><i></i><i></i><i></i></div><span class="terminal-label">PATCH’S FIELD TERMINAL</span><div class="terminal-tools"><button id="clear-terminal" aria-label="Clear terminal display">Clear</button></div></div>' +
    '<div id="terminal-output" class="terminal-output" role="log" aria-live="polite" aria-label="Terminal output"></div><form id="terminal-form" class="terminal-form" autocomplete="off"><label class="terminal-prompt" for="terminal-input">trainee@trail:' + escape(session.shell.cwd.replace('/home/trainee','~')) + '$</label><input id="terminal-input" data-testid="terminal-input" aria-label="Type a command" placeholder="Your next move…" spellcheck="false" autocapitalize="off" autocomplete="off" ' + (!session.started?'disabled':'') + '><button class="run-button" data-testid="run-command" type="submit" aria-label="Run command" ' + (!session.started?'disabled':'') + '>↵</button></form><div class="terminal-footer"><span>↑ ↓ history · Tab autocomplete · type help</span><span>Local simulation</span></div></section>' +
    '<div class="command-guide"><span>TOOLS FOR THIS STOP</span><div class="command-chips">' + commandNames(mission).map(command=>'<button class="command-chip" data-command="' + escape(command) + '">' + escape(command) + '</button>').join('') + '</div><div class="command-explainer" id="command-explainer" role="status"><strong>Every tool has a job.</strong><p>Pick a command to see what it does. Nothing runs until you press Enter.</p></div></div>' +
    '<article class="hint-card hint-companion" data-emotion="' + (session.hints?'hint':'idle') + '"><div class="hint-heading"><div><div class="eyebrow">COMPANION CHANNEL / PATCH</div><strong>Your very curious field buddy.</strong></div><span class="companion-online">● ONLINE</span></div>' +
    '<div class="hint-stage"><button type="button" class="patch-portrait companion-portrait" id="patch-chat" data-testid="patch-chat" aria-label="Check in with Patch" style="' + portraitStyle('PATCH') + '"><span class="character-signal" aria-hidden="true"></span></button><p class="patch-speech" id="hint-text" role="status">' + escape(session.hints?mission.hints[Math.min(session.hints-1,mission.hints.length-1)]:'Hey, trail buddy. I’m right here. Tap me for a check-in, or ask for a clue when you need one.') + '</p></div>' +
    '<div class="hint-meter" aria-label="Three clue strengths"><span>Small nudge</span><span>Dig a little deeper</span><span>Show the route</span></div><div class="hint-actions"><button class="button secondary" id="hint-button">Ask Patch ' + (session.hints?'('+session.hints+')':'') + '</button><button class="button ghost" id="restart-mission">↻ Try this stop again</button></div><p class="patch-response" id="patch-response" role="status">Good questions are part of the adventure.</p></article>' +
    '<div class="mission-actions"><div><p class="mission-feedback" id="mission-feedback" role="status">' + (count===mission.objectives.length?'All evidence collected. Tell Nova what you found.':'Make the moves. Follow the clues. Then make your call.') + '</p><small id="session-timer">' + timingText() + '</small></div><button class="button primary" id="debrief" data-testid="debrief" ' + (count!==mission.objectives.length?'disabled':'') + '>Finish & reflect →</button></div></div></div>' +
    '<div class="game-foundation-status" data-testid="foundation-status">' + (allComplete()?'Foundation complete · Office and Night Shift remain in development.':completedCount()+'/'+missions.length+' foundation missions cleared · Next worlds locked') + '</div></section></div></main>' + footer();
  bindActions();
  $$('[data-mission]').forEach(button=>button.onclick=()=>loadMission(Number(button.dataset.mission)));
  $('#start-mission').onclick=beginMission;
  $('#replay-story').onclick=()=>showScene(false);
  $('#tour-replay').onclick=()=>{if(!busy)tutorial.open();};
  $('#terminal-form').onsubmit=event=>{event.preventDefault();runCommand();};
  $('#terminal-input').onkeydown=terminalKeys;
  $('#clear-terminal').onclick=()=>{$('#terminal-output').replaceChildren();terminalLine('A clear view. Your mission evidence is still here.','system');};
  $$('[data-command]').forEach(button=>button.onclick=()=>{
    const command=button.dataset.command, detail=describeCommand(command);
    $('#command-explainer').innerHTML='<strong>' + escape(detail.title) + '</strong><p>' + escape(detail.text) + '</p><code>' + escape(detail.example) + '</code>';
    if(!session.started)return;
    $('#terminal-input').value=command+(['pwd','whoami','help'].includes(command)?'':' ');
    $('#terminal-input').focus();
  });
  $$('[data-decision]').forEach(button=>button.onclick=()=>makeDecision(button.dataset.decision));
  $('#hint-button').onclick=giveHint;
  $('#patch-chat').onclick=checkInWithPatch;
  $('#restart-mission').onclick=restartMission;
  $('#debrief').onclick=debrief;
  terminalLine('⌁ SIGNAL ACADEMY / FIELD SIMULATION','system');
  terminalLine(session.started?'Welcome back. Your files and verified evidence are saved.':'The trail is ready. Start the mission to wake up your terminal.','system');
  if(session.shell.history.length)terminalLine('Last moves:\n'+session.shell.history.slice(-5).join('\n'),'system');
  updateTasks();
  updateHintMeter();
  if(window.innerWidth<900)$('.trail-details').open=false;
}

function commandNames(mission) {
  return [...new Set(mission.solutions.map(command => command.trim().split(/\s+/)[0]))].slice(0,6).concat('help');
}
function objectivesHtml() {
  return missions[current].objectives.map((objective,index) => '<div class="objective ' + (session.tasks[index]?'done':'') + '" data-testid="objective-' + index + '" data-complete="' + !!session.tasks[index] + '"><span class="objective-check">' + (session.tasks[index]?'✓':String(index+1).padStart(2,'0')) + '</span><div><strong>' + escape(objective.label) + '</strong><small>' + escape(objective.detail) + '</small></div></div>').join('');
}
function beginMission() {
  if (session.started || tutorial.isOpen()) return;
  session.started = true; tickAt = performance.now(); persist();
  $('.ready-banner').classList.add('hidden');
  $('#terminal-input').disabled = false; $('.run-button').disabled = false;
  $$('[data-decision]').forEach(button => button.disabled = false);
  terminalLine('Patch is awake. Let’s figure this out together. Type help if you need your toolkit.','success');
  wakePatch('thinking', 'Field terminal awake. Start with one small question.');
  $('#terminal-input').focus();
}
function terminalLine(text,type='output') {
  const output=$('#terminal-output'); if(!output) return;
  const line=document.createElement('div'); line.className='terminal-line '+type; line.textContent=text; output.append(line);
  while(output.children.length>150) output.firstChild.remove();
  output.scrollTop=output.scrollHeight;
}
async function runCommand() {
  if (!session?.started || busy || tutorial.isOpen()) return;
  const input=$('#terminal-input'), raw=input.value.trim();
  if(!raw) return;
  busy=true; $('.run-button').disabled=true;
  const previousCwd=session.shell.cwd;
  input.value='';
  terminalLine('trainee@trail:'+previousCwd+'$ '+raw,'command');
  try {
    const result=await execute(session.shell,raw);
    session.commands++;
    historyIndex=session.shell.history.length;
    if(!result.error&&result.events.some(event=>event.type==='clear')) $('#terminal-output').replaceChildren();
    if(result.output) terminalLine(result.output,result.error?'error':'output');
    else if(!result.error) terminalLine('✓ Done.','system');
    const before = session.tasks.filter(Boolean).length;
    verify(result); persist();
    if (result.error) wakePatch('thinking', 'That move didn’t land. Check the message, adjust your command, and try again.');
    else if (session.tasks.filter(Boolean).length > before) {
      wakePatch('celebrate', 'Nice find! That clue checks out. We’re getting somewhere.');
      const scene = $('.mission-scene');
      if (scene) { scene.dataset.effect = 'verified'; setTimeout(() => { if (scene.isConnected) delete scene.dataset.effect; }, 850); }
    }
    $('.terminal-prompt').textContent='trainee@trail:'+session.shell.cwd.replace('/home/trainee','~')+'$';
  } catch(error) {terminalLine('Patch hit a snag: '+error.message,'error');}
  finally{busy=false; if($('.run-button')) $('.run-button').disabled=false;}
}
function verify(result) {
  if(result.error)return;
  missions[current].objectives.forEach((objective,index)=>{
    if(!session.tasks[index]&&matchesObjective(objective,result,session.shell)){
      session.tasks[index]=true;
      terminalLine('✦ Evidence verified: '+objective.label,'success');
    }
  });
  updateTasks();
}
function updateTasks() {
  if(!session||!$('#objectives'))return;
  $('#objectives').innerHTML=objectivesHtml();
  const count=session.tasks.filter(Boolean).length, total=missions[current].objectives.length;
  $('#mission-progress').textContent=count+' / '+total;
  $('#debrief').disabled=count!==total;
  $('#mission-feedback').textContent=count===total?'All evidence collected. Tell Nova what you found.':'Make the moves. Follow the clues. Then make your call.';
  const decisionDone=missions[current].objectives.some((objective,index)=>objective.check.type==='decision'&&session.tasks[index]);
  const cluesDone=missions[current].objectives.every((objective,index)=>objective.check.type==='decision'||session.tasks[index]);
  const state=count===total?'complete':cluesDone?'decision':'exploring';
  $('.mission-scene').dataset.state=state;
  $('#scene-status').textContent=count===total?'Evidence secured · Ready to reflect':cluesDone?'Clues collected · Your call':count?'A new clue · Keep following the trail':'Your next clue is waiting';
  $$('[data-stage]').forEach(stage=>{
    const complete=stage.dataset.stage==='clues'?cluesDone:stage.dataset.stage==='decision'?decisionDone:false;
    const active=stage.dataset.stage===(count===total?'reflection':cluesDone?'decision':'clues');
    stage.classList.toggle('completed',complete);stage.classList.toggle('active',active);
    if(active)stage.setAttribute('aria-current','step');else stage.removeAttribute('aria-current');
  });
  if(decisionDone){
    const correct=missions[current].decision.options.find(option=>option.correct);
    const button=$('[data-decision="'+correct.id+'"]');
    if(button)button.classList.add('correct');
    $$('[data-decision]').forEach(option=>option.disabled=true);
    if(!$('#decision-feedback').textContent)$('#decision-feedback').textContent=correct.feedback;
  }
}
function makeDecision(id) {
  if(!session.started||tutorial.isOpen())return;
  const option=missions[current].decision.options.find(item=>item.id===id); if(!option)return;
  const requiredEvidence=missions[current].objectives.every((objective,index)=>objective.check.type==='decision'||session.tasks[index]);
  if(!requiredEvidence){$('#decision-feedback').textContent='Collect the terminal evidence first. Your call should follow what you found.';return;}
  $$('[data-decision]').forEach(button=>{button.classList.remove('correct','wrong');button.setAttribute('aria-pressed',String(button.dataset.decision===id));});
  $('[data-decision="'+id+'"]').classList.add(option.correct?'correct':'wrong');
  $('#decision-feedback').textContent=option.feedback;
  if(option.correct){verify({output:'',error:false,events:[{type:'decision',value:id}]});persist();wakePatch('celebrate','That’s a call backed by evidence. Nova is ready for your field report.');}
  else wakePatch('thinking','We can rethink that. Let the clues guide the next choice.');
}
function updateHintMeter() {
  $$('.hint-meter span').forEach((item,index)=>{
    item.classList.toggle('used',index<session.hints);
    item.classList.toggle('active',index===Math.min(session.hints,3)-1);
  });
  $('.hint-meter')?.setAttribute('aria-label',Math.min(session.hints,3)+' of 3 clue strengths revealed');
}
function wakePatch(emotion,text) {
  const card=$('.hint-companion'), portrait=$('#patch-chat');
  if(!card)return;
  card.dataset.emotion=emotion;
  $('#patch-response').textContent=text;
  portrait?.classList.remove('speaking');
  if(portrait){void portrait.offsetWidth;portrait.classList.add('speaking');}
  clearTimeout(wakePatch.timer);
  wakePatch.timer=setTimeout(()=>{if(portrait?.isConnected)portrait.classList.remove('speaking');},1800);
}
function checkInWithPatch() {
  const lines=session.tasks.every(Boolean)?['Look at that. A whole trail stop figured out. Tell Nova what you learned.']:
    !session.started?['I’ve packed the snacks and warmed up the terminal. Start when you’re comfortable.','Read Nova’s brief first. We’ll take the next step together.']:
    ['One command. One clue. We don’t have to solve the whole mountain at once.','Curiosity is a very good tool. Check the file, follow the evidence, then make your call.','If the trail feels foggy, ask me for a nudge. That’s what companions are for.'];
  checkInWithPatch.index=((checkInWithPatch.index??-1)+1)%lines.length;
  wakePatch('thinking',lines[checkInWithPatch.index]);
}
function giveHint() {
  if(tutorial.isOpen())return;
  if(!session.started)return toast('Start this mission first, then Patch can help.');
  session.hints++;
  const mission=missions[current];
  $('#hint-text').textContent=mission.hints[Math.min(session.hints-1,mission.hints.length-1)];
  $('#hint-button').textContent='Ask Patch ('+session.hints+')';
  updateHintMeter();
  wakePatch('hint',session.hints<3?'A little nudge. Try it out, and we’ll follow the next clue.':'Here’s the route. Take it one command at a time and watch what each move tells you.');
  persist();
}
function restartMission() {
  if (busy) return toast('Patch is finishing your command. One moment.');
  openDialog('<div class="eyebrow">A FRESH ATTEMPT</div><h2 id="dialog-title">Try this stop again?</h2><p>Your saved achievements and other missions stay with you. The files, clues, and score for this attempt start fresh.</p><div class="setting-row"><button class="button secondary" id="cancel-restart">Keep exploring</button><button class="button primary" id="confirm-restart">Restart this mission</button></div>');
  $('#cancel-restart').onclick=closeDialog;
  $('#confirm-restart').onclick=()=>{if(busy)return;const id=missions[current].id;closeDialog();session=null;delete profile.sessions[id];persist();loadMission(current);};
}
function terminalKeys(event) {
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){
    event.preventDefault();
    historyIndex=Math.max(0,Math.min(session.shell.history.length,historyIndex+(event.key==='ArrowUp'?-1:1)));
    event.target.value=session.shell.history[historyIndex]||'';
  }
  if(event.key==='Tab'&&event.target.value.trim()){
    const text=event.target.value,parts=text.split(/\s+/),last=parts.at(-1);
    const candidates=parts.length===1?['pwd','whoami','ls','cd','cat','echo','touch','mkdir','cp','mv','find','grep','head','tail','sort','uniq','wc','awk','tee','chmod','sha256sum','base64','nslookup','ping','curl','ss','ps','help','history','clear'].filter(name=>name.startsWith(last)):[...Object.keys(session.shell.files),...session.shell.directories].map(path=>path.startsWith(session.shell.cwd+'/')?path.slice(session.shell.cwd.length+1):path).filter(path=>path.startsWith(last));
    if(candidates.length===1){event.preventDefault();parts[parts.length-1]=candidates[0];event.target.value=parts.join(' ');}
  }
}
function showScene(preview=false) {
  previewScene=preview;sceneIndex=0;
  dialogReturn=document.activeElement;
  $('#cinematic-backdrop').classList.remove('hidden');document.body.style.overflow='hidden';
  renderScene();$('.cinematic').focus();
}
function renderScene() {
  const mission=missions[current],frame=mission.story[sceneIndex],presentation=getPresentation(mission,sceneIndex),scene=presentation.scene;
  $('.cinematic').dataset.act = String(mission.act);
  $('.cinematic').dataset.frame = String(sceneIndex);
  $('.cinematic').dataset.speaker=presentation.speaker.name.toLowerCase();
  $('.cinematic').dataset.palette=scene.palette;
  $('.cinematic').innerHTML='<div class="cinematic-art" data-scene="'+escape(scene.id)+'" role="img" aria-label="'+escape(scene.alt)+'" style="'+atlasStyle(scene)+'"><div class="cinematic-grain"></div><span class="cinematic-label">THE SIGNAL ACADEMY / HIKE TRAIL</span><div class="mission-prop" aria-hidden="true">'+renderPropIcon(scene.prop)+'</div>'+portrait(presentation.speaker.name,'speaking-character companion-portrait')+'<span class="cinematic-location">'+escape(scene.label)+'</span></div><div class="cinematic-content"><div class="story-speaker">'+escape(frame.speaker)+' · TRANSMISSION '+(sceneIndex+1)+' / '+mission.story.length+'</div><h2 id="cinematic-title">'+escape(frame.title)+'</h2><p>'+escape(frame.text)+'</p></div><div class="cinematic-footer"><div class="scene-dots" aria-label="Story frame '+(sceneIndex+1)+' of '+mission.story.length+'">'+mission.story.map((_,index)=>'<span class="'+(index===sceneIndex?'active':'')+'"></span>').join('')+'</div><div class="cinematic-buttons"><button class="button ghost" id="scene-skip" data-testid="scene-skip">'+(previewScene?'Close preview':'Skip story')+'</button><button class="button primary" id="scene-next" data-testid="scene-next">'+(sceneIndex===mission.story.length-1?(previewScene?'Back to the adventure':'Let’s do this →'):'Continue story →')+'</button></div></div>';
  $('#scene-skip').onclick=()=>closeScene(true);
  $('#scene-next').onclick=()=>{if(sceneIndex<mission.story.length-1){sceneIndex++;renderScene();$('#scene-next').focus();}else closeScene(true);};
}
function closeScene(restore=true) {
  $('#cinematic-backdrop').classList.add('hidden');
  if($('#dialog-backdrop').classList.contains('hidden'))document.body.style.overflow='';
  if(restore){
    if(view==='game'&&!previewScene&&!profile.settings.tutorialSeen){tutorial.open();return;}
    if(view==='game'&&!previewScene&&!session.started)$('#start-mission')?.focus();else if(dialogReturn?.isConnected)dialogReturn.focus();
  }
}
function openDialog(content) {
  if ($('#dialog-backdrop').classList.contains('hidden')) dialogReturn=document.activeElement;
  $('.dialog-content').innerHTML=content;
  $('#dialog-backdrop').classList.remove('hidden');document.body.style.overflow='hidden';
  $('.dialog-close').dataset.testid='dialog-close';
  $('.dialog-close').onclick=closeDialog;$('.dialog-close').focus();
}
function closeDialog() {
  $('#dialog-backdrop').classList.add('hidden');
  if($('#cinematic-backdrop').classList.contains('hidden'))document.body.style.overflow='';
  if(dialogReturn?.isConnected)dialogReturn.focus();
}
function timingText() {
  const seconds=Math.floor(session?.elapsed||0), minutes=Math.floor(seconds/60);
  return (profile.settings.practice?'Explore mode · No time pressure':'Challenge mode · Personal best')+' · '+minutes+':'+String(seconds%60).padStart(2,'0')+' active time';
}
function debrief() {
  if(!session.tasks.every(Boolean))return;
  const mission=missions[current];
  openDialog('<div class="eyebrow">A MOMENT TO MAKE IT STICK</div><h2 id="dialog-title">Nice moves. What did they mean?</h2><p>'+escape(mission.debrief)+'</p><h3>'+escape(mission.quiz.question)+'</h3><div class="quiz-options">'+mission.quiz.options.map((option,index)=>'<button class="quiz-choice" data-quiz="'+index+'" data-testid="quiz-'+index+'">'+escape(option)+'</button>').join('')+'</div><p id="quiz-feedback" role="status"></p><label class="reflection-label" for="reflection">Leave a note for your future self <span>(optional)</span></label><textarea id="reflection" maxlength="2000" placeholder="What clicked? What would you check next time?">'+escape(profile.notes[mission.id]||'')+'</textarea><button class="button primary" id="complete-mission" data-testid="complete-mission" disabled>Complete this stop ✦</button>');
  $$('[data-quiz]').forEach(button=>button.onclick=()=>{
    const correct=Number(button.dataset.quiz)===mission.quiz.answer;
    $$('[data-quiz]').forEach(item=>{item.classList.remove('correct','wrong');item.setAttribute('aria-pressed',String(item===button));});
    button.classList.add(correct?'correct':'wrong');
    $('#quiz-feedback').textContent=correct?mission.quiz.explanation:'Not quite. Think about the evidence you found. You can try again.';
    $('#complete-mission').disabled=!correct;
  });
  $('#complete-mission').onclick=()=>{
    if($('#complete-mission').disabled)return;
    profile.notes[mission.id]=$('#reflection').value.trim();
    if(!profile.completed.includes(mission.id))profile.completed.push(mission.id);
    let stars=3;
    if(session.hints>0)stars=2;
    if(session.hints>=3)stars=1;
    if(!profile.settings.practice&&session.elapsed>600)stars=Math.min(stars,2);
    const score={stars,hints:session.hints,commands:session.commands,seconds:Math.floor(session.elapsed)};
    const old=profile.scores[mission.id];
    if(!old||stars>old.stars||(stars===old.stars&&score.commands<old.commands))profile.scores[mission.id]=score;
    persist();
    showResult(mission,score);
  };
}
function showResult(mission,score) {
  const last=allComplete(),next=current+1;
  openDialog('<div class="eyebrow">'+(last?'HIKE TRAIL / FOUNDATION CLEARED':'ONE MORE STEP FORWARD')+'</div><h2 id="dialog-title">'+(last?'The valley has its signal back.':'That’s a proper little win.')+'</h2><div class="result-stars" aria-label="'+score.stars+' out of 3 stars">'+[1,2,3].map(number=>'<span class="'+(number<=score.stars?'earned':'')+'">✦</span>').join('')+'</div><p>'+escape(last?'You followed the clues, protected the people, and brought the tower back. Every foundation mission is cleared. You can revisit any Hike Trail stop. Office and Night Shift will open once their chapters are built and tested.':mission.quiz.explanation)+'</p><div class="result-stats"><div><strong>'+score.commands+'</strong><span>commands tried</span></div><div><strong>'+score.hints+'</strong><span>Patch nudges</span></div><div><strong>'+completedCount()+'/'+missions.length+'</strong><span>stops cleared</span></div></div><p class="muted">Stars reward independent practice. Hints help you learn, and every completed stop counts. Replay whenever you like.</p><button class="button primary" id="next-mission" data-testid="next-mission">'+(last?'Back to your adventure →':next<missions.length?'On to the next stop →':'Explore the trail →')+'</button>');
  $('#next-mission').onclick=()=>{closeDialog();if(last)goHome();else if(next<missions.length)loadMission(next);else fieldMap();};
}
function fieldMap() {
  openDialog('<div class="eyebrow">THE WHOLE EXPEDITION</div><h2 id="dialog-title">Your way through the valley.</h2><p>One connected story. Four acts. Every cleared stop is yours to revisit.</p><div class="mission-grid-all">'+missions.map((mission,index)=>'<button class="mission-card '+(profile.completed.includes(mission.id)?'completed':'')+'" data-map-mission="'+index+'" '+(index>unlockedIndex()?'disabled':'')+'><span>STOP '+String(index+1).padStart(2,'0')+' '+(profile.completed.includes(mission.id)?'✓':index>unlockedIndex()?'⌁':'→')+'</span><strong>'+escape(mission.title)+'</strong><small>'+escape(mission.skills.join(' · '))+'</small></button>').join('')+'</div>');
  $$('[data-map-mission]').forEach(button=>button.onclick=()=>{closeDialog();loadMission(Number(button.dataset.mapMission));});
}
function notebook() {
  openDialog('<div class="eyebrow">FIELD NOTES / SKILLS THAT STAY WITH YOU</div><h2 id="dialog-title">Look at what you’re learning.</h2><p>Useful tools, better questions, and a trail full of evidence. These are practice skills, not a professional certification.</p><div class="skills-grid">'+skillGuide.map(skill=>'<article class="skill-card"><h3>'+escape(skill.title)+'</h3><p>'+escape(skill.description)+'</p><span class="chip">'+(skill.missions?.filter(id=>profile.completed.includes(id)).length||0)+' / '+(skill.missions?.length||0)+' related stops cleared</span></article>').join('')+'</div><h3>Your reflections</h3>'+missions.filter(mission=>profile.notes[mission.id]).map(mission=>'<article class="notebook-note"><strong>'+escape(mission.title)+'</strong><p>'+escape(profile.notes[mission.id])+'</p></article>').join('')+(Object.keys(profile.notes).length?'':'<p class="muted">Finish a stop and leave yourself a note. It’ll be waiting right here.</p>')+(profile.legacyProgress?'<h3>From your V4 journey</h3><p>Your earlier '+profile.legacyProgress.completed+' completed missions and '+profile.legacyProgress.xp+' XP are preserved separately.</p>'+Object.entries(profile.legacyProgress.notes||{}).map(([key,value])=>'<p><strong>'+escape(key)+': </strong>'+escape(value)+'</p>').join(''):''));
}
function settings() {
  if (busy) return toast('Patch is finishing your command. One moment.');
  openDialog('<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2 id="dialog-title">Your adventure, your pace.</h2><div class="settings-options"><label><input type="checkbox" id="setting-motion" data-testid="setting-motion" '+(profile.settings.motion?'checked':'')+'> Animated story scenes <small>Your device’s reduced-motion preference always takes priority.</small></label><label><input type="checkbox" id="setting-untimed" data-testid="setting-untimed" '+(profile.settings.practice?'checked':'')+'> Explore mode — no time pressure <small>Turn off for an optional personal-best challenge. The trail never cuts your learning short.</small></label></div><h3>Keep your progress safe.</h3><p>Journey '+slot+' is '+(storage.available?'saved in this browser. Saves do not sync across devices.':'temporary because browser storage is unavailable. Export before closing the tab.')+'</p><div class="setting-row"><button class="button secondary" id="export-save">↓ Export journey</button><button class="button secondary" id="import-save">↑ Import journey</button><button class="button ghost" id="choose-journey">Change journey</button></div><input type="file" id="import-file" accept=".json,application/json" class="hidden"><p id="settings-feedback" role="status"></p><h3>Need a fresh start?</h3><p>This only resets journey '+slot+'. Your other journeys stay saved.</p><button class="button ghost danger" id="reset-slot">Reset this journey</button><p class="setting-note">The terminal is a local training simulation. It does not run commands on your computer or contact real systems.</p>');
  $('#setting-motion').onchange=event=>{profile.settings.motion=event.target.checked;persist();};
  $('#setting-untimed').onchange=event=>{profile.settings.practice=event.target.checked;persist();if($('#session-timer'))$('#session-timer').textContent=timingText();};
  $('#export-save').onclick=()=>{
    try{
      if(session)persist();
      const content=storage.export(slot),blob=new Blob([typeof content==='string'?content:JSON.stringify(content,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='terminal-trails-journey-'+slot+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      $('#settings-feedback').textContent='Your journey backup is downloaded. Keep it somewhere safe.';
    }catch(error){$('#settings-feedback').textContent=error.message;}
  };
  $('#import-save').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(file.size>1024*1024){$('#settings-feedback').textContent='That backup is too large. Choose a journey file smaller than 1 MB.';return;}
    try{
      const text=await file.text();
      openDialog('<div class="eyebrow">IMPORT JOURNEY</div><h2 id="dialog-title">Replace journey '+slot+' with this backup?</h2><p>Your other journeys are safe. Export this journey first if you want to keep both.</p><div class="setting-row"><button class="button secondary" id="cancel-import">Cancel</button><button class="button primary" id="confirm-import">Import backup</button></div><p id="import-feedback" role="status"></p>');
      $('#cancel-import').onclick=settings;
      $('#confirm-import').onclick=()=>{
        try{storage.import(slot,text);profile=storage.read(slot);corruptSlots.delete(slot);current=Math.max(0,missions.findIndex(m=>m.id===profile.currentMission));session=null;closeDialog();renderHome();toast('Your journey is back. Welcome to the trail.');}
        catch(error){$('#import-feedback').textContent=error.message;}
      };
    }catch(error){$('#settings-feedback').textContent=error.message;}
  };
  $('#choose-journey').onclick=goHome;
  $('#reset-slot').onclick=()=>{
    openDialog('<div class="eyebrow">RESET JOURNEY '+slot+'</div><h2 id="dialog-title">Start this journey fresh?</h2><p>This removes this journey’s mission progress and notes. Export a backup first if you want to keep them.</p><div class="setting-row"><button class="button secondary" id="cancel-reset">Keep my journey</button><button class="button primary danger" id="confirm-reset">Reset journey '+slot+'</button></div>');
    $('#cancel-reset').onclick=settings;
    $('#confirm-reset').onclick=()=>{storage.remove(slot);corruptSlots.delete(slot);profile=createProgress(missions);current=0;session=null;closeDialog();renderHome();toast('A fresh trail is waiting.');};
  };
}
document.addEventListener('keydown',event=>{
  if(tutorial.isOpen())return;
  const backdrop=!$('#cinematic-backdrop').classList.contains('hidden')?$('#cinematic-backdrop'):!$('#dialog-backdrop').classList.contains('hidden')?$('#dialog-backdrop'):null;
  if(!backdrop)return;
  if(event.key==='Escape'){event.preventDefault();if(backdrop.id==='cinematic-backdrop')closeScene(true);else closeDialog();}
  if(event.key==='Tab'){
    const focusable=$$('button:not([disabled]),input:not([disabled]),textarea,a[href],[tabindex="0"]',backdrop).filter(node=>node.getClientRects().length);
    if(!focusable.length){event.preventDefault();return;}
    const first=focusable[0],last=focusable.at(-1),active=document.activeElement;
    if(!focusable.includes(active)){event.preventDefault();(event.shiftKey?last:first).focus();}
    else if(event.shiftKey&&active===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
  }
});
$('#dialog-backdrop').onclick=event=>{if(event.target===$('#dialog-backdrop'))closeDialog();};
reduceMotion.addEventListener('change',applySettings);
setInterval(()=>{
  const now=performance.now(),delta=Math.min((now-tickAt)/1000,2);tickAt=now;
  if(view==='game'&&session?.started&&!document.hidden&&!tutorial.isOpen()&&$('#dialog-backdrop').classList.contains('hidden')&&$('#cinematic-backdrop').classList.contains('hidden')&&!session.tasks.every(Boolean)){
    session.elapsed+=delta;
    if($('#session-timer'))$('#session-timer').textContent=timingText();
    if(Math.floor(session.elapsed)%5===0)persist();
  }
},1000);
document.addEventListener('visibilitychange',()=>{tickAt=performance.now();if(document.hidden&&session)persist();});
window.addEventListener('pagehide',()=>{if(session)persist();});
renderHome();
if (migrationReport.warnings.length) toast('An earlier save needs attention. Its original data is preserved; import a valid backup or use a fresh journey.');
