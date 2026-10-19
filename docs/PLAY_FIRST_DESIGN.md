# The playable valley

The player should want to find out what Patch has broken, rescue a small thing,
open a new part of the valley, or beat a stubborn machine. The computer skill is
the useful action that makes that possible. A correct selection on a worksheet
is not enough of a consequence to carry the adventure.

The opening has one small comic accident: Patch's welcome demonstration
scatters the field kit. The player moves, meets Patch, collects a part, opens the
pack and fits it at the bench. Nova then agrees the actual scope of the first
investigation. That supplies a reason to learn the screen/operating-system/tool/
file distinction: the player is putting their equipment together. The four
existing activity IDs and their grading remain intact; the physical play and
spoken lines give them purpose.

The adventure fills the play viewport. The world remains behind compact,
in-context guidance, dialogue, objectives and the equipment belt. A player
should not have to scroll past page furniture to find their ranger or open a
second little game inside the page. Gadgets temporarily take the attention
they need, then close back onto the same world and position.

The opening has a complete seven-step controls rehearsal before free play:

1. Meet Patch and choose to start the guide.
2. Actually walk a short distance with pointer, keyboard or touch controls.
3. Actually talk to Patch, learning how characters and optional hints work.
4. Actually investigate a crate, learning what objects and rewards do.
5. Open the backpack and equip an owned hat, seeing the ranger change.
6. Open a harmless practice gadget, run `help` and `pwd`, read the replies,
   and close it. This console does not touch mission files or award credit.
7. Find the persistent goal, understand the first rescue and Nova check-in,
   learn where notes and save transfer live, and choose to begin the adventure.

Only the welcome and final acknowledgement use a next-style button. Practical
steps advance on the actual action; a large instruction panel cannot be left
covering the action it asks the player to perform. A compact pointer or device-
appropriate control tip accompanies the active task. Talking to characters,
walking and moving equipment are playable from the start of this rehearsal.
The player can skip it or replay it from the menu. Replaying a searched crate
or re-equipping an already owned hat teaches the controls without minting new
items or requiring a purchase.

`controlsTutorial` supplies the seven presentation-only guide steps. Each has
an ID, observed gate, speaker, concise direction, action, target selector,
success response and an optional device-specific tip. Its gate sequence is
`continue`, `move`, `meet-patch`, `collect-cache`, `equip-hat`,
`practice-console`, `start-adventure`. Guide completion is separate from
learning saves, knowledge checks and mission rewards. Returning players get
the supplied `returningText` at the introduction and handoff instead of being
told their current mission is the first kit rescue. The controls preview can
be replayed on their current encounter without changing earned progress.

The six existing `tutorialBeats` remain the first encounter's story gates,
including verified kit assembly and the agreed investigation scope. They are
not six more lecture slides. Their IDs, order and earned-progress rules remain
stable for existing saves. Finishing or skipping the controls rehearsal retires
the old presentation counter; the mission runtime still requires actual kit
assembly and the investigation decision. Nothing important depends on dragging, animation,
sound or speed; every practical interaction has a keyboard and touch route.

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
the first seven encounters, seven controls rehearsal steps, and the six story
tutorial beats. `getPlayScene` is a
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
