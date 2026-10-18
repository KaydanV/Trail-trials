// Six deliberately authored additions to the existing lessons. These are evidence
// activities, not claims to execute a file parser, kernel, installer or cloud.
const details = [
  {
    mission: "c02-01",
    skills: ["structured-data-formats"],
    step: {
      id: "delivery-format-handoff",
      title: "Give each delivery record to the right reader",
      tool: "evidence",
      phase: "discover",
      prompt:
        "Bramble has the same delivery in three forms. Match each actual record to the reader that can use its structure without changing the delivery facts.",
      teaching: {
        plain:
          "Text can be arranged for a person, a table or a program. Its arrangement matters as much as its filename.",
        syntax:
          "Match the visible contents: plain text → human note; CSV → rows and columns; JSON → named values.",
        meaning:
          "CSV separates fields with commas and usually names columns in a header. JSON uses quoted names, colons and structured values. Plain text has no required table or object structure. This desk compares supplied examples; it does not run an importer.",
        when: "Choose how to inspect a support export before importing it, and check what its fields actually mean.",
      },
      check: { type: "activity" },
      activity: {
        kind: "classify",
        heading: "Bramble’s three delivery envelopes",
        instructions:
          "The archive needs a human note, a spreadsheet-ready table and a structured status message. Read the contents and assign each envelope to its matching reader. Renaming a file does not convert its contents.",
        categories: [
          { id: "note", label: "Plain text — read the human note" },
          { id: "table", label: "CSV — read header and table rows" },
          { id: "object", label: "JSON — read named values" },
        ],
        items: [
          {
            id: "letter",
            label: "delivery-note.txt",
            detail:
              "Bramble: the lantern batteries reached the bridge at 07:30. Keep the east handrail clear.\nA human sentence supplies the meaning; there is no fixed column or object layout.",
            category: "note",
          },
          {
            id: "ledger",
            label: "deliveries.csv",
            detail:
              "time,item,destination,status\n07:30,lantern batteries,bridge,delivered\nThe first row names four columns; the next row supplies their values in that order.",
            category: "table",
          },
          {
            id: "message",
            label: "delivery-status.json",
            detail:
              '{"time":"07:30","item":"lantern batteries","destination":"bridge","delivered":true}\nThe name delivered has a Boolean true value; the other values here are strings.',
            category: "object",
          },
        ],
      },
      solution: {
        classifications: { letter: "note", ledger: "table", message: "object" },
      },
      hints: [
        "Which envelope has sentences, which has columns, and which names individual values?",
        "Compare the content’s structure rather than assuming that every readable file is an unstructured note.",
        "The CSV header names time, item, destination and status. The JSON message has a delivered Boolean.",
        "Assign delivery-note.txt to Plain text, deliveries.csv to CSV, and delivery-status.json to JSON.",
      ],
      feedback: {
        speaker: "BRAMBLE",
        text: "Three envelopes, one delivery. The bridge gets its batteries and my spreadsheet no longer gets a paragraph jammed into its first cell.",
        why: "You recognised the representation without mistaking a different format for a different delivery or a successful import.",
        professional:
          "Structured data formats describe how fields and values are represented. Content inspection comes before parser or import selection.",
        when: "Read exported logs, API responses and support records without losing the meaning of their fields.",
      },
    },
    question: {
      question:
        "Bramble renames delivery-note.txt to delivery-note.json. What has actually changed?",
      options: [
        "Only its name; the sentence has not become a valid JSON object.",
        "Its sentences automatically become named JSON values.",
        "The delivery status changes from delivered to pending.",
      ],
      answer: 0,
      explanation:
        "A filename is a clue, not a conversion. The contents still have to follow the format a reader expects.",
    },
  },
  {
    mission: "c04-02",
    skills: ["user-kernel-space"],
    step: {
      id: "observatory-protection-boundary",
      title: "Keep the work crew outside the machinery guard",
      tool: "evidence",
      phase: "discover",
      prompt:
        "Tessa opens the observatory architecture board. Sort the running programs and protected operating-system work before Patch requests direct access to the cooling controls.",
      teaching: {
        plain:
          "Ordinary programs ask the operating system for protected work rather than freely controlling the machine.",
        syntax:
          "Place application processes in User space and protected operating-system mechanisms in Kernel space.",
        meaning:
          "User space and kernel space are protection domains. The kernel mediates resources and hardware access. A root-owned application can still run in user space: an account’s privileges and a processor’s execution mode are different ideas. This is a conceptual board, not a kernel inspection command.",
        when: "Understand why an application uses operating-system services and why a privileged account is not itself a kernel.",
      },
      check: { type: "activity" },
      activity: {
        kind: "classify",
        heading: "Tessa’s guarded machinery diagram",
        instructions:
          "Use the task’s role, not its owner or CPU percentage. The architecture cards describe where these particular tasks run.",
        categories: [
          { id: "user", label: "User space — application process" },
          { id: "kernel", label: "Kernel space — protected OS mechanism" },
        ],
        items: [
          {
            id: "cache",
            label: "PID 809: cache-builder",
            detail:
              "A service-account application builds cached observations. Its 85% CPU snapshot describes workload, not a switch into kernel space.",
            category: "user",
          },
          {
            id: "ssh",
            label: "PID 455: sshd",
            detail:
              "The root-owned SSH server is a user-space process. It requests protected operations through operating-system interfaces.",
            category: "user",
          },
          {
            id: "storage",
            label: "Observatory filesystem driver",
            detail:
              "This diagram’s filesystem driver runs inside the kernel and mediates access to the simulated storage device.",
            category: "kernel",
          },
          {
            id: "scheduler",
            label: "Operating-system scheduler",
            detail:
              "The kernel’s scheduler allocates processor time among runnable work. It is not another ranger application to stop casually.",
            category: "kernel",
          },
        ],
      },
      solution: {
        classifications: {
          cache: "user",
          ssh: "user",
          storage: "kernel",
          scheduler: "kernel",
        },
      },
      hints: [
        "Does owning a powerful account turn an application into the operating system itself?",
        "Separate user identity from the protection boundary between programs and kernel mechanisms.",
        "The two named PIDs are application processes. The driver and scheduler are the protected mechanisms on this diagram.",
        "Place cache-builder and sshd in User space; place the filesystem driver and scheduler in Kernel space.",
      ],
      feedback: {
        speaker: "TESSA",
        text: "Patch may request cooling through the proper controls. He may not become the operating system because he found a very important-looking badge.",
        why: "You separated a process owner’s authority from the protected machinery that applications ask the operating system to manage.",
        professional:
          "User/kernel separation limits direct access to protected resources; root privileges do not make an application a kernel component.",
        when: "Explain application permissions, system calls and the larger impact a kernel failure can have.",
      },
    },
    question: {
      question:
        "The process snapshot lists sshd as owned by root. What follows from that alone?",
      options: [
        "It must execute entirely inside the kernel.",
        "It has a privileged owner; its architecture still determines whether it is a user-space process.",
        "Its CPU use proves it bypassed the scheduler.",
      ],
      answer: 1,
      explanation:
        "Account identity and the user/kernel protection boundary are distinct. This scenario explicitly describes sshd as a user-space server.",
    },
  },
  {
    mission: "c06-04",
    skills: ["software-supply-chain"],
    step: {
      id: "approved-update-provenance",
      title: "Find a safe route for Patch’s real update",
      tool: "evidence",
      phase: "discover",
      prompt:
        "The disguised attachment stays quarantined. Compare the separate, approved update record with a courier’s substitute before recommending how Patch should obtain maintenance software.",
      teaching: {
        plain:
          "An update should come through a known, approved source with its identity and integrity checked, rather than through whichever parcel arrives first.",
        syntax:
          "Inspect the release, substitute and approval records; choose the supported maintenance route.",
        meaning:
          "Software supply-chain checks examine where software came from and what happened before installation. A signature or trusted digest can help verify origin or integrity when checked against an independently trusted source. Those checks do not guarantee the absence of bugs or malicious behaviour. Here you assess supplied records; no installer is run.",
        when: "Obtain an approved package or dependency without treating an email attachment or search result as an update authority.",
      },
      check: { type: "activity" },
      activity: {
        kind: "compare",
        heading: "Patch’s maintenance parcel comparison",
        instructions:
          "Open all three records. The legitimate maintenance route is separate from the quarantined battery-guide.pdf.exe; nothing here authorises restoring or executing that attachment.",
        items: [
          {
            id: "release",
            label: "Known maintenance repository record",
            detail:
              "Repository: the ranger-approved maintenance service recorded in the device inventory. Package: patch-power-controller 2.4. Release verification record: publisher signature valid for the expected maintenance publisher; package digest matches the signed release manifest obtained through that known service. This supplied record is not a real signature check performed by this desk.",
          },
          {
            id: "substitute",
            label: "Courier’s replacement offer",
            detail:
              "Courier attachment: patch-power-controller-latest.exe. Courier says its checksum is correct and supplies a checksum in the same message. No independent release record, expected-publisher verification or ranger approval is recorded.",
          },
          {
            id: "approval",
            label: "Maintenance approval",
            detail:
              "Tessa approved review of version 2.4 from the known repository, followed by a staged test, a rollback plan and an installation window. This evidence task authorises a recommendation only, not installation. Keep the earlier attachment quarantined.",
          },
        ],
        requiredInspect: ["release", "substitute", "approval"],
        choices: [
          {
            id: "courier",
            label:
              "Recommend the courier attachment because the checksum in its own message agrees.",
            correct: false,
            feedback:
              "A substitute and its supplied checksum can be changed together. The same untrusted message is not independent provenance.",
          },
          {
            id: "never-update",
            label:
              "Recommend disabling maintenance permanently because approved packages can still contain bugs.",
            correct: false,
            feedback:
              "Residual risk calls for approved verification, staged testing and rollback. It does not make leaving known weaknesses forever the safer default.",
          },
          {
            id: "approved-route",
            label:
              "Recommend the known, verified release for Tessa’s approved staged test; keep both installation and rollback within the maintenance process.",
            correct: true,
            feedback:
              "That uses independent source and integrity evidence while retaining testing, approval and recovery controls.",
          },
        ],
      },
      solution: {
        inspect: ["release", "substitute", "approval"],
        choice: "approved-route",
      },
      hints: [
        "Who supplies the software, and who supplies the evidence that it is the intended release?",
        "A checksum copied from the same unknown message cannot establish an independent trusted source.",
        "Compare the known repository’s verification record with Tessa’s maintenance approval. The quarantined attachment remains separate.",
        "Choose the known, verified release for the approved staged test, with installation and rollback controlled by maintenance.",
      ],
      feedback: {
        speaker: "PATCH",
        text: "An actual maintenance route! I shall stop accepting personality upgrades from strangers with impressive filenames.",
        why: "You selected a provenance-supported recommendation without claiming that a checksum proves a package harmless or that approval means installation already happened.",
        professional:
          "Software supply-chain assurance combines trusted distribution, provenance and integrity checks with operational testing and change control.",
        when: "Review updates, packages and third-party dependencies before introducing them into a working environment.",
      },
    },
    question: {
      question:
        "Why does the courier’s attachment plus its matching checksum leave a trust gap?",
      options: [
        "Checksums can only describe text documents.",
        "A checksum automatically proves an approved publisher identity.",
        "An untrusted sender can replace both the file and the checksum in the same message.",
      ],
      answer: 2,
      explanation:
        "The comparison needs an independently trusted release reference. Integrity evidence does not by itself establish trustworthy origin or harmless behaviour.",
    },
  },
  {
    mission: "c09-03",
    skills: ["pseudocode"],
    step: {
      id: "write-the-dispatch-plan",
      title: "Give the automaton a plan before another command",
      tool: "evidence",
      phase: "discover",
      prompt:
        "Tessa wants a plan any future machine can follow. Compare the plain-language algorithms for a requested change ID, including the missing-approval case.",
      teaching: {
        plain:
          "Pseudocode describes the steps and decisions of an algorithm without committing to a programming language.",
        syntax:
          "READ request ID → CHECK that exact request’s approval → IF approved, READY; OTHERWISE, HOLD.",
        meaning:
          "An algorithm is a defined procedure. Pseudocode makes its input, condition and possible outputs reviewable before choosing Bash or another language. These plans are read and compared here; their text is not executable code.",
        when: "Agree what an automation should do, including failure cases, before implementing its syntax.",
      },
      check: { type: "activity" },
      activity: {
        kind: "compare",
        heading: "Tessa’s language-independent dispatch plan",
        instructions:
          "The requirement is READY only for an explicit approval of the requested change ID. A different request’s approval is not enough. Read the requirement and both proposed plans.",
        items: [
          {
            id: "requirement",
            label: "Dispatch requirement and test cases",
            detail:
              "Requested CHG-42 with CHG-42 APPROVED → READY. Requested CHG-99 with no matching approval → HOLD, even though CHG-42 is approved. A missing request ID → HOLD.",
          },
          {
            id: "plan-a",
            label: "Plan A: a shortcut",
            detail:
              "READ request ID.\nIF the approval ledger contains any approved change, OUTPUT READY.\nOTHERWISE OUTPUT HOLD.\nThis checks that some approval exists, not that the requested change is approved.",
          },
          {
            id: "plan-b",
            label: "Plan B: the specific decision",
            detail:
              "READ request ID.\nIF the ID is missing, OUTPUT HOLD and stop.\nLOOK UP approval for that exact ID.\nIF that request is explicitly approved, OUTPUT READY.\nOTHERWISE OUTPUT HOLD.",
          },
        ],
        requiredInspect: ["requirement", "plan-a", "plan-b"],
        choices: [
          {
            id: "any-approval",
            label:
              "Choose Plan A: a busy ledger is enough evidence that the requested work can proceed.",
            correct: false,
            feedback:
              "CHG-42’s approval cannot authorise CHG-99. The input must be tied to the condition.",
          },
          {
            id: "specific-approval",
            label:
              "Choose Plan B: validate the request, then base the result on that request’s actual approval.",
            correct: true,
            feedback:
              "The input, decision and both outcomes match the requirement, including absent approval.",
          },
          {
            id: "syntax-only",
            label:
              "Skip the plan and check only whether the eventual command has valid syntax.",
            correct: false,
            feedback:
              "Syntactically valid code can implement the wrong rule and print a false success.",
          },
        ],
      },
      solution: {
        inspect: ["requirement", "plan-a", "plan-b"],
        choice: "specific-approval",
      },
      hints: [
        "Would approving one bridge repair authorise every other request in the valley?",
        "An algorithm must connect the input request to the exact condition it checks.",
        "Try the supplied CHG-99 case on each plan while CHG-42 remains approved.",
        "Choose Plan B: validate the requested ID, look up that ID, and output HOLD unless its approval is explicit.",
      ],
      feedback: {
        speaker: "TESSA",
        text: "That plan survives a new request number. The next engineer can debate the rule before getting buried in brackets.",
        why: "You reviewed an algorithm against positive, negative and missing-input cases rather than confusing correct syntax with correct behaviour.",
        professional:
          "Pseudocode exposes control flow and requirements independently of implementation language.",
        when: "Review a proposed script with a colleague or translate a workflow into a small, testable algorithm.",
      },
    },
    question: {
      question:
        "What useful problem did the pseudocode expose before any new script was written?",
      options: [
        "A rule can use valid syntax but check the wrong request’s approval.",
        "Pseudocode automatically executes more safely than Bash.",
        "An approval ledger must always contain exactly one request.",
      ],
      answer: 0,
      explanation:
        "The error was in the decision rule, not its punctuation. Writing the input and condition plainly made that mismatch visible.",
    },
  },
  {
    mission: "c09-05",
    skills: ["input-validation"],
    step: {
      id: "dispatcher-input-boundary",
      title: "Stop strange relay names at the dispatcher’s door",
      tool: "evidence",
      phase: "discover",
      prompt:
        "The tested signal checker is only one component. Tessa’s next dispatcher accepts exactly pine or oak as its relay ID. Classify its proposed inputs before they can become an instruction.",
      teaching: {
        plain:
          "Input validation checks whether supplied data belongs to the small set a workflow is prepared to handle.",
        syntax:
          "Accept the exact IDs pine and oak; reject every other input on this test board.",
        meaning:
          "An allowlist defines permitted values. Empty input, extra text and command-like punctuation do not become valid just because they contain the word pine. Validation should reject or report unexpected data before use. It complements safe data handling and does not make inserting input into shell code safe. This board evaluates examples; it does not execute their contents.",
        when: "Check form fields, script arguments and imported values before using them in an operation.",
      },
      check: { type: "activity" },
      activity: {
        kind: "classify",
        heading: "Dispatcher input test bench",
        instructions:
          "The whole input must exactly equal lowercase pine or oak. There is no automatic trimming or case conversion in this stated contract. Classify all examples; nothing on these cards is executed.",
        categories: [
          { id: "accept", label: "Accept — exact approved relay ID" },
          { id: "reject", label: "Reject — not an allowed complete value" },
        ],
        items: [
          {
            id: "pine",
            label: "Input: pine",
            detail:
              "The complete value is pine, an explicitly permitted relay ID.",
            category: "accept",
          },
          {
            id: "oak",
            label: "Input: oak",
            detail:
              "The complete value is oak, the other explicitly permitted relay ID.",
            category: "accept",
          },
          {
            id: "empty",
            label: "Input: empty",
            detail:
              "No characters were supplied. There is no relay ID to act on.",
            category: "reject",
          },
          {
            id: "extra",
            label: "Input: pine; echo READY",
            detail:
              "The input contains extra command-like text. It is not the complete allowed value pine. Do not run it to inspect it.",
            category: "reject",
          },
          {
            id: "unknown",
            label: "Input: spruce",
            detail:
              "A plausible tree name, but no spruce relay is approved in this dispatcher contract.",
            category: "reject",
          },
        ],
      },
      solution: {
        classifications: {
          pine: "accept",
          oak: "accept",
          empty: "reject",
          extra: "reject",
          unknown: "reject",
        },
      },
      hints: [
        "Does containing a permitted word make the entire supplied value a permitted ID?",
        "Validate against the exact allowlist rather than guessing what a person probably meant.",
        "Only the complete values pine and oak appear in Tessa’s dispatcher contract.",
        "Accept pine and oak. Reject the empty value, pine; echo READY, and spruce.",
      ],
      feedback: {
        speaker: "PATCH",
        text: "The machine refused a tree-shaped guess and an entire extra command. I also tried “pine, please”, but manners are not a relay ID.",
        why: "You distinguished data that meets the explicit input contract from data that is merely familiar-looking. No rejected text was executed.",
        professional:
          "Allowlist input validation enforces an expected set of complete values; safe execution still requires keeping data separate from code.",
        when: "Define both accepted and rejected test cases for a small automation before it handles real input.",
      },
    },
    question: {
      question:
        "The proposed input is pine; echo READY. Why must this dispatcher reject it?",
      options: [
        "Any text longer than four characters is malicious everywhere.",
        "It contains a recognised tree name, so it must be accepted.",
        "Its complete value is neither permitted relay ID, and input text must not be treated as a command.",
      ],
      answer: 2,
      explanation:
        "This contract accepts exactly pine or oak. Rejecting an unexpected value does not require executing it, guessing intent or proving it malicious.",
    },
  },
  {
    mission: "c11-05",
    skills: ["zero-trust", "shared-responsibility"],
    step: {
      id: "cloud-notes-trust-and-ownership",
      title: "Let the right ranger into the right cloud notebook",
      tool: "evidence",
      phase: "discover",
      prompt:
        "Bramble’s approved case store is a hosted service. Check a request from inside the outpost against the service agreement and the actual access rule before sharing the incident notebook.",
      teaching: {
        plain:
          "Being on the office network does not establish who may read a private case. A hosted service also leaves important security work with its customer.",
        syntax:
          "Compare verified identity, case-specific permission and the recorded provider/customer responsibilities.",
        meaning:
          "Zero-trust principles avoid granting access solely from network location; verify the requester and grant only the access needed for the resource. Shared responsibility divides duties between provider and customer according to the actual service model and agreement. This fictional hosted notes service has a stated split; it is not a universal split for every cloud product.",
        when: "Review a cloud sharing request and establish who owns identity, data handling, platform maintenance and incident coordination.",
      },
      check: { type: "activity" },
      activity: {
        kind: "compare",
        heading: "Hosted notebook access desk",
        instructions:
          "Read the service agreement, access request and policy. Choose an action that respects both the trust boundary and the stated responsibility split. This task records a recommendation; it does not change a real cloud account.",
        items: [
          {
            id: "agreement",
            label: "Approved hosted-notes agreement",
            detail:
              "For this service, the provider patches the hosted application and underlying platform and reports platform incidents. The ranger organisation manages its user accounts, case permissions, data classification and sharing settings. Both parties preserve and exchange relevant incident evidence under the agreement. Other cloud service models can divide work differently.",
          },
          {
            id: "request",
            label: "A request from the outpost Wi-Fi",
            detail:
              "Display name: “Tessa Support”. Current evidence: request arrived from an internal network address. Verified account identity and assignment to this private case are not established. The request asks for the full incident notebook.",
          },
          {
            id: "policy",
            label: "Private-case access rule",
            detail:
              "Use the known identity channel to verify the requester and case role. Grant the minimum case-specific access only after owner approval. Internal network location alone is insufficient. The ranger owner must review sharing permissions; provider platform patching does not configure those permissions for the customer.",
          },
        ],
        requiredInspect: ["agreement", "request", "policy"],
        choices: [
          {
            id: "internal-trust",
            label:
              "Share the full notebook now because the request came from outpost Wi-Fi.",
            correct: false,
            feedback:
              "Network location does not establish the requester’s identity, role or right to private evidence.",
          },
          {
            id: "verify-and-own",
            label:
              "Verify identity and case role through the known channel, seek owner approval and grant minimum access; retain ranger responsibility for accounts and sharing while the provider maintains its stated platform duties.",
            correct: true,
            feedback:
              "That follows the actual access policy and the agreement rather than treating either the internal network or the provider as a substitute for customer decisions.",
          },
          {
            id: "provider-owns-all",
            label:
              "Ask the provider to decide case membership because hosting transfers all security responsibility.",
            correct: false,
            feedback:
              "The agreement explicitly assigns case permissions and account administration to the ranger organisation.",
          },
        ],
      },
      solution: {
        inspect: ["agreement", "request", "policy"],
        choice: "verify-and-own",
      },
      hints: [
        "What evidence identifies the person, and who actually owns permission decisions under this agreement?",
        "An internal address is not identity. Hosting a service does not transfer every customer security duty.",
        "The agreement assigns accounts and case sharing to the rangers; the access rule requires verification and owner approval.",
        "Choose identity and case-role verification, minimum approved access, and the provider/customer duties recorded in the agreement.",
      ],
      feedback: {
        speaker: "NOVA",
        text: "The notebook stays private until the person and purpose are established. Bramble keeps the sharing keys; the provider keeps its platform duties. Neither gets to point vaguely at the cloud.",
        why: "You required evidence for this access decision and identified the organisation still responsible for the relevant configuration.",
        professional:
          "Zero-trust access decisions verify identity and authorisation for the resource. Shared responsibility depends on the service model and explicit agreement.",
        when: "Manage workplace cloud access without relying on network location or assuming the provider handles every security control.",
      },
    },
    question: {
      question:
        "The hosted-notes provider confirms that its platform is fully patched. What still belongs to the rangers under this agreement?",
      options: [
        "Nothing: provider patching proves every case is shared correctly.",
        "Account administration, case permissions and the notebook’s sharing configuration.",
        "Patching the provider’s underlying platform outside the agreement.",
      ],
      answer: 1,
      explanation:
        "The agreement separates platform maintenance from customer access and data-handling duties. A patched platform can still hold an incorrectly shared notebook.",
    },
  },
];

export function applyFoundationDetails(authored) {
  for (const detail of details) {
    const mission = authored.find(
      (encounter) => encounter.id === detail.mission,
    );
    if (!mission)
      throw new Error(
        `Foundation detail has no authored encounter: ${detail.mission}`,
      );
    if (mission.steps.some((step) => step.id === detail.step.id)) continue;
    if (mission.steps.length >= 5)
      throw new Error(
        `Foundation detail exceeds the lesson limit: ${detail.mission}`,
      );
    mission.steps.push(structuredClone(detail.step));
    mission.questions.push(structuredClone(detail.question));
    for (const skill of detail.skills)
      if (!mission.skills.includes(skill)) mission.skills.push(skill);
  }
  return authored;
}
