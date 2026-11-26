# Route completion failures to targeted repair

A report already has a valid operation receipt, but a presentation field fails validation. A boolean completion result leaves the workflow guessing whether to reread sources, rewrite the prose, or repair a field. Return a decision that identifies the work.

## Route each decision to the step that owns it

Use `defineCompletionChecks` to register checks and their `required` status. Deliver a `ready` result, ask the current user for a `clarify` decision, and report the available work for `partial`. For `repair`, use its `target` to select the responsible phase.

| Target | Repair | Preserve |
| --- | --- | --- |
| `format` | Structure, rendering, or parseable fields | Confirmed facts and operation receipts |
| `content` | The explanation built from existing evidence | Read sources and write state |
| `evidence` | Missing or stale sources | Other applicable evidence |

A required refusal stops the normal delivery path. A required check that throws goes to failure handling. An optional failure remains observable and can leave a valid main result available. Prefer checks with no side effects. Any necessary write requires application authorization and idempotency.

## Count business actions through repair

Run `node node_modules/@jangts/agent-core/development/examples/harness-composition.mjs`. It injects a format failure after one write and repairs delivery while retaining the receipt. In your workflow, assert that `format` repeats no reads or writes, and evidence repair rereads only stale requirements. Bound attempts and check how the task ends when they produce no progress. [Completion check contract](../docs/api/reliability.en.md) · [Resilience review Skill](../skills/agent-core-resilience-review/SKILL.md)

[Technical articles](README.en.md)
