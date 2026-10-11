# Terminal Trails design guide

The game should feel like a cinematic expedition with people you want to spend time with. The mountain, weather, characters, and signal are the world. The terminal is a real, readable tool inside that world. Let scenes show the stakes before instructions explain the next move.

## Colour and surfaces

| Token | Value | Purpose |
| --- | --- | --- |
| Night | `#081f28` | Main atmosphere and page canvas |
| Petrol | `#12353e` | Navigation, story, tools, scene edges |
| Deep blue | `#102b3c` | Night atmosphere and investigation cues |
| Mist | `#a8d8d0` | Terminal prompts, navigation, signal details |
| Amber | `#edc46d` | Primary actions, important display text, active trail stop |
| Sunset | `#ee9a72` | Human warmth and late-story atmosphere |
| Parchment | `#fff7e4` | Evidence, objectives, reference material |

Use dark atmosphere around scene images and terminal work. Warm surfaces make evidence and decisions easy to read. Give worlds and story acts distinct colour temperatures. Avoid turning every section into the same coloured card. Keep cyan for legible signals, with amber for the next meaningful action.

## Typography

Bricolage Grotesque provides expressive, chunky display lettering for the Terminal Trails wordmark, big adventure headlines, scene titles, and important story lines. Use weights 650–800 with compact line spacing; never use it for long command output. DM Sans carries the instructions, controls, and descriptions. Terminal output uses the platform monospace stack. Preserve the existing hero picture and its caption wording. The caption keeps its quieter serif treatment to contrast the display headline.

Both fonts are local WOFF2 files under `assets/fonts/`. They come from `@fontsource-variable/bricolage-grotesque@5.3.0` and `@fontsource-variable/dm-sans@5.3.0`. Their SIL Open Font License files are stored alongside them. The app makes no font requests to third-party services. Total font transfer is approximately 78 KB; `font-display: swap` keeps the interface usable while fonts load.

## Story and play

- Each mission starts with a scene that shows where the player is and what changed. Preserve scene composition; avoid covering the clue with a large panel.
- Show Nova and Patch portraits beside their dialogue. A name and a coloured box alone should not carry the character experience.
- Patch is a hint companion. His expression and a gentle movement can acknowledge thinking, a useful nudge, or a win. The clue itself must remain readable text.
- Show the player’s next action, verified evidence, and restored signal state as visible game cues. Completion should feel like the world responding to a choice.
- Tie each scene change to its own verified objective. A receipt can print, a route can unfold, or a local lamp can light; terminal errors, hints, and guesses must never award a scene change. Keep staged requests visibly separate from applied changes. The final beacon answers after the completed reflection.
- Patch’s three hint strengths follow the next unfinished clue and reset when that clue is verified. Explain a failed command in ordinary words without revealing the whole mission or silently entering a solution.
- Keep the terminal clear: readable monospace, distinct command/output/error colours, a visible input, and tools that insert a command rather than silently solving the mission.
- Use paper surfaces to separate objectives and evidence from atmospheric storytelling. Keep decisions close to the evidence they depend on.
- On phones, show the story, objectives, terminal, tools and hints, decision, then completion. Keep the trail list collapsible and settings reachable.
- Put a compact next-move card inside the terminal, above its header. Its clue should follow verified progress, with direct jumps to the full clues, Patch, and the decision. Preserve the full objective checklist and the story-first mobile reading order.
- At 900 pixels and below, keep Scene, Clues, Terminal, and Call within reach in a bottom field navigation. Show the current location with words and a selected surface, reserve room for device safe areas, and hide the navigation when the onscreen keyboard or a dialog is open. Keep the terminal input at 16 pixels to avoid phone zoom.
- Replaying a cleared stop should feel like returning to the expedition. Mark practice explicitly beside the mission and its launch control, and explain that the recorded result and XP are preserved.
- Fresh practice cases must keep instructions, evidence, scene responses, and correct choices consistent. Save their current case and reflection separately from the player’s trail achievements and notes.

## Motion and accessibility

Camera drift, character arrival, a slow Patch bob, and one brief evidence pulse are enough. Motion communicates a scene change or acknowledges progress; avoid decorative blinking and constant celebrations. Device reduced-motion preferences and the player’s motion setting disable all animation. Story text and game progress remain available without animation.

Keep keyboard focus obvious, target areas at least 44 pixels, and dialogs scrollable. Never encode evidence completion, locked access, or a wrong choice with colour alone. The tour should explain each action next to the relevant control, keep an obvious skip action, and return the player to the same place.

## Review checklist

Review landing, active mission, hint, decision feedback, debrief, completion, notebook, settings, and tour at 1440, 768, 390, 360, and 320 pixels after fonts load. Include long handoff clues and a practice case. Confirm that the hero artwork and caption are preserved, characters stay inside their crop, text remains readable, no page overflows horizontally, saved progress works, and reduced motion works. Check interaction and keyboard order when changing mobile layout.
