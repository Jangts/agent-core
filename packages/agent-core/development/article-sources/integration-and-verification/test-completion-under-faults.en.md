# Test how a task ends under faults

After approval the server confirms a write, but the final message fails to arrive. Assert the effect happened once, the receipt remains readable, reconnect can retrieve it, and late delivery is rejected after cancellation. Catching an exception alone leaves those behaviors untested.

## Inject faults at handoffs

| Injection point | What must remain true |
| --- | --- |
| Valid tool argument with denied authorization | The business port is called zero times and refusal has the right cause |
| External effect completes, then persistence or acknowledgement fails | Stable identity supports reconciliation and uncertainty prevents replay |
| The workflow has a result, then reply-format validation fails | Repair stays in delivery and retains confirmed work |
| A child is cancelled and reports late | Its result never enters parent commit and confirmed effects remain queryable |
| Allowance nears its ceiling or input is oversized | Hard bounds hold and delivery reports the real state |

Assert state and business call counts. Retain routes and error classes for diagnosis. Persistence failures need fault tests against the actual storage port. A simulated port proves behavior under its stated conditions.

## Match the test environment to the question

Use pure cases for calculations and schemas. Use offline composition for authorization, routing, budgets, and receipts. Use live-model samples for semantic choice and wording. Verify process reconstruction, remote effects, and reconnect behavior in the target environment. Scripted replies let the same scenario be reproduced.

The following command runs the bundled layered test fixture.

```sh
sdk=./node_modules/@jangts/agent-core
node "$sdk/development/skills/agent-core-app-testing/scripts/test-agent.mjs" \
  --fixture "$sdk/development/skills/agent-core-app-testing/examples/agent-tests.mjs"
```

Run inspected and trusted fixtures because the runner loads the actual module. [Layered testing Skill](../../skills/agent-core-app-testing/SKILL.md) · [Workflow development and verification](../../docs/workflow-development.en.md)

[Technical articles](../README.en.md)
