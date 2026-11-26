# Review disagreements and accept an existing result

Two reports disagree about whether the same batch passed. Bind both to the same business scope, content revision, policy revision, and sources before determining whether the disagreement is comparable. If one report checked a sample and the other checked the entire batch, preserve that difference in coverage.

## Record findings and coverage independently

Use `defineResultReview` to register detectors and their candidate scope. A detector cites evidence attached to those candidates. Deterministic checks can identify revision mismatches. Semantic checks can use a bounded Runner supplied by the host. The report contains findings and coverage. A confirmed conflict can coexist with unchecked candidates. Make failed detectors and missing evidence visible.

Use `checkReviewAdmission` as a preflight for blocking findings and required coverage. At commit, atomically recheck sources, policy, authority, and acceptance records. A difficult finding may warrant a bounded evidence check, which stops when results repeat or progress stalls.

## Have acceptance refer to an existing result

Use Review Choice for one or two existing summaries with confirmed complete coverage. Resolve missing evidence, failure, or incomplete coverage before offering the choice. Review Decision can wait for a human response. Receiving an answer and explicitly continuing are separate operations. The continuation accepts a validated answer under current authority. Bind the commit to the wait generation, submission ID, source versions, and stable action identity. Make a confirmed acceptance receipt readable on retry. Selecting an existing result adds no model call.

Run `node node_modules/@jangts/agent-core/development/examples/collaboration-probe.mjs` to see approval, process reconstruction, and lost save responses. In your own transaction, test revoked permissions, changed versions, post-deadline retrieval of accepted receipts, and refusal when coverage falls short. [Result review and decisions](../../docs/api/result-review.en.md) · [Change review Skill](../../skills/agent-core-workflow-change-review/SKILL.md)

[Technical articles](../README.en.md)
