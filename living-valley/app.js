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
  terminal: "Field terminal",
  explorer: "File explorer",
  network: "Network map",
  browser: "Browser & inbox",
  evidence: "Evidence board",
  windows: "Ranger workstation",
  script: "Script workshop",
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
let view = "home",
  chapterId = 1,
  active = null,
  session = null,
  activeTool = "terminal",
  busy = false,
  reviewing = false;
let storyFrame = 0,
  tourStep = 0,
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
  try {
    storage.write(profile);
  } catch (error) {
    toast(error.message);
  }
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
  persist();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (!session.started) showStory();
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
  const index = readyStep(),
    step = active.steps[index],
    count = session.done.filter(Boolean).length,
    chapter = chapterOf(active);
  const last = count ? active.steps[session.done.lastIndexOf(true)] : null;
  const learningPhase = step?.phase || active.phase;
  $("#app").innerHTML =
    header() +
    '<main id="main" class="mission-page" tabindex="-1"><div class="mission-topline">' +
    button("← The valley", "home", "", "text-button") +
    "<span>CHAPTER " +
    active.chapter +
    " · " +
    esc(phaseNames[active.phase]) +
    "</span><span>" +
    esc(active.location) +
    "</span></div>" +
    (reviewing
      ? '<aside class="return-banner"><strong>RETURN TRIP / CASE ' +
        active.reviewVariant +
        "</strong><p>New paths. The same skill. Your story achievements stay saved separately.</p></aside>"
      : "") +
    '<section class="adventure-stage">' +
    renderScene(active, session, chapter) +
    '<div class="stage-brief"><div class="eyebrow">' +
    esc(chapter.title) +
    "</div><h1>" +
    esc(active.title) +
    "</h1><p>" +
    esc(active.briefing.plain) +
    '</p><div class="brief-actions">' +
    button("▷ Replay story", "story", "", "small-button") +
    button("Show me around", "how-to", "", "small-button") +
    '</div><details class="brief-details"><summary>Why we’re here</summary><p>' +
    esc(active.briefing.why) +
    "</p><p><strong>In the field:</strong> " +
    esc(active.briefing.when) +
    "</p></details></div></section>" +
    renderBossEncounter() +
    '<div class="play-layout"><aside class="mission-rail"><section class="objectives-card" tabindex="-1"><div class="card-heading"><h2>The trail ahead</h2><span>' +
    count +
    " / " +
    active.steps.length +
    '</span></div><ol class="objectives">' +
    active.steps
      .map(
        (task, i) =>
          '<li class="' +
          (session.done[i] ? "done" : i === index ? "current" : "future") +
          '" data-testid="objective-' +
          i +
          '" data-complete="' +
          session.done[i] +
          '"><span class="objective-dot">' +
          (session.done[i] ? "✓" : i + 1) +
          "</span><div><strong>" +
          esc(task.title) +
          "</strong>" +
          (i === index ? "<p>" + esc(task.prompt) + "</p>" : "") +
          "</div></li>",
      )
      .join("") +
    '</ol></section><section class="patch-card" id="patch" tabindex="-1"><div class="patch-heading">' +
    renderPortrait("PATCH", lastResponse ? "thinking" : "idle") +
    '<div><span class="eyebrow">COMPANION CHANNEL</span><h2>Patch has your back.</h2></div></div><p id="patch-response" role="status">' +
    esc(
      lastResponse ||
        (step
          ? "One question at a time. We are figuring out " +
            step.title.toLowerCase() +
            "."
          : "Every clue is checked. Let’s tell Nova what we found."),
    ) +
    '</p><div class="hint-strengths"><span>Think</span><span>Concept</span><span>Location</span><span>Syntax</span></div>' +
    button(
      step ? "Ask Patch for a nudge" : "All clues checked",
      "hint",
      'data-testid="ask-patch" ' + (!step ? "disabled" : ""),
      "secondary",
    ) +
    '<small>Help is always welcome. We record assisted and independent attempts separately.</small></section></aside><section class="workbench">' +
    (last ? renderFeedback(last) : "") +
    '<div class="workbench-heading"><div><span class="eyebrow">' +
    (step ? "YOUR NEXT DISCOVERY" : "EVIDENCE COLLECTED") +
    '</span><h2 data-testid="current-objective">' +
    esc(step?.title || "Tell the valley what you found.") +
    '</h2></div><span class="phase-chip">' +
    esc(phaseNames[learningPhase]) +
    "</span></div>" +
    (step
      ? '<div class="current-context"><p>' +
        esc(step.prompt) +
        "</p>" +
        (learningPhase === "discover"
          ? '<div class="lesson-note"><strong>' +
            esc(step.teaching.plain) +
            "</strong><p>" +
            esc(step.teaching.meaning) +
            "</p>" +
            (step.teaching.syntax
              ? "<code>" + esc(step.teaching.syntax) + "</code>"
              : "") +
            "</div>"
          : '<details class="recall-note"><summary>Recall the idea</summary><p>' +
            esc(step.teaching.plain) +
            "</p><p>" +
            esc(step.teaching.when) +
            "</p></details>") +
        "</div>"
      : "") +
    '<nav class="tool-tabs" aria-label="Field tools">' +
    stageTools()
      .map((tool) =>
        button(
          '<span aria-hidden="true">' +
            toolIcons[tool] +
            "</span>" +
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
    '</nav><section class="tool-surface" data-tool="' +
    activeTool +
    '" tabindex="-1">' +
    renderTool(step, index) +
    '</section><div class="mission-finish">' +
    (profile.settings.timer
      ? '<span class="practice-clock">Your pace · <time id="practice-clock">' +
        formatClock(session.elapsed) +
        "</time> active time · No deadline</span>"
      : "") +
    "<p>" +
    esc(
      step
        ? "Follow the result. Find the next clue. You have time."
        : active.debrief,
    ) +
    "</p>" +
    button(
      "Talk it through with Nova →",
      "reflect",
      'data-testid="finish-encounter" ' + (step ? "disabled" : ""),
      "primary",
    ) +
    '</div></section></div><section class="field-translation"><span class="eyebrow">PLAIN WORDS → PROFESSIONAL WORDS</span><p>' +
    esc(active.briefing.professional) +
    '</p></section></main><nav class="field-dock" aria-label="Quick field navigation">' +
    button("Scene", "jump", 'data-region=".adventure-stage"') +
    button("Clues", "jump", 'data-region=".objectives-card"') +
    button("Tools", "jump", 'data-region=".workbench"') +
    button("Patch", "jump", 'data-region="#patch"') +
    "</nav>" +
    footer();
  const output = $("#terminal-output");
  if (output) output.scrollTop = output.scrollHeight;
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
  const activity = step.activity,
    draft = draftFor(index),
    inspected = session.activity?.[index]?.inspected || [];
  let html =
    '<div class="activity-heading"><span class="tool-symbol" aria-hidden="true">' +
    (toolIcons[activeTool] || "⌑") +
    "</span><div><h3>" +
    esc(activity.heading) +
    "</h3><p>" +
    esc(activity.instructions) +
    "</p></div></div>";
  if (activeTool === "browser")
    html +=
      '<div class="browser-address"><span>◉</span><span>Valley training browser · inspect before you trust</span></div>';
  if (activeTool === "windows")
    html +=
      '<div class="workstation-bar"><span>⊞ RANGER PC</span><span>Local training workstation</span></div>';
  if (
    !["inspect", "choose", "compare"].includes(activity.kind) &&
    (activity.requiredInspect || []).length
  ) {
    html +=
      '<div class="supporting-sources"><h4>Check the source material first</h4>' +
      (activity.items || [])
        .filter((item) => activity.requiredInspect.includes(item.id))
        .map(
          (item) =>
            '<article class="artifact ' +
            (inspected.includes(item.id) ? "opened" : "") +
            '">' +
            button(
              esc(item.label) +
                (inspected.includes(item.id) ? " · ✓ Inspected" : " · Inspect"),
              "inspect",
              'data-item="' +
                item.id +
                '" data-testid="inspect-' +
                item.id +
                '"',
              "artifact-open",
            ) +
            (inspected.includes(item.id)
              ? '<div class="artifact-content">' + esc(item.detail) + "</div>"
              : "") +
            "</article>",
        )
        .join("") +
      "</div>";
  }
  if (activity.kind === "sequence" || activity.kind === "connect") {
    html +=
      '<div class="sequence-board"><div class="evidence-pool"><h4>' +
      (activity.kind === "connect"
        ? "Available network points"
        : "Unsorted evidence") +
      "</h4>" +
      activity.items
        .map((item) =>
          button(
            "<strong>" +
              esc(item.label) +
              "</strong><span>" +
              esc(item.detail) +
              "</span>",
            "sequence-add",
            'data-item="' +
              item.id +
              '" ' +
              (draft.order.includes(item.id) ? "disabled" : ""),
            "evidence-tile",
          ),
        )
        .join("") +
      '</div><div class="ordered-evidence"><h4>' +
      (activity.kind === "connect" ? "Your route" : "Your timeline") +
      "</h4><ol>" +
      draft.order
        .map(
          (id) =>
            "<li>" +
            esc(activity.items.find((item) => item.id === id)?.label) +
            button(
              "×",
              "sequence-remove",
              'data-item="' + id + '" aria-label="Remove this item"',
              "icon-button",
            ) +
            "</li>",
        )
        .join("") +
      "</ol>" +
      button(
        "Check " + (activity.kind === "connect" ? "the route" : "the sequence"),
        "submit-activity",
        'data-testid="submit-activity"',
        "primary",
      ) +
      "</div></div>";
  } else if (activity.kind === "classify") {
    html +=
      '<div class="classify-board">' +
      activity.items
        .map(
          (item) =>
            '<article class="classify-card"><h4>' +
            esc(item.label) +
            "</h4><p>" +
            esc(item.detail) +
            '</p><label>Place this evidence<select data-category="' +
            item.id +
            '"><option value="">Choose a category…</option>' +
            (activity.categories || [])
              .map(
                (category) =>
                  '<option value="' +
                  category.id +
                  '" ' +
                  (draft.classifications[item.id] === category.id
                    ? "selected"
                    : "") +
                  ">" +
                  esc(category.label) +
                  "</option>",
              )
              .join("") +
            "</select></label></article>",
        )
        .join("") +
      "</div>" +
      button(
        "Check the evidence",
        "submit-activity",
        'data-testid="submit-activity"',
        "primary",
      );
  } else if (activity.kind === "report") {
    html +=
      '<div class="report-board">' +
      (activity.items || [])
        .map(
          (item) =>
            '<article class="report-evidence"><h4>' +
            esc(item.label) +
            "</h4><p>" +
            esc(item.detail) +
            "</p></article>",
        )
        .join("") +
      (activity.fields || [])
        .map(
          (field) =>
            "<label>" +
            esc(field.label) +
            "<small>" +
            esc(field.hint || "Use the evidence you can support.") +
            '</small><textarea data-report-field="' +
            field.id +
            '" rows="3">' +
            esc(draft.fields[field.id] || "") +
            "</textarea></label>",
        )
        .join("") +
      "</div>" +
      button(
        "Send your field report",
        "submit-activity",
        'data-testid="submit-activity"',
        "primary",
      );
  } else if (activity.kind === "repair") {
    html +=
      '<label class="script-label">Inspect and edit the text<textarea class="code-editor" data-repair-text rows="9" spellcheck="false">' +
      esc(draft.text) +
      '</textarea></label><p class="tool-instruction">This check reviews the text. Executable scripts are run separately in the field terminal.</p>' +
      button(
        "Check the revision",
        "submit-activity",
        'data-testid="submit-activity"',
        "primary",
      );
  } else {
    html +=
      '<div class="evidence-cards">' +
      (activity.items || [])
        .map(
          (item) =>
            '<article class="artifact ' +
            (inspected.includes(item.id) ? "opened" : "") +
            '">' +
            button(
              '<span class="artifact-icon" aria-hidden="true">' +
                (activeTool === "network"
                  ? "◈"
                  : activeTool === "browser"
                    ? "✉"
                    : "▤") +
                "</span><strong>" +
                esc(item.label) +
                "</strong><span>" +
                (inspected.includes(item.id) ? "✓ Inspected" : "Inspect") +
                "</span>",
              "inspect",
              'data-item="' +
                item.id +
                '" data-testid="inspect-' +
                item.id +
                '"',
              "artifact-open",
            ) +
            (inspected.includes(item.id)
              ? '<div class="artifact-content">' + esc(item.detail) + "</div>"
              : "") +
            "</article>",
        )
        .join("") +
      "</div>";
    if (activity.choices)
      html +=
        '<div class="field-choices"><h4>Your move</h4>' +
        activity.choices
          .map((choice) =>
            button(
              esc(choice.label),
              "activity-choice",
              'data-choice="' +
                choice.id +
                '" data-testid="choice-' +
                choice.id +
                '"',
              "choice-button",
            ),
          )
          .join("") +
        "</div>";
  }
  if (lastResponse)
    html +=
      '<p class="activity-response" role="status">' +
      esc(lastResponse) +
      "</p>";
  return html;
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
  if (kind === "settings" && view === "mission") renderMission();
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
  if (mode === "intro" && !session.started && currentIndex() === 0) showTour();
  else {
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
  const frames = (active.beats || []).filter(
    (beat) => beat.after === active.steps[index]?.id,
  );
  if (frames.length) showStory(frames, "beat");
}
const tour = [
  [
    "A place with a reason.",
    "The scene shows what is happening in the valley. Click its objects to open your briefing, tools, Patch, and journal. Your actions change the scene only after evidence is verified.",
    ".adventure-stage",
  ],
  [
    "A problem, then a clue.",
    "The trail ahead tells you what to achieve. In discovery lessons, we explain the tool and show its syntax. Later, the goal stays while the command hints fade.",
    ".objectives-card",
  ],
  [
    "Your kit is bigger than a terminal.",
    "Use the tabs for files, network maps, email, evidence, Windows, and scripts when the story calls for them. Read the result of each action. It will tell you why it mattered.",
    ".workbench",
  ],
  [
    "Ask a good question.",
    "Patch starts with a question, then the concept, then a place to look, and finally exact syntax. Help never locks you out. We keep independent demonstrations separate from assisted attempts.",
    "#patch",
  ],
  [
    "Make the learning yours.",
    "Finish the practical work, explain your conclusions to Nova, and leave a note. Your journal keeps concepts and demonstrations. Return trips change paths and let you try again without changing story progress.",
    ".mission-finish",
  ],
];
function showTour() {
  tourStep = 0;
  renderTour();
}
function renderTour() {
  const [title, copy, target] = tour[tourStep];
  if (view === "mission")
    $(target)?.scrollIntoView({ block: "center", behavior: "instant" });
  openDialog(
    '<span class="eyebrow">PATCH’S FIELD GUIDE · ' +
      (tourStep + 1) +
      " / " +
      tour.length +
      '</span><div class="tour-character">' +
      renderPortrait("PATCH") +
      '</div><h2 id="dialog-title">' +
      title +
      '</h2><p tabindex="0">' +
      copy +
      '</p><div class="tour-controls">' +
      button("Skip guide", "tour-end", "", "text-button") +
      button(
        tourStep === tour.length - 1 ? "Let’s go →" : "Next →",
        "tour-next",
        'data-testid="tour-next"',
        "primary",
      ) +
      "</div>",
    "tour",
  );
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
      '<span class="eyebrow">NOVA’S CHECK-IN · ' +
        (quizIndex + 1) +
        " / " +
        active.questions.length +
        '</span><h2 id="dialog-title">' +
        esc(question.question) +
        '</h2><p>Choose the conclusion you can support.</p><div class="knowledge-options">' +
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
                ? "Leave a field note →"
                : "Next question →",
              "question-next",
              'data-testid="question-next"',
              "primary",
            )
          : ""),
      "reflection",
    );
  } else {
    openDialog(
      '<span class="eyebrow">MAKE IT STICK</span><h2 id="dialog-title">Tell your future self.</h2><p>' +
        esc(active.debrief) +
        '</p><label class="reflection-label">What did you notice, and why did it matter?<textarea id="reflection" rows="4" placeholder="A note in your own words. Optional.">' +
        esc(session.reflection || "") +
        '</textarea></label><div class="reflection-application"><strong>Outside the valley</strong><p>' +
        esc(active.briefing.when) +
        "</p></div>" +
        button(
          "Complete this encounter →",
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
  persist();
  sound();
  render();
  if (active.ending?.length && !reviewing)
    showStory(active.ending, "ending", () => showCompletion(record));
  else showCompletion(record);
}
function showCompletion(record) {
  const independent = record.independent,
    final = completeIds().length === 104 && !reviewing;
  openDialog(
    '<span class="eyebrow">' +
      (reviewing
        ? "RETURN TRIP COMPLETE"
        : final
          ? "THE VALLEY ANSWERS"
          : "A LITTLE MORE OF THE VALLEY, RESTORED") +
      '</span><div class="completion-character">' +
      renderPortrait(final ? "NOVA" : "PATCH", "celebrate") +
      '</div><h2 id="dialog-title">' +
      (final ? "The last signal reaches home." : esc(active.title)) +
      '</h2><p class="completion-story">' +
      esc(active.debrief) +
      '</p><div class="completion-stats"><div><strong>' +
      completeIds().length +
      " / 104</strong><span>story encounters</span></div><div><strong>" +
      active.questions.length +
      " / " +
      active.questions.length +
      "</strong><span>knowledge checks</span></div><div><strong>" +
      (independent
        ? "Independent"
        : active.phase === "discover"
          ? "Introduced"
          : "Assisted") +
      "</strong><span>this practical attempt</span></div></div><p>" +
      esc(active.callback || "The valley remembers the care you took.") +
      "</p>" +
      (final
        ? '<div class="office-invitation"><span class="eyebrow">INCOMING / REGIONAL SECURITY OPERATIONS</span><p>“Your field report reached us. We have a bigger world of problems to show you.”</p><strong>The Office · Your next story is in development.</strong></div>'
        : "") +
      '<div class="completion-actions">' +
      button(
        reviewing
          ? "Back to the chapter"
          : final
            ? "Return to the valley"
            : "Follow the next clue →",
        reviewing ? "chapter" : final ? "home" : "next",
        'data-testid="next-encounter"',
        "primary",
      ) +
      button(
        "Try a return trip ↻",
        "review",
        'data-mission="' + active.id + '"',
        "secondary",
      ) +
      "</div>",
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
      '> Animated world<small>Your device’s reduced-motion preference takes priority.</small></label><label><input id="setting-sound" type="checkbox" ' +
      (profile.settings.sound ? "checked" : "") +
      '> Quiet discovery sounds<small>Short, gentle tones. Off until you choose them.</small></label><label><input id="setting-large" type="checkbox" ' +
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
    const blob = new Blob([storage.export(profile)], {
        type: "application/json",
      }),
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
  if (file.size > MAX_SAVE_BYTES) return toast("This backup is too large.");
  try {
    const candidate = storage.import(await file.text());
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
    sound();
    activeTool = stepNow()?.tool || activeTool;
    announce(
      active.steps[result.completedStep].feedback.text +
        " " +
        (stepNow()?.title || "Every clue is checked."),
    );
  } else announce(lastResponse);
  persist();
  render();
  if (result.completedStep !== undefined) showStepBeat(result.completedStep);
}
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
  if (action === "journal") showJournal();
  if (action === "settings") showSettings();
  if (action === "close-dialog") dismissDialog();
  if (action === "story") showStory();
  if (action === "story-next") {
    if (++storyFrame >= storyFrames.length) endStory();
    else renderStory();
  }
  if (action === "story-skip") endStory();
  if (action === "how-to") showTour();
  if (action === "tour-next") {
    if (++tourStep >= tour.length) endTour();
    else renderTour();
  }
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
    profile = importFile.pending;
    storage.write(profile);
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
    profile = storage.reset();
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
  if (event.target.id === "terminal-form") {
    event.preventDefault();
    historyIndex = -1;
    command($("#terminal-input").value);
  }
});
document.addEventListener("keydown", (event) => {
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
      "#terminal-input,[data-report-field],#script-editor,[data-repair-text]",
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
    !dialog.open
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
