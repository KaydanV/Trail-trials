# Foundation validation

The upgrade replaces the eight-mission V4 preview with a 24-mission Hike Trail, 103 verified objectives, and 72 story frames. The main application remains a static browser game. Office and Night Shift are visible and unavailable until their chapters are implemented.

## Automated checks

Validated in the prepared cloud machine with Node.js 24 and system Chromium:

- `npm ci` succeeds using the committed lockfile.
- `npm run check` validates all application modules.
- `npm test` passes 46 tests covering shell parsing, filesystem isolation, safe error behavior, real hashes, simulated networking, save validation, migration, tutorial settings, all 72 scene/character mappings, shipped artwork, static illustrated props, and every documented mission solution.
- `npm run test:browser` completes all 24 missions through the public interface, verifies evidence/decision/quiz gates, partial progress after reload, all three journeys, UI export/import/reset, hints and stars, terminal/reflection escaping, keyboard focus, settings and reduced motion, and locked future chapters before and after completion. It also checks all six guided tutorial steps, isolated command previews, Back/Skip/Escape/replay, unchanged mission evidence during the tour, returning V5 saves, free Patch check-ins, story-specific picture changes, active speakers, and locally served fonts.
- Browser screenshots and overflow checks cover 390, 768, and 1440 pixel widths. The browser suite checks application errors and failed local resources.

GitHub Actions runs the same module, unit/integration, and browser checks and retains browser screenshots as an artifact. A local passing run does not establish that the remote workflow has run; check its status after pushing.

## Release limits

Browser automation verifies achievable objectives and working flows. Beginner playtesting, more browser engines, and an accessibility audit remain appropriate before a public release. Current animated scenes use 12 illustrated locations, scene props, speaking character portraits, camera movement, and atmosphere; they are not video or 3D cutscenes. The terminal is an intentionally limited simulator, and course completion is not professional certification.

See `FOUNDATION.md` for curriculum coverage and the simulated scope of scripting, patching, firewall changes, and operational response. See `DEVELOPMENT.md` for the foundation-first product direction.
