# Organize facts, formats, and references in replies

Two complete product collections contain 82 and 65 unique items, with 64 in common. The application can calculate 18 missing items and one extra item, then ask the model to explain the difference. Unchecked order and unavailable prices belong in the input alongside the confirmed counts. Facts, references, and style samples serve different purposes.

## Decide what the program owns

- Use trusted published instructions directly where they apply. Compute dynamic counts and eligibility from authoritative sources.
- Let the model organize prose when wording is flexible, then check material facts and constraints.
- When a UI or service consumes structured output, use `Presentation.defineOutputCatalog` to separate generated fields, bound values, constants, and controlled semantic choices. Finish async reads first, then bind current request data. The application checks eligible placeholders and references and handles safe rendering.

Check the scope and revision of a factual reference. A writing sample supplies structure or tone. Keep its old values and objects out of the current evidence. Use `Presentation.defineReplyFormats` to choose among declared formats. When no format applies, ordinary prose can still be delivered.

For the product comparison, send the source scope, computed differences, and unexamined fields separately. If either collection turns out to be a page fragment, withdraw the missing and extra totals and retain observations about the page. For a dynamic layout, `Presentation.defineTextTemplate` substitutes once and `Presentation.defineSemanticSlots` checks declared namespaces, choices, and occurrences. The application still checks meaning. A syntactically valid count slot can still appear beside the wrong label.

## Set the default for this reply

`Support.resolveReplyGuidance` resolves trusted settings in order from the application default through the current node and applicable tools to the call. The application supplies the result as `replyGuidance` to `ModelRunner.invoke` or `prepare`. Conflicting tool defaults require a call-level choice. The options are `brief`, `normal`, and `detailed`. The SDK adds a short instruction that preserves explicit user requirements, material limitations, and the output protocol. A prepared handle carries that choice into invocation.

The instruction is counted and sent with the prepared interaction. Output bounds still come from call constraints and application checks. Use trusted instructions or small writing references to adapt an explanation for a newcomer, an expert, or a particular tone while preserving the same verified facts.

## Verify the reply and the effect

After a save produces a real receipt, inject a prose-format failure. Wording repair can reuse the receipt while the write count stays at one. Check quantities and eligibility against their source. Evaluate tone and detail on live-model samples.

```sh
sdk=./node_modules/@jangts/agent-core
runner="$sdk/development/skills/agent-core-app-testing/scripts/test-agent.mjs"
node "$runner" --fixture "$sdk/development/skills/agent-core-reply-development/examples/facts-and-reference.mjs"
node "$runner" --fixture "$sdk/development/skills/agent-core-reply-development/examples/presentation-and-style.mjs"
```

The [reply development Skill](../skills/agent-core-reply-development/SKILL.md) includes fixtures and a snapshot checker for declared relationships. Verify business receipts in behavioral tests against the actual execution path. [Support reply guidance](../docs/api/support.en.md)

[Technical articles](README.en.md)
