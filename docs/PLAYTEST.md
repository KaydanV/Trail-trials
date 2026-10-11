# Hike Trail learning pace review

Reviewed on 2026-10-11. This record covers the 24 Hike Trail missions, 103 objectives, and 72 story frames. It separates automated completion from an expert content audit. No human beginner sessions were conducted or observed, and no completion times or learner success rates were measured.

## Evidence collected

- `node --check src/curriculum.js` passed after the wording changes.
- `node --test --test-name-pattern='every Hike Trail mission' tests/engine.test.js` passed its one selected integration test. It creates a fresh simulated shell for each of the 24 missions, runs every documented solution, and verifies all 103 objectives, including the evidence-backed decision.
- A comparison with the committed curriculum confirmed that mission and objective IDs, objective checks, solutions, fixtures, decisions, quiz answers, story speakers/titles, acts, and the skill guide are unchanged. All 24 missions received wording improvements; the 72-frame story and artwork mapping remain intact.
- That comparison describes the wording-only review. A subsequent product review strengthened the log-count check to require its actual authentication-log pipeline and expanded credit for supported equivalent flags and paths. The authored solutions and mission identities remain the same.
- The content audit read the complete curriculum alongside the teaching shell, objective matcher, guided tour, and the application's story, checklist, decision, and quiz flow. It examined what a first-time learner is asked to understand before each action.
- The final Chromium browser regression completed all 24 canonical missions through the public UI and checked clues, decisions, quizzes, scene changes, focused hints, reloads, and phone navigation. Practice cases also completed with independent saves, including changed account and hash decisions. Longer late-game clues fit narrow phone layouts. The [validation record](VALIDATION.md) contains the full automated scope.

The automated checks demonstrate that the authored route remains achievable and that the interface supports it. They do not demonstrate that beginners can discover the route, understand the concepts, or complete it at the displayed estimate.

## Confusion found and wording changed

| Stop | Likely beginner obstacle found in the content audit | Change made |
| --- | --- | --- |
| 01 | The first instruction assumes knowing how to submit a terminal command. | Explain typing a command and pressing Enter, define the current working directory, and separate the command from its file argument. |
| 02 | Folder, directory, path, and relative filename arrive together. A learner might type `cd maps, then pwd` as one command. | Connect directory to folder, define a path, require separate commands, and tie `trail.txt` to the current folder. The quiz gives a concrete absolute-path example. |
| 03 | The previous stop ends inside `maps`, and `-n 2` has no first-use explanation. | Explain the fresh lab's starting folder, the slash in a file path, and the option/count in `head -n 2`; reuse the count for `tail`. |
| 04 | Filename searching and text searching can look interchangeable. “Provenance” is unfamiliar. | Identify the starting directory and `-name` criterion, explain grep's pattern-before-file order, and describe the note as evidence of who kept the copy. |
| 05 | A note-writing objective supplies a sentence without a command pattern. Copy direction and overwrite behavior are assumed. | Introduce `mkdir`, source-before-destination copying, `echo`, quotes, and `>` with a complete short example. |
| 06 | A successful copy might feel like sufficient recovery evidence; two similar copy operations risk reversal. | Name each exact source and destination, explain that restore replaces the active file, and identify the expected destination in the verification step. |
| 07 | Numeric permissions and `ls -l` arrive without explaining what the learner sees. | Define read/write/run access, explain the three digits of 600, and identify lowercase L and the permissions column. |
| 08 | MFA is used before its acronym and purpose are explained; grep targets are indirect. | Define multi-factor authentication, identify the two audit searches, and explain what password reuse `yes` means. |
| 09 | A sender field may seem to prove identity once the display name is discounted. | Explain that the address can also be forged and point the learner to independently sourced contact details. |
| 10 | Repeated file-reading tasks can become mechanical. | Ask the learner to notice the booking and sponsor status in the newest entries and identify the authorized contact channel. |
| 11 | The reporting task again gives only the desired sentence. | Reuse the learned quoted `echo` and `>` pattern and connect the saved text to the privacy purpose. |
| 12 | The lesson discusses unquoted variables without defining a variable or `$SOURCE`. | Explain how the variable holds a filename and how unquoted expansion can split a filename with spaces. Keep script inspection and the staged review clear. |
| 13 | IP, prefix, gateway, and DNS arrive in a dense block; the existing address guide is easy to miss. | Define the terms briefly, point to the optional address guide, and explain the purpose of `nslookup`. |
| 14 | Repeating DNS commands can encourage treating any answer as approval. | Give the two lookups a comparison purpose and direct attention to the approved destination record. |
| 15 | ICMP and `-c` are assumed knowledge. | Explain what ping asks, define `-c 2` as a bounded count, and retain the distinction between reachability and application health. |
| 16 | Port, socket, process, TCP, UDP, and two new command forms arrive together. | Define a running process and socket, unpack the four `ss` flags, explain the purpose of `ps aux`, and describe datagrams as individual messages. |
| 17 | TLS, headers, and `-I` can obscure what the request actually checks. | Expand TLS, explain capital i and response headers, then ask the learner to interpret the received 200 status with the guide. |
| 18 | “Digest” may be unfamiliar, and the learner may compare the filename as part of the hash. | Define digest as a fingerprint, identify the full value before the filename, and explain `-d` as decode. |
| 19 | Advisory, applicability, and rollback are introduced alongside a long planning task. | Explain affected versions and rollback, focus the comparison on 4.1.0 versus the fixed version, and provide the familiar note-writing pattern. |
| 20 | `source=any` and a subnet range may be mistaken for a port or account permission. | Define firewall filtering, identify the approved network range, explain `source=any`, and separate the listener from the access rule. |
| 21 | The first pipeline combines a new operator and counting command; “baseline” is unfamiliar. | Explain left-to-right data flow, lowercase L in `wc -l`, and the baseline's role in interpreting the three events. |
| 22 | Session and containment terminology may sound like actions the terminal already performs. | Describe the signed-in session, explain containment's purpose, and keep the saved note explicitly a staged request. |
| 23 | Folder creation and a long free-form handoff can create a sudden syntax burden. | Give separate `mkdir` and `cp` instructions, explain the sanitized copy, and reuse quoted text/redirection while retaining the reporting requirements. |
| 24 | The capstone could turn familiar commands into a checklist without interpretation. | Recall the earlier archive comparison and ask for the complete trusted digest and success of this specific header request. |

The progression introduces a concept where it first matters and gives later repetitions a reason to inspect the evidence. The story, fixture content, checks, solutions, answer choices, and completion requirements retain their existing scope. Scripting, patching, firewall changes, and containment remain staged simulation tasks.

## Next beginner sessions

These sessions have not been run. Use participants with little or no terminal experience and record observations separately from this audit. Start with the guided tour and stops 01–06, then sample the denser transitions at 12–13, 16–18, and 19–24. Include a narrow phone viewport and a returning session after a reload.

At each transition, ask the learner to explain the purpose of their next command before entering it and interpret one result afterward. Record the stop and objective, exact confusion, command attempts, hint strength used, whether the learner continued independently, and the learner's own explanation. Measure active task time separately from story reading and breaks. Do not use displayed estimates as measured results.

Watch especially for:

- Confusing the command name, option, search text, and file path.
- Treating examples as one long command, losing quotes, or reversing source and destination paths.
- Understanding an objective only after an exact action hint.
- Carrying an old working directory into a fresh stop or confusing practice progress with trail progress.
- Interpreting a DNS answer, ping reply, hash match, permission change, or HTTP 200 as a broader security verdict.
- Repeating policy-reading and note-writing without being able to explain the policy or accurately distinguish a requested action from a completed action.
- Needing to revisit the checklist, current clue, or command output frequently on a phone.

The remaining pacing risks are the number of new networking terms in Act 3 and the longer written plans in Act 4. The wording supplies short definitions and familiar command patterns, but observed beginner behavior is needed to decide whether those stops need smaller steps or additional practice. Preserve participants' actual outcomes, including incomplete tasks and misunderstandings; automated completion cannot substitute for those findings.
