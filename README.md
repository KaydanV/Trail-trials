# Terminal Trails — The Signal Academy

A little adventure. A lot of real skills.

We’re building the foundation first. Hike Trail takes you from helping a slightly chaotic robot find its feet to investigating a broken mountain signal network. You follow the story, use the terminal, collect evidence, and make a call. The learning happens while you’re figuring things out.

## What’s playable

- **Hike Trail:** 24 missions across four connected story acts, with illustrated locations that react to verified evidence, speaking Nova and Patch portraits, interactive decisions, animated story scenes, and short debriefs.
- **The Office:** visible and locked. Planned workplace situations; implementation comes after the foundation is refined and tested.
- **The Night Shift:** visible and locked. Planned realistic operations and time-sensitive tasks; implementation comes later.

Each completed stop offers practice remixes with fresh filenames and evidence. Some cases also change the correct decision, so read what you find. Resume the current case or generate another; practice progress and reflections save separately from trail XP, stars, unlocks, and notes. Finishing Hike Trail opens every foundation stop for replay. Office and Night Shift stay locked until their own chapters are built and validated.

The foundation includes terminal navigation, files, evidence preservation, least privilege, account security, phishing, data handling, networks, DNS, secure web connections, integrity checks, patching, log analysis, and incident response. See [the curriculum map](docs/FOUNDATION.md) for what each mission practices and the limits of a browser simulation.

## Play and develop

Use Node.js 22 or newer (validated with Node 24):

```sh
npm ci
npm start
```

The development server listens on port **4173**. The application is static HTML, CSS, and JavaScript; there is no build step, backend, account setup, or API key. Serve the repository with an HTTP server rather than opening `index.html` as a file, because it uses JavaScript modules.

```sh
npm run check
npm test
npm run test:browser
```

The browser checks need Chromium. They use `/usr/bin/chromium` when available; otherwise install Playwright’s browser with `npx playwright install chromium`. Set `CHROMIUM_PATH` to use another Chromium executable. Start the development server before running the browser checks; `TRAILS_URL` can select another address.

## Your journey stays yours

Three independent journeys save in browser storage, including in-progress files and verified objectives. Export a JSON backup from settings before changing devices or clearing browser data. If storage is unavailable, the game uses a temporary session and tells you to export it.

V4 progress is preserved separately when migrated. The expanded foundation starts fresh because the missions and requirements have changed. Earlier notes and XP remain available in the field notebook; original V4 storage keys are left intact.

Explore mode is untimed by default. The optional challenge mode records active time without stopping your mission. Story animation respects both the in-game setting and the device’s reduced-motion preference. Hints affect stars, never whether a completed mission counts: gentle nudges retain two stars, while revealing a route gives one. The hint strength resets when you verify the current clue.

Patch gives each journey a six-step guided introduction to the scene, objectives, terminal, hints, decisions, and progression. Its command previews are separate from the mission, and learning time pauses while the guide is open. Replay it whenever you like with **Show me around**. Command buttons explain their purpose before you run them; tapping Patch offers encouragement without using a hint.

Patch follows the next unfinished objective and explains common command mistakes. The world responds to verified actions: receipts appear, routes unfold, gates change, and the final beacon lights after reflection. Staged requests remain visibly staged. On a phone, the terminal keeps your current objective nearby and a shortcut bar jumps between the scene, clues, terminal, and your decision.

The visual direction uses expressive display lettering, deep forest and petrol atmosphere, warm amber actions, parchment evidence, and cyan terminal signals. Keep the world, characters, clues, and learning connected as we add more content. See [the design guide](docs/DESIGN_GUIDE.md) for the colours, fonts, scene composition, and interaction rules.

## Project layout

- `src/app.js`: adventure interface, story playback, progression, and debriefs.
- `src/curriculum.js`: mission story, fixtures, objectives, decisions, and skill map.
- `src/engine.js`: isolated teaching shell with structured evidence checks.
- `src/storage.js`: validated saves, backups, and V4 migration.
- `src/presentation.js`: scene and character mapping for every story frame, with illustrated evidence props.
- `src/world.js`: evidence-driven scene changes and character responses.
- `src/coach.js`: objective-aware hints and command failure explanations.
- `src/practice.js`: fresh evidence cases for all 24 foundation stops.
- `src/tutorial.js` and `src/tools.js`: Patch’s guided introduction and beginner command explanations.
- `styles.css`, `styles/`, and `assets/`: visual system, responsive play controls, animated world layers, and artwork.
- `tests/`: shell, save-system, curriculum, and browser regression checks.
- `docs/v4-reference.html`: the uploaded readable V4 source, retained as a development reference.

## What the simulation means

Commands work on fictional files and documented lab responses. They never execute on the player’s operating system or reach real networks. The shell supports a teaching subset, not a complete Linux implementation: no arbitrary scripts, shell expansion, package installation, or real service configuration. Failed pipelines restore their starting state so a learning mistake cannot destroy mission evidence; this is more forgiving than a real shell.

Completing the trail demonstrates the game’s exercises, not professional certification or independent operational readiness. Follow up in an authorized isolated lab and beginner playtesting before treating a skill as mastered.

## Next, once the trail feels right

Refine the foundation with observed beginner feedback, add optional audio, and verify more browsers. The [learning pace review](docs/PLAYTEST.md) records the content audit and the sessions still to run. Then build Office scenarios around everyday workplace needs. Night Shift follows with realistic priorities and time constraints. Keep the story, the terminal, and the reason for each action connected.
