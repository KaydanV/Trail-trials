import {
  chapters as firstChapters,
  missions as firstMissions,
} from "./data/chapters-01-04.js";
import {
  chapters as middleChapters,
  missions as middleMissions,
} from "./data/chapters-05-08.js";
import {
  chapters as lastChapters,
  missions as lastMissions,
} from "./data/chapters-09-12.js";
import { applyFoundationDetails } from "./data/foundation-details.js";

export const chapters = [
  ...firstChapters,
  ...middleChapters,
  ...lastChapters,
].sort((a, b) => a.id - b.id);
const authored = applyFoundationDetails([
  ...firstMissions,
  ...middleMissions,
  ...lastMissions,
]);
export const missions = chapters.flatMap((chapter) =>
  authored
    .filter((mission) => mission.chapter === chapter.id)
    .sort(
      (a, b) =>
        (a.phase === "boss" ? Infinity : a.lesson) -
        (b.phase === "boss" ? Infinity : b.lesson),
    ),
);
export const missionById = new Map(
  missions.map((mission, index) => [
    mission.id,
    { ...mission, number: index + 1 },
  ]),
);
export const phaseNames = {
  discover: "Discover",
  practice: "Practise",
  prove: "Prove",
  boss: "Chapter boss",
};
export const skillNames = (id) =>
  String(id)
    .replace(/[-_]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
export const actNames = [
  "Something is wrong",
  "The valley falls apart",
  "The hidden pattern",
  "Defend the valley",
];

export function skillTree() {
  const skills = new Map();
  for (const mission of missions) {
    for (const id of new Set([...mission.skills, ...mission.reinforces])) {
      if (!skills.has(id))
        skills.set(id, {
          id,
          title: skillNames(id),
          introduced: [],
          practice: [],
          bosses: [],
          prerequisites: new Set(
            (mission.requires || []).filter(
              (prerequisite) => prerequisite !== id,
            ),
          ),
          office: new Set(),
        });
      const skill = skills.get(id);
      skill[
        mission.phase === "boss"
          ? "bosses"
          : mission.phase === "discover" && mission.skills.includes(id)
            ? "introduced"
            : "practice"
      ].push(mission.id);
      if (mission.officeConnection) skill.office.add(mission.officeConnection);
    }
  }
  return [...skills.values()].map((skill) => ({
    ...skill,
    prerequisites: [...skill.prerequisites],
    office: [...skill.office],
  }));
}
