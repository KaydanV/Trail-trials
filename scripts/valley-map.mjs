import {writeFile} from 'node:fs/promises';
import {chapters, missions, phaseNames, skillTree, skillNames} from '../living-valley/curriculum.js';

const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const labels = values => values.length ? values.map(skillNames).map(cell).join(', ') : '—';
const encounters = ids => ids.length ? ids.join(', ') : '—';
const output = [
  '# Living Valley: the authored foundation map',
  '',
  'Generated from the playable curriculum with `node scripts/valley-map.mjs`. This maps the requested 92 lessons and 12 bosses to their actual teaching, practice, prerequisites, and later applications. It is a curriculum map, not a claim of certification or complete professional competence.',
  '',
  'Each chapter groups related methods before its boss. A step may introduce a new concept while another step recalls an earlier method; discovery explains the tool, practice and proof fade the route, and Patch remains available. Return trips keep their own state and hide supplied discovery syntax.',
  '',
  '| Chapter | Lessons | Boss | Preparation for later workplace cases |',
  '| --- | ---: | --- | --- |',
];
for (const chapter of chapters) {
  const group = missions.filter(mission => mission.chapter === chapter.id);
  output.push('| ' + chapter.id + '. ' + cell(chapter.title) + ' | ' + group.filter(mission => mission.phase !== 'boss').length + ' | ' + cell(group.at(-1).title) + ' | ' + cell(chapter.officeConnection) + ' |');
}
for (const chapter of chapters) {
  const group = missions.filter(mission => mission.chapter === chapter.id);
  output.push('', '## ' + chapter.id + '. ' + chapter.title, '', chapter.outcome, '', '| Encounter | Teaching and assessment | Practical work | Earlier capabilities required |', '| --- | --- | --- | --- |');
  for (const mission of group) {
    const modes = [...new Set(mission.steps.map(step => phaseNames[step.phase || mission.phase]))].join(' → ');
    const tools = [...new Set(mission.steps.map(step => step.tool))].join(', ');
    output.push('| ' + mission.id + ' · ' + cell(mission.title) + ' | ' + cell(modes) + ' | ' + cell(tools) + ' · ' + mission.steps.length + ' outcomes | ' + labels(mission.requires) + ' |');
  }
}
output.push('', '## Declared skill and reinforcement tree', '', 'The rows below use authored capability labels. Introduction, later reinforcement and boss assessment are separate links. Some composite labels name an assessment rather than a new tool. Prerequisites describe the capability’s first encounter; later recall does not retroactively make an earlier skill depend on a later one.', '', '| Capability | Introduction encounters | Practice and reinforcement | Boss assessments | First-encounter prerequisites |', '| --- | --- | --- | --- | --- |');
for (const skill of skillTree()) {
  output.push('| ' + cell(skill.title) + ' | ' + encounters(skill.introduced) + ' | ' + encounters(skill.practice) + ' | ' + encounters(skill.bosses) + ' | ' + labels(skill.prerequisites) + ' |');
}
output.push('', 'Office and Night Shift are story destinations in development. They are not playable or automatically unlocked implementations. See [the design](LIVING_VALLEY_DESIGN.md) and [review audit](LIVING_VALLEY_REVIEW_AUDIT.md) for scope and verification limits.', '');
await writeFile(new URL('../docs/LIVING_VALLEY_FOUNDATION.md', import.meta.url), output.join('\n'));
console.log('Mapped ' + missions.length + ' encounters and ' + skillTree().length + ' capability labels.');
