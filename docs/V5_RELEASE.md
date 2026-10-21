# Version 5 · The Living Valley

## Release scope

- 104 playable encounters: 92 lessons and 12 chapter bosses, with prerequisite progression, help, knowledge checks, reflection and return-trip practice.
- Terminal, exploration, comparisons, sorting, route wiring, evidence, mail, reports, scripts and a fictional Windows workstation.
- A consistent alpine visual treatment across all 12 scene families, using four shared illustrated environments. Portrait welcome artwork, painted characters and equipment, larger silhouettes, restrained evidence glow, reduced-motion support and readable task overlays.
- Evidence that has already been inspected remains available but loses its new-clue glow. Painted-building collision boundaries follow the displayed image crop, instead of invisible legacy tent and cabin shapes.
- One public V5 entry point at `/`, with `/living-valley/` retained and the original game preserved at `/classic.html`. Saves and original storage namespaces remain intact.
- A single local/CI verification command, `npm run verify:v5`, including the original game's regression coverage.

## Repository and publishing

`main` is the release source. Earlier feature branches are consolidated without rewriting their commits. Version tags preserve the release. The former publishing and duplicate foundation branches may be removed after the verified `main` Actions deployment succeeds. Their work remains in the release history and an archive tag.

GitHub Pages: **Settings → Pages → Source: GitHub Actions**. After verification on `main`, the publishing job uses its scoped Pages write permission to set this source, deploy a public-only artifact and check its live version marker. The cloud machine cannot reach the GitHub API directly; the job runs on GitHub's runner. If repository policy denies that request, the repository owner must select this source in Pages settings. A successful push is not deployment confirmation.

## Verification record

Local verification completed on 2026-10-21 with Node 24 and Chromium:

- `npm run verify:v5` passed from start to finish.
- 155 original-game tests and 110 Living Valley tests passed; none failed or skipped.
- The original browser suite completed all 24 missions. Its touch suite passed at 320×568, 390×844, 844×390 and 768×1024.
- The Living Valley browser suite completed all 104 public-UI encounters and 12 bosses, plus return trips, stories, knowledge gates, accepted reports, reload and export/import.
- The playable-tool suite passed, including keyboard navigation out of an empty terminal and inspected-clue feedback.
- The immersive suite passed tutorial, replay/skip, phone controls, viewport reachability, collision routing and movement checks. Direction speed is measured with equal controlled browser-clock intervals rather than unrelated wall-clock stalls.
- `npm run build:site` staged a runtime-only Pages artifact. A separate HTTP/browser smoke check of that artifact verified the root entry, real pickup collection, saved observation, workbench and absence of missing resources.

The CI workflow repeats the release gate on `main`, stages the site only on success, deploys with GitHub Pages, and verifies that the public `version.json` matches the release commit. A local result does not imply the remote Actions run or Pages deployment has completed.

## Scope limits

This is an illustrated 2D adventure with four shared environment settings, not 104 unique sets or a fully animated 3D world. Office and Night Shift remain in development. Authored-route automation demonstrates working gameplay and save handling; beginner enjoyment and delayed skill retention require playtesting. The simulated terminal is a bounded teaching interpreter.
