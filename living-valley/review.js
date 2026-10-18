// Return trips change the places where evidence lives, preserving the lesson's
// meaning and verified outcomes. They are practice, never extra story credit.
export function makeReviewMission(original, variant = 1) {
  if (!Number.isInteger(variant) || variant < 1 || variant > 10000)
    throw new Error("Invalid return-trip number.");
  const mission = structuredClone(original);
  const names = Object.keys(mission.fixtures || {}).filter(
    (name) =>
      !name.startsWith("/var/") &&
      !name.startsWith("/etc/") &&
      !name.startsWith("C:"),
  );
  const changes = names
    .map((name) => {
      const slash = name.lastIndexOf("/"),
        leaf = name.slice(slash + 1),
        dot = leaf.lastIndexOf(".");
      const replacement =
        dot > 0
          ? `${leaf.slice(0, dot)}-return-${variant}${leaf.slice(dot)}`
          : `${leaf}-return-${variant}`;
      return [name, name.slice(0, slash + 1) + replacement, leaf, replacement];
    })
    .sort((a, b) => b[0].length - a[0].length);
  const replace = (text) => {
    let result = text;
    for (let index = 0; index < changes.length; index++) {
      const [path, , leaf] = changes[index];
      result = result.split(path).join(`\u0001PATH${index}\u0001`);
      // Only complete file tokens; do not mutate command names or longer names.
      result = result.replace(
        new RegExp(
          `(?<![\\w.-])${leaf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])`,
          "g",
        ),
        `\u0001LEAF${index}\u0001`,
      );
    }
    return result.replace(
      /\u0001(PATH|LEAF)(\d+)\u0001/g,
      (_, kind, index) => changes[Number(index)][kind === "PATH" ? 1 : 3],
    );
  };
  function walk(value) {
    if (typeof value === "string") return replace(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [replace(key), walk(item)]),
      );
    return value;
  }
  const reviewed = walk(mission);
  reviewed.id = original.id;
  reviewed.title = `${original.title} · Return trip ${variant}`;
  reviewed.phase = original.phase === "boss" ? "boss" : "prove";
  for (const step of reviewed.steps) step.phase = reviewed.phase;
  reviewed.reviewVariant = variant;
  reviewed.briefing.plain = `A new evidence pack has arrived. ${reviewed.briefing.plain}`;
  reviewed.briefing.why +=
    " The filenames have changed. Locate the evidence again; use the methods you learned rather than a remembered path.";
  return reviewed;
}
