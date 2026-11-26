# Ordinary handlers versus workflow composition

[中文](harness-handler-comparison.md) · [Source](harness-handler-comparison.mjs)

Both versions perform the same deterministic task: prepare input, let a child model choose saving, authorize and save once, retain the receipt, then repair only a malformed delivery. With Node 22.12+ and existing SDK artifacts, run from the project root:

```sh
node development/examples/harness-handler-comparison.mjs
```

The ordinary handler uses the existing ModelRunner, actual parent/child ledger and tool catalog, with explicit sequencing and parse-error recovery. The recommended version reuses the bounded workflow example. Assertions compare delivery and actual Provider sequence: four calls, an extra call rejected before Provider entry, and no save or repair when authorization is denied. No second execution engine, network or credentials are involved.

| Decision or guarantee | Ordinary handler | Workflow composition |
| --- | --- | --- |
| Budget, schema and authorization | Reuse Core/Support | Reuse the same Core/Support guarantees |
| Stable dependencies | Bind once through the closure | Bind workflow and runtimes once |
| Next action | Sequence and explicit error handling | Nodes, declared routes and onErrorNodeId |
| Child-result acceptance | Retain the receipt explicitly and keep repair away from the tool | Return a patch for Engine acceptance; route repair explicitly |
| Execution diagnosis | Model/tool events exist; the App organizes phases | Engine records node entry, transition, error and completion |
| Added concepts | A tiny fixed task needs no graph | Nodes, patches and routes add concepts; branching and recovery can justify them |

This does not prove workflows are always simpler or ordinary handlers are unreliable. Small fixed tasks may be clearer as functions. Declared workflows help when execution paths, independent recovery and reusable nodes matter. Shared budget and authorization benefits come from actual Core/Support, not from graph syntax alone.

Equivalence assertions cover the normal, denied and budget paths only. Dedicated regressions cover cancellation races, observer identity, persistence and parallel tasks; this comparison does not prove equivalence under every fault.
