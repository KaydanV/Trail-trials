# Terminal Trails: current product review

Reviewed on 2026-10-11. My subjective assessment before the review fixes is **8/10 as a playable personal-learning prototype and about 7/10 as a premium learning product**. The potential is around **9/10** if independent learning, retention, variety, and observed usability improve. These are design judgments, not measured learner outcomes or a commercial forecast.

## What was actually reviewed

The current 24-mission website branch was opened in local Chromium, with fresh desktop and 320/390px phone screenshots. The review covered the landing page, story frames including frame three, all six tutorial steps, command previews, first-mission commands, hints, decision, quiz, and completion. The curriculum, shell, saves, and previous full-game browser validation were also inspected. GitHub Pages itself returned a network-policy rejection from this workspace, so this is a review of the checked-out website branch, not a confirmed inspection of the deployed public page.

No human beginner sessions, retention measurements, or other browser-engine results are claimed.

## Keep the identity

The mountain setting, painterly art, warm amber actions, dark field terminal, and Nova/Patch relationship now work together. The homepage lettering has presence, the terminal belongs inside the world, and verified actions visibly change the scene. Preserve the hero picture and caption. A wholesale art replacement or storyline reboot would discard a strong part of the product.

The debrief is useful because it asks the player to interpret the action. The calm pace, optional hints, local saves, and fresh practice evidence suit a learner who wants to spend time here. Office and Night Shift should remain visible and locked while the foundation is refined.

## The pasted V4 report versus this build

| Pasted concern | Current finding |
| --- | --- |
| Missing toast breaks progress | `index.html` contains the live-status toast. A fresh first-mission command updates its objective immediately. A defensive null guard is a small additional safeguard. |
| Wrong head/tail parsing, quoted redirects, mkdir | The current shell parses these supported operations and has regression coverage. Unsupported options report errors rather than pretending to work. It remains an explicit teaching subset. |
| Exact command matching | Filesystem objectives already check effects. Some command objectives still reject valid option/path equivalents, and the log-count objective can accept the wrong input. These are current defects requiring correction. |
| Created directories disappear | Directories and their permissions are stored in the validated shell session. |
| Ranks, mismatched mission names, hardcoded eight stops | Those refer to the old preview. The current application has one 24-stop mountain curriculum and no competing rank functions. One surviving homepage promise about missing snacks should be aligned with the actual field-briefing opening. |
| Weak import validation, no focus traps | The current save schema validates paths, history, hints, bounds, and reserved keys. Dialogs and the guided tour manage focus. |
| Repeating hero, baked-in mock-up text, letter avatars, unloaded fonts | The current artwork, portraits, local fonts, and responsive scene composition replace those V4 elements. |
| Layered overwritten JavaScript | The game now uses separate ES modules. CSS still has historical overrides, which should be consolidated gradually as touched styles are verified. |

## Current usability defects found

The review found three concrete gaps beyond the historical report: valid supported command equivalents could fail objective credit; unrelated three-line input could satisfy the log-count task; and narrow-screen cinematic location text overlapped the portrait. The completion message also had insufficient contrast because a general paragraph selector overrode its intended colour. These were corrected during this review.

Supported alternate flags, line counts, absolute paths, and paths after `cd` now receive credit. The log-count task checks the actual evidence feeding its pipeline. Caption and portrait layout reserves separate space, and completion-message contrast improved from 1.53:1 to 7.89:1. The toast has an additional null guard, and the homepage card now promises the actual field-briefing opening. All 155 automated tests and the expanded full 24-mission browser regression pass. The browser run also checks practice cases, save independence, variants, contrast, and scene changes; 288 caption/width render cases show no overlap or clipping.

The mobile tour is functional, but its short scrolling card hides part of the explanation and lets the character/title scroll away during a command preview. Objective details and decisions use small text. Both are high-value presentation improvements, even when the application has no overflow or JavaScript error.

## Recommendations, in order of value

| Priority | Change | Why it matters |
| --- | --- | --- |
| 1 | Offer an independent practice path within the existing remixes. State the desired outcome, let the player choose tools, and ask them to interpret the result. Keep guided instructions and Patch available. | Current objectives often supply the exact command, including the capstone. Completing a supplied route is different from choosing a useful action independently. The existing Challenge setting adds a timer to the same guidance. |
| 2 | Bring earlier skills back through short optional review cases after a gap. Track guided and independent practice separately. | This serves the goal of accelerating learning more directly than adding XP or mission count. Use practice history as evidence of activity, without labelling it mastery automatically. |
| 3 | Observe real beginners and longer personal sessions. Ask for a command's purpose before entry and an interpretation afterward. | Automation proves the route is possible; it does not show whether someone can discover it or remember the skill. Prioritise onboarding, networking transitions, and later incident tasks. Record confusion and incomplete tasks as well as successes. |
| 4 | Add several distinct investigation interactions within Hike Trail. Examples: pin relevant output to a case board, question a suspicious messenger, compare a service with its expected state, or choose between plausible explanations. | All 24 stops follow the same three-frame story, terminal clues, three-choice decision, and single-question debrief. Of 79 objectives outside decisions, 32 verify reading a file. Seven authored solutions write a largely prescribed note. Variety should deepen investigation while keeping the terminal central. |
| 5 | Strengthen the existing story with people, consequences, and callbacks. | Show who relies on the rescue radio, revisit a relay the player restored, and let Patch gradually become a more careful companion. Keep silly early situations and increase realism later. Attribution and unknown facts should remain honest; a generic villain is unnecessary. |
| 6 | Improve reading comfort and finish the scene composition. Target comfortable learning text, offer a larger-text setting, and give the phone tour a persistent header with a scrollable explanation/demo. Add more character expressions and distinct framing at important story beats. | Premium presentation is mostly about readable, intentional use of the existing art. Enlarging text requires checking long clues, dialog flow, and the onscreen keyboard rather than only increasing a font token. |
| 7 | Add optional quiet ambience and restrained action sounds after usability is solid. | Wind, a radio response, and a recovered signal can make the world feel present. Provide obvious sound controls, honour mute, and begin audio only after a player action. |
| 8 | Improve portability and offline convenience, then consider accounts if demand emerges. | A PWA and clearer backup flow would help this personal learner immediately. Cloud saves introduce authentication, privacy, and maintenance work. Paid chapters, LMS export, dashboards, and team licences should follow a validated learning experience and audience. |
| 9 | Verify accessibility and additional browsers; consolidate CSS carefully. | Test Firefox/Safari, keyboard-only use, screen-reader flow, contrast, and device text scaling. Keep accurate unsupported-command errors. A larger Linux/WebAssembly environment or a new build framework is useful only when a concrete teaching need justifies it. |

## Art and story alternatives

The current visual world is already distinctive. Spend the next art effort on a small set of expressive Nova/Patch poses and different compositions for turning points, keeping text outside the art. Later late-night operational scenes can have a colder palette while retaining the same character and UI language.

A stronger story opening can keep the current outage: the rescue radio loses its signal just as the valley prepares for the day. Early clues involve a confused printer owl and Patch's improvised map; later evidence reveals a route problem and a controlled investigation. The player sees earlier locations recover. This supplies a recurring purpose without pressuring beginners with a countdown. It is a proposal, not a claim that this expanded story is implemented.

## What would earn the higher rating

A version with independent practice, returning review cases, more varied investigations, readable phone onboarding, and demonstrated beginner understanding could plausibly reach 9/10 for its intended audience. More illustrations, accounts, certificates, or additional missions alone would not establish that quality. Refine the foundation through actual use before expanding Office and Night Shift.
