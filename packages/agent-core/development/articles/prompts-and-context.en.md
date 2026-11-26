# Build prompts and context by task stage

A support reply about ticket progress needs the current policy, the user's question, and the result of an executed lookup. Prior replies can resolve a reference. The current lookup determines the ticket state. Assemble those materials by source so later calls can account for each one's purpose and lifetime.

## Start with explicit messages

In an existing handler, put application rules in the system message and the question in the user message. Read source records under the request's identity. A tool proposal contributes evidence only after the authorized execution produces its result. Pass source material and historical text as data.

When sources need independent size limits or diagnostics, declare them with `Support.defineContextFragments`.

```ts
import { Support } from '@jangts/agent-core';

const context = Support.defineContextFragments<{ question: string }>([
  {
    id: 'rules', sourceId: 'app.reply-policy', role: 'system',
    trust: 'instruction', lifetime: 'configuration', maxChars: 300,
    format: () => 'Use confirmed records. State what could not be confirmed.',
  },
  {
    id: 'question', sourceId: 'request.question', role: 'user',
    trust: 'user', lifetime: 'turn', maxChars: 3000,
    format: ({ question }) => ({ question }),
  },
]);
```

Pass `context.build({ input })` to the Runner. A query receipt can have `trust: 'tool'`, `lifetime: 'step'`, and its own field. Structured user fragments require unique top-level fields. The application sets character limits. Fragment lifetime describes assembly scope. The host owns database retention.

## Build input for the work at hand

Tool selection needs the question and eligible capabilities. Reply writing needs actual receipts and applicable reply rules. To reduce history, pass `context.plan` to `Support.createContextProcessingNode` and choose a processing policy. Default validation measures and checks the assembled input. Reuse the returned prepared handle at invocation so the sent call follows the measured plan.

Inspect `fragmentUsage` and the actual provider request for source scope, size, and protocol overhead. Collect only the material needed to diagnose failures. Run `node node_modules/@jangts/agent-core/development/docs/examples/lifecycle-matrix.mjs` to compare capabilities at different stages. [Context processing](../docs/api/context-processing.en.md) · [Workflow design Skill](../skills/agent-core-workflow-design/SKILL.md)

[Technical articles](README.en.md)
