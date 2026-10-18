# Living Valley authoring contract

This is the implementation contract for the separate `/living-valley/` adventure. The existing 24-mission game and its saved journeys stay intact. The user blueprint contains 92 named lessons and 12 chapter bosses, in order. It is a curriculum reference, not proof of learning or a promise of certification.

## Module boundary

Each content module exports `chapters` (metadata) and `missions` (authored encounters). Modules are `living-valley/data/chapters-01-04.js`, `chapters-05-08.js`, `chapters-09-12.js`. Plain JavaScript objects; no runtime dependencies or generated filler. Chapter metadata: `{id:1,title,subtitle,location,scene:'welcome'|'maps'|'owl'|'burrow'|'desk'|'lantern'|'keeper'|'post'|'bridge'|'lookout'|'tower'|'summit',outcome,officeConnection}`. See uploaded blueprint for exact titles/order/counts.

Every mission object:

```js
{
 id:'c01-01', chapter:1, lesson:1, title:"The Ranger's Welcome",
 phase:'discover', // discover | practice | prove | boss; boss id c01-boss, lesson:0
 location:'Welcome hut', scene:'welcome',
 skills:['computer-literacy'], reinforces:[], requires:[],
 officeConnection:'Recognise the workstation and scope of an IT ticket.',
 summary:'A concrete problem in the valley.',
 story:[{speaker:'NOVA',title:'A concrete beat',text:'Authored dialogue.'}],
 briefing:{plain:'What you are doing.',why:'Why now, and where the clues live.',professional:'Plainly unpacked professional term.',when:'A realistic use outside the valley.'},
 fixtures:{'notice.txt':'Text in the simulated home folder.\n'},
 steps:[/* see below */],
 questions:[{question:'Evidence-specific understanding or transfer question.',options:['Plausible response','Plausible response','Plausible response'],answer:1,explanation:'Why, with evidence.'}],
 debrief:'What changed in the world, what remains unproven, and why the skill helped.',
 callback:'An earlier character or restoration remembered later.',
}
```

Use 2–4 story frames (vary deliberately), 2–5 meaningful steps per lesson, 5–6 steps for each boss. At least two questions per lesson and three per boss, with plausible distractors and varied correct positions. Characters: NOVA, PATCH (the existing robot, nickname Patches), OWL, BRAMBLE, TESSA. Story spine: the valley's communications fail; early mishaps become a documented coordinated incident, without blaming a villain before evidence. Bosses 3, 8 and 12 are major story turns. Never infer attacker identity solely from a log count or claim that HTTPS makes an organisation honest.

Every step:

```js
{
 id:'locate', title:'Locate the ranger’s map',
 tool:'terminal', // terminal | explorer | network | browser | evidence | windows | script | dialogue
 phase:'practice', // optional step override; new teaching discover, prior-tool recall practice/prove
 prompt:'Outcome first, with an in-world reason. Do not reveal an unintroduced filename.',
 teaching:{plain:'What the tool or concept does.',syntax:'cd maps',meaning:'The command and each new argument/option.',when:'A concrete real-world situation.'},
 check:{type:'read',path:'/home/trainee/maps/route.txt'},
 solution:'cat maps/route.txt', // shell command OR activity solution (below); test-only route
 hints:['A question to think about.','The useful concept.','Where to look.','An exact syntax example if needed.'],
 feedback:{speaker:'PATCH',text:'An authored reaction to this exact finding.',why:'Explain why the observed result matters.',professional:'Name the technical concept after explaining it plainly.',when:'Where this transfers to real work.'},
 evidence:{source:'maps/route.txt',contains:'Pine Relay'}, // optional real output text to emphasise; never fabricate evidence
 activity:null // for nonterminal steps
}
```

Terminal checks use the existing `src/engine.js` schema: `read {path}`, `command {name,argsIncludes?,outputIncludes?}`, `write {path,contains}`, `exists {path}`, `mode {path,value}`, `decision` is not used here. Root engine additionally supports `directory {path}`, `absent {path}`, `file {path,contains?,equals?,mode?}` and `activity {}`. Paths absolute under `/home/trainee` unless deliberately teaching `/var/log` or Windows (see terminal extension agent). `solution` may be an array of commands for the same outcome; each runs separately. Read checks recognise supported alternate inspection commands; do not insist on an exact command for independent work. Teaching should explain options such as `ss -tuln` with lowercase `l` explicitly. New command must be introduced before it is required.

Command checks may add `files:[{path,contains?,equals?,mode?}]` and `services:[{name,active}]` to require actual current scenario state. `after:[{name,argsIncludes?,outputIncludes?}]` requires an earlier successful command in the **same execution**, useful for a causal conditional or pipeline. Do not use `after` to reject a valid separate editor/run/verification workflow; use state requirements for that case.

Nonterminal steps use `check:{type:'activity'}` and an `activity` object:

```js
{
 kind:'inspect', // inspect | choose | compare | classify | sequence | connect | report | repair
 heading:'The actual desk, window, board or device',
 instructions:'How to use this specific interaction.',
 items:[{id:'a',label:'Artifact name',detail:'Actual complete readable evidence.'}],
 // inspect: solution is the id of the relevant item; opening it verifies this observation.
 // choose/compare: inspect relevant evidence, then take an action; these may be desktop/security changes, dialogue replies, network configuration etc.
 requiredInspect:['a'],
 choices:[{id:'retain',label:'An in-world action.',correct:true,feedback:'Specific consequences.'}, {id:'disable',label:'A plausible alternative.',correct:false,feedback:'What the evidence contradicts.'}],
 // classify: categories:[{id:'private',label:'Private'}]; items additionally have category:'private'. Each must be placed correctly.
 // sequence/connect: items must be arranged into the correct sequence or route; order:['a','b','c']; start from shuffled/unselected state.
 // report: fields:[{id:'finding',label:'Finding',required:['signal','unavailable'],hint:'Describe the confirmed impact.'}]; words are case-insensitive factual anchors, not pretend NLP.
 // repair: initial:'readable text'; expected:['required text']; explicitly text-only. Real script behavior needs terminal writes and execution; activity.tests is rejected.
}
```

For nonterminal `solution` is an object: inspect `{inspect:['a']}`; choice `{inspect:['a'],choice:'retain'}`; classify `{classifications:{a:'private'}}`; sequence/connect `{order:['a','b','c']}`; report `{fields:{finding:'The signal is unavailable.'}}`; repair `{text:'corrected script'}`. Root shared engine validates against activity data and records attempts; opening irrelevant items or wrong choices never grant credit. No action string directly grants hidden credit. Visual tools display actual scenario data and can operate independently of the terminal.

Keep choices meaningfully different, scripts bounded and simulated, all names fictional. Boss guidance contains outcomes and evidence locations, without displayed commands. Hints remain available; assisted completion and independent demonstration are distinct. No mandatory timer, no fake mastery percentage, no placeholder panels or 104 copies of one exercise. Root will implement a review mode and skill journal separately from story progress.
