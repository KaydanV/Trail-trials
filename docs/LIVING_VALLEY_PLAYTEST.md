# The 24-stop baseline: completed playthrough and redesign evidence

Reviewed 17 October 2026 against the unchanged original game at commit `08d4402`, before implementing Living Valley. The original game was served locally in Chromium on port 4191. This review uses the player's completed 24-mission review as its research input and the subsequent Living Valley blueprint as the proposed direction; proposals in that pasted conversation are not evidence that features already exist.

## What was actually completed

Two fresh-browser routes completed all 24 stops through the public interface. Neither wrote application state, injected objective credit, modified saves, or bypassed completion controls.

1. The existing full browser regression completed all 24 canonical missions, rejected unsafe choices and premature completion, checked objective-driven scenes, then exercised practice cases, separate saves, journey slots, export/import, tutorial behavior, and layouts from 320 to 1440 pixels. It exited successfully.
2. A separate inspection route watched every opening story frame and completed all 24 missions while recording the rendered objectives, commands, terminal responses, Patch replies, scene dialogue, decisions, debriefs, and result screens. This route entered 107 commands: 81 authored solution commands, 22 additional discovery/navigation commands, three deliberate error probes, and one successfully discovered relative-path read. Every result recorded the expected sequential completion count, ending at `24/24`. It produced no uncaught page errors.

Both routes used authored solutions and known correct decision/quiz answers. They demonstrate that the game is playable and let us inspect its actual feedback. They do **not** simulate ignorance, demonstrate independent mastery, or replace the user's real beginner playtest. The player's reported confusion remains valid even where an automated route is successful.

Reproduce the tracked regression from the repository root:

```sh
PORT=4191 npm start
# In a second terminal:
TRAILS_URL=http://127.0.0.1:4191 npm run test:browser
```

The inspection run's local artifacts are `test-results/living-valley-baseline/critique-play.json` and phone screenshots for stops 03, 04, 08, 09, 16, 19, 20, 22, and 23. These generated artifacts are ignored by Git. Its execution log is `/tmp/living-valley-critique-play.log`; the tracked regression log is `/tmp/living-valley-baseline-browser.log`.

## The completed route

The commands below were entered in the separate inspection route. Long saved notes are abbreviated in this table; their actual submitted contents were captured in the inspection JSON. Every row also required its evidence-backed decision and correct debrief answer before the public completion button could advance the journey.

| Stop | Commands entered on the authored route | Verified outcome |
| --- | --- | --- |
| 01 — A very small emergency | `pwd`; `whoami`; `cat briefing.txt` | Lab location, identity, and authorized scope; saved `1/24`. |
| 02 — The map that ate a map | `ls`; `cd maps`; `pwd`; `cat trail.txt` | Navigation and map evidence; saved `2/24`. |
| 03 — The owl left a receipt | `cat porch/guide.txt`; `head -n 2 porch/relay.log`; `tail -n 2 porch/relay.log` | Normal printer behavior separated from the missing route; saved `3/24`. |
| 04 — Follow the breadcrumb | `find supplies -name route.conf`; `grep route= supplies/archive/route.conf`; `cat supplies/archive/note.txt` | Located the backup, extracted its destination, and checked provenance; saved `4/24`. |
| 05 — Leave a better breadcrumb | `mkdir case-notes`; `cp relay-status.txt case-notes/status.txt`; quoted `echo` redirected to `case-notes/observation.txt` | Preserved observations without inventing a cause; saved `5/24`. |
| 06 — One light comes back | `cat approval.txt`; copy the active configuration to `recovery/route.before.conf`; copy `backups/route.conf` to `active/route.conf`; `grep route= active/route.conf` | Authorized simulated restoration with a before-copy; saved `6/24`. |
| 07 — The key under the doormat | `cat access-policy.txt`; `ls -l private`; `chmod 600 private/recovery-note.txt` | Owner-only recovery-note access; saved `7/24`. |
| 08 — The password dragon | `cat identity/policy.txt`; `grep password_reuse identity/account-audit.txt`; `grep mfa_enabled identity/account-audit.txt` | Password reuse and missing MFA identified; saved `8/24`. |
| 09 — The urgent acorn | `cat inbox/urgent.eml`; `grep From: inbox/urgent.eml`; `cat contacts/trusted.txt` | Suspicious credential request compared with a trusted channel; saved `9/24`. |
| 10 — The badge-shaped cookie | `cat gate/policy.txt`; `tail -n 2 gate/visitors.log`; `cat gate/directory.txt` | Visitor claim checked against policy and a known sponsor contact; saved `10/24`. |
| 11 — Keep the hikers out of the report | `cat privacy/policy.txt`; `cat privacy/route-status.txt`; quoted `echo` redirected to `handoff.txt` | Operational information shared with less personal data; saved `11/24`. |
| 12 — The shortcut that was too short | `cat automation/backup.sh`; `cat automation/review-guide.txt`; `cp automation/backup.sh automation/backup.original.sh`; quoted review note redirected to `automation/change-request.txt` | Script reviewed as text, original retained, safeguards requested; saved `12/24`. |
| 13 — An address in the mist | `cat network/interface.txt`; `grep gateway= network/interface.txt`; `nslookup academy.test` | Interface, gateway, and DNS results distinguished; saved `13/24`. |
| 14 — The signpost is not the destination | `nslookup academy.test`; `nslookup example.test`; `cat network/approved-destination.txt` | Resolution compared with the intended destination; saved `14/24`. |
| 15 — Can you hear the valley? | `cat network/troubleshooting.txt`; `nslookup academy.test`; `ping -c 2 academy.test` | Name lookup separated from reachability and service health; saved `15/24`. |
| 16 — Which door is listening? | `cat services/inventory.txt`; `ss -tuln`; `ps aux` | Listener 8088 correlated with the expected relay process; saved `16/24`. |
| 17 — The sealed envelope | `cat web/tls-policy.txt`; `curl -I https://academy.test`; `cat web/http-guide.txt` | Headers checked while retaining connection trust; saved `17/24`. |
| 18 — Same file, different question | `cat archive/trusted-sha256.txt`; `sha256sum archive/route.conf`; `base64 -d archive/dispatch.b64` | Integrity comparison separated from reversible encoding; saved `18/24`. |
| 19 — A warning with context | `cat maintenance/advisory.txt`; `grep relay-agent maintenance/inventory.txt`; `cat maintenance/change-policy.txt`; quoted patch plan redirected to `maintenance/plan.txt` | Installed 4.1.0 compared with fixed 4.2.1 and a safeguarded upgrade requested; saved `19/24`. |
| 20 — A gate, not a wall around everyone | `cat firewall/intended-access.txt`; `cat firewall/review.txt`; `ss -tuln`; quoted access request redirected to `firewall/request.txt` | Overbroad 8088 access compared with the approved subnet while retaining rescue paths; saved `20/24`. |
| 21 — Three knocks, one question | `grep AUTH_FAIL logs/auth.log`; `grep AUTH_FAIL logs/auth.log \| wc -l`; `cat logs/baseline.txt` | Filtered failure count interpreted against a baseline; saved `21/24`. |
| 22 — The evidence earns its name | `cat incident/timeline.txt`; `cat incident/authority.txt`; `cp incident/audit.log incident/audit-preserved.log`; quoted containment request redirected to `incident/containment-request.txt` | Correlated incident evidence preserved and an authorized response requested; saved `22/24`. |
| 23 — Write the handoff you would want | `cat report/requirements.txt`; `cat report/sanitized-timeline.txt`; `mkdir handoff`; `cp report/sanitized-timeline.txt handoff/timeline.txt`; quoted report redirected to `handoff/report.txt` | Handoff recorded confirmed facts, requested containment, unknown access method, and recovery checks; saved `23/24`. |
| 24 — The mountain answers | `cat capstone/closure.txt`; `sha256sum capstone/route.conf`; `chmod 600 capstone/private-recovery.txt`; `curl -I https://academy.test` | Recovery evidence checked; foundation saved complete at `24/24`. |

## Findings against the learner's critique

### Owl: technically explained, insufficiently consolidated

The intro says `head` reads the beginning and `tail` the end. The objective explains `-n 2`, the printer guide defines the log columns, and the debrief asks which command shows the latest entries. These explanations exist; describing the lesson as containing no explanation would be inaccurate.

However, the actual success output after `tail -n 2 porch/relay.log` is the two log lines followed by `✦ Evidence verified: Inspect the most recent entries`. The story interpretation appears in separate scene dialogue: `The latest entries report a missing route configuration.` The player is not asked to identify the decisive line or explain why the final two chronological entries matter. There is no contextual command breakdown attached to that successful output.

Living Valley should visibly distinguish command, option, count, path, and relevant evidence; let the learner point to the missing-configuration entry; explain how that finding advances the trail; then revisit the same skill with different evidence and less guidance.

### Squirrel: the search result should become the next action

`find supplies -name route.conf` returned `/home/trainee/supplies/archive/route.conf`. The subsequent objective supplied `grep route= supplies/archive/route.conf`, which worked and returned `route=academy.test`. The intro's box-versus-label analogy is useful and should survive the redesign.

The teaching gap is the bridge: use the discovered path as the target of the next command, choose what text would answer the story question, then interpret that match. Current Patch escalation progresses from a conceptual clue to the prescribed command; it does not make the learner reconstruct that bridge. Discovery should be an explicit learning action, with a return encounter that changes both path and desired field.

### Password dragon: the jump to the audit file is real

The standard is in `identity/policy.txt`, but reading that file does not reveal `identity/account-audit.txt` or introduce its field names. The next objective simply discloses both the audit path and `password_reuse` search. The intro already announces the account weaknesses, reducing the need to discover and interpret them.

An added public-UI probe, `ls` followed by `ls identity`, successfully revealed `identity`, then `account-audit.txt` and `policy.txt`. Thus the simulator supports the needed exploration; the authored learning route skips it. The replacement should make the account keeper hand over the audit location, let the player find the actual file, teach the record format, and compare findings with the standard. A later case must vary the findings rather than reward the remembered answer.

### Phishing: paths and trusted-channel reasoning need to stay connected

The story describes a suspicious message but does not establish how `inbox/urgent.eml` was obtained. Its first objective supplies that exact path. A discovery route worked: `ls` → `ls inbox` → `cd inbox` → `cat urgent.eml`.

After `cd inbox`, deliberately entering the supplied home-relative `cat inbox/urgent.eml` correctly failed with `/home/trainee/inbox/inbox/urgent.eml`. Patch explained that relative paths begin in the current directory and recommended `pwd`, `ls`, or a full path. Reading `cat urgent.eml` from inside the folder received valid evidence credit. Returning home is therefore one possible route, not a required ritual.

Keep the useful path error, but introduce the email through the world and show its location naturally. Early lessons should make the current folder visible, teach discovery before opening, and explain why reading text avoids following the message's requested action. Independent investigation should accept a sensible route through either the inbox tool or terminal while still requiring the relevant evidence and judgment.

### Sockets and firewall: the capital-I trap is reproducible

Both stops 16 and 20 rejected `ss -tuIn` and accepted `ss -tuln`. The failing character is capital `I`; the intended character is lowercase `l`, for listening. Moving to another folder cannot fix this command because it has no file operand.

The error and Patch response merely repeat the visually similar supported string. Stop 16's objective does already explain TCP (`t`), UDP (`u`), listeners (`l`), and numeric addresses/ports (`n`). Stop 20 assumes the learner retained it. This is not evidence that the working lowercase command is broken; it is a strong teaching and readability defect.

Show `lowercase L — listening` where it is first learned and when this specific mistake occurs. An interactive socket inventory should connect the named choices to their flags, highlight the local address and 8088 port, and compare with authorized inventory. The learner must understand that a listener's existence and the firewall's allowed sources answer different questions. Avoid presenting real-world-looking network output as a verdict by itself.

### Stop 19: the scenario is sound, the plan is mostly transcription

The advisory says versions before 4.2.1 are affected; `grep relay-agent maintenance/inventory.txt` returned `relay-agent=4.1.0`. The change policy describes backup, testing, rollback, and verification. The command works and the underlying risk reasoning is appropriate.

The route does not teach why the inventory is the next evidence source, and the saved plan is a supplied string containing prescribed phrases. The terminal reports `✓ Done.` and `Evidence verified`; the more meaningful explanation is elsewhere. The decision's distractors include patching unrelated products and ignoring internal services, which make elimination easier than genuine prioritization.

Make the player compare an affected-version range with an installed version, decide applicability before planning, and stage safeguards as meaningful choices. Show before and expected-after states and distinguish requested work from verified completion. Use plausible alternative priorities in assessments, with feedback identifying the overlooked evidence.

### Stops 22 and 23: retain the evidence discipline, improve how it is practiced

Stop 22 is a strong model for a connected investigation. The timeline combines an audit event, approved state, and operator confirmation. Preservation and authorization are explicit. The response remains a staged request, not a falsely claimed applied fix. The route completed successfully.

Its `cp` result still says only `✓ Done.` plus objective credit. The scene explains preservation, but the terminal does not explain source versus destination or why preserving before recovery matters. Living Valley should demonstrate and then inspect the copy, connect it to the case board, and ask the player to infer the authorized next move from evidence.

Stop 23 likewise correctly distinguishes `containment requested` from completion. `mkdir handoff` alone gives no evidence credit; copying the sanitized timeline then completes that evidence task. Writing the supplied report completes the final task. These are functioning file effects, not progress awarded merely for typing a command.

However, reporting is largely entering a long prepared sentence. Assessment should require the player to separate verified fact, pending action, unknown cause, owner, and next check using evidence they actually collected. A structured handoff tool can teach those distinctions before an independent terminal/reporting case. Preserve the prohibition on unnecessary credentials and personal data, and do not imply a staged request means a live containment action occurred.

## Repetition and feedback: what the count actually establishes

The current curriculum has 103 objectives: 24 decisions and 79 other objectives. Exactly 32 of those 79 are `read` checks. All 24 missions have exactly three opening story frames; each then follows the same terminal-evidence, three-option decision, and single-question debrief structure. The final capstone still supplies its commands.

Those facts support the player's sense of repetition, but reading is an essential investigation skill. The fix is not a ban on `cat` or an arbitrary command quota. Require selection, interpretation, comparison, and transfer; vary the playable tools and the situation. The same command can remain valuable when the evidence and reasoning change.

The old game already has illustrated scenes, reactive SVG evidence, character reactions, and contextual scene dialogue. Saying it has no mid-mission visual feedback would be false. In practice, the command area repeats the generic evidence-verification formula while richer reactions happen elsewhere on the page. Phone scrolling can separate those events even further. Important discoveries and their explanation should remain adjacent to the work and be available again in a journal.

## Standards for the 104-encounter replacement

- Establish where each clue comes from before expecting the player to know its filename, host, field, or tool. Exploring and selecting evidence must count as real play.
- Introduce new syntax through a specific story need, explain its pieces, and show what part of the result answers that need. Use ordinary language before introducing the professional term.
- Separate guided discovery, supported practice, independent transfer, and delayed review. A cleared guided mission alone is not proof of mastery.
- Use chapter bosses to combine learned skills without displaying their solution. Keep optional graduated Patch help, and make help usage transparent rather than pretending a revealed route was independent.
- Accept supported equivalent commands and effect-based alternatives where appropriate. Require the right evidence, not an exact memorized spelling or an unrelated matching count.
- Change the evidence and sometimes the correct conclusion in return cases. A renamed file with identical choices is weak evidence of transfer.
- Give specific feedback: what changed in the valley, which observation matters, why this tool helped, and when the skill is useful beyond the scene. Do not append long generic lectures to every command.
- Add genuinely different tools and interactions: folders and terminal, email inspection, expected-versus-observed network maps, evidence boards, Windows tools, and accurate handoff composition. Their evidence should flow into a shared assessment model.
- Preserve calm pacing, authorization, uncertainty, rescue availability, independent verification, and the distinction between a requested change and an observed outcome.
- Validate complete playable slices before multiplying the template. Automation should prove routes, alternative paths, state isolation, accessibility mechanics, and failure handling. Real learners must still establish comprehension, retention, and enjoyment.

The completed baseline supports a substantial redesign, not merely longer objective descriptions. It also gives us working simulation, save, and story assets worth retaining. The original 24-stop game should remain available while Living Valley develops separately.
