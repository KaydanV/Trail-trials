// Story-specific presentation, kept separate from curriculum and completion rules.
// The atlases have six illustrated locations each, in a 3 × 2 grid. Related
// missions share a truthful location, with a different illustrated evidence prop.
const EARLY = 'assets/scenes/trail-act1-atlas.webp';
const LATER = 'assets/scenes/trail-later-atlas.webp';
const positions = ['0% 0%', '50% 0%', '100% 0%', '0% 100%', '50% 100%', '100% 100%'];
const panel = (asset, index, palette, alt) => ({ asset, position: positions[index], palette, alt });
const panels = Object.freeze({
  welcome: panel(EARLY, 0, 'dawn', 'A mountain welcome hut at pink sunrise, with dark signal lamps, trail signs, and a camp table.'),
  maps: panel(EARLY, 1, 'dawn', 'Open filing drawers in a map cabinet, with a large mountain route map on the table.'),
  owl: panel(EARLY, 2, 'canopy', 'A carved mechanical wooden owl on the relay porch, printing a curled receipt.'),
  burrow: panel(EARLY, 3, 'canopy', 'A safety-vest squirrel holds a breadcrumb outside a woodland supply burrow, among crates and mushrooms.'),
  desk: panel(EARLY, 4, 'canopy', 'A covered wet field desk holds a notebook, an open folder, and a paper stack; a moth flies nearby.'),
  lantern: panel(EARLY, 5, 'signal', 'The relay lantern room contains a green beacon bulb, an open approval folder, and a repair bench.'),
  keeper: panel(LATER, 0, 'canopy', 'The keeper cabin and its playful dragon-shaped account gate.'),
  post: panel(LATER, 1, 'canopy', 'A forest post with the suspicious acorn-themed letter waiting to be inspected.'),
  bridge: panel(LATER, 2, 'canopy', 'The Glass Bridge compound, with a visitor gate and sheltered desks for rescue work and equipment.'),
  lookout: panel(LATER, 3, 'dawn', 'A misty bridge and network lookout, with relay antennas pointing across the valley.'),
  tower: panel(LATER, 4, 'signal', 'The relay tower interior, with service equipment, uplink instruments, and an archive workbench.'),
  summit: panel(LATER, 5, 'storm', 'The stormy Summit Beacon control room, with rain at the windows and signal consoles.'),
});

// Every SVG body below is static application data. Unknown inputs select a
// known icon; no supplied string is interpolated into SVG markup.
const iconBodies = Object.freeze({
  signal: '<path d="M60 26v62M41 88h38M53 88l7-25 7 25"/><circle cx="60" cy="26" r="5"/><path d="M46 17a18 18 0 0 0 0 25M74 17a18 18 0 0 1 0 25M35 7a32 32 0 0 0 0 45M85 7a32 32 0 0 1 0 45"/><path d="M22 99h76"/>',
  scope: '<path d="M34 18h43l13 14v68H34zM77 18v16h13M45 48h21M45 61h18"/><path d="M73 60l18 7v13c0 11-10 20-18 24-8-4-18-13-18-24V67zM65 81l6 6 11-14"/>',
  robot: '<rect x="27" y="35" width="66" height="51" rx="17"/><path d="M60 24v11M49 89v10M71 89v10M23 52h-8v19h8M97 52h8v19h-8"/><circle cx="60" cy="21" r="4"/><circle cx="44" cy="56" r="6"/><circle cx="76" cy="56" r="6"/><path d="M43 71q17 16 34 0"/>',
  map: '<path d="M16 31l29-12 30 12 29-12v72l-29 12-30-12-29 12zM45 19v72M75 31v72"/><path d="M30 66l13-20 14 11 24-23M76 35l5-1-1 6"/><circle cx="30" cy="66" r="5"/><path d="M79 73l7-12 7 12z"/>',
  folder: '<path d="M15 36h35l10 11h45v51H15zM18 31h29l8 9h45v7"/><path d="M36 63h49M36 76h35M36 88h22"/>',
  owl: '<path d="M31 28l5-13 18 14h12l18-14 5 13v35c0 22-17 33-29 33S31 85 31 63z"/><circle cx="45" cy="48" r="12"/><circle cx="75" cy="48" r="12"/><circle cx="45" cy="48" r="3"/><circle cx="75" cy="48" r="3"/><path d="M56 59l4 7 4-7M47 91v13M73 91v13M20 104h80M38 69l8 9M82 69l-8 9"/>',
  receipt: '<path d="M31 14h58v92l-8-5-8 5-8-5-8 5-8-5-9 5-9-5zM44 34h32M44 48h22M44 63h32M44 78h19"/><circle cx="80" cy="80" r="12"/><path d="M76 80l3 3 6-7"/>',
  squirrel: '<path d="M41 71C9 87 7 47 28 38c14-6 23 10 13 15-7 3-12-4-8-8M40 67c-2-20 5-38 20-38l5-14 9 16c11 5 13 15 8 24l-8 12v27H42zM50 31l-4-12-10 13M42 67l32 8M48 61l16 7 9-5M45 96h-9M72 96h11"/><circle cx="68" cy="43" r="2"/><path d="M86 62l13-6 7 8-10 8zM43 73l11 6v15M68 75v19"/>',
  evidence: '<path d="M19 40h34l9 11h39v52H19zM31 51V20h46l13 14v17M77 20v15h13M42 38h22M42 49h17"/><circle cx="58" cy="77" r="14"/><path d="M68 87l13 13M51 77l5 5 9-11"/>',
  lantern: '<path d="M43 37h34l9 54H34zM43 28h34v9M48 27c0-21 24-21 24 0M31 93h58v10H31M45 86h30M60 48v24"/><path d="M55 64q-13 9 0 16h10q13-7 0-16M18 47l10 4M92 51l10-4M16 69h12M92 69h12"/>',
  key: '<circle cx="41" cy="44" r="24"/><circle cx="41" cy="44" r="8"/><path d="M58 61l41 41h11V91L94 75l-9 9-9-9 9-9-11-11"/>',
  dragon: '<path d="M21 75l13-26 18-8 2-19 15 11 9-10 6 18 21 12-14 11-17-4-5 11 15 18H35zM35 75l-11 17M40 92h31M44 52l12 10M23 54l-11-13 5 29M76 91l13 8"/><circle cx="73" cy="43" r="2"/><path d="M87 57h11M42 76l13-4 12 6"/>',
  mfa: '<rect x="25" y="14" width="50" height="93" rx="10"/><path d="M43 25h14M45 96h10"/><circle cx="50" cy="58" r="18"/><path d="M41 58l6 6 12-14M84 34l22 8v18c0 13-13 24-22 27-9-3-16-10-20-18"/>',
  'acorn-mail': '<path d="M12 42h96v57H12zM12 43l48 33 48-33M12 99l32-30M108 99L76 69"/><path d="M42 29c-2-19 38-19 36 0M40 29h40M44 29c0 13 8 22 16 27 8-5 16-14 16-27M59 13l5-7M49 25h21"/>',
  'badge-cookie': '<path d="M40 14h40v13H40zM45 27v8M75 27v8"/><path d="M23 55c-2-13 9-24 22-23 12-10 24-5 31 5 16-2 28 12 23 26 9 11 2 28-10 31-5 15-24 17-34 8-14 4-28-7-25-20-11-8-13-21-7-27z"/><circle cx="47" cy="53" r="3"/><circle cx="80" cy="58" r="3"/><circle cx="40" cy="82" r="3"/><circle cx="72" cy="87" r="3"/><path d="M55 63h15v13H55z"/>',
  privacy: '<path d="M29 19h48l13 14v69H29zM77 19v15h13M40 44h29M40 57h14M40 86h14"/><rect x="59" y="69" width="38" height="30" rx="5"/><path d="M67 69V58a11 11 0 0 1 22 0v11M78 81v8"/>',
  script: '<path d="M30 15h47l15 15v75H30zM77 15v17h15M47 48l-10 10 10 10M76 48l10 10-10 10M66 43L55 73M43 88h34"/>',
  network: '<circle cx="60" cy="54" r="19"/><rect x="12" y="10" width="29" height="20" rx="4"/><rect x="79" y="10" width="29" height="20" rx="4"/><rect x="12" y="90" width="29" height="20" rx="4"/><rect x="79" y="90" width="29" height="20" rx="4"/><path d="M33 30l15 12M87 30L72 42M33 90l15-21M87 90L72 69M48 54h24M60 35v38"/>',
  dns: '<path d="M13 31h42v25H13zM65 67h42v25H65zM22 42h24M74 79h24M33 57v23h31M87 66V43H56M58 38l-5 5 5 5M60 75l5 5-5 5"/><circle cx="85" cy="18" r="11"/><path d="M79 18h12M85 7v22M24 95h18"/>',
  radio: '<rect x="27" y="40" width="66" height="60" rx="9"/><path d="M34 40V19l44-10M27 51h66M40 62h17v18H40M69 65h11M69 76h11M69 87h11M40 87h17"/><path d="M91 17a18 18 0 0 1 0 24M101 10a28 28 0 0 1 0 39"/>',
  ports: '<rect x="15" y="23" width="90" height="76" rx="7"/><path d="M15 44h90M15 72h90M27 33h7M43 33h7M27 58h7M43 58h7M27 86h7M43 86h7M76 28h15v9H76zM76 52h15v12H76zM76 80h15v12H76z"/>',
  tls: '<rect x="15" y="21" width="90" height="77" rx="8"/><path d="M15 41h90M26 31h2M37 31h2M48 31h2"/><rect x="42" y="65" width="36" height="24" rx="4"/><path d="M48 65V56a12 12 0 0 1 24 0v9M60 76v5"/>',
  fingerprint: '<path d="M25 54c0-48 70-48 70 0M34 77V54c0-35 52-35 52 0v17M43 86V54c0-24 34-24 34 0v30M52 93V54c0-10 16-10 16 0v35M61 54v43M25 64v8M95 63v10M77 94v5M43 98v5M86 83v9"/>',
  patch: '<path d="M35 31h50l16 29-16 29H35L19 60z"/><path d="M38 60h44M60 38v44M45 46l30 28M75 46L45 74"/><path d="M18 20l14 8M88 93l15 8M19 98l13-8M89 28l14-8"/>',
  firewall: '<path d="M17 32h86v62H17zM17 53h86M17 74h86M38 32v21M81 32v21M60 53v21M38 74v20M81 74v20"/><path d="M44 27c-8-11 4-18 5-22 0 9 12 9 9 20M65 26c-3-8 10-9 8-18 9 10 14 12 9 21"/>',
  logs: '<path d="M23 17h74v86H23zM35 34h10M53 34h31M35 49h10M53 49h31M35 64h10M53 64h18M35 79h10M53 79h31M35 94h10M53 94h22"/><path d="M13 58l8 6-8 6M100 76l9 6-9 6"/>',
  incident: '<path d="M60 17l48 83H12zM60 43v29"/><circle cx="60" cy="86" r="3"/><path d="M30 20l-8-9M91 20l8-9M11 51H3M117 51h-8"/>',
  report: '<path d="M27 18h47l16 16v71H27zM74 18v17h16M40 46h36M40 62h36M40 78h20M40 94h20"/><circle cx="88" cy="87" r="20"/><path d="M77 87l7 7 15-17"/>',
  beacon: '<path d="M49 24h22v29H49zM49 24l11-12 11 12M52 53l-9 46M68 53l9 46M41 99h38M53 78h14M50 88h20M52 66h16"/><path d="M40 29L13 14v40l27-15M80 29l27-15v40L80 39"/><circle cx="60" cy="37" r="5"/>',
});

export function renderPropIcon(propName) {
  const body = Object.hasOwn(iconBodies, propName) ? iconBodies[propName] : iconBodies.signal;
  return `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

const cut = (panelName, focus, label, prop, title, text) => ({ panelName, focus, label, prop, clue: { title, text, icon: prop } });
const storyShots = Object.freeze({
  'hike-01': [
    cut('welcome', 'signal-lost', 'Welcome hut · The signal goes quiet', 'signal', 'Something has changed', 'The signs are offline. Start with your location, identity, and permission.'),
    cut('welcome', 'meet-patch', 'Welcome hut · Meet your field companion', 'robot', 'Patch is on your side', 'Big buttons can wait. Your first investigation starts with small, sensible steps.'),
    cut('welcome', 'authorized-briefing', 'Welcome hut · Your first field briefing', 'scope', 'Keep it in the lab', 'Read the briefing before touching the relay. The terminal is your torch.'),
  ],
  'hike-02': [
    cut('maps', 'filing-cabinet', 'Map cabinet · Patch’s filing system', 'folder', 'A folder called maps', 'The cabinet has a lot of things. Start by looking for the map directory.'),
    cut('maps', 'route-map', 'Map cabinet · Find your place', 'map', 'One path at a time', 'List the folders, move into maps, and check where you landed.'),
    cut('welcome', 'trail-route', 'Basecamp · The route ahead', 'map', 'Know the trail', 'The route links Pine Relay, Glass Bridge, and Summit Beacon. Follow the known assets.'),
  ],
  'hike-03': [
    cut('owl', 'owl-receipt', 'Pine Relay · The owl’s receipt', 'owl', 'A clue with feathers', 'The mechanical owl is printing. Its guide explains what HOOT actually means.'),
    cut('desk', 'printer-guide', 'Pine Relay · Read the receipt and guide', 'receipt', 'Let the evidence speak', 'Read the guide, then compare the beginning and end of the relay log.'),
    cut('lantern', 'missing-route', 'Pine Relay · A missing configuration', 'logs', 'A useful lead', 'The latest entries point to a missing route file. That is a lead, not an accusation.'),
  ],
  'hike-04': [
    cut('burrow', 'breadcrumb-squirrel', 'Supply burrow · A helpful squirrel', 'squirrel', 'Follow the breadcrumb', 'A safety-vest squirrel has a clue. Your target is the file called route.conf.'),
    cut('burrow', 'crate-search', 'Supply burrow · Search the archive crates', 'folder', 'Find the right box', 'Search filenames first; then search the contents of the file you found.'),
    cut('desk', 'backup-provenance', 'Field desk · Check the backup’s source', 'evidence', 'Found is not verified', 'Read Nova’s provenance note before deciding whether the backup is suitable.'),
  ],
  'hike-05': [
    cut('desk', 'wet-field-desk', 'Field desk · A home for the facts', 'evidence', 'Keep the original', 'Give the investigation its own folder and preserve a copy of the relay status.'),
    cut('desk', 'patch-memory', 'Field desk · Better than Patch’s memory', 'robot', 'Write it down', 'Moths are distracting. A factual note is easier to hand over than a vague memory.'),
    cut('desk', 'case-note', 'Field desk · Leave a clear breadcrumb', 'report', 'Facts before theories', 'Record the outage and mark the cause unconfirmed. Use a new file for your note.'),
  ],
  'hike-06': [
    cut('lantern', 'approved-recovery', 'Lantern room · A trusted recovery', 'lantern', 'Read the approval', 'The recovery instruction names the exact files. Keep this first change small.'),
    cut('desk', 'before-copy', 'Field desk · Preserve the before-copy', 'evidence', 'A reversible step', 'Keep the faulty configuration before restoring the approved backup.'),
    cut('lantern', 'first-green-light', 'Lantern room · One light comes back', 'signal', 'Check what changed', 'Inspect the restored destination. The first green light should agree with the evidence.'),
  ],
  'hike-07': [
    cut('keeper', 'key-doormat', 'Keeper cabin · A key under the doormat', 'key', 'Access has an audience', 'A private recovery note should not be readable by everyone.'),
    cut('keeper', 'access-policy', 'Keeper cabin · Read the access policy', 'scope', 'Only what is needed', 'Inspect the permissions and compare them with the owner-only requirement.'),
    cut('keeper', 'private-note', 'Keeper cabin · A smaller audience', 'privacy', 'Restrict future access', 'Permission 600 protects the local note. A previously exposed secret would still need rotation.'),
  ],
  'hike-08': [
    cut('keeper', 'password-dragon', 'Account gate · The password dragon', 'dragon', 'A gate with opinions', 'A clever-looking word is not a complete account protection plan.'),
    cut('keeper', 'account-standard', 'Account gate · Read the sign-in standard', 'key', 'Unique, long, protected', 'Use a password manager. No real passwords belong in this game.'),
    cut('keeper', 'stronger-signin', 'Account gate · Build a better gate', 'mfa', 'More than one layer', 'Find the audit weaknesses and choose stronger sign-in with protected recovery.'),
  ],
  'hike-09': [
    cut('post', 'urgent-acorn', 'Forest post · The urgent acorn', 'acorn-mail', 'Urgent is not verified', 'A golden envelope claims to be from Nova. Inspect the message before acting.'),
    cut('post', 'sender-inspection', 'Forest post · Read the actual sender', 'receipt', 'Slow the message down', 'Compare the sender and requested destination with the trusted directory.'),
    cut('post', 'trusted-radio', 'Forest post · Verify through a known channel', 'radio', 'Do not take the bait', 'Preserve the suspicious message and use Nova’s established field radio to verify it.'),
  ],
  'hike-10': [
    cut('bridge', 'cookie-badge', 'Visitor gate · A badge-shaped cookie', 'badge-cookie', 'Tasty is not a credential', 'The visitor wants a staff code. Check the booking and sponsor first.'),
    cut('bridge', 'visitor-policy', 'Visitor gate · Friendly and careful', 'scope', 'Keep the boundary', 'A missing booking calls for sponsor verification, not a borrowed badge.'),
    cut('bridge', 'sponsor-handoff', 'Visitor gate · A safe waiting area', 'radio', 'A calm handoff', 'Contact Nova through the trusted directory while the visitor waits safely.'),
  ],
  'hike-11': [
    cut('bridge', 'rescue-manifest', 'Rescue desk · People behind the records', 'privacy', 'Protect the people', 'The operational handoff needs relay status, not personal details.'),
    cut('bridge', 'minimal-summary', 'Rescue desk · Less noise, less exposure', 'report', 'Keep the useful part', 'Classify the information and choose the smallest summary that does the job.'),
    cut('bridge', 'authorized-handoff', 'Rescue desk · Share what the task needs', 'evidence', 'The right audience', 'Give the authorized maintenance team a clear operational summary.'),
  ],
  'hike-12': [
    cut('bridge', 'backup-machine', 'Automation shed · Patch’s shortcut', 'script', 'Read before running', 'A tiny backup script can make a big assumption about filenames.'),
    cut('bridge', 'quoted-paths', 'Automation shed · A space in the path', 'folder', 'One intended argument', 'Review quoting and source checks. This training terminal does not execute scripts.'),
    cut('bridge', 'safe-change-review', 'Automation shed · Stage a safer change', 'report', 'A specific review', 'Preserve the original and request quoted paths, a source check, and backup verification.'),
  ],
  'hike-13': [
    cut('lookout', 'valley-network', 'Network lookout · Across the valley', 'network', 'From files to connections', 'Read your lab address and gateway before investigating the remote service.'),
    cut('lookout', 'packet-address', 'Network lookout · An address for the packet', 'dns', 'Names and numbers', 'A service name and its resolved address answer different parts of the question.'),
    cut('lookout', 'interface-card', 'Network lookout · Read the interface card', 'map', 'Know the next hop', 'Identify the gateway, then resolve academy.test inside the simulated lab.'),
  ],
  'hike-14': [
    cut('lookout', 'two-signposts', 'DNS station · Two convincing signposts', 'dns', 'Which destination?', 'Both lab names resolve. Only the approved record chooses the relay destination.'),
    cut('lookout', 'dns-answers', 'DNS station · Compare the answers', 'network', 'Ask the directory', 'Look up academy.test and example.test, then compare the approved destination.'),
    cut('tower', 'approved-uplink', 'Relay uplink · The approved destination', 'scope', 'Resolution is not trust', 'Follow the approved name and verify the connection separately.'),
  ],
  'hike-15': [
    cut('lookout', 'radio-static', 'Radio shelf · Static across the valley', 'radio', 'One narrow question', 'A small lab connectivity test is the next rung on the troubleshooting ladder.'),
    cut('lookout', 'bounded-ping', 'Radio shelf · Two polite packets', 'network', 'Keep the test bounded', 'Ask the simulated host twice. An endless stream does not make the answer better.'),
    cut('tower', 'application-next', 'Relay uplink · Check the actual service next', 'tls', 'Know the limit', 'ICMP reachability and application health are separate checks.'),
  ],
  'hike-16': [
    cut('tower', 'service-lights', 'Service room · Which door is listening?', 'ports', 'Ports have a purpose', 'Start with the authorized service inventory before interpreting a listener.'),
    cut('tower', 'port-8088', 'Service room · Door 8088', 'robot', 'Read, do not knock', 'Connect the port number to the relay agent’s documented role.'),
    cut('tower', 'process-match', 'Service room · Match the process', 'network', 'Expected does not mean unrestricted', 'Compare sockets, processes, and intended reachability without stopping legitimate services.'),
  ],
  'hike-17': [
    cut('tower', 'sealed-connection', 'HTTPS uplink · A message with a seal', 'tls', 'Protect the connection', 'Verified HTTPS protects the transport. It does not make every page truthful.'),
    cut('tower', 'trust-sticker', 'HTTPS uplink · Keep the trust check', 'scope', 'A sticker is not a certificate', 'Keep certificate verification enabled, even when a shortcut looks convenient.'),
    cut('tower', 'response-headers', 'HTTPS uplink · Read the response', 'receipt', 'Inspect the headers', 'Request simulated HTTPS headers and interpret the status within its limits.'),
  ],
  'hike-18': [
    cut('tower', 'trusted-fingerprint', 'Archive bench · A fingerprint for a file', 'fingerprint', 'Compare with a trusted record', 'A digest is useful when its reference comes from a trusted channel.'),
    cut('tower', 'encoded-dispatch', 'Archive bench · Patch’s “secret” dispatch', 'acorn-mail', 'Weird text is not secrecy', 'Base64 is reversible encoding. It does not protect the message from a reader.'),
    cut('tower', 'integrity-check', 'Archive bench · Same bytes, different questions', 'evidence', 'Hash, then decode', 'Verify the route fingerprint and decode the harmless summit dispatch.'),
  ],
  'hike-19': [
    cut('summit', 'maintenance-warning', 'Maintenance shelter · A warning with context', 'patch', 'Check applicability', 'A warning needs the installed product, version, and exposure to become a useful plan.'),
    cut('summit', 'version-inventory', 'Maintenance shelter · Read the inventory', 'receipt', 'Affected here?', 'Compare the fictional advisory with the actual lab service inventory.'),
    cut('summit', 'patch-plan', 'Maintenance shelter · A tested upgrade plan', 'report', 'Plan the safe rollout', 'Stage backup, compatibility testing, rollback, and verification. No real package is installed.'),
  ],
  'hike-20': [
    cut('summit', 'rescue-access', 'Access console · Keep the rescue path open', 'firewall', 'A gate with a purpose', 'Reduce unnecessary access without shutting out the service people need.'),
    cut('summit', 'blanket-ban', 'Access console · A blanket is for picnics', 'robot', 'Avoid the giant shortcut', 'Blocking everything trades one risk for another. Read the approved access first.'),
    cut('summit', 'scoped-rule', 'Access console · Request the narrow correction', 'network', 'Match need to access', 'Stage the approved source restriction with rescue paths, rollback, and verification.'),
  ],
  'hike-21': [
    cut('summit', 'rain-and-logs', 'Log room · Read through the noise', 'logs', 'Context stays with the count', 'Filter failed events, then compare the results with the known baseline.'),
    cut('summit', 'three-failures', 'Log room · Three events, not three villains', 'receipt', 'Numbers need interpretation', 'Expected retries and an unexplained event deserve different follow-up.'),
    cut('summit', 'pipeline-evidence', 'Log room · Pass the evidence along', 'script', 'One command feeds the next', 'Use a pipeline to count matching lines and preserve the original log.'),
  ],
  'hike-22': [
    cut('summit', 'confirmed-change', 'Incident desk · The evidence earns its name', 'incident', 'Now it is confirmed', 'Verified records and operator confirmation establish an unauthorized route change.'),
    cut('summit', 'preserved-audit', 'Incident desk · Keep the evidence intact', 'evidence', 'Patch has the folder', 'Preserve the audit before recovery changes and keep the rescue radio clear.'),
    cut('summit', 'authorized-response', 'Incident desk · Protect the right thing', 'scope', 'Contain within authority', 'Stage the approved session and route-edit response. Do not disconnect every relay.'),
  ],
  'hike-23': [
    cut('summit', 'next-operator', 'Handoff desk · The next person arrives', 'report', 'Make the handoff useful', 'The next operator needs facts, impact, accurate status, and remaining questions.'),
    cut('summit', 'report-revision', 'Handoff desk · Save the memoir for later', 'robot', 'Concise and factual', 'Patch can keep the dramatic opening. Your incident report can stay clear.'),
    cut('summit', 'sanitized-handoff', 'Handoff desk · A report you can trust', 'privacy', 'Requested is not completed', 'Copy the sanitized timeline and assign recovery verification without exposing credentials.'),
  ],
  'hike-24': [
    cut('summit', 'final-evidence', 'Summit Beacon · The final checks', 'evidence', 'Let the evidence agree', 'Read the verified closure and check the recovered route, private note, and service.'),
    cut('lantern', 'lanterns-answer', 'Pine Relay · The lanterns answer', 'lantern', 'Confetti can wait', 'Patch watches the lights. Your checks verify the recovery behind them.'),
    cut('welcome', 'trail-complete', 'Basecamp · Bring the trail home', 'beacon', 'An honest finish', 'Close the verified foundation work, retain monitoring, and leave future routes locked until ready.'),
  ],
});

export function getPresentation(mission, frameIndex = 0) {
  const shots = storyShots[mission?.id] || storyShots['hike-01'];
  const index = Number.isInteger(frameIndex) && frameIndex >= 0 && frameIndex < shots.length ? frameIndex : 0;
  const shot = shots[index];
  const background = panels[shot.panelName];
  const name = mission?.story?.[index]?.speaker === 'PATCH' ? 'PATCH' : 'NOVA';
  return {
    scene: {
      id: `${Object.hasOwn(storyShots, mission?.id) ? mission.id : 'hike-01'}-${shot.focus}`,
      ...background,
      label: shot.label,
      prop: shot.prop,
    },
    speaker: { name, position: name === 'PATCH' ? '100% 50%' : '0% 50%', role: name === 'PATCH' ? 'FIELD COMPANION' : 'FIELD GUIDE' },
    clue: { ...shot.clue },
  };
}
