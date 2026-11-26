# Resources, completion and recovery

Core owns request accounting and execution guarantees. Support offers opt-in assessment and request recovery. Completion Kit expresses App-owned checks and repair destinations; no App is required to install a global task-state framework.

## Dynamic call allocation

```ts
import { ModelRunner, Support } from '@jangts/agent-core';

const model = new ModelRunner({
  provider: { async *stream() { yield 'A result'; } },
  maxCalls: 2,
  maxTotalCalls: 12,
  execution: { signal: new AbortController().signal },
});
const assessment = Support.assessModelBudget({
  budget: model.callBudget,
  work: { execution: 3, review: 1, delivery: 1, recovery: 1 },
});
if (assessment.action === 'expand') {
  model.adjustCallBudget({ limit: assessment.suggestedLimit!, reason: assessment.reason });
}
const result = await model.invoke({ input: 'Complete the requested task.' });
console.log(result.value, model.callBudget);
```

`maxCalls` is the initial allocation, `maxTotalCalls` the immutable host ceiling (default: `maxCalls`). Adjustments are synchronous and request-local. They never reset charged attempts, change credentials, enlarge a model context window, extend a deadline or bypass ancestor reserves. Limits must be safe integers between consumed calls and the ceiling; reasons must be nonempty host-authored strings. A detached `callBudget` snapshot contains limit, ceiling, used, effective remaining and revision records. It is not a currency bill. Persist these records through the App's existing diagnostics; Core does not select storage or collect text automatically.

Bind a shared runner before inspecting or adjusting state. Ordinary workflow nodes use `context.model.callBudget` and `context.model.adjustCallBudget` with ModelRunner. Those members are optional for custom structural runtimes; an unsupported adjustment is a workflow contract error. A child can only revise within its original local ceiling and can never grant ancestor capacity. Multi-model selection does not turn one model's allocation into another's: adjust the selected runtime explicitly.

## Assess useful remaining work

`assessModelBudget` is a pure recommendation. `work` counts remaining execution, review, delivery and recovery, including nested model calls. An App can obtain these estimates from capability declarations and observed work; no mandatory classifier call is added.

| Fact | Recommendation |
| --- | --- |
| Result ready | deliver |
| Necessary user information or authority missing | clarify |
| Actual external blocker | partial |
| Repeated work without progress | replan |
| Context pressure with feasible selection/compression | reduce-context, then reassess |
| Work fits the effective allocation | continue |
| Useful work fits the host ceiling but exceeds the allocation | expand |
| Another allocation, input or plan problem | replan; partial only after alternativesExhausted |

A small initial quota is not a reason to abandon a feasible task. Context reduction cannot refund attempts. Reuse and deterministic projection precede model compression; preserve source retrieval, authority, recent corrections and critical facts. Compression and call expansion are separate decisions. App-owned task value, deadlines and financial limits remain explicit.

## Directed completion checks

```ts
import { defineCompletionChecks } from '@jangts/agent-core/kits/completion';

const checks = defineCompletionChecks<{ text: string }>([
  { id: 'profile', required: false, check: () => ({ kind: 'ready' }) },
  { id: 'content', required: true, check: value => value.text.trim()
    ? { kind: 'ready' }
    : { kind: 'repair', target: 'content', reason: 'Compose from existing evidence' } },
]);
const report = await checks.run({ text: 'Confirmed result' }, new AbortController().signal);
console.log(report.decision, report.observations);
```

`ready`, `repair`, `clarify` and `partial` are decisions, not business success claims. Repair targets are `content`, `format` and `evidence`. The App maps these to ordinary workflow routes. Required refusals stop checks; required exceptions remain failures for a recovery edge. Optional exceptions and refusals remain observable without vetoing the principal result. Cancellation is propagated. Keep checks pure when possible; actual writes require App-owned idempotency and receipts. Whether memory persistence is required depends on the user task, not a universal library rule.

## Independent request recovery

```ts
import { Support } from '@jangts/agent-core';

const run = Support.createRequestRecovery<{ artifacts: string[] }, string>({
  async execute(record) {
    record.artifacts.push('Verified report');
    throw new Error('An execution dependency is unavailable');
  },
  fallback(record) {
    return record.artifacts.length
      ? `Available work: ${record.artifacts.join(', ')}. The remaining part is unresolved.`
      : 'I could not obtain a reliable result this time.';
  },
});
const result = await run({ artifacts: [] }, new AbortController().signal);
console.log(result.source, result.value, result.errors);
```

Execution runs once. Optional `recover` can compose from existing records; if it fails, synchronous local `fallback` needs no model call. Methods keep their original receiver. Results distinguish `execution`, `recovery` and `fallback`, retaining technical failures for App diagnostics. Recovery is not task replay and does not mark business work successful. If the App's fallback itself throws, that failure remains visible.

Use a live outer request signal. Execution-only timeouts belong inside execute, so their expiry does not pre-cancel recovery. Explicit cancellation never invokes recovery or fallback. Bound the recover handler's lifetime in the App; the helper cannot invent a new deadline or authorized background task. A dead process or lost network requires host persistence and reconnect lookup, not a promise of immediate delivery. Never retry an uncertain write without reconciliation.
