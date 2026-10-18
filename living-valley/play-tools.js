/* The field kit is a set of playable objects, not a row of worksheet controls.
 * All grading stays in runtime.js. This module only presents and records moves. */
const escape = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const paths = {
  screen: '<rect x="3" y="4" width="26" height="18" rx="3"/><path d="M11 28h10M16 22v6M7 9h18M8 17h7"/>',
  chip: '<rect x="8" y="8" width="16" height="16" rx="3"/><path d="M12 1v7m8-7v7M12 24v7m8-7v7M1 12h7m-7 8h7m16-8h7m-7 8h7"/><rect x="12" y="12" width="8" height="8" rx="1"/>',
  folder: '<path d="M3 9V6a2 2 0 0 1 2-2h8l3 4h11a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 12h26M10 18h12"/>',
  map: '<path d="m3 6 8-3 10 4 8-3v22l-8 3-10-4-8 3zM11 3v22M21 7v22"/><path d="m7 15 8-4 9 9" stroke-dasharray="2 3"/><circle cx="24" cy="20" r="2"/>',
  file: '<path d="M7 2h12l7 7v20H7zM19 2v8h7M11 16h11m-11 5h11m-11 4h7"/>',
  mail: '<rect x="2" y="6" width="28" height="21" rx="3"/><path d="m3 8 13 11L29 8M3 25l8-9m18 9-8-9"/>',
  key: '<circle cx="10" cy="11" r="7"/><path d="m15 16 13 13m-6-6 4-4m-9-1 4-4"/><circle cx="8" cy="9" r="1"/>',
  shield: '<path d="m16 2 12 5v9c0 7-8 13-12 15C12 29 4 23 4 16V7z"/><path d="m10 16 4 4 8-9"/>',
  cable: '<rect x="2" y="5" width="10" height="9" rx="2"/><path d="M5 2v3m4-3v3M7 14v6c0 8 18 8 18 0v-3"/><rect x="20" y="9" width="10" height="9" rx="2"/><path d="M23 6v3m4-3v3"/>',
  radio: '<rect x="6" y="9" width="20" height="21" rx="4"/><path d="M10 9V2m5 12h7M11 25h10m-10-4h10M20 2c5 0 9 4 9 9"/><circle cx="11" cy="15" r="2"/>',
  clock: '<circle cx="16" cy="17" r="12"/><path d="M16 9v9l6 3M12 1h8m-4 0v4"/>',
  gear: '<path d="m13 2 6 0 1 5 4 2 4-1 3 5-3 4v4l3 3-3 5-5-1-4 2-1 3h-6l-1-4-4-2-4 1-3-5 3-4v-4l-3-3 3-5 5 1 4-2z" transform="translate(1 -1) scale(.9)"/><circle cx="16" cy="16" r="5"/>',
  drive: '<rect x="3" y="5" width="26" height="23" rx="4"/><circle cx="16" cy="16" r="7"/><path d="m16 16 7 6M8 8h1m14 0h1M8 25h1m14 0h1"/>',
  lantern: '<path d="M10 7h12l4 19H6zM11 7V4a5 5 0 0 1 10 0v3M5 27h22M16 11v9m-4-5h8"/>',
  terminal: '<rect x="2" y="5" width="28" height="23" rx="3"/><path d="m7 12 5 5-5 5m9 0h9M3 9h26"/>',
  person: '<circle cx="16" cy="9" r="6"/><path d="M4 29v-4a12 12 0 0 1 24 0v4M10 26v3m12-3v3"/>',
  mountain: '<path d="m2 28 12-23 6 12 4-6 7 17zM10 13l4 3 4-3M3 28h27"/>',
  check: '<path d="m5 17 7 7L28 7"/>',
};

function icon(kind, className = "") {
  return `<svg class="play-icon ${className}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] || paths.file}</svg>`;
}
function objectIcon(item) {
  const words = `${item.id || ""} ${item.label || ""}`.toLowerCase();
  if (/\.(txt|log|csv|json|pdf|md|yaml|conf|ini)\b/.test(words)) return "file";
  if (/screen|display|monitor/.test(words)) return "screen";
  if (/password|key|credential|token/.test(words)) return "key";
  if (/mail|message|inbox|sender|phish/.test(words)) return "mail";
  if (/route|map|viewer/.test(words)) return "map";
  if (/network|cable|gateway|router|dns|switch|port|packet|connect/.test(words)) return "cable";
  if (/cpu|processor|ram|memory|linux|operating|\bos\b/.test(words)) return "chip";
  if (/disk|storage|drive|backup/.test(words)) return "drive";
  if (/terminal|powershell|command|script|\bcli\b/.test(words)) return "terminal";
  if (/folder|directory|archive/.test(words)) return "folder";
  if (/time|clock|event|before|after/.test(words)) return "clock";
  if (/radio|dispatch|acknowledg|signal/.test(words)) return "radio";
  if (/approve|safe|trust|block|security|scope/.test(words)) return "shield";
  if (/person|user|account|owner|suspect|witness/.test(words)) return "person";
  if (/tool|app|program|sensor|setting|service|process/.test(words)) return "gear";
  return "file";
}
function action(label, name, attrs = "", style = "") {
  return `<button type="button" class="play-button ${style}" data-play-action="${name}" ${attrs}>${label}</button>`;
}
// Stable layouts survive re-renders, while a route's displayed parts do not
// arrive already in the author's answer order. No grading data is consulted.
function mixed(items, seed) {
  const arranged = [...items];
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  for (let i = arranged.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arranged[i], arranged[j]] = [arranged[j], arranged[i]];
  }
  if (arranged.length > 1 && arranged.every((item, index) => item === items[index])) arranged.push(arranged.shift());
  return arranged;
}
function itemAttrs(item) { return `data-item="${escape(item.id)}"`; }
function readableDetail(value) {
  return `<div class="play-object-detail">${escape(value || "").replace(/\n/g, "<br>")}</div>`;
}
function envelope(item, inspected, compact = false) {
  const opened = inspected.includes(item.id);
  return `<article class="play-envelope${opened ? " is-open" : ""}${compact ? " is-compact" : ""}">
    ${action(`${icon(objectIcon(item))}<span><strong>${escape(item.label)}</strong><small>${opened ? "Opened · read again" : "Break the seal"}</small></span><span class="play-envelope-seal" aria-hidden="true">${opened ? "✓" : "+"}</span>`, "inspect", `${itemAttrs(item)} data-testid="inspect-${escape(item.id)}" aria-expanded="${opened}"`, "play-envelope-open")}
    ${opened ? `<div class="play-paper">${readableDetail(item.detail)}</div>` : ""}
  </article>`;
}
function sources(activity, inspected) {
  const required = activity.requiredInspect || [];
  if (!required.length) return "";
  return `<section class="play-source-pouch" aria-label="Clues in your satchel"><div class="play-small-label">${icon("folder")} In your satchel · open the clues</div><div class="play-envelope-grid">${(activity.items || []).filter(item => required.includes(item.id)).map(item => envelope(item, inspected, true)).join("")}</div></section>`;
}
function statusLine(message) {
  return `<p class="play-status" data-play-status role="status" aria-live="polite">${escape(message)}</p>`;
}

function classify(activity, draft, step, context) {
  const items = activity.items || [], categories = activity.categories || [], placements = draft.classifications || {};
  const isFirstComputer = step.id === "parts" && (!context.mission || context.mission.id === "c01-01");
  const available = isFirstComputer ? items.filter(item => (context.inspected || []).includes(item.id)) : items;
  const kitSlots = {
    hardware: { title: "The body", detail: "Hardware · physical parts", icon: "screen" },
    os: { title: "The brain", detail: "Operating system", icon: "chip" },
    app: { title: "The toolbelt", detail: "Applications", icon: "gear" },
    file: { title: "The notebook", detail: "Saved files", icon: "file" },
  };
  const placedCount = items.filter(item => categories.some(category => category.id === placements[item.id])).length;
  const token = (item, placed = false) => action(`${icon(objectIcon(item))}<span><strong>${escape(item.label)}</strong>${placed ? "" : `<small>${escape(item.detail)}</small>`}</span><span class="play-grip" aria-hidden="true">⠿</span>`, "pick", `${itemAttrs(item)} data-testid="classify-item-${escape(item.id)}" draggable="true" aria-pressed="false" aria-describedby="play-packing-help"`, `play-object${placed ? " is-packed" : ""}`);
  return `<section class="play-packing-table${isFirstComputer ? " play-computer-assembly" : ""}" aria-label="${isFirstComputer ? "Build your field computer" : "Equipment sorting game"}">
    <div class="play-game-strip"><span>${icon("gear")} ${isFirstComputer ? "Pick a part, then tap its socket. Or drag it in." : "The kit is in pieces. Your hands, your call."}</span><strong>${placedCount} / ${items.length} placed</strong></div>
    ${isFirstComputer ? `<div class="play-device-display"><div class="play-device-antenna" aria-hidden="true"></div><div class="play-device-screen"><svg viewBox="0 0 220 85" aria-hidden="true"><path d="M4 65h30l12-22 17 28 20-49 19 42 14-20 13 20h29l15-29 16 29h27" fill="none" stroke="currentColor" stroke-width="2"/><path d="M0 78h220" stroke="currentColor" opacity=".2"/></svg><span>${placedCount === items.length ? "BUILD READY · TRY THE POWER SWITCH" : "FIELD COMPUTER · PARTS MISSING"}</span></div><div class="play-device-knobs" aria-hidden="true"><i></i><i></i><i></i></div><div class="play-device-label">PROPERTY OF NOVA · PLEASE DO NOT FEED</div></div>` : ""}
    <p id="play-packing-help" class="play-control-tip">Pick an object, then tap its destination. You can also drag it. Change your mind? Pick it up again.</p>
    <div class="play-tray-nav"><span>Loose parts · swipe the tray</span>${action("←", "tray-left", 'aria-label="Previous loose part"', "play-tray-arrow")}${action("→", "tray-right", 'aria-label="Next loose part"', "play-tray-arrow")}</div>
    <div class="play-loose-kit" aria-label="Objects on the workbench">${mixed(available, activity.heading || step.id).filter(item => !categories.some(category => category.id === placements[item.id])).map(item => token(item)).join("") || (available.length < items.length ? `<div class="play-cleared-bench">${icon("folder")} ${items.length - available.length} pieces are still out on the trail. Put the gadget away and pick them up.</div>` : `<div class="play-cleared-bench">${icon("check")} Workbench clear. Ready to try your arrangement?</div>`)}</div>
    <div class="play-bin-grid">${categories.map((category, index) => `<section class="play-bin" data-drop-category="${escape(category.id)}" style="--bin-index:${index % 4}">
      ${action(`${icon(isFirstComputer ? kitSlots[category.id]?.icon || objectIcon(category) : objectIcon(category))}<span><strong>${escape(isFirstComputer ? kitSlots[category.id]?.title || category.label : category.label)}</strong><small>${escape(isFirstComputer ? kitSlots[category.id]?.detail || category.label : "Place the object here")}</small></span><span class="play-target-cross" aria-hidden="true">＋</span>`, "place", `data-category-id="${escape(category.id)}" data-testid="classify-target-${escape(category.id)}" aria-describedby="play-packing-help" aria-label="${escape(isFirstComputer ? `${kitSlots[category.id]?.title || category.label}: ${category.label}` : category.label)}"`, "play-bin-target")}
      <div class="play-bin-contents">${items.filter(item => placements[item.id] === category.id).map(item => token(item, true)).join("") || '<span class="play-empty-slot" aria-hidden="true"></span>'}</div>
    </section>`).join("")}</div>
    ${statusLine("Choose an object to pick it up.")}
    <div class="play-commit-bar"><span class="play-patch-aside">${isFirstComputer ? "Patch: “I was carrying it very professionally until gravity got involved.”" : "Patch has appointed himself quality control. He is wearing a sticker."}</span>${action(`${icon(isFirstComputer ? "radio" : "lantern")} ${isFirstComputer ? "Power it up" : "Try this setup"}`, "submit", 'data-testid="submit-activity"', "play-commit")}</div>
  </section>`;
}

function routeBoard(activity, draft) {
  const route = draft.order || [], items = activity.items || [], isWire = activity.kind === "connect";
  const selected = route.map(id => items.find(item => item.id === id)).filter(Boolean);
  const viewWidth = Math.max(400, selected.length * 150);
  const path = selected.map((_, index) => `${index ? "L" : "M"}${75 + index * 150},46`).join(" ");
  return `<section class="play-route-board ${isWire ? "is-network" : "is-timeline"}" aria-label="${isWire ? "Signal route builder" : "Action timeline builder"}">
    <div class="play-game-strip"><span>${icon(isWire ? "cable" : "clock")} ${isWire ? "Build the signal’s journey" : "Put the plan in motion"}</span><strong>${selected.length} / ${items.length} connected</strong></div>
    <p class="play-control-tip">${isWire ? "Tap the points in the order the signal should travel. Tap a joined point to unplug it." : "Tap a move to add it to your plan. Remove any move to rethink the sequence."}</p>
    <div class="play-route-scroll"><div class="play-route" style="min-width:${viewWidth}px">
      <svg class="play-wires" viewBox="0 0 ${viewWidth} 100" preserveAspectRatio="none" aria-hidden="true"><path class="play-wire-track" d="M35 46H${viewWidth - 35}"/>${selected.length > 1 ? `<path class="play-wire-live" d="${path}"/>` : ""}</svg>
      <ol class="play-route-nodes">${selected.length ? selected.map((item, index) => `<li>${action(`<span class="play-node-number">${index + 1}</span>${icon(objectIcon(item))}<strong>${escape(item.label)}</strong><small>${isWire ? "Unplug" : "Remove move"}</small>`, "sequence-remove", `${itemAttrs(item)} data-testid="sequence-remove-${escape(item.id)}" aria-label="Remove ${escape(item.label)}"`, "play-route-node")}</li>`).join("") : `<li class="play-route-start">${icon(isWire ? "radio" : "clock")} ${isWire ? "The signal is waiting for a route…" : "Your first move goes here…"}</li>`}</ol>
    </div></div>
    <div class="play-node-pool" aria-label="Available moves">${mixed(items, activity.heading || "route").map(item => action(`${icon(objectIcon(item))}<span><strong>${escape(item.label)}</strong><small>${escape(item.detail)}</small></span><span class="play-node-add" aria-hidden="true">${route.includes(item.id) ? "✓" : "+"}</span>`, "sequence-add", `${itemAttrs(item)} data-testid="sequence-add-${escape(item.id)}" ${route.includes(item.id) ? "disabled" : ""}`, "play-pool-node")).join("")}</div>
    <div class="play-commit-bar"><span class="play-patch-aside">${isWire ? "Patch: “If this works, I’m taking partial credit. Very partial.”" : "Patch: “A plan! My previous plan was to look concerned.”"}</span>${action(`${icon(isWire ? "radio" : "check")} ${isWire ? "Send a test signal" : "Try the plan"}`, "submit", 'data-testid="submit-activity"', "play-commit")}</div>
  </section>`;
}

function reportRadio(activity, draft) {
  return `<section class="play-radio-desk" aria-label="Field radio dispatch">
    <div class="play-radio-head">${icon("radio")}<div><span class="play-small-label">Valley dispatch · text channel</span><h4>Tell the team what you found.</h4><p>Short, useful messages. Your own words. Nova needs the facts you can stand behind.</p></div><span class="play-radio-light" aria-hidden="true"></span></div>
    ${(activity.items || []).filter(item => !(activity.requiredInspect || []).includes(item.id)).length ? `<div class="play-radio-clues">${(activity.items || []).filter(item => !(activity.requiredInspect || []).includes(item.id)).map(item => `<article>${icon(objectIcon(item))}<div><strong>${escape(item.label)}</strong>${readableDetail(item.detail)}</div></article>`).join("")}</div>` : ""}
    <div class="play-dispatch-channels">${(activity.fields || []).map((field, index) => `<label class="play-dispatch-message"><span class="play-channel-number">${String(index + 1).padStart(2, "0")}</span><span class="play-dispatch-label">${escape(field.label)}</span><small>${escape(field.hint || "What does the evidence actually support?")}</small><textarea data-play-field="${escape(field.id)}" data-report-field="${escape(field.id)}" rows="2" placeholder="Your message to the team…">${escape(draft.fields?.[field.id] || "")}</textarea></label>`).join("")}</div>
    <div class="play-commit-bar"><span class="play-patch-aside">Patch will handle the radio. You handle saying something useful.</span>${action(`${icon("radio")} Radio the team`, "submit", 'data-testid="submit-activity"', "play-commit")}</div>
    <p class="play-control-tip play-honest-note">This is a typed dispatch. The game checks the stated facts; it does not record your voice or judge your writing style.</p>
  </section>`;
}

function repairBench(activity, draft) {
  return `<section class="play-blueprint" aria-label="Gadget blueprint editor"><div class="play-blueprint-head">${icon("gear")}<div><span class="play-small-label">Tessa’s repair bench</span><h4>Make the text match your plan.</h4></div></div><label class="play-blueprint-label">The working blueprint<textarea class="code-editor" data-play-field="__repair__" data-repair-text rows="8" spellcheck="false">${escape(draft.text || "")}</textarea></label><div class="play-commit-bar"><span class="play-patch-aside">Text check only. To run a real script, use your terminal kit.</span>${action(`${icon("gear")} Check the blueprint`, "submit", 'data-testid="submit-activity"', "play-commit")}</div></section>`;
}

function caseDesk(activity, inspected) {
  const isInspect = activity.kind === "inspect";
  return `<section class="play-case-desk" aria-label="Interactive clue desk"><div class="play-game-strip"><span>${icon("folder")} ${isInspect ? "There’s something in the satchel…" : "Open the clues. Then make your move."}</span><strong>${(activity.items || []).filter(item => inspected.includes(item.id)).length} / ${(activity.items || []).length} opened</strong></div>
    <div class="play-envelope-grid">${(activity.items || []).map(item => envelope(item, inspected)).join("")}</div>
    ${isInspect ? `<div class="play-commit-bar"><span class="play-patch-aside">Patch: “I checked for snacks. Now we should check for clues.”</span>${action(`${icon("check")} Clues checked. Let’s go.`, "submit", 'data-testid="submit-activity"', "play-commit")}</div>` : `<div class="play-choice-dialogue"><div class="play-small-label">Your move</div>${mixed(activity.choices || [], activity.heading || "decision").map((choice, index) => action(`<span class="play-choice-index" aria-hidden="true">${index + 1}</span><span>${escape(choice.label)}</span><span class="play-choice-arrow" aria-hidden="true">↗</span>`, "choose", `data-choice="${escape(choice.id)}" data-testid="choice-${escape(choice.id)}"`, "play-spoken-choice")).join("")}</div>`}
  </section>`;
}

export function renderPlayActivity(step, index, context = {}) {
  const activity = step.activity;
  if (!activity) return "";
  const draft = context.draft || { order: [], classifications: {}, fields: {}, text: activity.initial || "" };
  const inspected = context.inspected || [];
  const kind = activity.kind;
  const supporting = !["inspect", "choose", "compare"].includes(kind) ? sources(activity, inspected) : "";
  const body = kind === "classify" ? classify(activity, draft, step, context) : ["sequence", "connect"].includes(kind) ? routeBoard(activity, draft) : kind === "report" ? reportRadio(activity, draft) : kind === "repair" ? repairBench(activity, draft) : caseDesk(activity, inspected);
  return `<div class="play-kit play-kind-${escape(kind)}" data-play-activity="${escape(step.id)}" data-step-index="${escape(index)}"><header class="play-kit-heading"><span class="play-tool-emblem">${icon(kind === "report" ? "radio" : kind === "connect" ? "cable" : kind === "repair" ? "gear" : "folder")}</span><div><h3>${escape(activity.heading)}</h3><p>${escape(activity.instructions)}</p></div></header>${supporting}${body}</div>`;
}

/** Mount after each host render. The host owns drafts, progression and saves. */
export function mountPlayActivity(root, callbacks = {}) {
  if (!root?.addEventListener) return () => {};
  let selected = "", dragged = "";
  const signal = (message) => {
    const node = root.querySelector("[data-play-status]");
    if (node) node.textContent = message;
  };
  const focusAfter = (selector) => queueMicrotask(() => root.querySelector(selector)?.focus({ preventScroll: true }));
  const select = (id) => {
    selected = selected === id ? "" : id;
    root.querySelectorAll('[data-play-action="pick"]').forEach(node => {
      const active = node.dataset.item === selected;
      node.setAttribute("aria-pressed", String(active));
      node.classList.toggle("is-picked", active);
    });
    root.querySelector(".play-packing-table")?.classList.toggle("has-picked-object", Boolean(selected));
    const picked = Array.from(root.querySelectorAll('[data-play-action="pick"]')).find(node => node.dataset.item === selected);
    signal(picked ? `${picked.querySelector("strong")?.textContent || "Object"} picked up. Choose a destination.` : "Choose an object to pick it up.");
  };
  const place = (id, category) => {
    if (!id) { signal("Pick an object first, then choose where to put it."); return; }
    selected = "";
    callbacks.onClassify?.(id, category);
    queueMicrotask(() => {
      const token = root.querySelector(`[data-drop-category="${CSS.escape(category)}"] [data-play-action="pick"][data-item="${CSS.escape(id)}"]`);
      if (token) {
        token.classList.add("is-just-packed");
        token.addEventListener("animationend", () => token.classList.remove("is-just-packed"), { once: true });
        signal(`${token.querySelector("strong")?.textContent || "Object"} placed. You can pick it up again to change your setup.`);
      }
    });
    focusAfter(`[data-play-action="place"][data-category-id="${CSS.escape(category)}"]`);
  };
  const click = (event) => {
    const control = event.target.closest?.("[data-play-action]");
    if (!control || !root.contains(control)) return;
    event.preventDefault(); event.stopPropagation();
    if (control.disabled) return;
    const kind = control.dataset.playAction, id = control.dataset.item;
    if (kind === "pick") select(id);
    if (kind === "tray-left" || kind === "tray-right") {
      const tray = control.closest(".play-packing-table")?.querySelector(".play-loose-kit");
      const still = document.body.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
      tray?.scrollBy({ left: tray.clientWidth * (kind === "tray-left" ? -.85 : .85), behavior: still ? "instant" : "smooth" });
    }
    if (kind === "place") place(selected, control.dataset.categoryId);
    if (kind === "inspect") callbacks.onInspect?.(id);
    if (kind === "choose") callbacks.onChoose?.(control.dataset.choice);
    if (kind === "sequence-add") {
      callbacks.onSequenceAdd?.(id);
      focusAfter('[data-play-action="sequence-add"]:not(:disabled),[data-testid="submit-activity"]');
    }
    if (kind === "sequence-remove") {
      callbacks.onSequenceRemove?.(id);
      focusAfter(`[data-play-action="sequence-add"][data-item="${CSS.escape(id)}"]`);
    }
    if (kind === "submit") callbacks.onSubmit?.();
  };
  const input = (event) => {
    if (event.target.matches?.("[data-play-field]")) callbacks.onDraftField?.(event.target.dataset.playField, event.target.value);
  };
  const dragstart = (event) => {
    const node = event.target.closest?.('[data-play-action="pick"]');
    if (!node || !root.contains(node)) return;
    dragged = node.dataset.item;
    selected = dragged;
    event.dataTransfer?.setData("text/plain", dragged);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    node.classList.add("is-dragging");
    root.querySelector(".play-packing-table")?.classList.add("has-picked-object");
    signal(`${node.querySelector("strong")?.textContent || "Object"} picked up. Drop it into a destination.`);
  };
  const dragover = (event) => {
    // Keep the real pointer interaction usable in short windows and at larger
    // text sizes as well as the compact desktop layout. Scrolling is a view
    // operation; only a drop on an actual socket records a move.
    if (dragged) {
      const panel = root.querySelector("#game-panel");
      if (panel && panel.scrollHeight > panel.clientHeight) {
        const bounds = panel.getBoundingClientRect(), edge = 52;
        if (event.clientY < bounds.top + edge) panel.scrollBy({ top: -18, behavior: "instant" });
        else if (event.clientY > bounds.bottom - edge) panel.scrollBy({ top: 18, behavior: "instant" });
      }
    }
    const bin = event.target.closest?.("[data-drop-category]");
    if (!bin || !root.contains(bin) || !dragged) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    root.querySelectorAll(".is-drop-ready").forEach(node => node.classList.remove("is-drop-ready"));
    bin.classList.add("is-drop-ready");
  };
  const drop = (event) => {
    const bin = event.target.closest?.("[data-drop-category]");
    if (!bin || !root.contains(bin) || !dragged) return;
    event.preventDefault(); event.stopPropagation();
    const id = dragged; dragged = "";
    place(id, bin.dataset.dropCategory);
  };
  const dragend = () => {
    dragged = "";
    root.querySelectorAll(".is-dragging,.is-drop-ready").forEach(node => node.classList.remove("is-dragging", "is-drop-ready"));
    root.querySelector(".play-packing-table")?.classList.toggle("has-picked-object", Boolean(selected));
  };
  const escapePick = (event) => {
    if (event.key === "Escape" && selected) { event.preventDefault(); event.stopPropagation(); select(selected); }
  };
  const listeners = { click, input, dragstart, dragover, drop, dragend, keydown: escapePick };
  for (const [name, listener] of Object.entries(listeners)) root.addEventListener(name, listener);
  return () => { for (const [name, listener] of Object.entries(listeners)) root.removeEventListener(name, listener); };
}
