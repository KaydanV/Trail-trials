# Foundation validation

The upgrade replaces the eight-mission V4 preview with a 24-mission Hike Trail, 103 verified objectives, and 72 story frames. The main application remains a static browser game. Office and Night Shift are visible and unavailable until their chapters are implemented.

## Automated checks

Validated on 2026-10-11 in the prepared cloud machine with Node.js 24 and system Chromium:

- `npm ci` succeeds using the committed lockfile.
- `npm run check` validates all application modules.
- `npm test` passes 152 tests covering shell parsing, filesystem isolation, safe errors, real hashes, simulated networking, save validation and migration, tutorial settings, all 72 scene/character mappings, shipped artwork, and every documented mission solution. The added checks complete all 24 remixes across four variants, follow focused hints through every canonical mission and remix variants 1–2, verify independent practice saves, and check evidence-driven world states.
- `TRAILS_URL=http://127.0.0.1:4174 npm run test:browser` completes all 24 missions through the public interface. It verifies evidence/decision/quiz gates, actual SVG visibility, scene restoration after reload, objective-aware hint strength and resets, partial progress, all three journeys, UI export/import/reset, hints and stars, terminal/reflection escaping, keyboard focus, settings and reduced motion, and locked future chapters. The existing six-step tutorial, isolated previews, Back/Skip/Escape/replay, returning V5 saves, free Patch check-ins, story pictures, active speakers, and local fonts remain covered.
- Practice browser checks cover fresh early and capstone evidence, resume after reload, changed filenames, same-case restart, new cases, separate reflections, and export/import. Account and hash cases with changed correct decisions also complete through the UI. Exported canonical files, objectives, scores, notes, current mission, and completion remain unchanged; practice adds no XP or unlocks.
- Browser screenshots and overflow checks cover 320, 360, 390, 768, and 1440 pixel widths, including longer late-game clues and practice cases. Field shortcuts work with pointer and keyboard input without awarding evidence or hints. The final run reports no application errors, unexpected dialogs, or failed local resources.
- A final screenshot review found faint practice buttons caused by overlapping button styles. After correcting their selectors, focused public-UI checks at 320 and 390 pixels confirm 7.91:1 text contrast, no overflow, and no browser errors.

GitHub Actions runs the same module, unit/integration, and browser checks and retains browser screenshots as an artifact. A local passing run does not establish that the remote workflow has run; check its status after pushing.

## Release limits

Browser automation verifies achievable objectives and working flows. The [learning pace review](PLAYTEST.md) records a complete content audit and wording improvements across all 24 stops; observed beginner sessions remain pending. More browser engines and an accessibility audit also remain appropriate before a public release. Current animated scenes use 12 illustrated locations, reactive SVG layers, scene props, speaking character portraits, camera movement, and atmosphere; they are not video or 3D cutscenes. The terminal is an intentionally limited simulator, and course completion is not professional certification.

See `FOUNDATION.md` for curriculum coverage and the simulated scope of scripting, patching, firewall changes, and operational response. See `DEVELOPMENT.md` for the foundation-first product direction.
