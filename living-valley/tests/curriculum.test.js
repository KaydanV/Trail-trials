import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { chapters, missions, missionById, skillTree } from '../curriculum.js';
import { createShell } from '../shell.js';
import {
  createSession, currentStep, runCommand, inspectItem, submitActivity,
  answerQuestion, canComplete, completeMission, createProfile, createStorage,
} from '../runtime.js';
import { makeReviewMission } from '../review.js';

const chapterCounts = [8, 9, 9, 8, 10, 9, 8, 9, 9, 8, 9, 8];
const scenes = new Set('welcome maps owl burrow desk lantern keeper post bridge lookout tower summit'.split(' '));
const tools = new Set('terminal explorer network browser evidence windows script dialogue'.split(' '));
const kinds = new Set('inspect choose compare classify sequence connect report repair'.split(' '));
const terminalTypes = new Set('read command write exists mode permission directory absent file'.split(' '));
const knownSpeakers = new Set('NOVA PATCH PATCHES OWL BRAMBLE TESSA'.split(' '));
const clone = value => structuredClone(value);
const text = (value, label, minimum = 3) => assert.equal(typeof value === 'string' && value.trim().length >= minimum, true, label);

async function solveEncounter(mission, { wrongQuestion = false } = {}) {
  const session = createSession(mission);
  session.started = true;
  assert.equal(canComplete(mission, session), false, `${mission.id}: fresh encounter is incomplete`);
  assert.throws(() => completeMission(mission, session), /Collect every clue/);
  for (let index = 0; index < mission.steps.length; index++) {
    assert.equal(currentStep(mission, session), index, `${mission.id}: clue order cannot be bypassed`);
    const step = mission.steps[index];
    if (['file', 'exists', 'directory', 'absent', 'mode', 'permission'].includes(step.check.type)) {
      const unrelated = clone(session);
      await runCommand(mission, unrelated, 'pwd');
      assert.equal(unrelated.done[index], false, `${mission.id}/${step.id}: an unrelated command cannot claim an already-true state`);
    }
    if (step.check.type !== 'activity') {
      for (const command of Array.isArray(step.solution) ? step.solution : [step.solution]) {
        const result = await runCommand(mission, session, command);
        assert.equal(result.ok === true && !(result.error && result.completedStep === undefined), true,
          `${mission.id}/${step.id}: ${command}\n${result.reason ?? result.output}`);
      }
    } else {
      for (const item of step.solution.inspect ?? step.activity.requiredInspect ?? []) {
        if (!session.done[index]) {
          const result = inspectItem(mission, session, index, item);
          assert.equal(result.ok, true, `${mission.id}/${step.id}: inspect ${item}: ${result.reason ?? ''}`);
        }
      }
      if (!session.done[index]) {
        const result = submitActivity(mission, session, index, step.solution);
        assert.equal(result.ok, true, `${mission.id}/${step.id}: ${result.reason ?? 'activity failed'}`);
      }
    }
    assert.equal(session.done[index], true, `${mission.id}/${step.id}: authored outcome did not verify`);
    assert.equal(currentStep(mission, session), index + 1);
  }
  assert.equal(canComplete(mission, session), false, `${mission.id}: collecting clues does not bypass knowledge checks`);
  for (const [index, question] of mission.questions.entries()) {
    if (wrongQuestion) {
      assert.equal(answerQuestion(mission, session, index, (question.answer + 1) % question.options.length).correct, false);
      assert.equal(canComplete(mission, session), false);
    }
    assert.equal(answerQuestion(mission, session, index, question.answer).correct, true,
      `${mission.id}: the authored correct answer is accepted`);
  }
  assert.equal(canComplete(mission, session), true);
  const record = completeMission(mission, session,
    'Automated route verification: this establishes functional completion, not real learner retention.');
  assert.equal(record.missionId, mission.id);
  assert.equal(record.hints, 0);
  assert.equal(record.independent, mission.phase !== 'discover');
  return { session, record };
}

test('the blueprint has exactly 92 ordered lessons and 12 chapter bosses across 104 encounters', () => {
  assert.equal(chapters.length, 12);
  assert.equal(missions.length, 104);
  assert.deepEqual(chapters.map(chapter => chapter.id), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.deepEqual(chapters.map(chapter => missions.filter(mission => mission.chapter === chapter.id).length), chapterCounts);
  const lessons = missions.filter(mission => mission.phase !== 'boss');
  assert.deepEqual(lessons.map(mission => mission.lesson), Array.from({ length: 92 }, (_, index) => index + 1));
  assert.equal(new Set(missions.map(mission => mission.id)).size, 104);
  assert.equal(missionById.size, 104);
  for (const chapter of chapters) {
    const encounters = missions.filter(mission => mission.chapter === chapter.id);
    assert.equal(encounters.at(-1).phase, 'boss', `Chapter ${chapter.id} concludes with its own boss`);
    assert.equal(encounters.filter(mission => mission.phase === 'boss').length, 1);
    assert.equal(encounters.at(-1).id, `c${String(chapter.id).padStart(2, '0')}-boss`);
    assert.equal(new Set(encounters.flatMap(mission => mission.questions.map(question => question.answer))).size >= 3, true,
      `Chapter ${chapter.id}: correct answers vary across the offered positions`);
    for (const field of ['title', 'subtitle', 'location', 'outcome', 'officeConnection']) text(chapter[field], `Chapter ${chapter.id}: ${field}`);
    assert.equal(scenes.has(chapter.scene), true);
  }
});

test('every encounter supplies real evidence, four help tiers, contextual explanations and knowledge checks', () => {
  const answers = new Set(), prompts = new Set(), summaries = new Set(), activityKinds = new Set(), usedTools = new Set();
  for (const mission of missions) {
    const id = mission.id;
    for (const field of ['title', 'location', 'summary', 'officeConnection', 'debrief', 'callback']) text(mission[field], `${id}: ${field}`);
    assert.equal(summaries.has(mission.summary), false, `${id}: each scenario has its own problem`);
    summaries.add(mission.summary);
    assert.equal(['discover', 'practice', 'prove', 'boss'].includes(mission.phase), true, id);
    assert.equal(scenes.has(mission.scene), true, id);
    assert.equal(mission.story.length >= 2 && mission.story.length <= 4, true, `${id}: two to four deliberate story beats`);
    for (const frame of mission.story) {
      assert.equal(knownSpeakers.has(frame.speaker.toUpperCase()), true, `${id}: known speaking character`);
      text(frame.title, `${id}: story title`); text(frame.text, `${id}: story dialogue`, 20);
    }
    for (const field of ['plain', 'why', 'professional', 'when']) text(mission.briefing[field], `${id}: briefing ${field}`, 15);
    assert.equal(Array.isArray(mission.skills) && mission.skills.length > 0, true, `${id}: demonstrated skills`);
    for (const collection of ['skills', 'reinforces', 'requires']) {
      assert.equal(Array.isArray(mission[collection]), true, `${id}: ${collection}`);
      assert.equal(new Set(mission[collection]).size, mission[collection].length, `${id}: distinct ${collection}`);
      for (const skill of mission[collection]) text(skill, `${id}: skill identifier`, 1);
    }
    assert.equal(mission.steps.length >= (mission.phase === 'boss' ? 5 : 2) && mission.steps.length <= (mission.phase === 'boss' ? 6 : 5), true, `${id}: meaningful clue count`);
    assert.equal(new Set(mission.steps.map(step => step.id)).size, mission.steps.length, `${id}: unique clue identifiers`);
    createShell(mission.fixtures, mission.shell); // validates every actual fixture, permission and canonical path
    for (const step of mission.steps) {
      const label = `${id}/${step.id}`;
      assert.equal(tools.has(step.tool), true, `${label}: supported playable tool`);
      usedTools.add(step.tool);
      for (const field of ['title', 'prompt']) text(step[field], `${label}: ${field}`);
      assert.equal(prompts.has(step.prompt), false, `${label}: an authored outcome rather than a repeated placeholder`);
      prompts.add(step.prompt);
      for (const field of ['plain', 'meaning', 'when']) text(step.teaching[field], `${label}: teaching ${field}`, 10);
      assert.equal(typeof step.teaching.syntax, 'string', `${label}: syntax deliberately introduced or withheld`);
      assert.equal(step.hints.length, 4, `${label}: question, concept, location and syntax help`);
      for (const [index, hint] of step.hints.entries()) text(hint, `${label}: usable hint`, index === 3 ? 1 : 8);
      assert.equal(new Set(step.hints).size, 4, `${label}: distinct help tiers`);
      assert.equal(knownSpeakers.has(step.feedback.speaker.toUpperCase()), true, `${label}: contextual character feedback`);
      for (const field of ['text', 'why', 'professional', 'when']) text(step.feedback[field], `${label}: feedback ${field}`, 8);
      if (step.check.type === 'activity') {
        assert.equal(kinds.has(step.activity.kind), true, `${label}: supported actual interaction`);
        activityKinds.add(step.activity.kind);
        text(step.activity.heading, `${label}: interaction heading`);
        text(step.activity.instructions, `${label}: interaction instructions`);
        assert.equal(typeof step.solution, 'object', `${label}: activity has an executable learner route`);
        if (step.activity.items) {
          assert.equal(new Set(step.activity.items.map(item => item.id)).size, step.activity.items.length, `${label}: distinct evidence artifacts`);
          for (const item of step.activity.items) { text(item.id, label, 1); text(item.label, label, 1); text(item.detail, `${label}: inspectable source`, 5); }
        }
        const ids = new Set((step.activity.items ?? []).map(item => item.id));
        for (const required of step.activity.requiredInspect ?? []) assert.equal(ids.has(required), true, `${label}: required source exists`);
        if (step.activity.choices) {
          assert.equal(step.activity.choices.filter(choice => choice.correct).length >= 1, true, `${label}: a supported action`);
          assert.equal(step.activity.choices.some(choice => !choice.correct), true, `${label}: a realistic alternative`);
          for (const choice of step.activity.choices) { text(choice.label, label); text(choice.feedback, `${label}: action consequence`); }
        }
        if (step.activity.kind === 'report') {
          assert.deepEqual(Object.keys(step.solution.fields ?? {}).sort(), step.activity.fields.map(field => field.id).sort(),
            `${label}: report answers correspond to the actual visible fields`);
          for (const field of step.activity.fields) {
            text(field.label, `${label}: report field`);
            assert.equal(field.required.length > 0, true, `${label}: a report checks actual observed facts`);
            text(step.solution.fields[field.id], `${label}: a factual report can be written`);
          }
        }
        if (step.activity.kind === 'repair') assert.equal((step.activity.tests ?? []).length, 0, `${label}: text repair cannot pretend to execute a script`);
      } else {
        assert.equal(terminalTypes.has(step.check.type), true, `${label}: supported observable outcome`);
        const route = Array.isArray(step.solution) ? step.solution : [step.solution];
        assert.equal(route.length > 0, true, label);
        for (const command of route) text(command, `${label}: actual terminal route`, 1);
        if (step.check.path) assert.match(step.check.path, /^\/(?:home\/trainee|var|etc|tmp)(?:\/|$)/, `${label}: isolated scenario path`);
      }
    }
    assert.equal(mission.questions.length >= (mission.phase === 'boss' ? 3 : 2), true, `${id}: explanation and transfer checks`);
    for (const question of mission.questions) {
      text(question.question, `${id}: knowledge question`, 15); text(question.explanation, `${id}: answer reasoning`, 20);
      assert.equal(question.options.length >= 3 && question.options.length <= 5, true, `${id}: multiple authored alternatives`);
      assert.equal(new Set(question.options).size, question.options.length, `${id}: distinct answer choices`);
      assert.equal(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length, true, `${id}: answer is available`);
      for (const option of question.options) text(option, `${id}: readable answer`, 1);
      answers.add(question.answer);
    }
  }
  assert.deepEqual([...answers].sort(), [0, 1, 2], 'The correct answer is not fixed in one position');
  for (const required of ['terminal', 'explorer', 'network', 'browser', 'evidence', 'windows', 'dialogue']) assert.equal(usedTools.has(required), true, `A broad foundation includes ${required} play`);
  for (const required of ['inspect', 'choose', 'compare', 'classify', 'sequence', 'connect', 'report']) assert.equal(activityKinds.has(required), true, `An actual ${required} interaction is authored`);
});

test('the skill journal resolves prerequisites to capabilities encountered earlier in the adventure', () => {
  const seen = new Set();
  for (const mission of missions) {
    for (const prerequisite of mission.requires) assert.equal(seen.has(prerequisite), true,
      `${mission.id}: prerequisite ${prerequisite} must have appeared before it is required`);
    for (const skill of mission.skills) seen.add(skill);
  }
  const tree = skillTree();
  assert.equal(tree.length, seen.size);
  for (const skill of tree) {
    assert.equal(skill.introduced.length + skill.practice.length + skill.bosses.length > 0, true);
    assert.equal(skill.office.length > 0, true, `${skill.id}: preparation for later supervised work`);
    for (const source of [...skill.introduced, ...skill.practice, ...skill.bosses]) assert.equal(missionById.has(source), true);
  }
});

test('all 104 canonical learner routes genuinely complete, reject wrong answers, and survive export/import', async () => {
  const profile = createProfile(missions), store = createStorage(missions, null);
  for (const mission of missions) {
    const { session, record } = await solveEncounter(mission, { wrongQuestion: true });
    profile.sessions[mission.id] = session;
    profile.records[mission.id] = record;
    profile.completed.push(mission.id);
    profile.currentMission = missions[Math.min(profile.completed.length, missions.length - 1)].id;
    if (mission.phase === 'boss') {
      const restored = store.import(store.export(profile));
      assert.deepEqual(restored.completed, profile.completed, `${mission.id}: complete chapter progress survives`);
      assert.deepEqual(restored.sessions[mission.id].shell.files, session.shell.files, `${mission.id}: actual evidence survives`);
      assert.equal(restored.records[mission.id].independent, record.independent);
    }
  }
  assert.equal(profile.completed.length, 104);
  assert.equal(Object.keys(profile.records).length, 104);
});

for (const variant of [1, 2]) test(`every return-trip ${variant} uses its renamed evidence and actually completes all 104 encounters`, async () => {
  const originals = JSON.stringify(missions);
  for (const original of missions) {
    const mission = makeReviewMission(original, variant);
    assert.equal(mission.id, original.id);
    assert.equal(mission.reviewVariant, variant);
    for (const step of mission.steps) assert.equal(step.phase, mission.phase,
      `${original.id}/${step.id}: return trips withhold discovery syntax while keeping optional hints`);
    const originalPaths = Object.keys(original.fixtures);
    const newPaths = Object.keys(mission.fixtures);
    for (const name of originalPaths.filter(path => !/^\/(?:var|etc)\//.test(path) && !path.startsWith('C:'))) {
      assert.equal(newPaths.includes(name), false, `${original.id}: the practice evidence moved from ${name}`);
    }
    const { session, record } = await solveEncounter(mission);
    assert.equal(session.done.every(Boolean), true);
    assert.equal(record.independent, true, `${original.id}: unassisted return-trip demonstration`);
    assert.equal(record.introduced, false);
    const backend = createStorage([original], null), profile = createProfile([original]);
    const canonical = await solveEncounter(original);
    profile.completed.push(original.id); profile.sessions[original.id] = canonical.session; profile.records[original.id] = canonical.record;
    profile.practiceSessions[original.id] = { variant, session, record };
    const restored = backend.import(backend.export(profile));
    assert.equal(restored.practiceSessions[original.id].variant, variant);
    assert.deepEqual(restored.practiceSessions[original.id].session.shell.files, session.shell.files);
    assert.deepEqual(restored.sessions[original.id].shell.files, canonical.session.shell.files, 'Practice never overwrites canonical evidence');
  }
  assert.equal(JSON.stringify(missions), originals, 'Return trips leave the authored adventure immutable');
});

test('wrong actions and unsupported claims cannot clear authored investigation clues', async () => {
  let choiceCases = 0, inspectionCases = 0, readCases = 0;
  for (const original of missions) {
    for (const step of original.steps) {
      // A one-clue encounter isolates the real authored evidence without forging session progress.
      const mission = { ...original, steps: [clone(step)] }, session = createSession(mission);
      if (step.check.type === 'read') {
        const result = await runCommand(mission, session, 'echo "Investigation complete"');
        assert.equal(result.completedStep, undefined); assert.deepEqual(session.done, [false]); readCases++;
      }
      if (step.check.type !== 'activity') continue;
      const activity = step.activity;
      if (activity.kind === 'choose' || activity.kind === 'compare') {
        const correct = activity.choices.find(choice => choice.correct);
        if ((activity.requiredInspect ?? []).length) {
          const result = submitActivity(mission, session, 0, { choice: correct.id });
          assert.equal(result.ok, false, `${original.id}/${step.id}: evidence must precede the action`);
          inspectionCases++;
        }
        for (const id of activity.requiredInspect ?? []) inspectItem(mission, session, 0, id);
        const wrong = activity.choices.find(choice => !choice.correct);
        assert.equal(submitActivity(mission, session, 0, { choice: wrong.id }).ok, false);
        assert.deepEqual(session.done, [false]); choiceCases++;
      } else if (activity.kind === 'report') {
        assert.equal(submitActivity(mission, session, 0, { fields: Object.fromEntries(activity.fields.map(field => [field.id, 'Everything is fine.'])) }).ok, false);
        assert.deepEqual(session.done, [false]);
      }
    }
  }
  assert.equal(choiceCases > 20, true, 'Wrong actions were exercised across actual authored scenarios');
  assert.equal(inspectionCases > 20, true, 'Evidence requirements were exercised across actual authored scenarios');
  assert.equal(readCases > 20, true, 'Printed claims do not substitute for inspecting the evidence');
});

test('the separate adventure references existing local assets and preserves the original game entry point', async () => {
  for (const relative of ['../index.html', '../app.js', '../styles.css', '../world.js', '../world.css', '../../index.html', '../../assets/expedition.webp']) {
    await access(new URL(relative, import.meta.url));
  }
  for (const relative of ['../index.html', '../styles.css', '../world.css', '../world.js']) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8');
    const references = [...source.matchAll(/(?:src=["']|url\(["']?)([^"')\s]+\.(?:webp|svg|woff2|png|css|js))/g)].map(match => match[1]);
    for (const reference of references.filter(value => !/^(?:https?:|data:|#)/.test(value))) await access(new URL(reference, new URL(relative, import.meta.url)));
  }
});
