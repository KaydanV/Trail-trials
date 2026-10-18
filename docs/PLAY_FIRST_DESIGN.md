# The playable valley

The player should want to find out what Patch has broken, rescue a small thing,
open a new part of the valley, or beat a stubborn machine. The computer skill is
the useful action that makes that possible. A correct selection on a worksheet
is not enough of a consequence to carry the adventure.

The first minute has one small comic accident: Patch's welcome demonstration
scatters the field kit. The player moves, meets Patch, collects a part, opens the
pack and fits it at the bench. Nova then agrees the actual scope of the first
investigation. That supplies a reason to learn the screen/operating-system/tool/
file distinction: the player is putting their equipment together. The four
existing activity IDs and their grading remain intact; the physical play and
spoken lines give them purpose.

The tutorial uses six short, event-gated prompts. A prompt advances when the
player performs its action, with a visible skip control and replay available.
Movement works with touch and pointer controls; a keyboard route must remain
available. Nothing important depends on dragging, animation, sound or speed.
No five-paragraph modal is required before touching the world.

Each encounter follows a readable loop:

1. Explore a small scene and encounter a character or an obvious problem.
2. Choose a relevant prop or piece of equipment from the field kit.
3. Use the tool against the actual simulated files, records or service state.
4. See a consequence in that scene and hear a short character reaction.
5. Receive a useful object, a visible restoration or access to the next place.

The player keeps practical progress and save compatibility. Presentation never
awards a step by itself. A relay only changes to its restored state after the
existing runtime verifies the requested operation. A wrong experiment can have
a comic reaction and a retry; it cannot silently count as a successful repair.
Hints remain optional, errors remain legible, and the terminal's real response
is available whenever it matters.

The twelve chapters each have a physical comedy and a practical problem. The
welcome hut has an overenthusiastic launcher; the archive has a paper mountain;
the gate has backwards manners; the observatory has an actual jam; the network
has wrongly addressed deliveries; the deceptive dispatch puts urgency in an
acorn; the vault has impressive but insufficient sparkle; the watchtower has a
bell that cries wagon; the workshop has an overconfident automaton; the Windows
spare needs careful containment; the outpost must keep one light on; the summit
brings the well-travelled kit back together. Stakes become more grounded as the
player's tools become more capable.

Patch is funny because he jumps to a concrete, understandable wrong idea and
then learns. Nova is warm, direct and willing to let the player try. Tessa likes
useful experiments. Bramble wants the valley's actual work to carry on. Owl has
dry patience, an unreliable nap schedule and a strong preference for evidence.
They are companions with different priorities, not five voices reading a
glossary. Jokes target overconfident equipment, strange paperwork and Patch's
habits; they do not target people affected by an incident.

Bosses are investigations with visible phases and an opponent the player can
understand: a misplaced notebook, a runaway zero, a backwards gate, a jammed
observatory, a blocked message, a disguised dispatch, a polished wrong door, a
connected evidence board, a confidently wrong automaton, a spare that cannot
rejoin, an outpost that must preserve dispatch, and the final blackout. These
names personify the obstacle, not a fictional attribution of a real action.
The player wins by changing the checked state or building the supported case.

`living-valley/play-script.js` contains twelve chapter voices, a distinct short
hook and completion line for all 104 encounters, detailed in-context prompts for
the first seven encounters, and the six tutorial beats. `getPlayScene` is a
presentation-only API: its goal follows the current first-act action while its
win text remains behind successful completion. Spoken success text must never
be displayed on an unverified attempt. Later chapters keep their authored
curriculum requirements; the world and tool interactions should make those
requirements part of play instead of presenting a pile of fields at once.

The useful acceptance test is a fresh beginner's first ten minutes: do they
move, experiment, smile, understand what they are trying to do, and get a
visible response without reading several screens of instructions? Automated
checks can verify controls and state changes. Whether the game is fun requires
that actual playthrough and an honest reaction.
