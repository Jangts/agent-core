# Reflection, Branches, and Knowledge Publication

[Core](core.md) provides the model invocation, execution, branch identity, and cancellation contract. [Kit](kits.md) handles reflection, data versions, and durable tasks on the authorization and storage ports supplied by the App.

The authorize, BranchVersioningDefinition.validate, and verifySources callbacks of these Kits are assertion-style callbacks: they return void on success and throw on rejection; returning any other value synchronously or asynchronously, such as false, true, or null, is treated as a contract error, and execution or saving does not continue.

BranchVersions and knowledge publication fix the request identity, target, and serializable data before entering asynchronous authorization or reads; later modifications to the original request do not change this operation. BranchVersions read validation and authorization obtain isolated data; a check callback cannot be used to rewrite stored originals or pending records. Source references must not contain missing entries, and validity is still checked before commit.

## Bounded Subtask Composition

Ordinary tasks call the same `createChild` entry point. When composing multiple independent tasks, `Support.runChildren` starts child runners according to the capacity of the root runner, isolating the journal, signal, and output; each task still uses its own ordinary handler or Workflow.

```js
import { ModelRunner, Support } from '@jangts/agent-core';

export async function analyze(provider, inputs, signal) {
  const model = new ModelRunner({ provider, maxCalls: 8, execution: { signal },
    children: { maxDepth: 2, maxConcurrentCalls: 2, maxChildren: 8 } });
  return Support.runChildren(model, inputs.map((text, index) => ({
    id: `part-${index}`, maxCalls: 2, reserveCalls: 1, timeoutMs: 30000,
    interactions: [],
    async run(child) { return (await child.invoke(text)).value; },
  })), {
    concurrency: 2,
    accept(value) { if (typeof value !== 'string' || !value.trim()) throw Error('Empty analysis'); },
  });
}
```

Both `accept` and `commit` return void on success; rejection is expressed by throwing, not by a boolean return value. The transport list of subtasks is fixed when the group starts. `accept` checks each result, and waiting remains subject to that subtask's cancellation and deadline; only after all results are accepted is the optional `commit(value, id)` called in declaration order. Failure of any task or acceptance check cancels the tasks in the same group, and late results cannot enter the commit. `commit` is the App's real side-effect port; a commit that has already happened cannot pretend to roll back because of cancellation. When whole-group atomicity is required, the App commits the entire returned array in a real transaction. Role and tool lists are registered explicitly; subtask execution does not inherit permissions automatically.

accept likewise follows the assertion contract: it returns void on success and rejects any other return value, so false cannot be treated as a successful check.

## Metadata Reflection

```ts
import { defineReflection } from '@jangts/agent-core/kits/reflection';
import type { ReflectionSource } from '@jangts/agent-core/kits/reflection';
import type { ModelRunner, OperationContext } from '@jangts/agent-core';

export function review<App>(model: ModelRunner, source: ReflectionSource<App>,
  authorize: (question: string, context: OperationContext<App>) => Promise<void>) {
  return defineReflection({ model, source, authorize,
    maxCalls: 4, reserveCalls: 1, maxPages: 4, maxEvents: 64, maxEvidenceChars: 12000 });
}
```

`run(question, context)` obtains evidence through the registered `history.query` tool, and the model can choose to discover runs, read events, or submit a report. The Source validates the real account and scope for every query; the output exposes fixed metadata fields and does not carry log bodies. Reports distinguish observed, hypothesis, and recommendation; observed entries must reference evidence IDs actually returned in this operation. Incomplete reads, expiration, insufficient budget, or protocol failure all preserve the real limitation, and reports default to `persisted: false`.

`defineReflectionLogSource({ reader, id, traceId, authorize })` can adapt an App-owned structured log reader: it fixes the trace scope, reads only the runs discovered in this operation, and projects only Core metadata. Actual time, span/parent span, and invocation and branch identity are preserved through a fixed list so the report can reference real relationships. Coverage information keeps only consistency, complete, and gaps; other fields attached by the source are not forwarded. The App owns the catalog, account validation, closing of the reader, and log retention. Additional tools must be read-only, with their list and canonical methods fixed at construction time, and they still follow the ordinary tool input, authorization, and output contract.

Logs read metadata according to event declarations: model.end uses payload.state, workflow.event uses payload.event, and loop.event uses its own payload. The actual lifecycle of workflows and loops is mapped to running/success/error/cancelled; error codes and durations are preserved along the same projection, and raw error text is not sent to the model.

Read permission, handing data to the model, and disclosing results are independent decisions. A missing log cannot prove that nothing ran, and the sub-steps of a dynamic report cannot prove the real internal scheduling. Delivery is refused when the source data expires before it is returned.

The report's `createdAtMs`, and the evidence's and report's `expiresAtMs`, are absolute millisecond times, using the same unit as the event's `occurredAtMs`.

## Durable Branches and Explicit Promotion

```ts
import { defineBranchVersioning } from '@jangts/agent-core/kits/branch-versioning';
import type { BranchVersionStore } from '@jangts/agent-core/kits/branch-versioning';
import type { OperationContext } from '@jangts/agent-core';

type State = { goal: string; sourceRevision: string };
export function family<App>(store: BranchVersionStore<State>,
  authorize: (context: OperationContext<App>) => Promise<void>,
  verify: (state: State) => Promise<void>) {
  return defineBranchVersioning<State, App>({
    store, maxVersions: 16, retentionMs: 7 * 86400000,
    isState: (value): value is State => !!value && typeof (value as State).goal === 'string'
      && typeof (value as State).sourceRevision === 'string',
    authorize: (_operation, _record, context) => authorize(context),
    validate: candidate => verify(candidate.state),
    async merge({ base, target, source }) {
      if (target.goal !== base.goal && source.goal !== base.goal && target.goal !== source.goal)
        return { conflicts: ['goal'] };
      return { value: target.goal === base.goal ? source : target, conflicts: [] };
    },
  });
}
```

`create` establishes the initial version; `fork` receives the real parent branch identity and the cloned state; `merge` requires a common base and relies on the App's three-way merger to report conflicts. A new version is first saved as a candidate. `promote({ id, revision, candidateId, expectedActiveId }, context)` rechecks the current source and approval responsibility and explicitly switches activeId. Only candidates whose base is the current active version may be promoted.

`BranchVersionStore.compareAndSwap` must atomically commit the complete version set and activeId in real storage; only a true return is a success receipt. Read permission is enforced by the bound store, while mutations go through authorize separately. Branch data does not restore identity, budget authorization, tool instances, or running functions; the App rebinds current dependencies when it uses a selected version. When the Engine has already bound request-level model or tool runtime instances, `fork`'s `resume` must supply the corresponding instances; if they are missing, it rejects during derivation. The Engine's `exportSnapshot`/`restoreSnapshot` handle serializable host-data and branch snapshots, and BranchVersions manages the App's version set.

Versions use `createdAtMs`, and sets use `expiresAtMs`, both absolute millisecond times. App-owned database fields can be mapped to these contract fields at the store boundary.

## Durable Professional Tasks

```js
import { defineDurableTask } from '@jangts/agent-core/kits/durable';

export function professionalTask(store, isState, authorize, analyze) {
  return defineDurableTask({ id: 'app.review', revision: '1', isState, authorize,
    steps: [{ id: 'analyze', replayPolicy: 'safe',
      async run(state, context) {
        // analyze binds its real model runner to context.maxModelCalls.
        return analyze(state, context);
      },
    }],
  }, { store });
}
```

The App creates a version=2 checkpoint with definitionId/revision, state, nextStepIndex=0, attemptCount=0, maxAttempts, a fixed execution deadlineAtMs and status=ready; save modelBudget when a cumulative model limit is needed. Initial commitId may be omitted; every new Kit save generates a commit identity. Work starts only when the App explicitly calls run({ taskId }, context).

Use safe for replay-safe analysis and reconcile for operations that might already have written. Reconciliation returns completed with full state, not-executed, or unknown, never a plain State; it must not repeat the operation. It queries actual receipts using stable operationId and receives maxModelCalls=0. A temporarily absent record is not proof that nothing happened; retain uncertainty rather than guessing from chat text.

Authorization context.operation is execute, reconcile or read. Interrupted operations first confirm read-only, even after execution time or allowance is exhausted. Confirmed completion spends no new attempt or reservation; not-executed still requires the original execution permissions, deadline and allowance before work can retry. Completed results remain available after the execution deadline with read authorization; the App controls retention and query timeouts.

The App binds execution reservations to actual Runners, without refunds on failure. Lost save acknowledgements are read back under the lock using matching commitId; unconfirmed saves retain the original error. Started saves and read-back settle before lock release. Cancellation prevents result acceptance, not necessarily remote side effects; persistent cancellation is explicit host work. See [Durable](kits.en.md#durable) for confirmation, commit and authorization boundaries.


## Candidate Knowledge and Publication

```js
import { Knowledge } from '@jangts/agent-core/kits/knowledge';

export function publication(store, authorize, verifySources) {
  return Knowledge.defineKnowledgePublication({ store, authorize, verifySources,
    maxCandidates: 32, candidateRetentionMs: 7 * 86400000,
    requiredReads: [{ documentId: 'guide', selection: { mode: 'document' } }],
    maxReadChars: 12000,
  });
}
```

`propose({ revision, document, sources }, context)` uses the same Knowledge compiler to check the complete post-replacement document set and requiredReads, and writes only a candidate. `publish({ revision, candidateId }, context)` re-authorizes and verifies the source versions, validity periods, and publishedRevision, then replaces the official set once with CAS and removes the candidate. `reject` explicitly deletes the candidate. Changing body text or metadata requires a new revision for the document.

Candidate and source deadlines are checked again after asynchronous verification, document compilation, and preparation of the commit snapshot, and only after that check passes does CAS start; a storage commit that has already started keeps waiting for the real receipt and does not falsely claim a rollback because of a deadline passing midway.

The store's revision coordinates all writes, and publishedRevision specifically identifies changes to the official set; a candidate based on an outdated official version must be prepared again. Ordinary knowledge reads build the catalog from record.documents and do not mix candidates in as facts. Human-authored material, cumulative preferences, and experience candidates each have their own sources, permissions, and lifecycles; publication is explicitly authorized by the App, and the model does not obtain permission on its own.

The same instance caches the compile-check result of the most recent record, with a key containing revision, publishedRevision, and the full document content; content changes under the same version number are still re-checked. The cache does not replace store reads, operation authorization, source verification, or validity checks.

A candidate's `createdAtMs`/`expiresAtMs` and a source's optional `expiresAtMs` use absolute millisecond times; `candidateRetentionMs` is a duration. Source expiration cannot be extended by candidate retention.

When runChildren receives a shared Runner, it binds once for the whole group; all children share that budget. A bound parent keeps its existing budget. Reflection likewise binds a shared Runner using the current context before creating its child.
