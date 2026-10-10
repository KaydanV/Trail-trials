# Foundation-first direction

We need to make this feel like a game people want to come back to. Better colours, stronger scenes, a clear story, and commands that actually do something in the situation.

Hike Trail is our priority. The first stops should be easy, a bit fictional, and a bit silly. As you move through the valley, the tasks should get more connected and closer to real work. The player should understand the skills because they used them to solve a problem, not because we put a textbook in front of them.

Office and Night Shift stay visible so people can see where the journey is going. We finish and test the foundation first. Then Office gets everyday workplace tasks; Night Shift gets realistic investigations and time-sensitive priorities. We’ll decide the final difficulty selection and progression once the whole experience exists.

## Release checks

Each foundation mission must have an achievable terminal task, a decision supported by the evidence, and a debrief that explains why the action mattered. A typed command alone must not grant completion when its operation failed. Save/reload and replay must keep a player’s progress intact.

Before release: pass the shell/save/curriculum tests, complete all 24 missions in the browser, verify locked future worlds and all three saves, and inspect small-screen layouts and keyboard interaction. Recruit beginners for playtesting. Automated completion is useful engineering evidence; it cannot prove that every new learner will find the game intuitive.

## Source lineage

The user supplied the V4 source ZIP and development archive. The readable original is retained in `v4-reference.html` and its four artwork files are retained in `assets/scene_asset_*.webp`. The main application now separates story content, terminal behavior, persistence, and visual presentation into modules. New illustration avoids text baked into the scene so the interface can adapt to small screens.
