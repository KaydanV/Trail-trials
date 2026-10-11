/** Patch's guidance is read-only: evidence and credit still come from the engine. */
import { missions as baseMissions } from './curriculum.js';

const HOME = '/home/trainee';
const clue = (nudge, action, ...solutions) => ({ nudge, action, solutions });

// Each route belongs to one objective, rather than revealing the whole mission.
// References deliberately use authored solutions; tests verify their effects.
const COACHING = {
  'hike-01': {
    location: clue('First, get your bearings. The working directory tells you where your file paths begin.', 'Use pwd to print your current location.', 0),
    identity: clue('Next, check which lab account is making these moves.', 'Use whoami to print the account name.', 1),
    scope: clue('The written briefing tells us where our permission starts and stops.', 'Use cat to read briefing.txt before investigating.', 2),
  },
  'hike-02': {
    list: clue('A cabinet is easier to explore when you can see its folder names.', 'Use ls to list the folders at the starting location.', 0),
    move: clue('You found the map folder. Now step inside and confirm where you landed.', 'Use cd to enter maps, then pwd to confirm the directory. If you are already there, just confirm it.', 1, 2),
    map: clue('You are looking for the contents of the route map, rather than another list of names.', 'Use cat on trail.txt inside maps to read the route.', 3),
  },
  'hike-03': {
    guide: clue('An unfamiliar printer sound has a documented meaning. Check its guide first.', 'Use cat to read porch/guide.txt.', 0),
    start: clue('The beginning of a log gives you the starting conditions.', 'Use head on porch/relay.log; -n sets the line count, and this clue asks for two.', 1),
    end: clue('The end of a chronological log is where the latest events land.', 'Use tail on porch/relay.log with a line count of two. Compare these entries with the beginning.', 2),
  },
  'hike-04': {
    find: clue('We know the filename, but we still need its location in the supply folders.', 'Use find under supplies with -name to look for route.conf.', 0),
    search: clue('Now look inside the configuration for its destination setting.', 'Use grep to search for route= in the route.conf file you found.', 1),
    note: clue('A found backup still needs a source and a reason to trust it.', 'Read supplies/archive/note.txt with cat before proposing a restore.', 2),
  },
  'hike-05': {
    folder: clue('Give the investigation a folder of its own before saving evidence.', 'Use mkdir to create case-notes.', 0),
    copy: clue('Keep the status source intact while making a working evidence copy.', 'Use cp with relay-status.txt as the source and case-notes/status.txt as the destination.', 1),
    note: clue('A useful note separates what you observed from what you do not know yet.', 'Write the observed outage and the unconfirmed cause to case-notes/observation.txt. Quote the text; > saves it to the new note.', 2),
  },
  'hike-06': {
    approval: clue('Before replacing a configuration, check the written recovery authorization.', 'Read approval.txt with cat and notice both the before-copy and restore destinations.', 0),
    preserve: clue('A recovery needs a before-copy so the faulty state remains available for review.', 'Copy active/route.conf to recovery/route.before.conf. Keep the source in place.', 1),
    restore: clue('The approved backup can now become the active configuration.', 'Use cp with backups/route.conf as the source and active/route.conf as the destination.', 2),
    verify: clue('A successful copy still needs a check of the resulting setting.', 'Search active/route.conf for route= using grep, then compare the destination with the approval.', 3),
  },
  'hike-07': {
    policy: clue('The access policy explains who should be able to read the private note.', 'Read access-policy.txt with cat before changing permissions.', 0),
    inspect: clue('File permissions are visible in a detailed directory listing.', 'Use ls with -l on private to inspect the current permission bits.', 1),
    restrict: clue('The private note should be readable and writable by its owner alone.', 'Use chmod with the owner-only mode 600 on private/recovery-note.txt.', 2),
  },
  'hike-08': {
    policy: clue('Start with the account standard so the audit findings have something to compare against.', 'Read identity/policy.txt with cat.', 0),
    reuse: clue('The audit records password reuse as a named field. Search for that field.', 'Use grep for password_reuse in identity/account-audit.txt.', 1),
    mfa: clue('There is a separate audit field for whether multi-factor authentication is enabled.', 'Search identity/account-audit.txt for mfa_enabled with grep.', 2),
  },
  'hike-09': {
    message: clue('Reading a suspicious message as text lets you inspect it without following its requests.', 'Use cat on inbox/urgent.eml. Inspect the message; keep its links untouched.', 0),
    sender: clue('A display name can distract from the actual sender address.', 'Use grep to find the From: field in inbox/urgent.eml.', 1),
    contacts: clue('Verify a request through a contact source you already trust.', 'Read contacts/trusted.txt with cat and compare it with the message.', 2),
  },
  'hike-10': {
    policy: clue('The gate has a visitor process, even when somebody says the request is urgent.', 'Read gate/policy.txt with cat.', 0),
    log: clue('The latest visitor entries tell you what the gate actually recorded.', 'Use tail with a line count of two on gate/visitors.log.', 1),
    directory: clue('A sponsor check needs a trusted contact route.', 'Read gate/directory.txt with cat to find the established contact.', 2),
  },
  'hike-11': {
    policy: clue('Check how information is classified before preparing a handoff.', 'Read privacy/policy.txt with cat.', 0),
    status: clue('The route status contains the operational facts needed for the next person.', 'Read privacy/route-status.txt with cat and identify the affected route and service state.', 1),
    summary: clue('A short handoff should carry the operational fact with only the information the reader needs.', 'Save the affected bridge and its service state in handoff.txt, using quoted echo text and >.', 2),
  },
  'hike-12': {
    script: clue('A script can be inspected as plain text before anyone considers running it.', 'Read automation/backup.sh with cat. This lab reviews scripts as text.', 0),
    guide: clue('The review guide tells you which backup assumptions need checking.', 'Read automation/review-guide.txt with cat.', 1),
    original: clue('Preserve the original script so reviewers can compare the proposed change.', 'Copy automation/backup.sh to automation/backup.original.sh with cp.', 2),
    review: clue('Stage a review request that names the safeguards the backup needs.', 'Save notes about quoting paths, checking the source, and verifying the backup to automation/change-request.txt.', 3),
  },
  'hike-13': {
    interface: clue('The interface card describes this device’s local network configuration.', 'Read network/interface.txt with cat.', 0),
    gateway: clue('The gateway is a particular setting on the interface card.', 'Use grep to search for gateway= in network/interface.txt.', 1),
    resolve: clue('A service name needs an address before a client can reach it.', 'Use nslookup on the approved lab name academy.test.', 2),
  },
  'hike-14': {
    academy: clue('Check the address returned for the approved service name.', 'Use nslookup for academy.test and keep the returned address for comparison.', 0),
    example: clue('A second lab name gives you a comparison, rather than a reason to guess.', 'Use nslookup for example.test and compare its address with the first result.', 1),
    approved: clue('A working name lookup still needs to match the intended destination.', 'Read network/approved-destination.txt with cat.', 2),
  },
  'hike-15': {
    guide: clue('A troubleshooting ladder helps each test answer one specific question.', 'Read network/troubleshooting.txt with cat.', 0),
    dns: clue('Confirm name resolution before testing reachability.', 'Use nslookup for academy.test and inspect its returned address.', 1),
    ping: clue('A small, bounded reachability check is enough for this clue.', 'Use ping on academy.test with -c set to two. A reply tells you about reachability.', 2),
  },
  'hike-16': {
    inventory: clue('An approved inventory gives listening services a purpose to compare against.', 'Read services/inventory.txt with cat.', 0),
    sockets: clue('Listening sockets show which local ports are waiting for connections.', 'Use ss with -tuln to inspect the simulated listeners and compare them with the inventory.', 1),
    processes: clue('Connect the expected service with the process that runs it.', 'Use ps aux and locate relay-agent in its command column.', 2),
  },
  'hike-17': {
    policy: clue('Secure connections rely on a trust policy as well as a response from a server.', 'Read web/tls-policy.txt with cat.', 0),
    headers: clue('A headers-only HTTPS request is enough to inspect the lab service response.', 'Use curl with -I and the complete HTTPS URL for academy.test.', 1),
    status: clue('Use the HTTP guide to interpret the status you just received.', 'Read web/http-guide.txt with cat and connect it with the header response.', 2),
  },
  'hike-18': {
    reference: clue('A file fingerprint is useful when the comparison value comes from a trusted record.', 'Read archive/trusted-sha256.txt with cat before comparing the route.', 0),
    hash: clue('Calculate the route file’s fingerprint so you can compare the bytes with that record.', 'Use sha256sum on archive/route.conf and compare the full digest with the trusted value.', 1),
    decode: clue('The dispatch uses an encoding that can be reversed into ordinary text.', 'Use base64 with -d on archive/dispatch.b64 to decode it.', 2),
  },
  'hike-19': {
    advisory: clue('An advisory has to apply to the installed product before it becomes a change priority.', 'Read maintenance/advisory.txt with cat.', 0),
    version: clue('Find the installed product version so you can compare it with the affected versions.', 'Use grep for relay-agent in maintenance/inventory.txt.', 1),
    policy: clue('The change policy sets the safeguards for a planned upgrade.', 'Read maintenance/change-policy.txt with cat.', 2),
    plan: clue('Turn the applicable finding into a plan that protects recovery and checks the outcome.', 'Save the affected and upgrade versions, plus backup, test, rollback, and verification steps, to maintenance/plan.txt.', 3),
  },
  'hike-20': {
    policy: clue('An access review starts with who is supposed to reach the service.', 'Read firewall/intended-access.txt with cat.', 0),
    review: clue('The rule review explains how current access compares with the approved policy.', 'Read firewall/review.txt with cat.', 1),
    listener: clue('Confirm the expected API is listening before proposing its access change.', 'Use ss with -tuln and look for the API port in the listener output.', 2),
    request: clue('A narrow change request should protect essential paths and include a way back.', 'Save the approved source restriction for port 8088, rescue paths, rollback, and verification to firewall/request.txt.', 3),
  },
  'hike-21': {
    filter: clue('Separate failed authentication events from the other log entries.', 'Use grep for AUTH_FAIL in logs/auth.log.', 0),
    count: clue('Count the matching events by passing the filtered output to a line counter.', 'Pipe grep’s AUTH_FAIL results from logs/auth.log into wc with -l. Count the filtered output rather than the whole log.', 1),
    baseline: clue('A failure count needs the expected activity alongside it before you interpret it.', 'Read logs/baseline.txt with cat and compare its explanations with the events.', 2),
  },
  'hike-22': {
    timeline: clue('A correlated timeline shows what the incident evidence can actually establish.', 'Read incident/timeline.txt with cat.', 0),
    authority: clue('Containment needs an approved boundary before you propose action.', 'Read incident/authority.txt with cat.', 1),
    preserve: clue('Keep an audit copy available before staging the response.', 'Copy incident/audit.log to incident/audit-preserved.log with cp.', 2),
    request: clue('The containment request should stay within the authorization and preserve essential traffic.', 'Save the approved session revocation, route-edit isolation, and rescue-traffic safeguard to incident/containment-request.txt.', 3),
  },
  'hike-23': {
    requirements: clue('Check what the next operator needs from this report.', 'Read report/requirements.txt with cat.', 0),
    facts: clue('Use the verified facts to separate confirmed events from pending work.', 'Read report/sanitized-timeline.txt with cat.', 1),
    evidence: clue('The handoff needs its own sanitized evidence copy.', 'Make the handoff folder if it is missing, then copy report/sanitized-timeline.txt to handoff/timeline.txt.', 2, 3),
    report: clue('An accurate report distinguishes requested actions, unknowns, and checks still needed.', 'Save the case ID, verified change, containment status, unknown access method, and recovery follow-up to handoff/report.txt.', 4),
  },
  'hike-24': {
    closure: clue('Begin the final check with the closure record and its remaining open questions.', 'Read capstone/closure.txt with cat.', 0),
    hash: clue('Compare the recovered configuration’s bytes with the trusted closure fingerprint.', 'Use sha256sum on capstone/route.conf and compare the complete digest.', 1),
    permission: clue('The final recovery note still needs owner-only access.', 'Use chmod with mode 600 on capstone/private-recovery.txt.', 2),
    service: clue('Check the simulated service itself after the file and access checks.', 'Request the HTTPS headers from academy.test using curl with -I, keeping trust verification enabled.', 3),
  },
};

const DECISION_GUIDANCE = {
  'hike-01': 'Compare each move with the written lab scope and the outage you observed.',
  'hike-02': 'Use the known relay asset and the authorized route to choose a focused next step.',
  'hike-03': 'Choose the lead supported by the guide and recent log entries, and keep unsupported attribution out of the conclusion.',
  'hike-04': 'Consider what you still need to verify about the backup before making a change.',
  'hike-05': 'Choose a note that records observations and clearly labels the unconfirmed cause.',
  'hike-06': 'Match the restored setting with the approval and preserve the before-copy.',
  'hike-07': 'Changing file access helps future protection. Consider what else is required if a credential was already exposed.',
  'hike-08': 'Compare the reuse and MFA findings with the account standard, and choose durable account safeguards.',
  'hike-09': 'Use the trusted contact source to verify the request and follow the reporting process.',
  'hike-10': 'Follow the visitor policy and independently verify the sponsor through the trusted directory.',
  'hike-11': 'Choose the minimum information and an approved recipient boundary for this operational handoff.',
  'hike-12': 'Choose a reviewed change that handles quoted paths, validates its source, and verifies the backup.',
  'hike-13': 'Distinguish this device’s configuration, the gateway’s role, and what name resolution actually proves.',
  'hike-14': 'Compare both lookup results with the approved destination record.',
  'hike-15': 'Name resolution and a ping reply cover two steps. Choose the next check that tests the actual service.',
  'hike-16': 'Match the listener, process, and approved purpose before deciding whether its reachability needs review.',
  'hike-17': 'A certificate warning calls for trusted diagnosis of the connection before sensitive interaction.',
  'hike-18': 'Separate a byte comparison with a trusted hash from encoding and confidentiality.',
  'hike-19': 'Prioritize the applicable asset risk with an approved upgrade, a rollback plan, and health checks.',
  'hike-20': 'Choose the approved narrow access boundary while protecting rescue availability and recovery.',
  'hike-21': 'Use the baseline to distinguish explained failures from the event that still needs correlation.',
  'hike-22': 'Choose the authorized response for the confirmed issue, preserving evidence and essential service.',
  'hike-23': 'Keep requested actions separate from verified completion, and assign the remaining checks.',
  'hike-24': 'Close what the final evidence verifies while retaining monitoring and unresolved investigation work.',
};

/** Terminal evidence comes first, even when a decision appears earlier in the data. */
export function getNextObjective(mission, tasks = []) {
  const objectives = mission?.objectives ?? [];
  const remaining = objective => tasks[objective.index] !== true;
  const indexed = objectives.map((objective, index) => ({ objective, index }));
  return indexed.find(item => item.objective.check?.type !== 'decision' && remaining(item))
    ?? indexed.find(item => remaining(item)) ?? null;
}

const quote = value => /^[a-zA-Z0-9_./=:@+-]+$/.test(String(value)) ? String(value) : `'${String(value).replaceAll("'", "'\"'\"'")}'`;
const shortPath = path => path?.startsWith(HOME + '/') ? path.slice(HOME.length + 1) : path;
const parentPath = path => path?.slice(0, path.lastIndexOf('/')) || HOME;
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mapDirectory = mission => mission.objectives?.find(objective => objective.id === 'move')?.check?.outputIncludes?.find(value => value.startsWith('/'))
  ?? parentPath(mission.objectives?.find(objective => objective.id === 'map')?.check?.path);

/** Remixes keep objective IDs while changing paths and evidence. Follow that data. */
function adaptEntry(mission, entry) {
  if (!entry || !mission.practiceVariant) return entry;
  const base = baseMissions.find(item => item.id === mission.id);
  if (!base) return entry;
  const changes = new Map(), directories = new Map();
  const addPath = (before, after) => {
    if (!before || !after || before === after) return;
    changes.set(before, after);
    changes.set(shortPath(before), shortPath(after));
    const oldParts = shortPath(before).split('/'), newParts = shortPath(after).split('/');
    for (let index = 0; index < oldParts.length; index++) {
      const oldPart = oldParts[index], newPart = newParts[index];
      if (!newPart || oldPart === newPart) continue;
      if (oldPart.includes('.')) changes.set(oldPart, newPart);
      else directories.set(oldPart, newPart);
    }
  };
  const oldFixtures = Object.keys(base.fixtures), newFixtures = Object.keys(mission.fixtures);
  oldFixtures.forEach((path, index) => addPath(path, newFixtures[index]));
  base.objectives.forEach(before => {
    const after = mission.objectives.find(objective => objective.id === before.id);
    if (!after) return;
    addPath(before.check.path, after.check.path);
    for (const field of ['argsIncludes', 'outputIncludes', 'contains']) {
      const oldValues = before.check[field] ?? [], newValues = after.check[field] ?? [];
      oldValues.forEach((oldValue, index) => {
        const newValue = newValues[index];
        if (typeof oldValue !== 'string' || typeof newValue !== 'string' || oldValue === newValue) return;
        if (oldValue.startsWith('/')) addPath(oldValue, newValue);
        else changes.set(oldValue, newValue);
      });
    }
  });
  // Bare directory words also appear in ordinary prose; change only path references.
  for (const directory of directories.keys()) changes.delete(directory);
  const expression = changes.size ? new RegExp(`(?<![A-Za-z0-9_.-])(?:${[...changes.keys()].sort((a, b) => b.length - a.length).map(escapePattern).join('|')})(?![A-Za-z0-9_-])`, 'g') : null;
  const directoryExpression = directories.size ? new RegExp(`(?<![A-Za-z0-9_.-])(?:${[...directories.keys()].map(escapePattern).join('|')})(?![A-Za-z0-9_-])`, 'g') : null;
  const transform = text => {
    let changed = expression ? text.replace(expression, value => changes.get(value)) : text;
    if (directoryExpression) changed = changed.replace(directoryExpression, (value, index) => {
      const prefix = changed.slice(Math.max(0, index - 50), index);
      return /\b(?:enter|inside|under|on|create|into|in)\s+$/i.test(prefix) ? directories.get(value) : value;
    });
    return changed;
  };
  return { ...entry, nudge: transform(entry.nudge), action: transform(entry.action) };
}

function fallbackRoute(objective) {
  const check = objective.check ?? {};
  const path = quote(shortPath(check.path) ?? '');
  if (check.type === 'read') return [`cat ${path}`];
  if (check.type === 'permission') return [`chmod ${quote(check.mode)} ${path}`];
  if (check.type === 'directory') return [`mkdir ${path}`];
  if (check.type === 'command' && check.name) return [[check.name, ...(check.argsIncludes ?? [])].map(quote).join(' ')];
  return [];
}

function exactRoute(mission, objective, entry, session) {
  const shell = session?.shell;
  const cwd = shell?.cwd ?? HOME;
  let route = entry ? entry.solutions.map(index => mission.solutions?.[index]).filter(Boolean) : fallbackRoute(objective);
  if (mission.id === 'hike-02' && objective.id === 'move') {
    const directory = mapDirectory(mission);
    return cwd === directory ? ['pwd'] : [`cd ${quote(directory)}`, 'pwd'];
  }
  if (mission.id === 'hike-02' && objective.id === 'map') {
    return [cwd === parentPath(objective.check.path) ? `cat ${quote(objective.check.path.split('/').at(-1))}` : `cat ${quote(objective.check.path)}`];
  }
  // A preparatory directory may already exist without completing the copy clue.
  if (mission.id === 'hike-23' && objective.id === 'evidence' && shell?.directories?.includes(parentPath(objective.check.path))) {
    route = route.filter(command => !command.startsWith('mkdir '));
  }
  // Command checks include authored relative operands; return home to retain them.
  const needsStartingFolder = route.some(command => !/^(whoami|nslookup|ping|curl|ss|ps)(?:\s|$)/.test(command));
  if (cwd !== HOME && needsStartingFolder) route.unshift(`cd ${HOME}`);
  return route;
}

/** strength belongs to the current target, never the accumulated mission hint count. */
export function getHint(mission, session = {}, strength = 0) {
  const next = getNextObjective(mission, session.tasks);
  const depth = Number.isFinite(strength) ? Math.max(0, Math.min(2, Math.trunc(strength))) : 0;
  if (!next) return { targetId: null, index: -1, strength: 0, text: 'All your clues and your call are recorded. Finish & reflect with Nova, and tell her what you learned.' };
  const { objective, index } = next;
  const hint = { targetId: objective.id, index, strength: depth, text: '' };
  const completed = (mission.objectives ?? []).filter((item, i) => item.check?.type !== 'decision' && session.tasks?.[i] === true).length;
  const progress = completed ? `${completed} clue${completed === 1 ? '' : 's'} recorded. ` : '';
  if (objective.check?.type === 'decision') {
    const correct = mission.decision?.options?.find(option => option.id === objective.check.value);
    hint.text = depth === 0 ? 'You have collected the terminal evidence. Take your time: compare it with the choices and make your call.'
      : depth === 1 ? (DECISION_GUIDANCE[mission.id] ?? mission.decision?.context ?? objective.detail)
      : correct ? `Choose “${correct.label}” Then connect that choice with the evidence you collected.`
      : objective.detail;
    return hint;
  }
  const entry = adaptEntry(mission, COACHING[mission.id]?.[objective.id]);
  if (depth === 0) hint.text = progress + (entry?.nudge ?? objective.label ?? mission.hints?.[0] ?? 'Take the next clue one step at a time.');
  if (depth === 1) {
    hint.text = progress + (entry?.action ?? objective.detail ?? mission.hints?.[0] ?? 'Use help to review the supported commands for this clue.');
    const cwd = session.shell?.cwd;
    if (cwd && cwd !== HOME && !(mission.id === 'hike-02' && cwd === mapDirectory(mission))) {
      hint.text += ` You are currently in ${cwd}; check your location before using a path from the starting folder.`;
    }
    if (mission.id === 'hike-23' && objective.id === 'evidence' && session.shell?.directories?.includes(parentPath(objective.check.path))) {
      hint.text = progress + 'The handoff folder is already there. ' + entry.action.replace('Make the handoff folder if it is missing, then copy', 'Copy');
    }
  }
  if (depth === 2) {
    const route = exactRoute(mission, objective, entry, session);
    hint.text = progress + `Here is the route for this clue: ${objective.label}. Take each command one at a time and inspect its result.`;
    if (route.length) hint.example = route.join('\n');
    else hint.text += ` ${objective.detail ?? mission.hints?.[0] ?? ''}`;
  }
  return hint;
}

const COMMAND_HELP = {
  pwd: 'pwd takes no arguments and prints your current directory.',
  whoami: 'whoami takes no arguments and prints your lab account.',
  ls: 'ls accepts -a for hidden names, -l for details, and one optional path.',
  cd: 'cd takes one directory path. Use pwd or ls to check your location first.',
  cat: 'cat reads file paths; this lab does not support cat flags.',
  mkdir: 'mkdir needs a directory name; -p can create missing parent folders.',
  cp: 'cp takes a source file first and a destination second. Keep a separate destination when preserving evidence.',
  mv: 'mv takes a source first and a destination second; it moves the source rather than preserving it.',
  find: 'find takes a starting directory, then supported filters such as -name, -type f, or -mmin with their values.',
  grep: 'grep takes a search pattern followed by a file. Use -i for case-insensitive matching or -n for line numbers.',
  head: 'head uses -n followed by a whole-number line count, then the file path.',
  tail: 'tail uses -n followed by a whole-number line count, then the file path.',
  wc: 'Use wc with -l to count lines, including output received through a pipe.',
  chmod: 'chmod takes an octal mode followed by one path. The lab supports 600, 640, 644, and 700; 600 allows owner read/write only.',
  nslookup: 'nslookup takes one lab host name, academy.test or example.test.',
  ping: 'ping takes one lab host and an optional -c count from 1 to 4. Keep the test bounded.',
  curl: 'curl uses -I to request headers from the HTTPS root of academy.test or example.test. Keep verification enabled.',
  ss: 'Use ss with -tuln to inspect the simulated listening sockets.',
  ps: 'Use ps aux to inspect the simulated process list.',
  base64: 'base64 reads a file or piped text; -d decodes valid Base64.',
  echo: 'echo writes plain text. Quote text containing spaces or semicolons, then use > with a new note path to save it.',
};
const COMMANDS = 'pwd whoami ls cd cat echo touch mkdir cp mv find grep head tail sort uniq wc awk tee chmod sha256sum base64 nslookup ping curl ss ps help history clear'.split(' ');

function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}

/** Explain a failed attempt without running another command or changing objective credit. */
export function explainFailure(mission, session = {}, raw, result) {
  if (!result?.error) return null;
  const output = String(result.output ?? '');
  const command = String(raw ?? '').trim().split(/\s+/)[0];
  const cwd = session.shell?.cwd ?? HOME;
  const next = getNextObjective(mission, session.tasks);
  const focus = next?.objective.check?.type !== 'decision' && next ? ` Your next clue is “${next.objective.label}”.` : '';
  if (/This lab simulates|No network request|Only the fictional|outside|not a lab|approved lab hosts|academy\.test and example\.test|Unknown lab host/i.test(output)) {
    return 'This lab answers only for academy.test and example.test. Use the approved fictional target from your clue; your permission covers this simulation.';
  }
  if (/Unclosed quote|Unfinished escape/i.test(output)) {
    return 'That text has an unfinished quote or escape. Put a matching quote at each end of the text, then retry. A quoted note keeps its spaces and semicolons together.';
  }
  if (/Unsupported shell syntax|Command substitution/i.test(output)) {
    return 'Run one command at a time in this teaching shell. Use | for a supported pipeline; quote note text that contains a semicolon. Scripts, command substitution, and && are outside its supported syntax.';
  }
  if (/pipe needs a command|command is missing/i.test(output)) {
    return 'A pipeline needs a command on each side of |. The left command produces text; the right command reads it. Check both sides before retrying.';
  }
  if (/redirection/i.test(output)) {
    return 'Output redirection needs one destination file path after > or >>. > replaces that file; >> appends. Check the destination and its parent folder before retrying.';
  }
  const unavailable = output.match(/Command not available:\s*([^\s.]+)/i)?.[1];
  if (unavailable) {
    const similar = COMMANDS.filter(name => distance(unavailable.toLowerCase(), name) === 1);
    return similar.length === 1 ? `“${unavailable}” is not available. Did you mean ${similar[0]}? Type help to see the supported lab commands.`
      : `“${unavailable}” is not available in this teaching shell. Type help to see its supported commands.${focus}`;
  }
  if (/Permission denied|not permitted/i.test(output)) {
    return 'Check the intended owner and access policy before changing permission bits. Use a detailed listing to inspect access, and apply only the authorized mode for this lab clue.';
  }
  if (/Is a directory/i.test(output)) {
    return 'That path names a directory, while this command needs a file. Use ls on the directory to see its filenames, then choose the intended file.';
  }
  if (/Not a directory/i.test(output)) {
    return `cd needs a folder that exists. You are in ${cwd}. Use ls to inspect the available folders, and check whether the path names a file instead.`;
  }
  if (/No such directory/i.test(output)) {
    return `The destination’s parent folder does not exist at that path. You are in ${cwd}. Check the intended location; create a new parent folder with mkdir before saving into it.${focus}`;
  }
  if (/No such file/i.test(output)) {
    return `The shell could not find that path from ${cwd}. Relative paths start in your current directory. Use pwd and ls to check the location and spelling, or use the full path.${focus}`;
  }
  if (/File exists|destination already exists/i.test(output)) {
    return 'That name already exists. Inspect it with ls before retrying. If it is the folder you just made, move on to the copy or note step rather than creating it again.';
  }
  if (/no matching lines/i.test(output)) {
    return 'grep found no lines matching that pattern. Check the search term and file, including letter case; -i ignores case. An empty match is evidence to interpret, and this attempt recorded no clue.';
  }
  if (/unsupported option|unexpected argument|expected .*operand|missing .*operand|missing .*pattern|missing value|too many arguments|takes|supports|use chmod|line count|simulated count|one lab host|one input file|one path|whole number|complete HTTPS|HTTPS root/i.test(output)) {
    return (COMMAND_HELP[command] ?? 'Check the command’s required arguments and supported flags with help, then retry one command at a time.') + focus;
  }
  if (/base64: invalid|non-UTF-8/i.test(output)) {
    return 'Decoding needs valid Base64 text representing a UTF-8 message in this lab. Check the intended dispatch file and use -d only when decoding.';
  }
  if (/same|directory copies|inside itself/i.test(output)) {
    return 'Check the source and destination carefully. A preserved copy needs a different file destination; this lesson’s cp copies files. Use ls to inspect both paths before retrying.';
  }
  return `Read the terminal’s error, then check the command and its inputs with help. Your evidence stays as it was before this failed attempt.${focus}`;
}
