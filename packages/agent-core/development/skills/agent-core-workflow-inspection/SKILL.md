---
name: agent-core-workflow-inspection
description: Inspect an App's Agent Core workflow during development. Export registered nodes and routes, trace tool and adapter references, and generate an interactive HTML report. Review a specific recorded run when an authorized WorkflowRunTrace is available.
---

# Inspect an Agent Core workflow

Read the installed SDK's [inspector manual](../../docs/workflow-inspector.en.md) and [workflow view contract](../../docs/api/workflow-views.en.md). Use the SDK's `development/scripts/workflow-inspector/cli.mjs` from the App directory. If this Skill was copied separately, resolve the installed SDK first and read those files there.

1. Find the App's actual registration. Use a trusted, declaration-only JavaScript module exposing `workflow` or `inspection`. Reuse the production definition and public catalog. Keep service initialization, I/O and handler execution outside the entry being imported. Use an existing JSON export if the App cannot safely import the declaration by itself.
2. Add optional node, tool, adapter and condition metadata from explicit declarations or source locations. Preserve route order, directed edges, loops and recovery edges. Identify a condition by node and route order. Leave unresolved details absent. Keep adapter-specific contracts separate, and inspect schemas for private content before exporting.
3. Run `inspect` for an offline HTML report or `watch` with explicit `--source` paths. Include dependencies that can change the exported definition. Use `--serve` only when a local viewer is wanted. Keep the latest valid report when an export fails, and identify it as stale.
4. For a historical run, use a supplied, authorized `WorkflowRunTrace` captured using `toTrace(runId)` and pass the exact `--run-id`. Preserve separate span visits, gaps, coverage and historical names. Check authorized scope before acquiring or sharing evidence. The report's registered graph shows possible paths. Observed transitions and status come from the chain.
5. Deliver the report and explain the inspected sources, unresolved references and the evidence available for the requested question. Keep cross-node tool usage distinct from graph edges. Static declarations alone cannot establish runtime tool authorization, policy decisions or successful completion.

Report design concerns separately from tool findings. No warnings means only that the inspected declarations triggered no checks. Review inputs, outputs, effects, completion, progress and failure ownership in actual handlers before judging boundaries. Loops and technical stages are not intrinsically defects; repeated visits without progress need behavioral evidence.

Use [the organization comparison](../../docs/examples/organization-comparison.en.md) to relate graph organization to actual visits, invocation counts, results and receipts. Read its current output contract before interpreting budget snapshots or projection sizes. Tool order is not a topology edge, and multiple visits to one node must remain separate visits.

For a stage/tool matrix, read the [executable matrix reference](../../docs/examples/lifecycle-matrix.en.md). Preserve combined intent/next decisions when suitable; derive stage, hook, handler, all/selected mode and intent scope from actual registration. Export optional `lifecycleMatrix` for inspector/diff; associate authorized `toTrace` subflow records through stable binding IDs. Missing records remain unobserved, not proof of non-execution. Review pairing rejection, visibility and live authorization, retained results, budgets and cancellation; do not replace a valid matrix with use-case nodes merely to match another App's graph.
