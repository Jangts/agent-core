# Bounded Agent composition

[中文](harness-composition.md) · [Source](harness-composition.mjs)

This example combines a single model call with a parent workflow wrapping a bounded child Agent, retaining tool receipts and repairing delivery separately. It uses public `@jangts/agent-core` exports, a deterministic Provider and request-local storage. No network or credentials are required.

Run from `main/` with **Node 22.12 or newer** and existing workspace package artifacts:

```sh
node development/examples/harness-composition.mjs
```

The example does not build sources. Stop and report missing or stale artifacts; source changes do not automatically enter this run. No model service configuration is needed.

## Importing and offline validation

Importing the module does not run the example or print logs. `runMinimal()` demonstrates one call; `runComposition()` runs the default probe and assertions. `createComposition({ provider, signal, canSave, saveNote })` returns one request's App assembly. Defaults use the built-in deterministic Provider, an independent request signal, allowed saving and a request-local Map.

Supply `provider` to replace model I/O, `signal` to bind cancellation and `canSave: false` to reject authorization. Optional `saveNote(note, context)` is an App save port; context includes the request lifetime and example receipt. The local receipt is recorded only after this port returns. A save port may complete after cancellation; the App must reconcile actual side effects.

Targeted checks use the real public MockGPT entry and `CompatibleModelProvider`, with `mock.fetch` serving HTTP/SSE without network access. They require the workspace's existing optional `@jangts/mock-gpt` package and artifacts:

```sh
node --test test/harness-composition.test.mjs test/harness-mockgpt.test.mjs
```

Cases cover shared budgets, rejected authorization, delivery repair without replaying saves, charging failed HTTP 429 attempts, rejecting a late model choice after cancellation, and preventing a late noncooperative save from becoming a successful child result. These are specific fault points, not exhaustive cancellation coverage.

## Execution path

The single-call example constructs `ModelRunner({ provider })`. The parent and child workflows use one explicitly request-bound parent Runner:

1. The parent Workflow spends one model call preparing the input.
2. An ordinary parent node derives a child Runner with `createChild`, then passes it to the child Engine through `bindModelRuntime`. The child Agent owns its state, a decision loop bounded to two rounds and a tool catalog. The model chooses saving; the authorized tool executes; the Agent returns a draft and receipt.
3. The parent commits that result before checking delivery format. The draft deliberately violates the JSON contract.
4. The check node routes through `onErrorNodeId` to one delivery repair. Repair reads the confirmed receipt, never routes back into the child and has no parent tool runtime.

The parent allowance is 4 calls. The child may spend 2 and must reserve 1 parent call for repair. Parent preparation and repair cost 2 calls, plus 2 child calls. Assertions require both actual Provider calls and parent `totalCallCount` to equal 4. A fifth attempt must raise `BudgetError` before reaching the Provider. Instrumentation observes consumption; ModelRunner enforces it.

A second path rejects tool authorization: one authorization check, zero saves, zero repairs and two total model calls. Authorization rejects by throwing. Model text and tool schemas grant no permissions.

## Integration boundaries

- The App retains the request-bound parent Runner in a closure to derive children; `WorkflowContext.model` does not expose `createChild`. Constructing another Runner with identical settings does not share its ledger.
- Parent Engine and Runner share the request signal. The child also receives the node signal and a timeout; child tools use that child lifetime. Targeted checks cover the two cancellation points above, not all races.
- No persistent diagnostic output port is configured by default. Optional observer regression covers parent/child metadata correlation and single event delivery, but not full streaming-content ownership or diagnostic storage.
- The save port is a request-local Map. One save proves that this format-repair path does not replay the tool; it does not prove persistence, idempotency, crash recovery or external exactly-once behavior.
- Deterministic responses verify program paths, not real-model tool selection, semantic quality, injection resistance or repair quality.
- Persistent waiting, cross-process recovery, parallel result merging, resource cleanup faults and external LangChain integration remain outside this slice. No Core API or special Agent-node protocol is introduced.

A successful run prints `r0` and `r1Probe` with delivery, call sequences and parent/child consumption. Any failed assertion exits nonzero. Results apply to the Node executable and package artifacts actually used.

Pass `observe` to `createComposition` to inspect metadata. The regression checks four distinct model starts, one tool call and one shared run identity, without duplicate event delivery when the same observer is bound through both Runner and Engine.
