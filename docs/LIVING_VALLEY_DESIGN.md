# Terminal Trails — The Living Valley

## The problem this version solves

The first Hike Trail established a working 24-mission adventure. Its first completed human playtest exposed a gap between executing a supplied command and understanding an investigation. A player could follow a supplied filename without knowing how it was discovered, what the command meant, or what its output justified. The same player became more comfortable with navigation through repetition, which is worth preserving.

This version follows the supplied blueprint: **92 named learning missions and 12 chapter bosses**. The original expedition stays at the root; the new adventure lives at **living-valley/** with a separate browser save namespace. Finishing the old expedition does not silently award completion of a different curriculum.

[LIVING_VALLEY_PLAYTEST.md](LIVING_VALLEY_PLAYTEST.md) records two public-interface completions of the original 24 encounters and the observed teaching gaps.

## The standard for an encounter

A mission begins with a concrete event. The player knows what changed, why it matters, and where the first evidence came from. A path is introduced by a character, listing, document or observation, instead of appearing as an unexplained answer beneath a checkbox.

Discovery explains purpose and syntax before asking for a new tool. Practice retains the objective and evidence context while removing the displayed solution. Proof and bosses combine earlier methods. Help remains available.

An encounter can introduce a new concept and then ask for independent recall of an earlier tool. An explicit step phase controls those instructions: discovery shows the explanation and syntax; practice and proof show the outcome and a collapsed conceptual reminder. The encounter's overall phase still describes its completion record, so a lesson introducing a new skill does not become an independent demonstration merely because one step recalled an old command.

Each verified action produces its real simulated result, an authored character explanation of that result and its limits, and a visible change in the scene. The next task retains the previous finding. Plain language comes before professional vocabulary, followed by a realistic use outside the valley.

Lessons have at least two knowledge questions; bosses have at least three. Correct answers produce an explanation before continuing. Wrong alternatives should be plausible mistakes. Practical outcomes and knowledge checks both gate completion.

## One connected adventure

The valley depends on archives, radios, gates, workstations and emergency communications. Some failures are ordinary mistakes. Others form a pattern of manipulated access and forged instructions. Evidence establishes connections; a failed-login count or a strange message does not establish an attacker's identity.

| Chapter | Encounters | Main skills | Assessment |
| --- | ---: | --- | --- |
| The First Footsteps | 7 + boss | Computer literacy, interfaces, commands, paths, help | Lost Notebook |
| The Archivist's Workshop | 8 + boss | Files, copies, moving, deletion, search and filtering | Archive Sabotage |
| The Keeper's Gate | 8 + boss | Accounts, owners, permissions, privilege and MFA | The Gatekeeper |
| The Engine Beneath the Mountain | 7 + boss | Hardware, processes, services, storage, logs, changes | Failing Observatory |
| The Whispering Network | 9 + boss | Addresses, roles, DNS, packets, routes, ports, filtering | Broken Signal |
| The Deceptive Messenger | 8 + boss | Assets, phishing, impersonation, malware, reporting | The Impostor |
| The Crystal Vault | 7 + boss | Web, TLS, certificates, encoding, hashes, keys, sessions | False Portal |
| The Watcher's Lantern | 8 + boss | Logs, baselines, timelines, detection, evidence, reports | Night Intruder |
| The Tinker's Workshop | 8 + boss | Streams, redirection, sequencing, variables, conditions, loops, scripts | Broken Automaton |
| The Ranger's Second Computer | 7 + boss | Windows, PowerShell, accounts, processes, events, defences | Infected Station |
| The Shield of the Valley | 8 + boss | Inventory, hardening, patch priorities, backups, policy, risk, response | Siege of the Outpost |
| The Last Signal | 7 + boss | Integrated diagnosis, trust, evidence, communication, repair, handoff | Valley Blackout |

Four acts move from discovering something wrong through the valley falling apart, identifying the pattern, and defending the community. Bosses 3, 8 and 12 are story turns. Earlier restorations and character mistakes return as callbacks.

Nova is the field guide. Patch, nicknamed Patches, is the same robot companion. Owl translates technical concepts. Bramble protects access and operational boundaries. Tessa works on machines, networks and automation. Characters explain observations instead of announcing unsupported conclusions.

The final invitation leads toward The Office. That is a story transition: Office and Night Shift remain in development.

## Tools inside an adventure

The workbench changes with the investigation:

- The field terminal has inspectable files, permissions, process/service changes, configured network responses, pipelines and bounded script execution. Supported alternative inspections can satisfy evidence goals.
- The file explorer offers visual navigation and document inspection before terminal reading is introduced.
- Network maps use observed roles, addresses, classifications and ordered routes. A missing reply does not automatically prove endpoint failure.
- Browser and inbox cases expose saved messages, addresses, headers, certificate facts and trust comparisons. Fictional links do not contact outside systems.
- Evidence boards support classifications, timelines, comparisons, routes and reports. Required observations gate decisions.
- The ranger workstation introduces Windows concepts and supported PowerShell commands over fictional state.
- The script workshop reads and edits actual simulated files. Execution uses the bounded interpreter. A text-only revision is explicitly labelled and never presented as a behavioral test.
- Dialogue supplies evidence and makes plain-language explanations part of the investigation.

No tool executes host commands, contacts real networks, evaluates supplied JavaScript or needs credentials. The shell implements a teaching subset, not complete Bash, PowerShell or Windows. Privileged and destructive actions remain scoped to the scenario's authorisation.

POSIX owners, groups and mode bits are inspectable and repairable policy metadata. The simulator does not enforce every read/write permission as different operating-system accounts. Permission lessons assess policy reasoning and the repaired metadata; they do not claim to reproduce full operating-system access control. Script execution checks executable mode, and administrative operations use explicit scenario allowlists.

## Guided work and independence

Patch's tiers are a question, concept, location, then exact syntax. Help never removes a route through the game. Requests stay recorded after the visible clue changes.

The journal separates story progress, knowledge checks and practical demonstrations. An independent record describes a practice/proof attempt completed without requesting hints; discovery remains an introduction. These records do not claim comprehensive mastery, retention, certification or job readiness.

Later tasks revisit earlier skills. Mission prerequisite and reinforcement fields form the skill tree. Return trips use isolated sessions and change evidence filenames and corresponding paths. They preserve the underlying lesson and are not advertised as entirely new incidents. Story achievements remain unchanged.

The journal retains command explanations, syntax, realistic uses and personal reflections. Search makes it usable as a reference.

## World and accessibility

The illustrated 2D valley uses the existing painterly locations, animated weather, verified signal state, interactive objects, portraits and skippable scenes. Evidence boards, routes, reports and scripts change the interaction, rather than reskinning one terminal worksheet.

The visual direction remains forest, petrol, amber and parchment. The original hero and caption stay intact. Nova/Patch keep their portraits; Owl, Bramble and Tessa have dedicated illustrated expressions.

Device and player motion preferences stop animations. Optional gentle discovery tones start only when chosen. Larger text applies to reading and evidence. Phone layouts retain touch targets, wide typing, native modal focus, safe areas and direct navigation. History and completion have touch controls.

The optional active-play clock is a personal reference. It pauses in dialogs and hidden tabs and never blocks completion. There is no compulsory beginner deadline.

## Saves and verification

Living Valley saves use a separate versioned key. Validation checks known encounter identities, contiguous story progress, session shapes, questions, authorised scenario configuration and isolated return trips. Bounded imports reject prototype keys, invented processes and expanded permissions. Invalid imports leave current progress intact.

Saves remain local to the browser origin; export/import moves them between devices. Storage failures fall back to an exportable memory journey. The old game's saves remain untouched.

The implementation contract is [LIVING_VALLEY_CONTRACT.md](LIVING_VALLEY_CONTRACT.md). Tests must perform actual authored actions and state changes. Browser runs use the public interface. Real beginner sessions and delayed unfamiliar transfer tasks are still needed to establish educational effectiveness.
