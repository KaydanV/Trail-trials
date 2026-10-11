/** Fresh evidence for completed lessons. Every command still runs in the teaching shell. */
export const MAX_PRACTICE_VARIANT = 100000;
const HOME = '/home/trainee/';
const ORIGINAL_HASH = 'bf6d00c8e2e1aff9cd1eac06769a8c392a22d2646ee37e71cbeb5d553085f179';
const HASHES = [
  'c2d9fbf509d8442ed5d2c5beba3aea0e0e648eabc0d61fe5101c62f965dbbe42',
  'a764af7b0eb9af7a3a5078b6a121c4922dcfd955ce25b9a79c97dea3b9210088',
  'c205a339c5e19d992f245922f83cbc8560e5fe44f1d846a984ed4274e04ad398',
];
const DISPATCHES = [
  ['Summit requests a status check.', 'U3VtbWl0IHJlcXVlc3RzIGEgc3RhdHVzIGNoZWNrLg=='],
  ['Bring the verified route to Cedar Relay.', 'QnJpbmcgdGhlIHZlcmlmaWVkIHJvdXRlIHRvIENlZGFyIFJlbGF5Lg=='],
  ['The rescue channel is ready.', 'VGhlIHJlc2N1ZSBjaGFubmVsIGlzIHJlYWR5Lg=='],
];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
const titleCase = value => value[0].toUpperCase() + value.slice(1);

function mapText(value, transform) {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map(item => mapText(item, transform));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, ['id', 'name', 'speaker'].includes(key) ? item : mapText(item, transform)]));
  }
  return value;
}

function replacements(entries) {
  const lookup = new Map(entries.filter(([before, after]) => before !== after));
  const pattern = [...lookup.keys()].sort((a, b) => b.length - a.length).map(escape).join('|');
  if (!pattern) return value => value;
  const expression = new RegExp(`(?<![A-Za-z0-9_.-])(?:${pattern})(?![A-Za-z0-9_-])`, 'g');
  return value => value.replace(expression, match => lookup.get(match));
}

function renamePaths(base, variant) {
  const paths = new Set(Object.keys(base.fixtures));
  for (const objective of base.objectives) if (objective.check?.path) paths.add(objective.check.path);
  const entries = [], directories = new Map();
  const rename = component => {
    const dot = component.lastIndexOf('.');
    return dot > 0 ? `${component.slice(0, dot)}-r${variant}${component.slice(dot)}` : `${component}-r${variant}`;
  };
  for (const absolute of paths) {
    if (!absolute.startsWith(HOME)) continue;
    const relative = absolute.slice(HOME.length);
    const parts = relative.split('/');
    const renamed = parts.map(rename);
    entries.push([absolute, HOME + renamed.join('/')], [relative, renamed.join('/')]);
    // Filename-only references in scripts, find arguments, and explanations also change.
    if (parts.at(-1).includes('.')) entries.push([parts.at(-1), renamed.at(-1)]);
    const length = base.objectives.some(item => item.check?.type === 'directory' && item.check.path === absolute) ? parts.length : parts.length - 1;
    for (let index = 0; index < length; index++) {
      directories.set(parts[index], renamed[index]);
      entries.push([parts.slice(0, index + 1).join('/'), renamed.slice(0, index + 1).join('/')]);
      entries.push([HOME + parts.slice(0, index + 1).join('/'), HOME + renamed.slice(0, index + 1).join('/')]);
    }
  }
  // Bare directory words can also be ordinary prose ("private", "report", "network").
  // Replace them only when they are a path argument or an explicit directory reference.
  const directoryNames = [...directories.keys()];
  const pathEntries = entries.filter(([key]) => !directoryNames.includes(key));
  const replacePaths = replacements(pathEntries);
  const directoryExpression = directoryNames.length
    ? new RegExp(`(?<![A-Za-z0-9_.-])(?:${directoryNames.sort((a, b) => b.length - a.length).map(escape).join('|')})(?![A-Za-z0-9_-])`, 'g')
    : null;
  const transform = text => {
    const changed = replacePaths(text);
    if (!directoryExpression) return changed;
    return changed.replace(directoryExpression, (name, index) => {
      const prefix = changed.slice(Math.max(0, index - 50), index);
      const explicit = changed === name || /\b(?:cd|mkdir|find|inspect|into)\s+$/i.test(prefix)
        || /\bls(?:\s+-[a-z]+)?\s+$/i.test(prefix)
        || /\b(?:create|in)\s+$/i.test(prefix) && ['maps', 'case-notes', 'handoff'].includes(name);
      return explicit ? directories.get(name) : name;
    });
  };
  const mission = mapText(base, transform);
  mission.fixtures = Object.fromEntries(Object.entries(mission.fixtures).map(([key, fixture]) => [transform(key), fixture]));
  return { mission, transform };
}

function decision(mission, value) {
  const objective = mission.objectives.find(item => item.check.type === 'decision');
  objective.check.value = value;
  objective.label = mission.decision.title;
}

function healthyAccount(mission, transform) {
  const audit = transform(HOME + 'identity/account-audit.txt');
  mission.fixtures[audit] = 'account=keeper\npassword_reuse=no\nmfa_enabled=yes\nmfa_type=passkey\nrecovery_owner=Nova\nNo passwords or tokens are included in this audit.\n';
  mission.objectives.find(item => item.id === 'reuse').check.outputIncludes = ['password_reuse=no'];
  mission.objectives.find(item => item.id === 'mfa').check.outputIncludes = ['mfa_enabled=yes'];
  mission.story[2].text = 'This keeper account uses a unique password and has passkey MFA. Confirm the audit findings, then keep its approved controls and review recovery. Strong controls still need careful use.';
  mission.hints = [
    'Read the account standard and inspect the current audit. This remix may show a different sign-in posture.',
    transform('Use grep password_reuse and grep mfa_enabled on identity/account-audit.txt. Read the values rather than assuming weaknesses.'),
    transform('Run cat identity/policy.txt, grep password_reuse identity/account-audit.txt, and grep mfa_enabled identity/account-audit.txt. The controls are present; retain them and review protected recovery.'),
  ];
  mission.decision = { title: 'Review the keeper account', context: 'The audit shows no password reuse and enabled passkey MFA. Protected recovery still needs regular review.', options: [
    { id: 'retain', label: 'Retain the unique password and passkey MFA, review protected recovery, and verify unexpected prompts.', correct: true, feedback: 'Follow the actual audit. These controls are present; keep them and maintain the recovery and verification process.' },
    { id: 'disable', label: 'Disable MFA because the password is unique.', correct: false, feedback: 'Unique passwords and MFA provide complementary protection. Keep the approved layered controls.' },
    { id: 'shared', label: 'Replace the unique password with a shared keeper password.', correct: false, feedback: 'Sharing a credential reduces accountability and widens the impact of exposure.' },
  ] };
  mission.debrief = 'You followed the current evidence: unique credentials and passkey MFA are already present. Keep them, protect recovery, and verify unexpected sign-in requests.';
  decision(mission, 'retain');
}

function remixLog(mission, transform, variant) {
  const known = 2 + variant % 3;
  const count = known + 1;
  const hour = String(18 + variant % 3).padStart(2, '0');
  mission.fixtures[transform(HOME + 'logs/auth.log')] = `${hour}:00 AUTH_OK account=keeper source=maintenance\n`
    + Array.from({ length: known }, (_, index) => `${hour}:0${index + 1} AUTH_FAIL account=keeper source=maintenance reason=expired-session\n`).join('')
    + `${hour}:05 AUTH_FAIL account=unknown source=outside-policy reason=unknown-account\n${hour}:06 SERVICE_OK component=relay\n`;
  mission.fixtures[transform(HOME + 'logs/baseline.txt')] = `BASELINE AND CONTEXT\nMaintenance session expired; ${words[known]} retries were expected.\nThe ${hour}:05 outside-policy failure needs review with identity and access logs.\nA failed login alone is not proof of compromise.\nPreserve the original log and compare timestamps and account context.\n`;
  mission.objectives.find(item => item.id === 'count').check.outputIncludes = [String(count)];
  mission.title = `${titleCase(words[count])} knocks, one question`;
  mission.story[1].text = `I counted ${words[count]} failed knocks and wrote ${words[count].toUpperCase()} VILLAINS. Nova changed it to ${words[count].toUpperCase()} FAILED EVENTS. Apparently numbers need interpretation.`;
  mission.decision.context = `${titleCase(words[known])} failures match a documented expired session. One outside-policy event needs more context.`;
  mission.decision.options.find(item => item.id === 'compromised').label = `Declare ${words[count]} compromises because there are ${words[count]} failures.`;
  mission.decision.options.find(item => item.id === 'ignore').feedback = `A benign explanation for ${words[known]} events does not explain every event. Follow the remaining lead.`;
  mission.debrief = `${titleCase(words[count])} failures become ${words[known]} explained retries and one lead worth reviewing. A count is evidence to interpret, not a compromise verdict.`;
}

/** Deterministic, independent mission data; unchanged IDs keep objective persistence stable. */
export function createPracticeMission(baseMission, variant = 1) {
  if (!Number.isInteger(variant) || variant < 1 || variant > MAX_PRACTICE_VARIANT) throw new RangeError(`Practice variant must be an integer from 1 to ${MAX_PRACTICE_VARIANT}.`);
  if (!baseMission || typeof baseMission.id !== 'string' || !baseMission.fixtures || !Array.isArray(baseMission.objectives) || !Array.isArray(baseMission.solutions)) throw new TypeError('Practice requires a complete base mission.');
  const { mission: renamed, transform } = renamePaths(baseMission, variant);
  const cycle = (variant - 1) % 3;
  const relay = ['Cedar', 'Spruce', 'Birch'][cycle];
  const port = 8180 + variant % 7;
  const evidence = replacements([
    ['Pine', relay], ['Glass Bridge', ['Stone Bridge', 'Willow Bridge', 'Moss Bridge'][cycle]],
    ['Rowan', ['Robin', 'Ash', 'Wren'][cycle]], ['Iris', ['Fern', 'Hazel', 'Reed'][cycle]],
    ['TT-204', `TT-${204 + variant}`], ['S-17', `S-${17 + variant}`],
    ['4.1.0', `4.${2 + cycle}.0`], ['4.2.1', `4.${3 + cycle}.1`],
    ['192.0.2.50', `192.0.2.${60 + variant % 30}`], ['192.0.2.1', `192.0.2.${240 + variant % 10}`],
    ['people_count=12', `people_count=${7 + variant % 12}`], ['8088', String(port)],
  ]);
  let mission = mapText(renamed, value => evidence(value).replace(/\b(08|09|18):(\d{2})\b/g, (_, hour, minutes) => `${String(Number(hour) + variant % 3).padStart(2, '0')}:${minutes}`));
  mission.practiceVariant = variant;
  if (['hike-16', 'hike-20'].includes(mission.id)) {
    mission.fixtures['/etc/network.txt'] = `Netid State  Local Address:Port    Peer Address:Port\ntcp   LISTEN 0.0.0.0:22           0.0.0.0:*\ntcp   LISTEN 0.0.0.0:${port}         0.0.0.0:*\nudp   UNCONN 127.0.0.1:53         0.0.0.0:*\n`;
    mission.fixtures['/etc/processes.txt'] = `USER PID %CPU %MEM COMMAND\nroot 1 0.0 0.2 /sbin/init\ntrainee ${714 + variant} 0.1 0.3 /bin/bash\nservice ${809 + variant} 0.2 1.1 /opt/relay/relay-agent --port ${port}\n`;
  }
  if (mission.id === 'hike-08' && variant % 2 === 0) healthyAccount(mission, transform);
  if (mission.id === 'hike-21') remixLog(mission, transform, variant);
  if (['hike-18', 'hike-24'].includes(mission.id)) {
    const trusted = HASHES[cycle];
    mission = mapText(mission, value => value.replaceAll(ORIGINAL_HASH, trusted));
    const folder = mission.id === 'hike-18' ? 'archive' : 'capstone';
    mission.fixtures[transform(HOME + `${folder}/route.conf`)] = `route=academy.test\nmode=verified\nexercise=${cycle + 1}\n`;
    if (mission.id === 'hike-18') {
      const [message, encoded] = DISPATCHES[cycle];
      mission.fixtures[transform(HOME + 'archive/dispatch.b64')] = encoded + '\n';
      mission.objectives.find(item => item.id === 'decode').check.outputIncludes = [message];
      mission.debrief = `The decoded dispatch reads: ${message} Base64 supplied no secrecy.`;
      if (variant % 2 === 0) {
        // The task credits calculating actual bytes. The decision must recognize a discrepancy.
        mission.fixtures[transform(HOME + 'archive/route.conf')] = 'route=academy.test\nmode=verified\n';
        mission.objectives.find(item => item.id === 'hash').check.outputIncludes = [ORIGINAL_HASH];
        mission.decision.context = 'The calculated route hash differs from Nova’s trusted reference. The dispatch is ordinary Base64.';
        mission.decision.options[0] = { id: 'mismatch', label: 'Hold the differing copy, preserve the evidence, and verify it through Nova’s trusted release channel.', correct: true, feedback: 'The bytes do not match the approved record. Investigate the discrepancy before relying on the file; Base64 remains non-secret encoding.' };
        mission.hints[2] = transform('Run cat archive/trusted-sha256.txt, sha256sum archive/route.conf, and base64 -d archive/dispatch.b64. The digests differ; preserve the copy and verify through the trusted release channel.');
        mission.debrief += ' The route fingerprint differed from the trusted record, so you held the copy for verification.';
        decision(mission, 'mismatch');
      } else mission.debrief += ' The route fingerprint matches the trusted record.';
    }
  }
  return mission;
}
