# Terminal Trails · Version 5

**The Living Valley** is a story-led cybersecurity adventure: 92 lessons and 12 chapter bosses, with a curious robot, practical investigations, and a valley to bring back online.

[Play Version 5](https://kaydanv.github.io/Trail-trials/) · [Direct game link](https://kaydanv.github.io/Trail-trials/living-valley/) · [Original expedition](https://kaydanv.github.io/Trail-trials/classic.html)

## Play

Explore with WASD, arrow keys, click-to-walk, or the phone thumbstick. Glowing objects indicate evidence worth inspecting. Use the workbench, terminal, maps, mail and evidence tools to investigate; check in with Nova when your findings are ready. Patch offers increasingly specific hints. Wrong turns are recoverable.

Progress saves in this browser. Settings includes export/import backups for moving between devices. Existing Living Valley saves remain supported; the original expedition retains its independent saves.

## Develop

Node.js 24 is used in CI (22 or newer is supported).

```sh
npm ci
npm start
```

Open the server's root URL to enter Version 5. This is a static HTML/CSS/JavaScript game: no backend, build step, account, or API key.

## Verify a release

```sh
npx playwright install chromium
npm run verify:v5
```

The release command starts and stops its own server, checks both games, and runs the unit, full-adventure, phone, interactive-tool and immersive-control browser suites. It exits unsuccessfully if a required check fails. System Chromium is used when available; `CHROMIUM_PATH` selects another executable. Browser evidence is written under ignored `test-results/`.

## Publish

`main` is the release branch. After the release checks pass on `main`, the publishing job requests GitHub Pages to use **GitHub Actions**. The root enters Living Valley; `/living-valley/` remains a stable direct link. `.nojekyll` keeps the static application intact. The publishing job needs the repository’s Pages write permission; if repository policy denies that operation, select this source in Settings → Pages. See [the V5 release record](docs/V5_RELEASE.md) for checks and the publishing transition.

## Project

- `living-valley/`: the Version 5 application, curriculum, simulation, art styling and tests.
- `assets/`: local artwork, character/equipment sheets and fonts.
- `scripts/`: development server, curriculum map and release verification.
- `classic.html`, `src/`, `styles/`, `tests/`: preserved original expedition and its checks.
- `docs/`: curriculum, design and historical development records. [Legacy guide](docs/LEGACY.md).

The release covers the Living Valley foundation. Office and Night Shift are future destinations. The tools operate on fictional teaching state, never the player's computer or real networks.
