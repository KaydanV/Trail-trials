import {
  chapters,
  missions,
  missionById,
  phaseNames,
  skillNames,
  skillTree,
  actNames,
} from "./curriculum.js";
import {
  createSession,
  currentStep,
  runCommand,
  inspectItem,
  submitActivity,
  requestHint,
  answerQuestion,
  canComplete,
  completeMission,
  createStorage,
  MAX_SAVE_BYTES,
} from "./runtime.js";
import { makeReviewMission } from "./review.js";
import { renderMap, renderScene, renderPortrait } from "./world.js";
import {
  renderPlayWorld,
  mountPlayWorld,
  renderGearIcon,
} from "./play-world.js?v=20261019-alpine";
import { renderPlayActivity, mountPlayActivity } from "./play-tools.js";
import { renderRanger } from "./play-art.js";
import { getPlayScene, tutorialBeats, controlsTutorial } from "./play-script.js?v=20261019-alpine";
import { hasSeenControls, saveControlsSeen, createGuidePractice, runGuidePractice, renderControlsGuide, renderGuidePractice } from "./play-guide.js";
import {
  createPlayState,
  loadPlayState,
  savePlayState,
  validatePlayState,
  syncPlayRewards,
  interactPlay,
  equipPlayItem,
  resetPlayMission,
  movePlayPlayer,
  advancePlayTutorial,
  catalog,
  MAX_PLAY_BYTES,
} from "./play-state.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const toolNames = {
  terminal: "Pocket console",
  explorer: "Workbench",
  network: "Signal rig",
  browser: "Mail satchel",
  evidence: "Clue board",
  windows: "Ranger workstation",
  script: "Tinker’s bench",
  dialogue: "Talk it through",
};
const toolIcons = {
  terminal: ">_",
  explorer: "▣",
  network: "⌁",
  browser: "◎",
  evidence: "⌑",
  windows: "⊞",
  script: "{ }",
  dialogue: "◌",
};
let backend;
try {
  backend = localStorage;
} catch {}
const storage = createStorage(missions, backend);
let profile = storage.read();
const restoredPlay = loadPlayState(backend, profile);
let play = restoredPlay.state;
let playRecoveryRequired = !!restoredPlay.error;
let introIndex = 0;
let controlsSeen = hasSeenControls(backend),
  controlsStep = null,
  controlsOrigin = null,
  controlsPractice = createGuidePractice(),
  speechExpanded = false;
let gamePanel = null,
  chatter = null,
  worldCleanup = null,
  toolsCleanup = null;

let view = "home",
  chapterId = 1,
  active = null,
  session = null,
  activeTool = "terminal",
  busy = false,
  reviewing = false;
let storyFrame = 0,
  lastResponse = "",
  quizIndex = 0,
  quizFeedback = null,
  dialogOrigin = null,
  audioContext = null;
let storyFrames = [],
  storyMode = "intro",
  afterStory = null;
const drafts = new Map();
const dialog = $("#dialog");
const mediaMotion = matchMedia("(prefers-reduced-motion: reduce)");
const completeIds = () => profile.completed || [];
const unlockedIndex = () => Math.min(completeIds().length, missions.length - 1);
const currentIndex = () =>
  active ? missions.findIndex((m) => m.id === active.id) : 0;
const readyStep = () => (active && session ? currentStep(active, session) : 0);
const stepNow = () => active?.steps[readyStep()];
const chapterOf = (mission) => chapters.find((c) => c.id === mission.chapter);
const button = (label, action, attrs = "", kind = "") =>
  '<button type="button" class="button ' +
  kind +
  '" data-action="' +
  action +
  '" ' +
  attrs +
  ">" +
  label +
  "</button>";
function persist() {
  if (active && session) {
    if (reviewing) profile.practiceSessions[active.id].session = session;
    else profile.sessions[active.id] = session;
  }
  profile.updatedAt = new Date().toISOString();
  persistPlay();
  try {
    storage.write(profile);
  } catch (error) {
    toast(error.message);
  }
}
function persistPlay() {
  if (playRecoveryRequired) return;
  syncPlayRewards(play, profile);
  const result = savePlayState(backend, play, profile);
  if (result?.error)
    console.warn("Adventure accessories are using temporary storage.");
}
function syncTutorial() {
  if (active?.id !== "c01-01") return;
  if (play.tutorialStage === 4 && session.done[0])
    advancePlayTutorial(play, "fit-part");
  if (play.tutorialStage === 5 && session.done[1])
    advancePlayTutorial(play, "talk-nova");
}
function beginControlsGuide(renderNow = true) {
  controlsStep = 0;
  controlsOrigin = { ...play.position };
  controlsPractice = createGuidePractice();
  gamePanel = null;
  speechExpanded = false;
  if (renderNow) render();
}
function advanceControlsGuide(gate) {
  if (controlsStep === null || controlsTutorial[controlsStep]?.gate !== gate) return false;
  controlsStep++;
  if (controlsStep >= controlsTutorial.length) finishControlsGuide();
  return true;
}
function finishControlsGuide() {
  controlsStep = null;
  controlsSeen = true;
  saveControlsSeen(backend);
  play.tutorialStage = 6;
  gamePanel = null;
  clearTimeout(toast.timer);
  $("#toast")?.classList.remove("visible");
  chatter = {speaker:"PATCH", text:"Ranger ready. Antenna questionable. Adventure definitely on. Your goal is up there; anything interesting is worth a closer look."};
  persistPlay();
}
function clearControlsGuide() {
  controlsStep = null;
  controlsOrigin = null;
  controlsPractice = createGuidePractice();
  gamePanel = null;
}
function closeGamePanel() {
  const practiced = gamePanel === "practice" && controlsPractice.seen.includes("help") && controlsPractice.seen.includes("pwd");
  gamePanel = null;
  if (practiced) advanceControlsGuide("practice-console");
  render();
  $(".pw-scene")?.focus({preventScroll:true});
}
function openGameGadget() {
  if (controlsStep !== null) gamePanel = "practice";
  else {
    gamePanel = "tools";
    activeTool = stepNow()?.tool || "terminal";
  }
  render();
  if (gamePanel === "practice") {
    const input = $("#guide-practice-input");
    input?.focus({preventScroll:true});
    revealInput(input);
  }
}
function playLine() {
  if (chatter) return chatter;
  if (active?.id === "c01-01" && play.tutorialStage < 6) {
    const beat = tutorialBeats[play.tutorialStage];
    return {
      speaker: beat?.speaker || "PATCH",
      text: beat?.text || "Try something. I have a tiny fire extinguisher.",
    };
  }
  return { speaker: "PATCH", text: getPlayScene(active, session).goal };
}
function renderSpeech() {
  const original = playLine();
  const actor = String(original.text || "").match(/^(PATCH|PATCHES|NOVA|OWL|BRAMBLE|TESSA):\s*/i);
  const line = actor ? {speaker:actor[1].toUpperCase(),text:original.text.slice(actor[0].length)} : original;
  return (
    renderPortrait(line.speaker || "PATCH", "speaking") +
    '<div><span class="eyebrow">' +
    esc(line.speaker || "PATCH") +
    " / LIVE FROM THE TRAIL</span><p>" +
    esc(line.text) +
    "</p></div>"
  );
}
function updateSpeech() {
  const speech = $(".play-speech-copy");
  if (speech) speech.innerHTML = renderSpeech();
  const tutorial = $(".play-tutorial-count");
  if (tutorial)
    tutorial.textContent =
      play.tutorialStage < 6
        ? "Getting our feet dirty · " + (play.tutorialStage + 1) + "/6"
        : "";
}
function applySettings() {
  document.body.dataset.motion =
    profile.settings.motion && !mediaMotion.matches ? "on" : "off";
  document.body.dataset.textSize = profile.settings.textSize || "normal";
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 5000);
}
function announce(message) {
  $("#announcement").textContent = String(message);
}
function sound(success = true) {
  if (!profile.settings.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const oscillator = audioContext.createOscillator(),
      volume = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = success ? 523.25 : 220;
    volume.gain.setValueAtTime(0.025, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.24,
    );
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.25);
  } catch {}
}
function header() {
  return (
    '<header class="site-header"><button class="brand" data-action="home" aria-label="Terminal Trails home"><img src="../assets/trail-mark.svg" alt=""><span><strong>TERMINAL <em>TRAILS</em></strong><small>THE LIVING VALLEY</small></span></button><nav aria-label="Main navigation">' +
    button("The valley", "home", "", "nav-button") +
    button("Field journal", "journal", 'data-testid="journal"', "nav-button") +
    '</nav><div class="header-actions"><span class="progress-chip">' +
    completeIds().length +
    ' / 104</span><button class="icon-button" data-action="settings" data-testid="settings" aria-label="Save and settings">⚙</button></div></header>'
  );
}
function footer() {
  return (
    '<footer class="site-footer"><span>A little adventure. Real things to figure out.</span><span>' +
    (storage.available
      ? "Saved in this browser"
      : "Temporary journey · Export a backup") +
    '</span><a href="../">Original 24-mission expedition ↗</a></footer>'
  );
}
function render() {
  worldCleanup?.();
  worldCleanup = null;
  toolsCleanup?.();
  toolsCleanup = null;
  document.body.dataset.view = view;
  document.body.dataset.guide = view === "mission" && controlsStep !== null ? "on" : "off";
  applySettings();
  if (view === "mission" && active) renderMission();
  else if (view === "chapter") renderChapter();
  else renderHome();
}
function renderHome() {
  view = "home";
  const next =
    missionById.get(profile.currentMission) ||
    missionById.get(missions[unlockedIndex()].id);
  $("#app").innerHTML =
    header() +
    '<main id="main" tabindex="-1"><section class="valley-hero"><div class="hero-copy"><span class="eyebrow">A NEW APPRENTICE. A VALLEY WITH SECRETS.</span><h1>The valley is<br>going <em>silent.</em></h1><p>The signs have stopped answering. The archive has a gap in its memory. Patch has a theory involving a suspicious sandwich.</p><p class="hero-sub">Explore. Find the clues. Learn the tools. Then make the call yourself.</p><div class="hero-actions">' +
    button(
      completeIds().length
        ? "Continue your adventure →"
        : "Meet your field buddy →",
      "start",
      'data-testid="start-journey"',
      "primary",
    ) +
    button("How to play", "how-to", "", "secondary") +
    '</div><div class="hero-facts"><span>12 connected chapters</span><span>92 learning missions</span><span>12 bosses</span></div></div><figure class="hero-art"><img src="../assets/expedition.webp" alt="A ranger and a small robot look out over a sunlit mountain trail."><figcaption>Every expert starts somewhere.</figcaption></figure></section><section class="journey-strip"><div><span class="eyebrow">YOUR NEXT CHAPTER</span><strong>' +
    esc(next?.title || "The valley remembers you.") +
    "</strong><p>" +
    esc(
      completeIds().length === missions.length
        ? "The signal is back. Return to a case and see what has stayed with you."
        : next?.summary,
    ) +
    '</p></div><div class="story-progress"><strong>' +
    completeIds().length +
    '<small> / 104</small></strong><span>encounters cleared</span><progress max="104" value="' +
    completeIds().length +
    '">' +
    completeIds().length +
    ' of 104</progress></div></section><section class="world-section"><div class="section-heading"><div><span class="eyebrow">ONE MYSTERY. TWELVE PLACES TO FIND YOUR FEET.</span><h2>A valley worth getting lost in.</h2></div><p>Each chapter builds a skill, changes the world, and asks you to prove what you can do.</p></div>' +
    renderMap(chapters, profile, chapterId) +
    '</section><section class="worlds-future"><article><span class="eyebrow">THE NEXT ADVENTURE</span><h3>The Office</h3><p>Workplace investigations, teammates, and decisions with a wider impact.</p><span class="locked-label">Chapter in development</span></article><article><span class="eyebrow">FURTHER DOWN THE ROAD</span><h3>The Night Shift</h3><p>Realistic operations, changing priorities, and time-sensitive incidents.</p><span class="locked-label">Chapter in development</span></article></section></main>' +
    footer();
}
function renderChapter() {
  const chapter = chapters.find((c) => c.id === chapterId),
    entries = missions.filter((m) => m.chapter === chapterId);
  $("#app").innerHTML =
    header() +
    '<main id="main" class="chapter-page" tabindex="-1">' +
    button("← Back to the valley", "home", "", "text-button") +
    '<section class="chapter-intro"><div><span class="eyebrow">CHAPTER ' +
    String(chapter.id).padStart(2, "0") +
    " · " +
    esc(actNames[Math.floor((chapter.id - 1) / 3)]) +
    "</span><h1>" +
    esc(chapter.title) +
    "</h1><p>" +
    esc(chapter.outcome) +
    "</p></div>" +
    renderPortrait(
      chapter.id < 3
        ? "PATCH"
        : chapter.id < 5
          ? "BRAMBLE"
          : chapter.id < 9
            ? "TESSA"
            : "OWL",
    ) +
    '</section><div class="trail-list">' +
    entries
      .map((m) => {
        const index = missions.findIndex((item) => item.id === m.id),
          unlocked = index <= unlockedIndex(),
          cleared = completeIds().includes(m.id);
        return (
          '<article class="trail-card ' +
          (m.phase === "boss" ? "boss" : "") +
          " " +
          (cleared ? "cleared" : "") +
          '"><span class="trail-number">' +
          (cleared
            ? "✓"
            : m.phase === "boss"
              ? "✦"
              : String(index + 1).padStart(2, "0")) +
          '</span><div><span class="eyebrow">' +
          esc(phaseNames[m.phase]) +
          "</span><h2>" +
          esc(m.title) +
          "</h2><p>" +
          esc(m.summary) +
          '</p><div class="skill-tags">' +
          m.skills
            .map((skill) => "<span>" + esc(skillNames(skill)) + "</span>")
            .join("") +
          '</div></div><div class="trail-card-actions">' +
          button(
            cleared
              ? "Revisit →"
              : unlocked
                ? "Enter the scene →"
                : "Earlier encounters first",
            "mission",
            'data-mission="' + m.id + '" ' + (!unlocked ? "disabled" : ""),
            "primary",
          ) +
          (cleared
            ? button(
                "Return-trip case ↻",
                "review",
                'data-mission="' + m.id + '"',
                "secondary",
              )
            : "") +
          "</div></article>"
        );
      })
      .join("") +
    '</div><aside class="office-connection"><span class="eyebrow">THIS SKILL GOES PLACES</span><p>' +
    esc(chapter.officeConnection) +
    "</p></aside></main>" +
    footer();
}
function openMission(id, practice = false) {
  if (busy) return;
  const source = missionById.get(id);
  if (!source || missions.findIndex((m) => m.id === id) > unlockedIndex())
    return toast(
      "Follow the earlier encounters to open this part of the trail.",
    );
  worldCleanup?.();
  worldCleanup = null;
  if (active && session) persist();
  reviewing = practice;
  if (practice) {
    if (!completeIds().includes(id))
      return toast("Clear this encounter before opening a return trip.");
    profile.practiceSessions ||= {};
    let entry = profile.practiceSessions[id];
    if (!entry || entry.record) {
      const variant = ((entry?.variant || 0) % 10000) + 1;
      active = makeReviewMission(source, variant);
      entry = profile.practiceSessions[id] = {
        variant,
        session: createSession(active),
      };
    } else active = makeReviewMission(source, entry.variant);
    session = entry.session;
  } else {
    active = source;
    session = profile.sessions[id] ||= createSession(active);
    profile.currentMission = id;
  }
  chapterId = active.chapter;
  view = "mission";
  activeTool = stepNow()?.tool || "terminal";
  lastResponse = "";
  window.scrollTo({ top: 0, behavior: "instant" });
  resetPlayMission(play, active.id);
  syncTutorial();
  gamePanel = null;
  introIndex=1;
  chatter=active.id==="c01-01"&&play.tutorialStage<6?null:getPlayScene(active,session).intro?.[0]||null;
  session.started = true;
  if (!controlsSeen && controlsStep === null) beginControlsGuide(false);
  persist();
  render();
}
function stageTools() {
  return [
    ...new Set([
      "explorer",
      ...active.steps.map((step) => step.tool),
      ...(Object.keys(session.shell.files).some((path) => /\.sh$/.test(path))
        ? ["script"]
        : []),
      "terminal",
    ]),
  ];
}
function renderMission() {
  syncTutorial();
  const index = readyStep(),
    step = stepNow(),
    scene = getPlayScene(active, session);
  const done = session.done.filter(Boolean).length;
  $("#app").innerHTML =
    '<main id="main" class="play-page" data-art-direction="' + ((active.scene || chapterOf(active)?.scene) === "welcome" ? "alpine" : "classic") + '" tabindex="-1"><div class="play-topbar">' +
    button("← Valley map", "home", "", "play-map-button") +
    '<div><span class="eyebrow">CHAPTER ' +
    active.chapter +
    (reviewing ? " · RETURN TRIP" : "") +
    "</span><h1>" +
    esc(scene.title || active.title) +
    '</h1></div><div class="play-wallet" aria-label="Acorns">' +
    play.coins +
    " <span>acorns</span></div>" +
    (profile.settings.timer
      ? '<span class="play-clock">Your pace · <time id="practice-clock">' +
        formatClock(session.elapsed) +
        "</time></span>"
      : "") +
    '</div><nav class="play-utility" aria-label="Game menu"><button type="button" data-action="settings" data-testid="settings" aria-label="Game settings" title="Game settings">⚙</button><button type="button" data-action="tour" aria-label="How to play" title="How to play">?</button><button type="button" data-game-action="fullscreen" aria-label="Toggle fullscreen" title="Toggle fullscreen">⛶</button></nav><div class="play-stage-wrap"><div id="game-world">' +
    renderPlayWorld(active, session, play, chapterOf(active)) +
    '</div><div class="play-quest"><span>' +
    (active.phase === "boss" ? "BOSS ENCOUNTER" : "ON THE TRAIL") +
    '</span><button data-game-action="gadget" data-testid="current-objective">' +
    esc(step ? scene.goal : "The beacon is ready. Let Nova know.") +
    '</button><div class="play-progress" aria-label="Verified discoveries">' +
    active.steps
      .map(
        (task, i) =>
          '<span data-testid="objective-' +
          i +
          '" data-complete="' +
          session.done[i] +
          '" class="' +
          (session.done[i] ? "lit" : "") +
          '" title="' +
          esc(task.title) +
          '">' +
          (session.done[i] ? "✓" : "·") +
          "</span>",
      )
      .join("") +
    '</div></div><div class="play-speech" data-expanded="' + speechExpanded + '"><button type="button" class="play-speech-toggle" data-game-action="speech-expand" aria-expanded="' + speechExpanded + '" aria-label="' + (speechExpanded ? "Collapse dialogue" : "Expand dialogue and hints") + '">⌃</button><div class="play-speech-copy" id="patch-response">' +
    renderSpeech() +
    '</div><div class="play-speech-actions">' +
    button("Say that again", "game-banter", "", "small-button") +
    '<button type="button" class="button small-button" data-game-action="hint" data-testid="ask-patch">A tiny nudge?</button>' +
    '</div><small class="play-tutorial-count">' +
    (active.id === "c01-01" && play.tutorialStage < 6
      ? "Getting our feet dirty · " + (play.tutorialStage + 1) + "/6"
      : "") +
    '</small></div></div><nav class="play-belt" aria-label="Your adventure kit"><button data-game-action="pack" data-testid="pack"><span aria-hidden="true">▣</span> Backpack</button><button data-game-action="gadget" data-testid="open-gadget"><span aria-hidden="true">⌁</span> ' +
    (step ? esc(toolNames[step.tool] || "Gadget") : "Beacon ready") +
    '</button><button data-action="journal"><span aria-hidden="true">▤</span> Notebook</button><button data-game-action="nova" data-testid="finish-encounter" ' +
    (!session.done.every(Boolean) ? "disabled" : "") +
    '><span aria-hidden="true">✦</span> ' +
    (session.completed ? "Next stop" : "Talk to Nova") +
    "</button></nav>" +
    renderGamePanel(step, index) +
    renderControlsGuide(controlsStep, {returning:active.id !== "c01-01" || session.completed || session.done.some(Boolean), practicing:gamePanel === "practice"}) +
    "</main>";
  worldCleanup = mountPlayWorld($("#game-world"), {
    motion: document.body.dataset.motion !== "off",
    onPosition: (position) => {
      const before = play.tutorialStage;
      movePlayPlayer(play, position.x, position.y);
      persistPlay();
      if (controlsStep !== null && controlsTutorial[controlsStep]?.gate === "move" && controlsOrigin && Math.hypot(position.x-controlsOrigin.x,position.y-controlsOrigin.y) >= 5) {
        advanceControlsGuide("move");
        queueMicrotask(render);
      }
      if (before !== play.tutorialStage) {
        chatter = null;
        updateSpeech();
        announce(playLine().text);
      }
    },
    onInteract: worldInteract,
  });
  const toolSurface = $(".tool-surface");
  if (toolSurface)
    toolsCleanup = mountPlayActivity($("#app"), {
      onInspect: (id) =>
        handleActivity(inspectItem(active, session, readyStep(), id)),
      onChoose: (id) =>
        handleActivity(
          submitActivity(active, session, readyStep(), { choice: id }),
        ),
      onClassify: (item, category) => {
        draftFor(readyStep()).classifications[item] = category;
        render();
      },
      onSequenceAdd: (id) => {
        const draft = draftFor(readyStep());
        if (!draft.order.includes(id)) draft.order.push(id);
        render();
      },
      onSequenceRemove: (id) => {
        const draft = draftFor(readyStep());
        draft.order = draft.order.filter((item) => item !== id);
        render();
      },
      onDraftField: (id, value) => {
        if (id === "__repair__") draftFor(readyStep()).text = value;
        else draftFor(readyStep()).fields[id] = value;
      },
      onSubmit: () =>
        handleActivity(
          submitActivity(active, session, readyStep(), draftFor(readyStep())),
        ),
    });
  const output = $("#terminal-output");
  if (output) output.scrollTop = output.scrollHeight;
  if (gamePanel)
    queueMicrotask(() => {
      if (
        document.activeElement === document.body ||
        document.activeElement === $("#main") ||
        !document.activeElement?.isConnected
      )
        $('[data-testid="close-game-panel"]')?.focus({ preventScroll: true });
    });
  if (controlsStep !== null && gamePanel !== "practice") {
    const target = $(controlsTutorial[controlsStep]?.target);
    target?.classList.add("onboarding-target");
    if (!gamePanel) queueMicrotask(() => {
      const beat = controlsTutorial[controlsStep];
      if (beat?.gate === "continue" || beat?.gate === "start-adventure") $('[data-testid="guide-next"]')?.focus({preventScroll:true});
      else $(".pw-scene")?.focus({preventScroll:true});
    });
  }
}
function renderGamePanel(step, index) {
  if (!gamePanel) return "";
  if (gamePanel === "practice") return renderGuidePractice(controlsPractice);
  if (gamePanel === "pack")
    return (
      '<aside id="game-panel" class="play-panel pack-panel" role="dialog" aria-modal="true" aria-label="Your backpack"><header><div><span class="eyebrow">THE RANGER’S OUTFITTER</span><h2>Your backpack</h2></div><button data-game-action="close-panel" data-testid="close-game-panel" aria-label="Close backpack">×</button></header><div class="pack-character-preview"><span aria-hidden="true">' + renderRanger(play.equipped.hat) + '</span><div><span class="eyebrow">YOUR RANGER</span><h3>' + esc(catalog.find(item => item.id === play.equipped.hat)?.label || "Ready for the trail") + '</h3><p>Try a new look. Patch insists the antenna improves biscuit reception.</p></div></div><div class="pack-grid">' +
      catalog
        .map((item) => {
          const owned = play.bag.includes(item.id),
            equipped = Object.values(play.equipped).includes(item.id);
          return (
            '<article class="pack-item ' +
            (equipped ? "equipped" : "") +
            '"><span class="pack-illustration" data-gear="' +
            esc(item.id) +
            '" aria-hidden="true">' +
            renderGearIcon(item.id) +
            "</span><h3>" +
            esc(item.label || item.name || item.id) +
            "</h3><p>" +
            esc(
              item.description || "A tiny piece of the valley for your pocket.",
            ) +
            '</p><button data-game-action="equip" data-item="' +
            esc(item.id) +
            '" data-testid="equip-' +
            esc(item.id) +
            '" ' +
            (item.slot === "kit" || (!owned && (item.award || item.cache))
              ? "disabled"
              : "") +
            ">" +
            (equipped
              ? "Wearing it"
              : item.slot === "kit"
                ? owned
                  ? "In your kit"
                  : "Find on the trail"
                : owned
                  ? "Equip"
                  : item.award
                    ? "Chapter souvenir"
                    : item.cache
                      ? "Find on the trail"
                      : "Get for " + item.price + " acorns") +
            "</button></article>"
          );
        })
        .join("") +
      "</div></aside>"
    );
  const phase = step?.phase || active.phase;
  return (
    '<aside id="game-panel" class="play-panel gadget-panel workbench" role="dialog" aria-modal="true" aria-label="Field gadget"><header><div><span class="eyebrow">FROM YOUR TOOLKIT</span><h2>' +
    esc(step?.activity?.heading || toolNames[activeTool] || "Field gadget") +
    '</h2></div><button data-game-action="close-panel" data-testid="close-game-panel" aria-label="Put gadget away">×</button></header>' +
    (step
      ? '<p class="gadget-cue">' +
        esc(getPlayScene(active, session).current?.prompt || step.prompt) +
        '</p><details class="gadget-how"><summary>Patch, how does this thing work?</summary><p>' +
        esc(step.teaching.plain) +
        "</p><p>" +
        esc(step.teaching.meaning) +
        "</p>" +
        (phase === "discover" && step.teaching.syntax
          ? "<code>" + esc(step.teaching.syntax) + "</code>"
          : "") +
        "</details>"
      : "<p>The trail is waiting. Nova is beside the beacon.</p>") +
    (lastResponse
      ? '<div class="gadget-reaction" role="status">' +
        renderPortrait("PATCH", "thinking") +
        "<p>" +
        esc(lastResponse) +
        "</p></div>"
      : "") +
    '<nav class="tool-tabs" aria-label="Gadgets">' +
    stageTools()
      .map((tool) =>
        button(
          esc(toolNames[tool] || tool),
          "tool",
          'data-tool="' +
            tool +
            '" aria-pressed="' +
            (activeTool === tool) +
            '"',
          "tool-tab " + (activeTool === tool ? "selected" : ""),
        ),
      )
      .join("") +
    '</nav><section class="tool-surface" tabindex="-1" data-tool="' +
    activeTool +
    '">' +
    renderTool(step, index) +
    "</section>" +
    (!step
      ? button(
          "Call Nova →",
          "reflect",
          'data-testid="finish-gadget"',
          "primary",
        )
      : "") +
    "</aside>"
  );
}
function worldInteract(id) {
  if (busy) return;
  if (controlsStep !== null && (id.startsWith("artifact:") || ["nova","beacon","exit"].includes(id))) {
    toast("We’ll get to the mission in a moment. " + (controlsTutorial[controlsStep]?.action || "Finish the controls rehearsal, or skip it to explore."));
    return;
  }
  if (controlsStep !== null && ["terminal","objective"].includes(id)) return openGameGadget();
  if (id === "map" || id === "exit") {
    if (id === "exit" && session.completed)
      return openMission(
        missions[Math.min(completeIds().length, missions.length - 1)].id,
      );
    if (id === "exit" && !session.completed) {
      chatter = {
        speaker: "PATCH",
        text: "I tried leaving dramatically. The problem followed me. Let’s get this place working first.",
      };
      render();
      return;
    }
    view = "chapter";
    render();
    return;
  }
  if (id === "inventory") {
    gamePanel = "pack";
    render();
    return;
  }
  if (id === "patch") {
    const result = interactPlay(play, active, "patch");
    advanceControlsGuide("meet-patch");
    chatter = {
      speaker: "PATCH",
      text:
        result.message ||
        getPlayScene(active, session).banter?.[0] ||
        "I have a plan. It contains at least one sensible step.",
    };
    if (active.id === "c01-01" && play.tutorialStage < 6) chatter = null;
    persistPlay();
    render();
    return;
  }
  if (id === "cache") {
    const result = interactPlay(play, active, "cache");
    if (result.ok) advanceControlsGuide("collect-cache");
    chatter = {
      speaker: "PATCH",
      text:
        result.message || "A spare part! Or an extremely ambitious biscuit.",
    };
    syncTutorial();
    persistPlay();
    sound();
    render();
    return;
  }
  if (id === "nova" || id === "beacon") {
    if (session.completed) {
      chatter = {
        speaker: "NOVA",
        text: "This stop is safely recorded. The next bit of the trail is yours.",
      };
      render();
      return;
    }
    if (session.done.every(Boolean)) return showReflection();
    if (active.id === "c01-01" && session.done[0]) {
      activeTool = stepNow().tool;
      gamePanel = "tools";
      chatter = {
        speaker: "NOVA",
        text: "The computer is alive! One thing before we go: this badge is for our training trail. Have a look at the note.",
      };
      render();
      return;
    }
    chatter = {
      speaker: "NOVA",
      text: "I’m by the beacon. Patch has the gadget you need—give that problem a poke first.",
    };
    render();
    return;
  }
  if (active.id === "c01-01" && readyStep() === 0 && id.startsWith("artifact:")) {
    const item = id.slice(9);
    const result = inspectItem(active, session, 0, item);
    if (result.ok) {
      const lines = {
        screen: "The screen was hiding in the fern. A bold camouflage strategy for something that glows.",
        linux: "Linux recovered. Patch calls it the brain. The penguin has declined to comment.",
        viewer: "One map viewer, rescued. It can open a route; it cannot carry your sandwiches.",
        route: "The route file is safe. It weighs no more after collecting. Patch finds this deeply suspicious.",
      };
      chatter = { speaker: "PATCH", text: lines[item] || "One useful piece, safely in the kit." };
      sound();
      persist();
      render();
    }
    return;
  }
  if (id === "terminal" || id === "objective" || id.startsWith("artifact:")) {
    if (controlsStep !== null) return openGameGadget();
    gamePanel = "tools";
    activeTool = id === "terminal" ? "terminal" : stepNow()?.tool || "terminal";
    chatter = null;
    render();
    if (id.startsWith("artifact:")) {
      const item = id.slice(9);
      $('[data-testid="inspect-' + CSS.escape(item) + '"]')?.focus({
        preventScroll: true,
      });
    }
  }
}
function renderBossEncounter() {
  if (active.phase !== "boss") return "";
  const done = session.done.filter(Boolean).length;
  return (
    '<section class="boss-encounter" aria-label="Chapter boss progress"><div class="boss-emblem" aria-hidden="true">✦</div><div class="boss-intel"><span class="eyebrow">CHAPTER SHOWDOWN / ' +
    esc(chapterOf(active).title) +
    "</span><h2>" +
    esc(active.title) +
    "</h2><p>" +
    esc(active.summary) +
    "</p><strong>" +
    done +
    " / " +
    active.steps.length +
    ' outcomes verified · Every clue matters</strong></div><ol class="boss-checkpoints">' +
    active.steps
      .map(
        (step, index) =>
          '<li class="' +
          (session.done[index]
            ? "secured"
            : index === readyStep()
              ? "next"
              : "") +
          '" ' +
          (index === readyStep() ? 'aria-current="step"' : "") +
          '><span aria-hidden="true">' +
          (session.done[index] ? "✓" : index + 1) +
          "</span><small>" +
          esc(step.title) +
          "</small></li>",
      )
      .join("") +
    "</ol></section>"
  );
}
function renderFeedback(step) {
  const finding = session.transcript
    .filter((line) => line.stepId === step.id && line.kind === "output")
    .at(-1)?.text;
  return (
    '<article class="discovery-feedback" role="status"><div>' +
    renderPortrait(step.feedback.speaker || "PATCH", "celebrate") +
    '<div><span class="eyebrow">A PIECE OF THE VALLEY MAKES SENSE</span><h3>' +
    esc(step.feedback.text) +
    "</h3><p>" +
    esc(step.feedback.why) +
    "</p></div></div>" +
    (finding
      ? '<div class="finding-evidence"><span class="eyebrow">WHAT YOU FOUND</span><pre>' +
        esc(finding.slice(0, 1800)) +
        "</pre></div>"
      : "") +
    renderAcceptedEvidence(step) +
    "<details><summary>Where this skill goes next</summary><p><strong>Professional words:</strong> " +
    esc(step.feedback.professional) +
    "</p><p>" +
    esc(step.feedback.when) +
    "</p></details></article>"
  );
}
function renderAcceptedEvidence(step) {
  const accepted = session.activity?.[active.steps.indexOf(step)]?.submission;
  if (!accepted || !step.activity) return "";
  const activity = step.activity,
    itemLabel = (id) =>
      activity.items?.find((item) => item.id === id)?.label || id;
  let lines = [];
  if (accepted.fields)
    lines = Object.entries(accepted.fields).map(
      ([id, value]) =>
        (activity.fields.find((field) => field.id === id)?.label || id) +
        ": " +
        value,
    );
  else if (accepted.choice)
    lines = [
      activity.choices.find((choice) => choice.id === accepted.choice)?.label ||
        accepted.choice,
    ];
  else if (accepted.order) lines = [accepted.order.map(itemLabel).join(" → ")];
  else if (accepted.classifications)
    lines = Object.entries(accepted.classifications).map(
      ([id, category]) =>
        itemLabel(id) +
        ": " +
        (activity.categories.find((item) => item.id === category)?.label ||
          category),
    );
  else if (accepted.text) lines = [accepted.text];
  return lines.length
    ? '<div class="finding-evidence"><span class="eyebrow">YOUR VERIFIED FIELDWORK</span><pre>' +
        esc(lines.join("\n").slice(0, 2600)) +
        "</pre></div>"
    : "";
}
function highlighted(text) {
  const previous = active.steps[session.done.lastIndexOf(true)];
  const needle = stepNow()?.evidence?.contains || previous?.evidence?.contains;
  if (!needle || typeof needle !== "string" || !text.includes(needle))
    return esc(text);
  return text
    .split(needle)
    .map(esc)
    .join("<mark>" + esc(needle) + "</mark>");
}
function displayedPath(path) {
  if (session?.shell?.platform !== "windows") return path;
  return String(path)
    .replace(/^\/home\/trainee(?=\/|$)/, "C:\\Users\\Trainee")
    .replace(/\//g, "\\");
}
function renderTerminal() {
  return (
    '<div class="terminal-frame"><div class="terminal-title"><span><i></i><i></i><i></i></span><strong>' +
    (activeTool === "windows"
      ? "RANGER WORKSTATION"
      : "PATCH’S FIELD TERMINAL") +
    '</strong><span>Training world</span></div><div id="terminal-output" class="terminal-output" role="log" aria-live="off" aria-label="Terminal output. New results are announced separately.">' +
    (session.transcript || []).slice(-35).map(renderTerminalLine).join("") +
    '</div><form id="terminal-form" autocomplete="off"><label for="terminal-input">' +
    esc(
      (session.shell.platform === "windows" ? "PS " : "") +
        displayedPath(session.shell.cwd || "/home/trainee"),
    ) +
    " <span>" +
    (session.shell.platform === "windows" ? "&gt;" : "$") +
    '</span></label><div class="command-entry"><textarea id="terminal-input" rows="1" data-testid="terminal-input" aria-label="Type a command. Enter runs it; Shift and Enter adds a line." placeholder="Your next move…" spellcheck="false" autocapitalize="off" autocomplete="off" ' +
    (busy ? "disabled" : "") +
    '></textarea><button class="run-button" data-testid="run-command" type="submit" ' +
    (busy ? "disabled" : "") +
    '>Run ↵</button></div></form><div class="typing-tools" role="group" aria-label="Command editing tools">' +
    button("↑ Previous", "typing", 'data-key="ArrowUp"') +
    button("↓ Next", "typing", 'data-key="ArrowDown"') +
    button("⇥ Complete", "typing", 'data-key="Tab"') +
    "</div></div>"
  );
}
function renderTerminalLine(line) {
  if (line.kind === "feedback") {
    const step = active.steps.find((item) => item.id === line.stepId);
    const verified =
      step &&
      session.done[active.steps.indexOf(step)] &&
      line.text ===
        (step.feedback.speaker || "NOVA") + ": " + step.feedback.text;
    const speaker = verified ? step.feedback.speaker : "PATCH";
    return (
      '<article class="field-transmission ' +
      (verified ? "verified" : "coaching") +
      '">' +
      renderPortrait(speaker, verified ? "celebrate" : "thinking") +
      '<div><span class="eyebrow">' +
      esc(speaker) +
      " / " +
      (verified ? "CLUE VERIFIED" : "FIELD CHANNEL") +
      "</span><p>" +
      esc(verified ? step.feedback.text : line.text) +
      "</p>" +
      (verified
        ? "<details><summary>Why this result matters</summary><p>" +
          esc(step.feedback.why) +
          "</p><p>" +
          esc(step.feedback.professional) +
          "</p></details>"
        : "") +
      "</div></article>"
    );
  }
  return (
    '<div class="terminal-line ' +
    esc(line.kind) +
    '">' +
    highlighted(line.text) +
    "</div>"
  );
}
function renderExplorer() {
  const cwd = session.shell.cwd || "/home/trainee",
    directories = session.shell.directories || [],
    files = Object.keys(session.shell.files || {});
  const prefix = cwd === "/" ? "/" : cwd + "/";
  const children = [
    ...directories
      .filter(
        (path) =>
          path !== cwd &&
          path.startsWith(prefix) &&
          !path.slice(prefix.length).includes("/"),
      )
      .map((path) => ({ path, folder: true })),
    ...files
      .filter(
        (path) =>
          path.startsWith(prefix) && !path.slice(prefix.length).includes("/"),
      )
      .map((path) => ({ path, folder: false })),
  ];
  return (
    '<div class="explorer-toolbar">' +
    button(
      "↑ Parent folder",
      "explorer",
      'data-path="' +
        esc(cwd.split("/").slice(0, -1).join("/") || "/") +
        '" data-folder="true"',
      "small-button",
    ) +
    "<code>" +
    esc(displayedPath(cwd)) +
    '</code></div><p class="tool-instruction">Open a folder to look inside. Opening a text file reads its contents in your field terminal.</p><div class="file-grid">' +
    children
      .map((item) =>
        button(
          '<span aria-hidden="true">' +
            (item.folder ? "▣" : "▤") +
            "</span><strong>" +
            esc(item.path.slice(prefix.length)) +
            "</strong><small>" +
            (item.folder ? "Folder" : "Text file") +
            "</small>",
          "explorer",
          'data-path="' +
            esc(item.path) +
            '" data-folder="' +
            item.folder +
            '"',
          "file-tile",
        ),
      )
      .join("") +
    (children.length
      ? ""
      : "<p>This folder is empty. A path describes where you are, not where every file must live.</p>") +
    "</div>"
  );
}
function renderTool(step, index) {
  if (activeTool === "explorer")
    return step?.tool === "explorer" && step.activity
      ? renderActivity(step, index)
      : renderExplorer();
  if (activeTool === "terminal") return renderTerminal();
  if (activeTool === "script")
    return (
      (step?.activity ? renderActivity(step, index) : renderScriptEditor()) +
      renderTerminal()
    );
  if (step?.tool === activeTool && step.activity)
    return renderActivity(step, index);
  if (step?.tool === activeTool && step.check.type !== "activity")
    return renderTerminal();
  if (activeTool === "windows")
    return (
      '<div class="workstation-bar"><span>⊞ RANGER PC</span><span>PowerShell</span></div>' +
      renderTerminal()
    );
  const available = active.steps.find(
    (item, i) => item.tool === activeTool && i === index,
  );
  return (
    '<div class="tool-idle">' +
    renderPortrait(activeTool === "network" ? "TESSA" : "OWL") +
    "<h3>" +
    esc(toolNames[activeTool] || "Field tool") +
    "</h3><p>" +
    esc(
      available?.prompt ||
        "This part of your kit will come into play when the next clue calls for it. Your terminal and file explorer are always available.",
    ) +
    "</p></div>"
  );
}
function draftFor(index) {
  const key = active.id + ":" + (active.reviewVariant || 0) + ":" + index;
  if (!drafts.has(key))
    drafts.set(key, {
      order: [],
      classifications: {},
      fields: {},
      text: active.steps[index]?.activity?.initial || "",
    });
  return drafts.get(key);
}
function renderActivity(step, index) {
  return renderPlayActivity(step, index, {
    draft: draftFor(index),
    inspected: session.activity?.[index]?.inspected || [],
    lastResponse,
    mission: active,
  });
}
function renderScriptEditor() {
  const scripts = Object.keys(session.shell.files).filter((path) =>
    /\.(sh|ps1)$/.test(path),
  );
  if (!scripts.length)
    return '<p class="tool-instruction">Create your script in the terminal, then return here to inspect it.</p>';
  const draft = draftFor(readyStep()),
    path = draft.scriptPath || scripts[0];
  return (
    '<div class="script-workshop"><label>Script file<select id="script-path">' +
    scripts
      .map(
        (file) =>
          '<option value="' +
          esc(file) +
          '" ' +
          (file === path ? "selected" : "") +
          ">" +
          esc(file) +
          "</option>",
      )
      .join("") +
    '</select></label><label>Read the script before running it<textarea id="script-editor" class="code-editor" rows="9" spellcheck="false">' +
    esc(draft.scriptText ?? session.shell.files[path].content) +
    '</textarea></label><div class="script-actions">' +
    button("Save this revision", "save-script", "", "secondary") +
    button("Run in the training shell", "run-script", "", "primary") +
    "</div></div>"
  );
}
function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}
async function command(raw, focus = true) {
  if (!active || busy || !raw.trim()) return;
  busy = true;
  try {
    session.started = true;
    const before = readyStep(),
      result = await runCommand(active, session, raw);
    lastResponse = result.error
      ? errorGuidance(raw, result.output)
      : result.reason || "";
    persist();
    if (result.completedStep !== undefined || readyStep() > before) {
      sound();
      activeTool = stepNow()?.tool || activeTool;
      announce(
        active.steps[before].feedback.text +
          " " +
          (stepNow()?.title || "Every clue is checked."),
      );
    } else announce((result.output || lastResponse).slice(0, 1800));
    render();
    if (result.completedStep !== undefined || readyStep() > before)
      showStepBeat(before);
  } catch (error) {
    toast(error.message);
    render();
  } finally {
    busy = false;
    if ($("#terminal-input")) $("#terminal-input").disabled = false;
    if ($(".run-button")) $(".run-button").disabled = false;
    if (focus && !dialog.open && $("#terminal-input")) {
      $("#terminal-input").focus({ preventScroll: true });
      revealInput();
    }
  }
}
function errorGuidance(raw, output = "") {
  if (/^ss\s/.test(raw) && /I/.test(raw))
    return "Patch: That flag looks like a capital I. Listening sockets use a lowercase l. The terminal distinguishes the two; check the command’s letters before changing the investigation.";
  if (/no such|not found|cannot find/i.test(output))
    return "Patch: A relative path starts from the folder on your prompt. Check where you are, list what is there, and follow the path you actually discovered. A missing path is a clue to navigation, not a lost mission.";
  return "Patch: Read the message and change one thing. Mistakes leave our evidence in place, and I can help you work out what the tool expected.";
}
function revealInput(input = $("#terminal-input")) {
  if (!input || innerWidth > 1000 || dialog.open) return;
  const viewport = visualViewport,
    top = (viewport?.offsetTop || 0) + 14;
  let bottom =
    (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 14;
  const dock = $(".field-dock");
  if (dock?.getClientRects().length)
    bottom = Math.min(bottom, dock.getBoundingClientRect().top - 12);
  const box = input.getBoundingClientRect();
  const panel = input.closest("#game-panel");
  if (panel) {
    panel.style.maxHeight =
      Math.max(160, (viewport?.height || innerHeight) - 18) + "px";
    if (box.bottom > bottom) panel.scrollTop += box.bottom - bottom + 18;
    else if (box.top < top) panel.scrollTop -= top - box.top + 18;
    return;
  }
  if (box.top < top || box.bottom > bottom)
    window.scrollTo({
      top: Math.max(0, scrollY + box.top + box.height / 2 - (top + bottom) / 2),
      behavior: "instant",
    });
}
let historyIndex = -1;
function typeKey(key) {
  const input = $("#terminal-input");
  if (!input || busy) return;
  const history = session.shell.history || [];
  if (historyIndex < 0) historyIndex = history.length;
  if (key === "ArrowUp" || key === "ArrowDown") {
    historyIndex = Math.max(
      0,
      Math.min(history.length, historyIndex + (key === "ArrowUp" ? -1 : 1)),
    );
    input.value = history[historyIndex] || "";
  }
  if (key === "Tab") {
    const parts = input.value.split(/\s+/),
      last = parts.at(-1);
    const commands = [
      "pwd",
      "whoami",
      "ls",
      "cd",
      "cat",
      "less",
      "head",
      "tail",
      "find",
      "grep",
      "sort",
      "uniq",
      "wc",
      "mkdir",
      "touch",
      "cp",
      "mv",
      "rm",
      "rmdir",
      "chmod",
      "chown",
      "chgrp",
      "id",
      "man",
      "help",
      "history",
      "clear",
      "ss",
      "ps",
      "top",
      "kill",
      "systemctl",
      "df",
      "du",
      "journalctl",
      "nslookup",
      "ping",
      "traceroute",
      "ip",
      "curl",
      "sha256sum",
      "base64",
      "echo",
      "awk",
      "cut",
      "sed",
      "tee",
      "diff",
      "bash",
      "Get-Location",
      "Get-ChildItem",
      "Set-Location",
      "Get-Content",
      "Get-Process",
      "Get-Service",
      "Get-WinEvent",
    ];
    const paths = [
      ...Object.keys(session.shell.files),
      ...session.shell.directories,
    ].map((path) =>
      path.startsWith(session.shell.cwd + "/")
        ? path.slice(session.shell.cwd.length + 1)
        : path,
    );
    const found = [
      ...new Set(
        (parts.length === 1 ? commands : paths).filter(
          (value) => last && value.startsWith(last),
        ),
      ),
    ];
    if (found.length === 1) {
      parts[parts.length - 1] = found[0];
      input.value = parts.join(" ");
    } else if (found.length > 1)
      toast("Several matches: " + found.slice(0, 6).join(", "));
  }
  input.focus({ preventScroll: true });
  revealInput();
}
function openDialog(html, kind = "") {
  if (!dialog.open) dialogOrigin = document.activeElement;
  $("#dialog-content").innerHTML = html;
  dialog.dataset.kind = kind;
  if (!dialog.open) dialog.showModal();
  $(".dialog-close").focus({ preventScroll: true });
}
function closeDialog() {
  const kind = dialog.dataset.kind;
  dialog.close();
  dialog.removeAttribute("data-kind");
  if (kind === "settings" && view === "mission") render();
  if (
    dialogOrigin?.isConnected &&
    !dialog.contains(dialogOrigin) &&
    ![document.body, document.documentElement].includes(dialogOrigin)
  )
    dialogOrigin.focus({ preventScroll: true });
  else if (view === "mission") $("#main")?.focus({ preventScroll: true });
}
function showStory(frames = active?.story, mode = "intro", after = null) {
  if (!frames?.length) return after?.();
  storyFrame = 0;
  storyFrames = frames;
  storyMode = mode;
  afterStory = after;
  renderStory();
}
function renderStory() {
  const frame = storyFrames[storyFrame],
    last = storyFrame === storyFrames.length - 1;
  openDialog(
    '<div class="story-art">' +
      renderScene(active, session, chapterOf(active)) +
      '</div><div class="story-content"><span class="eyebrow">' +
      esc(frame.speaker) +
      " · " +
      (storyMode === "ending"
        ? "AFTER THE SIGNAL"
        : storyMode === "beat"
          ? "LIVE FROM THE VALLEY"
          : "TRANSMISSION") +
      " " +
      (storyFrame + 1) +
      " / " +
      storyFrames.length +
      '</span><div class="speaker-line">' +
      renderPortrait(
        frame.speaker,
        storyMode === "ending" ? "celebrate" : "idle",
      ) +
      '<h2 id="dialog-title">' +
      esc(frame.title) +
      '</h2></div><p tabindex="0">' +
      esc(frame.text) +
      '</p><div class="story-controls">' +
      button("Skip story", "story-skip", "", "text-button") +
      button(
        last
          ? storyMode === "ending"
            ? "See your field report →"
            : storyMode === "beat"
              ? "Follow the clue →"
              : "Enter the scene →"
          : "Continue story →",
        "story-next",
        'data-testid="story-next"',
        "primary",
      ) +
      "</div></div>",
    "story",
  );
  dialog.dataset.storyMode = storyMode;
}
function endStory() {
  const mode = storyMode,
    after = afterStory;
  afterStory = null;
  closeDialog();
  if (after) return after();
  if (mode === "intro" && !session.started && currentIndex() === 0) {
    session.started = true;
    persist();
  } else {
    session.started = true;
    persist();
  }
}
function dismissDialog() {
  if (dialog.dataset.kind === "story") return endStory();
  if (dialog.dataset.kind === "tour") return endTour();
  closeDialog();
}
function endTour() {
  if (session) {
    session.started = true;
    persist();
  }
  closeDialog();
  if (view === "mission")
    $(".workbench")?.scrollIntoView({ block: "start", behavior: "instant" });
}
function showStepBeat(index) {
  lastResponse = "";
  const frames = (active.beats || []).filter(
    (frame) => frame.after === active.steps[index]?.id,
  );
  const frame = frames[0],
    playful = getPlayScene(active, session).steps?.[active.steps[index]?.id];
  if (playful?.success) {
    chatter = {
      speaker: active.steps[index].feedback.speaker || "PATCH",
      text: playful.success,
    };
    gamePanel = null;
    syncTutorial();
    persistPlay();
    render();
    announce(chatter.text);
    return;
  }
  chatter = frame
    ? { speaker: frame.speaker, text: frame.text }
    : {
        speaker: active.steps[index].feedback.speaker,
        text: active.steps[index].feedback.text,
      };
  gamePanel = null;
  syncTutorial();
  persistPlay();
  render();
  announce(chatter.text);
}
function showTour() {
  closeDialog();
  if (!active) {
    openMission(profile.currentMission || missions[0].id);
  }
  view = "mission";
  beginControlsGuide();
}
function showReflection() {
  quizFeedback = null;
  if (!session.done.every(Boolean))
    return toast("Collect the evidence before checking your conclusions.");
  quizIndex = active.questions.findIndex(
    (question, i) => session.answers[i] !== question.answer,
  );
  if (quizIndex < 0) quizIndex = active.questions.length;
  renderReflection();
}
function renderReflection(message = "") {
  if (quizIndex < active.questions.length) {
    const question = active.questions[quizIndex];
    openDialog(
      '<div class="radio-conversation">' +
        renderPortrait("PATCH", "curious") +
        '<span class="eyebrow">PATCH HAS A THEORY · ' +
        (quizIndex + 1) +
        " / " +
        active.questions.length +
        '</span><h2 id="dialog-title">' +
        esc(
          active.id === "c01-01"
            ? quizIndex === 0
              ? "I closed the map app. Please tell me I didn’t accidentally eat our route. What happened?"
              : "That public mountain website looks broken too. Can I use our training badge to poke it?"
            : question.question,
        ) +
        '</h2><p>Talk it through with your field buddy.</p><div class="knowledge-options">' +
        question.options
          .map((option, i) =>
            button(
              esc(option),
              "answer",
              'data-answer="' +
                i +
                '" data-testid="answer-' +
                i +
                '" ' +
                (quizFeedback?.correct ? "disabled" : ""),
              "choice-button",
            ),
          )
          .join("") +
        "</div>" +
        (quizFeedback
          ? '<p class="question-feedback" role="status">' +
            esc(quizFeedback.explanation) +
            "</p>"
          : "") +
        (quizFeedback?.correct
          ? button(
              quizIndex === active.questions.length - 1
                ? "Ready for the trail →"
                : "And one more thing… →",
              "question-next",
              'data-testid="question-next"',
              "primary",
            )
          : ""),
      "reflection",
    );
  } else {
    openDialog(
      '<span class="eyebrow">THE TRAIL IS OPEN</span>' +
        renderPortrait("PATCH", "celebrate") +
        '<h2 id="dialog-title">Right. Boots on. Let’s go.</h2><p>' +
        esc(
          getPlayScene(active, session).win ||
            "A little more of the valley is working. Patch is already pretending this was the plan.",
        ) +
        '</p><details><summary>Leave yourself a pocket note (optional)</summary><textarea id="reflection" rows="2" placeholder="Something you want to remember.">' +
        esc(session.reflection || "") +
        "</textarea></details>" +
        button(
          "Light the beacon →",
          "complete",
          'data-testid="complete-encounter"',
          "primary",
        ),
      "reflection",
    );
  }
}
function finish() {
  if (!canComplete(active, session))
    return toast("Check each practical task and each question first.");
  const record = completeMission(
    active,
    session,
    $("#reflection")?.value || "",
  );
  if (reviewing) profile.practiceSessions[active.id].record = record;
  else {
    profile.records[active.id] = record;
    if (!completeIds().includes(active.id)) profile.completed.push(active.id);
    const next = missions[Math.min(completeIds().length, missions.length - 1)];
    profile.currentMission = next.id;
  }
  syncPlayRewards(play, profile);
  persist();
  sound();
  gamePanel = null;
  render();
  if (active.ending?.length && !reviewing)
    showStory(active.ending, "ending", () => showCompletion(record));
  else showCompletion(record);
}
function showCompletion(record) {
  const final = completeIds().length === 104 && !reviewing;
  openDialog(
    '<div class="play-celebration"><span class="eyebrow">' +
      (final
        ? "THE VALLEY IS TALKING AGAIN"
        : active.phase === "boss"
          ? "BOSS CLEARED · NEW SOUVENIR"
          : "BEACON LIT") +
      "</span>" +
      renderPortrait(final ? "NOVA" : "PATCH", "celebrate") +
      '<h2 id="dialog-title">' +
      esc(
        final
          ? "You brought the signal home."
          : getPlayScene(active, session).title || active.title,
      ) +
      "</h2><p>" +
      esc(getPlayScene(active, session).win || active.callback) +
      '</p><div class="loot-reward"><span>✦</span><strong>+' +
      (reviewing ? 0 : active.phase === "boss" ? 40 : 8) +
      " acorns</strong><small>" +
      (reviewing
        ? "Return trip · your story rewards stay separate"
        : "In your backpack. Spend them on spectacularly unnecessary gear.") +
      '</small></div><div class="completion-actions">' +
      button(
        final
          ? "Back to the valley"
          : reviewing
            ? "Back to this chapter"
            : "Onwards, ranger →",
        final ? "home" : reviewing ? "chapter" : "next",
        'data-testid="next-encounter"',
        "primary",
      ) +
      button("Look in my backpack", "pack-after-win", "", "secondary") +
      "</div></div>",
    "completion",
  );
}
function showJournal() {
  const tree = skillTree();
  const rows = tree
    .map((skill) => {
      const records = missions
        .filter(
          (m) => m.skills.includes(skill.id) || m.reinforces.includes(skill.id),
        )
        .map((m) => profile.records[m.id])
        .filter(Boolean);
      const independent = records.some((record) => record.independent);
      const introduced = records.length > 0;
      const next = skill.practice.find((id) => !completeIds().includes(id));
      return (
        '<article class="journal-skill" data-journal-search="' +
        esc(skill.title + " " + skill.office.join(" ")) +
        '"><div><h3>' +
        esc(skill.title) +
        '</h3><span class="mastery-label ' +
        (independent ? "independent" : "") +
        '">' +
        (independent
          ? "Demonstrated independently"
          : introduced
            ? "Introduced · keep practising"
            : "Ahead on the trail") +
        "</span></div><p>" +
        esc(skill.office[0] || "A skill to carry into future investigations.") +
        "</p><small>" +
        records.length +
        " distinct encounters recorded" +
        (next ? " · More practice ahead" : "") +
        "</small></article>"
      );
    })
    .join("");
  const references = missions
    .filter((m) => completeIds().includes(m.id))
    .map(
      (m) =>
        '<details class="journal-reference" data-journal-search="' +
        esc(
          m.title +
            " " +
            m.steps
              .map((step) => step.teaching.syntax + " " + step.teaching.plain)
              .join(" "),
        ) +
        '"><summary>' +
        esc(m.title) +
        "</summary><p>" +
        esc(m.briefing.professional) +
        "</p>" +
        m.steps
          .map(
            (step) =>
              "<article><h4>" +
              esc(step.title) +
              "</h4><p>" +
              esc(step.teaching.plain) +
              "</p><code>" +
              esc(step.teaching.syntax) +
              "</code><p>" +
              esc(step.teaching.meaning) +
              "</p><p><strong>When it helps:</strong> " +
              esc(step.teaching.when) +
              "</p></article>",
          )
          .join("") +
        "</details>",
    )
    .join("");
  const notes = Object.entries(profile.records)
    .filter(([, record]) => record.reflection)
    .map(
      ([id, record]) =>
        '<article class="journal-note"><h3>' +
        esc(missionById.get(id)?.title) +
        "</h3><p>" +
        esc(record.reflection) +
        "</p>" +
        button(
          "Return-trip case",
          "review",
          'data-mission="' + id + '"',
          "small-button",
        ) +
        "</article>",
    )
    .join("");
  const revisits = missions
    .filter((m) => completeIds().includes(m.id) && m.phase !== "discover")
    .filter(
      (m) =>
        !profile.records[m.id]?.independent ||
        m.chapter + 2 <= Math.max(chapterId, 1),
    )
    .slice(-6);
  openDialog(
    '<span class="eyebrow">YOUR FIELD JOURNAL</span><h2 id="dialog-title">What stayed with you?</h2><p>Story progress, knowledge checks, and independent demonstrations tell different parts of your learning story. These records describe what you did in this training world.</p><h3>Return to a skill</h3><p>Try a fresh path before looking at the old solution. Return trips save separately from the story.</p><div class="review-list">' +
      (revisits.length
        ? revisits
            .map((m) =>
              button(
                esc(m.title) + " ↻",
                "review",
                'data-mission="' + m.id + '"',
                "review-link",
              ),
            )
            .join("")
        : "<p>Independent practice will appear as you clear the trail.</p>") +
      '</div><label class="journal-search-label">Find a skill or command<input id="journal-search" type="search" placeholder="Try grep, permissions, DNS…"></label><div class="journal-grid">' +
      rows +
      "</div><h3>Tools you have used</h3>" +
      (references ||
        "<p>Your command explanations and examples appear here as you clear encounters.</p>") +
      "<h3>Your own words</h3>" +
      (notes || "<p>Your reflections will live here after each encounter.</p>"),
    "journal",
  );
}
function showSettings() {
  openDialog(
    '<span class="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="dialog-title">Your valley. Your pace.</h2><div class="settings-fields"><label><input id="setting-motion" type="checkbox" ' +
      (profile.settings.motion ? "checked" : "") +
      '> World animation<small>Your device’s reduced-motion preference takes priority.</small></label><label><input id="setting-sound" type="checkbox" ' +
      (profile.settings.sound ? "checked" : "") +
      '> Game sounds<small>Short, gentle tones. Off until you choose them.</small></label><label><input id="setting-large" type="checkbox" ' +
      (profile.settings.textSize === "large" ? "checked" : "") +
      '> Larger reading text<small>Make instructions, evidence, and dialogue easier to read.</small></label><label><input id="setting-timer" type="checkbox" ' +
      (profile.settings.timer ? "checked" : "") +
      '> Optional practice clock<small>A personal reference. It never blocks your learning.</small></label></div><h3>Keep your journey safe</h3><p>Saved on this browser. Export your Living Valley journey before changing devices. The original expedition keeps its own saves.</p><div class="settings-actions">' +
      button(
        "↓ Export journey",
        "export",
        'data-testid="export-save"',
        "secondary",
      ) +
      button(
        "↑ Import journey",
        "import",
        'data-testid="import-save"',
        "secondary",
      ) +
      '</div><input id="import-file" type="file" accept=".json,application/json" hidden><p id="settings-feedback" role="status"></p><details class="reset-area"><summary>Start a fresh Living Valley journey</summary><p>Export a backup first if you want to keep this journey.</p>' +
      button("Reset this journey", "reset", "", "danger") +
      "</details>",
    "settings",
  );
}
function exportSave() {
  try {
    persist();
    const journey = JSON.parse(storage.export(profile));
    const blob = new Blob(
        [
          JSON.stringify({
            format: "terminal-trails-adventure",
            version: 1,
            journey,
            play: validatePlayState(play, profile),
          }),
        ],
        {
          type: "application/json",
        },
      ),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "terminal-trails-living-valley.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Your Living Valley journey has been exported.");
  } catch (error) {
    toast(error.message);
  }
}
async function importFile(file) {
  if (!file) return;
  if (file.size > MAX_SAVE_BYTES + MAX_PLAY_BYTES + 1024)
    return toast("This backup is too large.");
  try {
    const parsed = JSON.parse(await file.text());
    const envelope = parsed?.format === "terminal-trails-adventure";
    if (
      envelope &&
      (parsed.version !== 1 ||
        Object.keys(parsed).some(
          (key) => !["format", "version", "journey", "play"].includes(key),
        ))
    )
      throw new Error("This adventure backup has an unsupported format.");
    const candidate = storage.import(
      JSON.stringify(envelope ? parsed.journey : parsed),
    );
    const candidatePlay = envelope
      ? validatePlayState(parsed.play, candidate)
      : createPlayState(candidate);
    openDialog(
      '<span class="eyebrow">CHECK YOUR BACKUP</span><h2 id="dialog-title">Bring this journey back?</h2><p>' +
        candidate.completed.length +
        ' of 104 encounters. Importing replaces this Living Valley journey in this browser.</p><div class="settings-actions">' +
        button("Keep my current journey", "settings", "", "secondary") +
        button(
          "Import this journey",
          "confirm-import",
          'data-testid="confirm-import"',
          "primary",
        ) +
        "</div>",
      "import",
    );
    importFile.pending = candidate;
    importFile.pendingPlay = candidatePlay;
  } catch (error) {
    toast(error.message);
  }
}
function handleActivity(result) {
  session.started = true;
  lastResponse =
    result.reason ||
    result.feedback ||
    (result.ok
      ? "A useful observation. Follow what it tells you."
      : "Look at the evidence and try one change.");
  if (typeof lastResponse !== "string") lastResponse = lastResponse.text || "";
  if (result.completedStep !== undefined) {
    syncTutorial();
    sound();
    activeTool = stepNow()?.tool || activeTool;
    announce(
      active.steps[result.completedStep].feedback.text +
        " " +
        (stepNow()?.title || "Every clue is checked."),
    );
  } else announce(lastResponse);
  if (result.completedStep === undefined && !result.ok) {
    chatter = {
      speaker: "PATCH",
      text:
        (getPlayScene(active, session).wrong?.[
          Math.floor(
            Math.random() * (getPlayScene(active, session).wrong?.length || 1),
          )
        ] ||
          "Good experiment. The machine disagrees. Let’s try a different piece.") +
        " " +
        lastResponse,
    };
  }
  persist();
  render();
  if (result.completedStep !== undefined) showStepBeat(result.completedStep);
}
document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-guide-action]");
  if (!control || control.disabled || busy) return;
  const action = control.dataset.guideAction;
  if (action === "skip") {
    finishControlsGuide();
    render();
    $(".pw-scene")?.focus({preventScroll:true});
  } else if (action === "next") {
    const gate = controlsTutorial[controlsStep]?.gate;
    if (gate === "continue" || gate === "start-adventure") {
      advanceControlsGuide(gate);
      render();
    }
  } else if (action === "pack") {
    gamePanel = "pack";
    render();
  } else if (action === "practice") openGameGadget();
  else if (action === "practice-done" && controlsPractice.seen.includes("help") && controlsPractice.seen.includes("pwd")) closeGamePanel();
});
document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-game-action]");
  if (!control || control.disabled || busy) return;
  const action = control.dataset.gameAction;
  if (action === "close-panel") {
    closeGamePanel();
  }
  if (action === "speech-expand") {
    speechExpanded = !speechExpanded;
    const speech = $(".play-speech");
    speech.dataset.expanded = String(speechExpanded);
    control.setAttribute("aria-expanded", String(speechExpanded));
    control.setAttribute("aria-label", speechExpanded ? "Collapse dialogue" : "Expand dialogue and hints");
  }
  if (action === "fullscreen") {
    if (!document.fullscreenEnabled) return toast("The game already fills this window. Use your browser’s full-screen control to hide its toolbar.");
    const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    change.catch(() => toast("Your browser keeps the game in its full-window view. You can hide its toolbar from the browser menu."));
  }
  if (action === "pack") {
    gamePanel = "pack";
    render();
  }
  if (action === "equip") {
    const result = equipPlayItem(play, control.dataset.item);
    if (result.ok && catalog.find(item => item.id === control.dataset.item)?.slot === "hat" && advanceControlsGuide("equip-hat")) gamePanel = null;
    chatter = {
      speaker: "PATCH",
      text:
        result.message || "That is a spectacularly unnecessary hat. I approve.",
    };
    syncTutorial();
    persistPlay();
    render();
  }
  if (action === "gadget") {
    openGameGadget();
  }
  if (action === "nova") worldInteract(session.completed ? "exit" : "nova");
  if (action === "skip-guide") {
    play.tutorialStage=6;chatter={speaker:'PATCH',text:'Freestyle it is. Tap anything interesting; I will be right here if the hat starts receiving weather reports.'};persistPlay();render();
  }
  if (action === "hint" && stepNow()) {
    const hint = requestHint(active, session, readyStep());
    lastResponse = hint.text;
    chatter = { speaker: "PATCH", text: hint.text };
    persist();
    render();
  }
});
document.addEventListener("click", async (event) => {
  const control = event.target.closest("button");
  if (!control || control.disabled) return;
  if (control.dataset.chapter) {
    chapterId = Number(control.dataset.chapter);
    view = "chapter";
    closeDialog();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  if (control.dataset.hotspot) {
    const spot = control.dataset.hotspot;
    if (spot === "journal") return showJournal();
    if (spot === "briefing") return showStory();
    $(spot === "patch" ? "#patch" : ".workbench")?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
    return;
  }
  const action = control.dataset.action;
  if (busy && action !== "close-dialog") return;
  if (action === "home") {
    gamePanel = null;
    if (active) persist();
    closeDialog();
    view = "home";
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  if (action === "start") {
    closeDialog();
    openMission(profile.currentMission || missions[unlockedIndex()].id);
  }
  if (action === "chapter") {
    closeDialog();
    view = "chapter";
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  if (action === "mission" || action === "review") {
    closeDialog();
    openMission(control.dataset.mission, action === "review");
  }
  if (action === "next") {
    closeDialog();
    openMission(
      missions[Math.min(completeIds().length, missions.length - 1)].id,
    );
  }
  if (action === "game-banter") {
    const scene=getPlayScene(active,session);
    if(introIndex<(scene.intro?.length||0))chatter=scene.intro[introIndex++];
    else chatter={speaker:'PATCH',text:scene.banter[Math.floor(Math.random()*scene.banter.length)]};
    render();
  }
  if (action === "pack-after-win") {
    closeDialog();
    gamePanel = "pack";
    render();
  }
  if (action === "journal") showJournal();
  if (action === "settings") showSettings();
  if (action === "close-dialog") dismissDialog();
  if (action === "story") showStory();
  if (action === "story-next") {
    if (++storyFrame >= storyFrames.length) endStory();
    else renderStory();
  }
  if (action === "story-skip") endStory();
  if (action === "how-to" || action === "tour") showTour();
  if (action === "tour-next") showTour();
  if (action === "tour-end") endTour();
  if (action === "tool") {
    activeTool = control.dataset.tool;
    render();
  }
  if (action === "hint" && stepNow()) {
    const hint = requestHint(active, session, readyStep());
    lastResponse = hint.text;
    persist();
    render();
    $("#patch")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  if (action === "inspect")
    handleActivity(
      inspectItem(active, session, readyStep(), control.dataset.item),
    );
  if (action === "activity-choice")
    handleActivity(
      submitActivity(active, session, readyStep(), {
        choice: control.dataset.choice,
      }),
    );
  if (action === "sequence-add") {
    draftFor(readyStep()).order.push(control.dataset.item);
    render();
  }
  if (action === "sequence-remove") {
    const draft = draftFor(readyStep());
    draft.order = draft.order.filter((id) => id !== control.dataset.item);
    render();
  }
  if (action === "submit-activity")
    handleActivity(
      submitActivity(active, session, readyStep(), draftFor(readyStep())),
    );
  if (action === "explorer") {
    const folder = control.dataset.folder === "true";
    activeTool = folder ? "explorer" : "terminal";
    await command(
      (folder ? "cd " : "cat ") + shellQuote(control.dataset.path),
      false,
    );
  }
  if (action === "typing") typeKey(control.dataset.key);
  if (action === "save-script") {
    const path = $("#script-path").value,
      text = $("#script-editor").value;
    await command("echo " + shellQuote(text) + " > " + shellQuote(path), false);
  }
  if (action === "run-script") {
    const path = $("#script-path").value;
    await command("bash " + shellQuote(path), false);
  }
  if (action === "reflect") showReflection();
  if (action === "answer") {
    quizFeedback = answerQuestion(
      active,
      session,
      quizIndex,
      Number(control.dataset.answer),
    );
    persist();
    sound(quizFeedback.correct);
    renderReflection();
  }
  if (action === "question-next" && quizFeedback?.correct) {
    quizIndex++;
    quizFeedback = null;
    renderReflection();
  }
  if (action === "complete") finish();
  if (action === "export") exportSave();
  if (action === "import") $("#import-file").click();
  if (action === "confirm-import") {
    worldCleanup?.();
    worldCleanup = null;
    profile = importFile.pending;
    play = importFile.pendingPlay;
    playRecoveryRequired = false;
    clearControlsGuide();
    storage.write(profile);
    persistPlay();
    active = null;
    session = null;
    reviewing = false;
    view = "home";
    closeDialog();
    render();
    toast("Your Living Valley journey is restored.");
  }
  if (action === "reset")
    openDialog(
      '<h2 id="dialog-title">Start this journey again?</h2><p>This clears only the Living Valley journey in this browser.</p>' +
        button("Keep my journey", "settings", "", "secondary") +
        button("Start fresh", "confirm-reset", "", "danger"),
      "reset",
    );
  if (action === "confirm-reset") {
    worldCleanup?.();
    worldCleanup = null;
    profile = storage.reset();
    play = createPlayState(profile);
    playRecoveryRequired = false;
    clearControlsGuide();
    persistPlay();
    active = null;
    session = null;
    view = "home";
    closeDialog();
    render();
  }
  if (action === "jump") {
    $(control.dataset.region)?.scrollIntoView({
      block: "start",
      behavior: document.body.dataset.motion === "off" ? "instant" : "smooth",
    });
    if (control.dataset.region === ".workbench" && $("#terminal-input")) {
      $("#terminal-input").focus({ preventScroll: true });
      revealInput();
    }
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "guide-practice-form") {
    event.preventDefault();
    if (busy) return;
    const raw = $("#guide-practice-input").value;
    busy = true;
    runGuidePractice(controlsPractice, raw).then(() => {
      busy = false;
      render();
      $("#guide-practice-input")?.focus({preventScroll:true});
      const output = $("#guide-practice-output");
      if (output) output.scrollTop = output.scrollHeight;
      revealInput($("#guide-practice-input"));
    }).catch(() => {
      busy = false;
      toast("The practice gadget needs another try. Your mission is safe.");
    });
  }
  if (event.target.id === "terminal-form") {
    event.preventDefault();
    historyIndex = -1;
    command($("#terminal-input").value);
  }
});
document.addEventListener("keydown", (event) => {
  const pausedGuide = !dialog.open && !gamePanel && $('.play-onboarding[data-world-blocked="true"]');
  if (pausedGuide && event.key === "Tab") {
    const buttons = $$("button:not(:disabled)", pausedGuide);
    const first = buttons[0], last = buttons.at(-1);
    if (!pausedGuide.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus({preventScroll:true});
    }
  }
  if (gamePanel && !dialog.open) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeGamePanel();
      return;
    }
    if (event.key === "Tab") {
      const controls = $$(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        $("#game-panel"),
      ).filter((node) => node.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }
  }
  if (event.target.id === "guide-practice-input" && ["ArrowUp","ArrowDown"].includes(event.key)) {
    event.preventDefault();
    event.target.value = event.key === "ArrowUp" ? controlsPractice.shell.history.at(-1) || "" : "";
  }
  if (event.target.id === "terminal-input") {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      historyIndex = -1;
      command(event.target.value);
    } else if (
      ["ArrowUp", "ArrowDown", "Tab"].includes(event.key) &&
      (event.key === "Tab" || !event.target.value.includes("\n"))
    ) {
      event.preventDefault();
      typeKey(event.key);
    }
  }
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "terminal-input") {
    target.style.height = "auto";
    target.style.height = Math.min(180, target.scrollHeight) + "px";
  }
  if (target.id === "journal-search") {
    const query = target.value.toLocaleLowerCase();
    $$("[data-journal-search]").forEach(
      (card) =>
        (card.hidden = !card.dataset.journalSearch
          .toLocaleLowerCase()
          .includes(query)),
    );
    return;
  }
  if (!active) return;
  if (target.dataset.reportField)
    draftFor(readyStep()).fields[target.dataset.reportField] = target.value;
  if (target.hasAttribute("data-repair-text"))
    draftFor(readyStep()).text = target.value;
  if (target.id === "script-editor")
    draftFor(readyStep()).scriptText = target.value;
});
document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.category)
    draftFor(readyStep()).classifications[target.dataset.category] =
      target.value;
  if (target.id === "script-path") {
    draftFor(readyStep()).scriptPath = target.value;
    delete draftFor(readyStep()).scriptText;
    render();
  }
  if (target.id === "setting-motion") profile.settings.motion = target.checked;
  if (target.id === "setting-sound") {
    profile.settings.sound = target.checked;
    sound();
  }
  if (target.id === "setting-large")
    profile.settings.textSize = target.checked ? "large" : "normal";
  if (target.id === "setting-timer") profile.settings.timer = target.checked;
  if (target.id?.startsWith("setting-")) {
    persist();
    applySettings();
  }
  if (target.id === "import-file") importFile(target.files[0]);
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      dismissDialog();
  }
});
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  dismissDialog();
});
function revealActiveEditor() {
  const editor = document.activeElement;
  if (
    editor?.matches(
      "#terminal-input,#guide-practice-input,[data-report-field],#script-editor,[data-repair-text]",
    )
  )
    revealInput(editor);
}
window.addEventListener("resize", revealActiveEditor);
window.visualViewport?.addEventListener("resize", revealActiveEditor);
window.addEventListener("pagehide", () => {
  if (active) persist();
});
mediaMotion.addEventListener("change", applySettings);
let clockAt = performance.now();
setInterval(() => {
  const now = performance.now(),
    delta = Math.max(0, Math.min(2, (now - clockAt) / 1000));
  clockAt = now;
  if (
    view === "mission" &&
    session?.started &&
    !session.completed &&
    profile.settings.timer &&
    !document.hidden &&
    !dialog.open &&
    controlsStep === null
  ) {
    session.elapsed = (session.elapsed || 0) + delta;
    const label = $("#practice-clock");
    if (label) label.textContent = formatClock(session.elapsed);
    if (Math.floor(session.elapsed) % 10 === 0) persist();
  }
}, 1000);
document.addEventListener("visibilitychange", () => {
  clockAt = performance.now();
  if (document.hidden && session) persist();
});
function formatClock(value) {
  const seconds = Math.floor(value || 0);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}
applySettings();
render();
if (storage.warning) toast(storage.warning);

if (restoredPlay.error)
  toast(
    "Your older backpack is unreadable. Your learning progress is safe; this tab has a temporary backpack. Export it or explicitly start fresh to replace the damaged copy.",
  );
