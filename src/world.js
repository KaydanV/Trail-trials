// The field feed changes only when the objective verifier has accepted evidence.
// All text and SVG are authored here; command output never becomes image markup.
const step = (id, title, detail) => ({ id, title, detail });
const world = (kind, actor, waiting, steps, done, doneDetail) => ({ kind, actor, waiting, steps, done, doneDetail });
const worlds = Object.freeze({
  'hike-01': world('welcome', 'PATCH', 'The trail signs are still dark', [
    step('location', 'Your position appears on the field map', 'Basecamp is your starting point. The relay lamps are still offline.'),
    step('identity', 'Your trainee badge checks out', 'Patch knows who is operating the terminal.'),
    step('scope', 'Your authorized trail is marked', 'The briefing sets the boundary for this investigation.'),
    step('decision', 'A careful first step', 'You chose to investigate within the lab briefing.'),
  ], 'Ready to follow the first clue', 'Location, identity, and permission are checked. The mountain signal still needs investigation.'),
  'hike-02': world('map', 'PATCH', 'The map cabinet is waiting', [
    step('list', 'The maps drawer is highlighted', 'The directory listing points to the maps folder.'),
    step('move', 'Your marker moves into maps', 'The terminal confirms your current folder.'),
    step('map', 'The mountain route unfolds', 'Pine Relay, Glass Bridge, and Summit Beacon now have places on your route.'),
    step('decision', 'The known route is selected', 'You chose the approved assets on the trail.'),
  ], 'The trail has a shape', 'Patch can put the right map in the right drawer.'),
  'hike-03': world('owl', 'PATCH', 'The owl has a blank receipt', [
    step('guide', 'The owl prints its guide', 'HOOT is the printer status. Keep reading the relay evidence.'),
    step('start', 'The first log lines print', 'The relay started successfully at the beginning of the log.'),
    step('end', 'The missing-route line prints', 'The latest entries report a missing route configuration.'),
    step('decision', 'The receipt points to a file', 'A missing route is the next lead. The owl has not been blamed.'),
  ], 'One useful receipt, one useful lead', 'The owl keeps printing; the missing route file is your next question.'),
  'hike-04': world('breadcrumbs', 'PATCH', 'The squirrel is holding the first breadcrumb', [
    step('find', 'A breadcrumb reaches the archive crate', 'The filename search located supplies/archive/route.conf.'),
    step('search', 'A second breadcrumb marks the route', 'The configuration names academy.test as its destination.'),
    step('note', 'The source note joins the trail', 'Nova’s provenance note is now part of the evidence.'),
    step('decision', 'The verified source is selected', 'You chose to verify the backup and follow the approved recovery instructions.'),
  ], 'The squirrel has a route to the right crate', 'You found the configuration and checked its source. Recovery is a later step.'),
  'hike-05': world('notes', 'NOVA', 'The field desk needs a case folder', [
    step('folder', 'A case folder opens on the desk', 'Your investigation now has its own directory.'),
    step('copy', 'The preserved status copy lands in the folder', 'The original status remains available for comparison.'),
    step('note', 'Your observation appears on the case sheet', 'The note records offline signs and an unconfirmed cause.'),
    step('decision', 'Facts stay with the handoff', 'Your case note keeps observations separate from theories.'),
  ], 'The evidence has a home', 'The status copy and factual note are ready for the next operator.'),
  'hike-06': world('lantern', 'NOVA', 'Pine Relay’s signal lantern is dark', [
    step('approval', 'The approved repair path appears', 'The recovery instruction names the exact files to use.'),
    step('preserve', 'The before-copy is on the bench', 'The faulty route is preserved before replacement.'),
    step('restore', 'The restored route reaches the lantern', 'The approved configuration is in the destination. Inspect it next.'),
    step('verify', 'The destination check is recorded', 'The verified output names academy.test. The signal light needs every recovery check.'),
    step('decision', 'One green light comes back', 'The approved, preserved, restored, and inspected route supports this local recovery.'),
  ], 'Pine Relay’s first lantern is green', 'One working breadcrumb is back. The rest of the mountain still has a trail ahead.'),
  'hike-07': world('private', 'NOVA', 'The recovery note has too large an audience', [
    step('policy', 'The owner-only boundary is drawn', 'The policy says the private note should belong to its owner alone.'),
    step('inspect', 'The exposed permission row is highlighted', 'The permission listing shows who can currently read the note.'),
    step('restrict', 'The local note closes to its owner', 'Permission 600 protects future access to this file.'),
    step('decision', 'The rotation reminder stays attached', 'Previously exposed secrets still need rotation through the approved process.'),
  ], 'The doormat no longer advertises the note', 'The file has owner-only access. A previously exposed secret is still a separate recovery concern.'),
  'hike-08': world('dragon', 'PATCH', 'The dragon is guarding a closed account gate', [
    step('policy', 'The dragon’s sign-in standard appears', 'Unique long passwords, a manager, and protected recovery belong in the plan.'),
    step('reuse', 'The reused-password weakness is marked', 'The audit records password reuse.'),
    step('mfa', 'The missing second layer is marked', 'The audit records that MFA is disabled.'),
    step('decision', 'The dragon accepts your protection plan', 'A password manager, unique credentials, MFA, and protected recovery make a stronger plan.'),
  ], 'The dragon opens the trail gate', 'Your stronger sign-in plan earned passage. No real account settings were changed.'),
  'hike-09': world('mail', 'NOVA', 'The urgent envelope is unverified', [
    step('message', 'The envelope is opened for inspection', 'The suspicious message is preserved as evidence.'),
    step('sender', 'The actual sender is underlined', 'The message’s From field differs from the trusted contact.'),
    step('contacts', 'Nova’s trusted radio channel lights up', 'The known directory gives you an independent verification route.'),
    step('decision', 'The suspicious request stays outside the route', 'You chose to preserve, verify independently, and report the message.'),
  ], 'The acorn becomes preserved evidence', 'The trusted verification route is selected; the suspicious message has not earned your trust.'),
  'hike-10': world('visitor', 'NOVA', 'The visitor gate is waiting for verification', [
    step('policy', 'The gate’s access boundary is marked', 'A visitor needs a booking and sponsor verification.'),
    step('log', 'The missing booking is marked', 'The visitor log does not show an approved booking.'),
    step('directory', 'The sponsor channel becomes available', 'The trusted directory identifies the proper contact.'),
    step('decision', 'A safe waiting area is selected', 'The visitor waits while the sponsor is verified. Staff access stays protected.'),
  ], 'The gate stays secure', 'A respectful sponsor handoff keeps the visitor comfortable and the access boundary intact.'),
  'hike-11': world('privacy', 'NOVA', 'The handoff sheet is still empty', [
    step('policy', 'The privacy boundary appears on the sheet', 'The operational audience does not need personal details.'),
    step('status', 'The operational relay status is selected', 'The useful fact is that the Glass Bridge service is offline.'),
    step('summary', 'A small operational summary reaches the folder', 'The handoff records the service status without copying hikers’ details.'),
    step('decision', 'The minimal handoff is approved', 'The authorized team gets the information its task needs.'),
  ], 'A useful summary, a smaller audience', 'The maintenance handoff protects the fictional hikers’ personal information.'),
  'hike-12': world('automation', 'PATCH', 'The backup machine is waiting for review', [
    step('script', 'The script opens on the review bench', 'The training terminal reads this script as text.'),
    step('guide', 'The quoting problem is marked', 'Paths with spaces need to remain one intended argument.'),
    step('original', 'The original script is preserved beside it', 'A before-copy is available for a later authorized change.'),
    step('review', 'The safer change request reaches the tray', 'The request calls for quoted paths, a source check, and backup verification.'),
    step('decision', 'The review gets a clear next step', 'The change is staged for review. The script has not run.'),
  ], 'The backup change is ready for review', 'The original is preserved and the requested safeguards are specific. Execution is still a separate step.'),
  'hike-13': world('network', 'PATCH', 'The lookout has an unlabelled route', [
    step('interface', 'Your lab address appears at the lookout', 'The interface record identifies this machine on the simulated network.'),
    step('gateway', 'The next hop is marked', 'The lab gateway is 192.0.2.1.'),
    step('resolve', 'academy.test gains an address marker', 'The lab lookup resolves the service to 192.0.2.20.'),
    step('decision', 'The address layers are connected', 'The interface, gateway, and resolved service answer different questions.'),
  ], 'A name and an address for the next clue', 'The lookout map has a known next hop. Application health has not been checked yet.'),
  'hike-14': world('dns', 'NOVA', 'Two signposts need an approved route', [
    step('academy', 'The academy address marker appears', 'academy.test resolves to 192.0.2.20 in the lab.'),
    step('example', 'The comparison address marker appears', 'example.test also resolves, to 192.0.2.10.'),
    step('approved', 'The approved signpost is outlined', 'The trusted destination record selects academy.test.'),
    step('decision', 'The approved route is selected', 'A DNS answer supplies an address. The approved record chooses the destination.'),
  ], 'One approved destination, two DNS answers', 'You have selected academy.test without treating name resolution as proof of trust.'),
  'hike-15': world('radio', 'NOVA', 'The radio awaits a bounded test', [
    step('guide', 'The troubleshooting ladder is unfolded', 'The guide keeps connectivity and application checks in order.'),
    step('dns', 'The lab destination is marked', 'The service name has a known lab address.'),
    step('ping', 'Two test packets appear across the valley', 'The simulated ping sent exactly two bounded requests.'),
    step('decision', 'The application check is queued next', 'ICMP evidence is one narrow result. Verified HTTPS is the next separate question.'),
  ], 'Two polite packets, one next question', 'The connectivity test is bounded. The service still needs its own application check.'),
  'hike-16': world('services', 'PATCH', 'The service doors need labels', [
    step('inventory', 'The documented service card is attached', 'The authorized inventory describes the relay agent.'),
    step('sockets', 'Door 8088 gains its listener light', 'The socket listing shows a listener on port 8088.'),
    step('processes', 'The listener connects to its process card', 'The process listing identifies relay-agent.'),
    step('decision', 'The expected service is marked for access review', 'Its documented role does not establish intended network exposure by itself.'),
  ], 'Door 8088 has a documented purpose', 'The relay agent stays running while its intended reachability can be reviewed.'),
  'hike-17': world('tls', 'NOVA', 'The uplink seal awaits a checked request', [
    step('policy', 'The certificate boundary is marked', 'The connection policy keeps certificate verification enabled.'),
    step('headers', 'The HTTPS response arrives with its seal', 'The simulated service returned an HTTP 200 response.'),
    step('status', 'The response gets its status label', 'The HTTP guide explains the response separately from content safety.'),
    step('decision', 'The trust check stays in place', 'You chose to investigate a certificate warning through trusted channels.'),
  ], 'The uplink responds with verification intact', 'The transport check remains enabled. A response does not guarantee harmless content.'),
  'hike-18': world('integrity', 'PATCH', 'The route file needs a trusted comparison', [
    step('reference', 'The trusted fingerprint card appears', 'The reference comes from the trusted record.'),
    step('hash', 'The route fingerprint is placed beside it', 'The computed digest matches the authored lab reference.'),
    step('decode', 'The dispatch unfolds into readable text', 'The decoded message says: Summit needs you.'),
    step('decision', 'The matching bytes are marked', 'A trusted hash comparison supports integrity. Base64 supplies no secrecy.'),
  ], 'The route matches its trusted fingerprint', 'The harmless dispatch is readable, and the file comparison has a trusted reference.'),
  'hike-19': world('patch', 'NOVA', 'The maintenance warning needs context', [
    step('advisory', 'The advisory reaches the planning board', 'The fictional warning identifies an affected relay-agent version.'),
    step('version', 'The installed version is pinned beside it', 'The inventory records version 4.1.0.'),
    step('policy', 'The safe-change checkpoints appear', 'The change policy requires backup, test, rollback, and verification.'),
    step('plan', 'The upgrade plan enters the review tray', 'The staged plan requests 4.2.1 and the required safeguards.'),
    step('decision', 'The applicable maintenance plan is selected', 'Prioritization follows the asset evidence and the controlled change process.'),
  ], 'A safer maintenance path is staged', 'A risk-aware plan is ready for review. No upgrade has been applied in this mission.'),
  'hike-20': world('firewall', 'NOVA', 'The access console needs a scoped request', [
    step('policy', 'The rescue path is marked on the console', 'The intended access record preserves authorized service traffic.'),
    step('review', 'The overbroad rule is highlighted', 'The review finding identifies the access that needs correction.'),
    step('listener', 'The 8088 listener is identified', 'The service exists; its listener and network access are separate facts.'),
    step('request', 'A narrow rule enters the request tray', 'The request restricts 8088 to 192.0.2.0/24 and retains rescue paths, rollback, and verification.'),
    step('decision', 'The rescue route stays in the proposed design', 'The scoped request reduces exposure without a blanket shutdown.'),
  ], 'A selective gate is ready for review', 'The firewall change is requested. Application of the rule still needs authorization and verification.'),
  'hike-21': world('logs', 'PATCH', 'The log strip is still unfiltered', [
    step('filter', 'The failed-event lines reach the strip', 'The filter preserves the outside-policy event for follow-up.'),
    step('count', 'Three event markers appear', 'The pipeline counts three matching lines.'),
    step('baseline', 'Two retries gain their baseline markers', 'The baseline explains two failures and leaves one lead to correlate.'),
    step('decision', 'The unexplained event stays on the board', 'You chose corroboration and preservation before making a compromise claim.'),
  ], 'Two explained retries and one open lead', 'The count describes events. The outside-policy event still needs correlation.'),
  'hike-22': world('incident', 'NOVA', 'The incident desk awaits correlated evidence', [
    step('timeline', 'The correlated timeline reaches the board', 'Audit, approved-state comparison, and operator confirmation establish unauthorized change.'),
    step('authority', 'The response boundary is marked', 'Authorization covers a narrow session and route-edit response.'),
    step('preserve', 'The audit copy is sealed in the case folder', 'The audit evidence has been preserved before recovery changes.'),
    step('request', 'The scoped containment request enters the tray', 'Revocation of S-17 and route-edit isolation are requested while preserving rescue traffic.'),
    step('decision', 'The authorized response is selected', 'The incident is confirmed. Requested containment is still distinguished from verified completion.'),
  ], 'A confirmed incident, an authorized request', 'The evidence is intact and containment is staged. Recovery completion has not been claimed.'),
  'hike-23': world('handoff', 'PATCH', 'The next operator needs a clear case sheet', [
    step('requirements', 'The handoff checklist opens', 'The next operator needs facts, impact, status, uncertainty, and ownership.'),
    step('facts', 'Verified facts reach the case sheet', 'The sanitized timeline records the known unauthorized route change.'),
    step('evidence', 'The sanitized timeline enters the folder', 'The evidence copy keeps completion unverified.'),
    step('report', 'The concise report lands in the handoff tray', 'The report records requested containment, unknown access method, and recovery verification.'),
    step('decision', 'The handoff keeps its honest status', 'The next owner can distinguish known facts from actions that still need verification.'),
  ], 'The next operator can pick up the case', 'The handoff is clear and sanitized. Requested actions remain separate from completed actions.'),
  'hike-24': world('beacon', 'PATCH', 'The Summit Beacon awaits your final checks', [
    step('closure', 'The verified closure reaches the console', 'The operator record establishes the completed response actions.'),
    step('hash', 'The recovered route matches its fingerprint', 'The restored file agrees with the trusted reference.'),
    step('permission', 'The private recovery note closes to its owner', 'The local recovery note now has permission 600.'),
    step('service', 'The final HTTPS response reaches the console', 'The simulated service returns HTTP 200 with verification enabled.'),
    step('decision', 'The final checks agree', 'The evidence supports an honest foundation closure. Reflect before lighting the summit.'),
  ], 'The Summit Beacon answers', 'The recovered route, private note, service, and closure agree. Hike Trail is complete; monitoring continues.'),
});

function authored(mission) {
  const original = Object.hasOwn(worlds, mission?.id) ? worlds[mission.id] : worlds['hike-01'];
  if (!Number.isInteger(mission?.practiceVariant) || mission.practiceVariant < 1) return original;
  // Practice cases change evidence, not just names. Select only authored variants;
  // no fixture text or terminal output is inserted into the drawing.
  const generalize = text => text
    .replaceAll('supplies/archive/route.conf', 'the route file in this case’s archive')
    .replaceAll('Pine Relay', 'the local relay')
    .replaceAll('Glass Bridge', 'this case’s bridge')
    .replaceAll('192.0.2.0/24', 'the approved source range')
    .replaceAll('192.0.2.20', 'its recorded lab address')
    .replaceAll('192.0.2.10', 'its comparison address')
    .replaceAll('192.0.2.1', 'the recorded lab gateway')
    .replaceAll('8088', 'the recorded lab port')
    .replaceAll('4.1.0', 'the affected lab version')
    .replaceAll('4.2.1', 'the approved target version')
    .replaceAll('S-17', 'the identified session');
  const config = { ...original, steps: original.steps.map(item => ({ ...item, title: generalize(item.title), detail: generalize(item.detail) })), done: generalize(original.done), doneDetail: generalize(original.doneDetail), practice: true };
  const choice = mission.objectives?.find(item => item.id === 'decision')?.check?.value;
  if (mission.id === 'hike-08' && choice === 'retain') {
    config.healthyAccount = true;
    config.steps[1] = step('reuse', 'The unique-password control is confirmed', 'This audit records no password reuse. Keep the existing unique credential.');
    config.steps[2] = step('mfa', 'The passkey MFA layer is confirmed', 'This audit records enabled passkey MFA. Keep the existing second layer.');
    config.steps[3] = step('decision', 'The dragon accepts your evidence-based review', 'Retain the existing protections, review recovery, and verify unexpected prompts.');
    config.doneDetail = 'You retained the existing unique credential and passkey MFA, with protected recovery and careful verification.';
  }
  if (mission.id === 'hike-18') {
    config.steps[2] = step('decode', 'The practice dispatch unfolds into readable text', 'You decoded this case’s harmless dispatch. Base64 supplied no secrecy.');
    if (choice === 'mismatch') {
      config.hashMismatch = true;
      config.steps[1] = step('hash', 'The route fingerprint differs from the reference', 'The computed digest does not match the trusted record. Hold this copy for verification.');
      config.steps[3] = step('decision', 'The differing copy is held for verification', 'Preserve the evidence and use Nova’s trusted release channel before relying on this file.');
      config.done = 'The discrepancy is preserved for review';
      config.doneDetail = 'The route differs from its trusted fingerprint. You held the copy and selected verification through the trusted release channel.';
    } else config.doneDetail = 'The route agrees with the trusted fingerprint in this case. Its harmless dispatch is decoded; Base64 supplied no secrecy.';
  }
  if (mission.id === 'hike-21') {
    const count = Number(mission.objectives?.find(item => item.id === 'count')?.check?.outputIncludes?.[0]);
    config.logCount = [3, 4, 5].includes(count) ? count : 3;
    config.steps[1] = step('count', 'The counted event markers appear', 'The pipeline counted the matching lines in this practice case.');
    config.steps[2] = step('baseline', 'The expected retries gain baseline markers', 'The baseline explains the known retries and leaves one outside-policy lead to correlate.');
    config.done = 'Expected retries and one open lead';
    config.doneDetail = 'The case’s event count has its own baseline. The remaining outside-policy event still needs correlation.';
  }
  if (mission.id === 'hike-24') config.doneDetail = 'This practice case’s recovered route, private note, service, and verified closure agree. The final checks support its closure.';
  return config;
}

function verifiedTasks(mission, session) {
  const config = authored(mission), verified = new Set();
  if (!Object.hasOwn(worlds, mission?.id) || !Array.isArray(mission.objectives) || !Array.isArray(session?.tasks)) return verified;
  // A boolean from an unrelated or malformed saved task list is not evidence.
  if (mission.objectives.length !== config.steps.length || mission.objectives.some((objective, index) => objective?.id !== config.steps[index].id)) return verified;
  for (let index = 0; index < config.steps.length - 1; index += 1) {
    if (session.tasks[index] === true) verified.add(config.steps[index].id);
  }
  if (verified.size === config.steps.length - 1 && session.tasks[config.steps.length - 1] === true) verified.add('decision');
  return verified;
}

export function getWorldState(mission, session, completed = false) {
  const config = authored(mission), verified = verifiedTasks(mission, session);
  const secured = verified.size === config.steps.length;
  const finished = completed === true && secured;
  const phase = finished ? 'complete' : secured ? 'secured' : verified.size === config.steps.length - 1 ? 'ready' : verified.size ? 'discovering' : 'waiting';
  const last = config.steps.findLast(item => verified.has(item.id));
  let title = finished ? config.done : last?.title || config.waiting;
  let detail = finished ? config.doneDetail : last?.detail || 'Follow the mission evidence to change this field feed.';
  if (mission?.id === 'hike-06' && ['approval', 'preserve', 'restore', 'verify'].every(id => verified.has(id)) && !finished) {
    title = config.practice ? 'This case’s first relay signal turns green' : 'Pine Relay’s first signal turns green';
    detail = 'The approved route has been preserved, restored, and inspected. One local signal is back.';
  }
  return { phase, title, detail, actor: config.actor, effect: finished && config.kind === 'beacon' ? 'beacon' : mission?.id === 'hike-06' && verified.has('verify') && verified.has('restore') && verified.has('preserve') && verified.has('approval') ? 'signal' : verified.size ? 'evidence' : 'none', stage: verified.size, kind: config.kind };
}

// These helpers receive application constants, never supplied strings.
const bit = (task, body, classes = '', requires = task) => `<g class="world-bit ${classes}" data-world-task="${task}" data-world-requires="${requires}" data-revealed="false">${body}</g>`;
const line = (d, extra = '') => `<path class="world-route ${extra}" d="${d}"/>`;
const paper = (x, y, width = 220, height = 190) => `<rect class="world-paper" x="${x}" y="${y}" width="${width}" height="${height}" rx="10"/>`;
const tick = (x, y, size = 36) => `<circle class="world-confirm" cx="${x}" cy="${y}" r="${size}"/><path class="world-tick" d="M${x - size / 2} ${y}l${size / 3} ${size / 3} ${size * .7} -${size * .7}"/>`;
const lock = (x, y) => `<path class="world-metal" d="M${x - 25} ${y}v-20a25 25 0 0 1 50 0v20"/><rect class="world-confirm" x="${x - 37}" y="${y}" width="74" height="60" rx="10"/><path class="world-ink" d="M${x} ${y + 19}v22"/>`;
const rows = (x, y, length = 140) => `<path class="world-ink" d="M${x} ${y}h${length}m-${length} 28h${length * .73}m-${length * .73} 28h${length * .85}"/>`;
const point = (x, y) => `<circle class="world-point" cx="${x}" cy="${y}" r="20"/><circle class="world-point-core" cx="${x}" cy="${y}" r="7"/>`;
const summitGlass = '<path class="world-lamp-off" d="M232 223q49-14 98 0v111q-49 17-98 0z"/><path class="world-lamp-frame" d="M242 221v116m25-119v123m26-123v123m26-120v116M232 223h98m-98 111h98"/>';

function drawing(config) {
  const ids = config.steps.map(item => item.id), tasks = ids.join(' ');
  const reveal = (index, body, classes = '', requires = ids[index]) => bit(ids[index], body, classes, requires);
  const decision = body => bit('decision', body, 'world-decision', tasks);
  const complete = (body, classes = '') => bit('complete', body, `world-completion ${classes}`, `${tasks} complete`);
  const caseBase = paper(400, 540, 310, 205);
  const caseWork = () => caseBase + ids.slice(0, -1).map((id, index) => reveal(index, `<path class="world-ink" d="M430 ${574 + index * 39}h${170 - index * 17}"/>${tick(670, 574 + index * 39, 12)}`)).join('') + decision(tick(545, 646, 39)) + complete(`<path class="world-folder-edge" d="M385 532h135l28 25h178v197H385z"/>`);
  switch (config.kind) {
    case 'welcome': return '<g class="world-dark-signals"><ellipse cx="903" cy="162" rx="26" ry="36"/><ellipse cx="912" cy="278" rx="25" ry="32"/><ellipse cx="921" cy="376" rx="25" ry="32"/></g>' + reveal(0, point(547, 657) + line('M547 657v-79')) + reveal(1, paper(175, 659, 125, 95) + tick(235, 699, 22)) + reveal(2, line('M558 648Q640 553 722 615T835 559', 'world-dotted')) + decision(tick(830, 556, 27)) + complete('<path class="world-ink" d="M175 704h72"/>');
    case 'map': return reveal(0, '<path class="world-drawer" d="M180 358h311v87H180z"/>') + reveal(1, point(371, 705) + line('M290 730l55-17')) + reveal(2, line('M371 705Q457 674 516 716T692 622T837 660') + point(692, 622) + point(837, 660)) + decision('<path class="world-route-select" d="M371 705Q457 674 516 716T692 622T837 660"/>') + complete(tick(837, 660, 27));
    case 'owl': return '<path class="world-receipt-blank" d="M641 409h111q-3 84 18 149l13 225q-10 22-107 9l-8-216q-4-94-27-167z"/>' + reveal(0, rows(666, 449, 67), 'world-print') + reveal(1, rows(680, 573, 70), 'world-print') + reveal(2, '<rect class="world-warning-paper" x="684" y="694" width="77" height="69" rx="5"/><path class="world-alert-line" d="M695 716h51m-51 23h37"/>', 'world-print') + decision('<path class="world-route-select" d="M692 771h61"/>') + complete(tick(730, 773, 23));
    case 'breadcrumbs': return reveal(0, line('M642 755Q538 740 480 699', 'world-breadcrumb-route') + '<circle class="world-crumb" cx="619" cy="748" r="16"/><circle class="world-crumb" cx="552" cy="726" r="14"/>') + reveal(1, line('M480 699Q340 653 247 601', 'world-breadcrumb-route') + '<circle class="world-crumb" cx="418" cy="678" r="17"/><circle class="world-crumb" cx="334" cy="645" r="15"/><circle class="world-crumb" cx="250" cy="604" r="18"/>') + reveal(2, paper(112, 549, 139, 104) + rows(134, 572, 79)) + decision(tick(198, 604, 23)) + complete('<path class="world-route-select" d="M642 755Q480 699 247 601"/>');
    case 'notes': return reveal(0, '<path class="world-folder" d="M313 578h118l32 30h261v156H313z"/>') + reveal(1, paper(353, 551, 142, 166) + rows(373, 582, 92)) + reveal(2, paper(510, 568, 170, 157) + rows(531, 602, 112)) + decision(tick(616, 685, 27)) + complete('<path class="world-folder-edge" d="M312 714h411v49H312z"/>');
    case 'lantern': return '<g class="world-obscurer" data-world-requires="approval preserve restore verify" data-revealed="false"><path class="world-lamp-off" d="M708 195q43-19 85 0l25 77-17 71q-48 20-94 0l-20-71z"/><path class="world-lamp-frame" d="M708 195l93 148m-114-71l106-77m-86 148l111-71M708 195h85m-86 148h94"/></g>' + reveal(0, paper(283, 589, 149, 95) + tick(357, 633, 19)) + reveal(1, paper(181, 681, 122, 74) + paper(204, 666, 122, 74)) + reveal(2, line('M427 648Q590 534 716 371', 'world-dotted')) + reveal(3, '<ellipse class="world-light-halo" cx="753" cy="277" rx="111" ry="130"/><ellipse class="world-light-core" cx="753" cy="277" rx="15" ry="24"/><path class="world-light-rays" d="M642 271l-40-6m256 6l40-6M669 197l-29-25m197 25l29-25"/>', 'world-signal-glow', 'approval preserve restore verify') + decision(tick(703, 365, 25)) + complete('<path class="world-light-link" d="M802 250L982 159"/>');
    case 'private': return paper(198, 638, 195, 109) + reveal(0, '<path class="world-drawer" d="M186 626h219v133H186z"/>') + reveal(1, '<circle class="world-warning" cx="241" cy="690" r="19"/><circle class="world-warning" cx="291" cy="690" r="19"/><circle class="world-warning" cx="341" cy="690" r="19"/>') + reveal(2, '<rect class="world-paper" x="202" y="645" width="184" height="91" rx="8"/>' + lock(295, 674)) + decision('<path class="world-dotted world-alert-line" d="M397 678h84v61"/>') + complete(tick(418, 713, 21));
    case 'dragon': return reveal(0, paper(168, 509, 165, 146) + rows(187, 538, 111)) + reveal(1, config.healthyAccount ? tick(709, 459, 28) : '<circle class="world-warning" cx="709" cy="459" r="28"/><path class="world-ink" d="M700 451l18 18m0-18l-18 18"/>') + reveal(2, config.healthyAccount ? tick(710, 533, 25) : '<rect class="world-warning" x="685" y="511" width="50" height="43" rx="7"/><path class="world-ink" d="M710 520v20"/>') + decision(tick(284, 600, 25)) + complete('<path class="world-gate-opening" d="M456 611h381v214H456z"/><path class="world-gate-door" d="M819 611l106-31v209l-106 36z"/><path class="world-gate-plank" d="M844 613v188m27-197v188m27-197v188"/><path class="world-route-select" d="M601 877q-32-125 91-224"/>' + lock(833, 656), 'world-gate-open');
    case 'mail': return reveal(0, '<path class="world-drawer" d="M224 409l418-20 42 318-443 25z"/>') + reveal(1, paper(255, 451, 311, 79) + '<path class="world-alert-line" d="M277 482h250m-250 27h161"/>') + reveal(2, '<path class="world-radio-wave" d="M815 360q-26-30 0-59m22 69q-39-39 0-79"/>') + decision('<circle class="world-evidence-seal" cx="465" cy="634" r="58"/><path class="world-alert-line" d="M436 604l59 59"/>') + complete(tick(652, 690, 29));
    case 'visitor': return reveal(0, '<path class="world-drawer" d="M33 429h313v255H33z"/>') + reveal(1, paper(404, 591, 223, 96) + '<path class="world-alert-line" d="M430 625h154m-154 30h100"/>') + reveal(2, '<path class="world-radio-wave" d="M724 441q-31-45 0-90m24 105q-49-60 0-119"/>') + decision('<path class="world-waiting-area" d="M711 594h181v79H711zM728 673v52m147-52v52"/>') + complete(tick(289, 578, 32));
    case 'privacy': return caseBase + reveal(0, '<path class="world-drawer" d="M389 529h331v226H389z"/>') + reveal(1, rows(430, 576, 196)) + reveal(2, paper(587, 587, 169, 130) + '<path class="world-ink" d="M606 616h127m-127 26h76"/>') + decision(lock(443, 655)) + complete(tick(706, 685, 22));
    case 'automation': return paper(324, 551, 242, 197) + reveal(0, rows(347, 585, 159)) + reveal(1, '<path class="world-quote" d="M342 623l-12 25h17m161-25l-12 25h17"/>') + reveal(2, paper(561, 565, 127, 153) + rows(579, 595, 87)) + reveal(3, paper(675, 583, 162, 148) + '<path class="world-ink" d="M695 613h110m-110 30h83m-83 30h99"/>') + decision('<path class="world-dotted world-route" d="M558 651h110"/>') + complete(tick(792, 700, 24));
    case 'network': return reveal(0, paper(185, 578, 158, 98) + point(267, 625)) + reveal(1, line('M343 625L488 534') + point(488, 534)) + reveal(2, line('M488 534L813 390', 'world-dotted') + point(813, 390)) + decision('<path class="world-route-select" d="M267 625L488 534L813 390"/>') + complete(tick(813, 390, 25));
    case 'dns': return reveal(0, point(783, 362) + line('M441 594L783 362', 'world-dotted')) + reveal(1, point(347, 425) + line('M441 594L347 425', 'world-dotted')) + reveal(2, '<path class="world-route-select" d="M441 594L783 362"/>') + decision(tick(783, 362, 30)) + complete('<path class="world-ink" d="M327 490h38"/>');
    case 'radio': return reveal(0, paper(126, 576, 164, 136) + rows(148, 612, 100)) + reveal(1, point(807, 348)) + reveal(2, line('M383 513L807 348', 'world-dotted') + '<path class="world-packet" d="M470 460l34-14 21 29-35 14zM620 402l34-14 21 29-35 14z"/>') + decision(paper(615, 563, 143, 81) + lock(687, 578)) + complete(tick(505, 475, 22));
    case 'services': return paper(197, 410, 190, 156) + paper(456, 469, 194, 154) + reveal(0, rows(220, 438, 120)) + reveal(1, '<rect class="world-service-light" x="212" y="489" width="154" height="58" rx="8"/><text class="world-number" x="289" y="528">' + (config.practice ? 'PORT' : '8088') + '</text>') + reveal(2, line('M388 529h67') + rows(476, 498, 140)) + decision('<circle class="world-drawer" cx="551" cy="548" r="58"/>') + complete(tick(636, 590, 26));
    case 'tls': return reveal(0, '<path class="world-dotted world-route" d="M247 480L719 380"/>') + reveal(1, line('M247 480L719 380') + paper(584, 419, 163, 129) + lock(664, 433)) + reveal(2, '<text class="world-number" x="669" y="529">200</text>') + decision(tick(286, 472, 30)) + complete('<path class="world-route-select" d="M319 465L560 414"/>');
    case 'integrity': return paper(328, 629, 329, 151) + reveal(0, '<path class="world-fingerprint" d="M351 651h14m12 0h37m12 0h20m12 0h46m12 0h42m12 0h45"/>') + reveal(1, config.hashMismatch ? '<path class="world-fingerprint world-fingerprint-mismatch" d="M351 691h28m12 0h13m12 0h49m12 0h21m12 0h18m12 0h79"/>' : '<path class="world-fingerprint" d="M351 691h14m12 0h37m12 0h20m12 0h46m12 0h42m12 0h45"/>') + reveal(2, paper(665, 625, 178, 139) + rows(686, 658, 123)) + decision(config.hashMismatch ? '<circle class="world-warning" cx="628" cy="718" r="23"/><path class="world-ink" d="M628 704v17m0 9v1"/>' : tick(628, 718, 23)) + complete(config.hashMismatch ? '<path class="world-proposal" d="M349 739h238"/>' : '<path class="world-route-select" d="M349 739h238"/>');
    case 'patch': return summitGlass + caseWork() + reveal(3, '<path class="world-dotted world-route" d="M710 613h135v-60"/>');
    case 'firewall': return summitGlass + '<rect class="world-console" x="360" y="485" width="337" height="199" rx="15"/>' + reveal(0, line('M389 640h277')) + reveal(1, '<path class="world-alert-line" d="M398 522h260"/>') + reveal(2, '<text class="world-number" x="531" y="571">' + (config.practice ? 'PORT' : '8088') + '</text>') + reveal(3, paper(710, 534, 146, 158) + rows(729, 567, 96)) + decision('<path class="world-proposal" d="M397 598h260m-117-79v114"/>') + complete(tick(820, 662, 23));
    case 'logs': {
      const count = config.logCount || 3, positions = Array.from({ length: count }, (_, index) => 400 + index * (216 / (count - 1)));
      return summitGlass + paper(364, 525, 309, 227) + reveal(0, rows(388, 558, 244)) + reveal(1, positions.map(x => `<circle class="world-warning" cx="${x}" cy="684" r="21"/>`).join('')) + reveal(2, positions.slice(0, -1).map(x => tick(x, 684, 21)).join('')) + decision('<circle class="world-drawer" cx="616" cy="684" r="34"/><path class="world-route" d="M650 682l31-12"/>') + complete('<path class="world-dotted world-route" d="M682 670h71"/>');
    }
    case 'incident': return summitGlass + caseWork() + reveal(3, '<path class="world-proposal" d="M738 561h96v86h-96zM710 597h28"/>') + reveal(1, '<path class="world-route" d="M729 715h136"/>');
    case 'handoff': return summitGlass + caseWork() + reveal(2, paper(729, 553, 136, 173) + rows(749, 585, 87)) + reveal(3, '<path class="world-dotted world-route" d="M705 649h33"/>');
    case 'beacon': return '<g class="world-obscurer" data-world-requires="closure hash permission service decision complete" data-revealed="false">' + summitGlass + '</g>' + reveal(0, paper(658, 636, 171, 124) + rows(677, 665, 109)) + reveal(1, '<path class="world-fingerprint" d="M346 526h17m10 0h22m10 0h36m10 0h23m10 0h31"/>') + reveal(2, lock(374, 604)) + reveal(3, '<rect class="world-service-light" x="472" y="581" width="128" height="50" rx="7"/><text class="world-number" x="536" y="616">200</text>') + decision(tick(667, 667, 28)) + complete('<path class="world-beacon-beam" d="M255 270L12 116v285l243-83M309 270L909 19v519L309 318"/><ellipse class="world-beacon-halo" cx="281" cy="279" rx="111" ry="151"/><ellipse class="world-light-core" cx="281" cy="279" rx="13" ry="43"/><path class="world-light-rays" d="M185 269l-74-28m259 28l84-28M281 172v-55"/>', 'world-beacon-light');
    default: return '';
  }
}

export function renderWorld(mission) {
  const config = authored(mission);
  return `<div class="world-reactor" data-kind="${config.kind}" data-phase="waiting" data-stage="0" data-verified="" aria-hidden="true"><svg class="world-drawing" viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false" aria-hidden="true">${drawing(config)}</svg></div><span class="world-status-text">${config.waiting}</span>`;
}

export function updateWorld(node, mission, session, completed = false) {
  const state = getWorldState(mission, session, completed);
  if (!node) return state;
  const reactor = node.matches?.('.world-reactor') ? node : node.querySelector?.('.world-reactor');
  if (!reactor) return state;
  const verified = verifiedTasks(mission, session);
  if (state.phase === 'complete') verified.add('complete');
  const previous = new Set((reactor.dataset.verified || '').split(' ').filter(Boolean));
  reactor.dataset.kind = state.kind;
  reactor.dataset.phase = state.phase;
  reactor.dataset.stage = String(state.stage);
  reactor.dataset.verified = [...verified].join(' ');
  node.dataset.worldPhase = state.phase;
  node.dataset.worldKind = state.kind;
  for (const element of reactor.querySelectorAll('[data-world-requires]')) {
    const requirements = element.dataset.worldRequires.split(' ');
    const revealed = requirements.every(id => verified.has(id));
    const wasRevealed = requirements.every(id => previous.has(id));
    element.dataset.revealed = String(revealed);
    element.classList.toggle('is-new', revealed && !wasRevealed);
  }
  const text = node.querySelector?.('.world-status-text');
  if (text) text.textContent = `${state.title}. ${state.detail}`;
  const viewport = node.matches?.('.scene-viewport') ? node : node.querySelector?.('.scene-viewport');
  if (viewport) {
    viewport.dataset.worldOriginalAlt ||= viewport.getAttribute('aria-label') || '';
    viewport.setAttribute('aria-label', `${viewport.dataset.worldOriginalAlt} ${state.title}. ${state.detail}`.trim());
  }
  return state;
}
