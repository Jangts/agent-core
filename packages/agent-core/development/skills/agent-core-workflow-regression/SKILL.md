---
name: agent-core-workflow-regression
description: Add, run or diagnose offline regression cases for an App using Agent Core. Exercise the actual Engine with scripted model replies and synthetic dependencies to verify results, routing, denied access, recovery and model call counts.
---

# Test an Agent Core workflow offline

Read the [offline scenario contract](../../docs/workflow-development.en.md#run-offline-cases) and the [packaged fixture](../../examples/workflow-scenarios.mjs). Run the fixture with `development/scripts/workflow-scenarios/cli.mjs` from the App's installed SDK.

1. Pick a request whose behavior matters, such as a route that changed or a denied request that must recover without calling the model. Use the App's real workflow factory, pass through the supplied `execution` and scripted `provider`, and inject synthetic replacements for external ports. Check the fixture's top-level imports before running it.
2. State the expected behavior with Node assertions. Check the returned value or rejection, the observed route or recovery when relevant, and the important call counts or effects on fixture dependencies. Give a fresh state and dependency instances to each case. Include only the scripted replies that the case should consume.
3. Run the relevant case with `--case`. Diagnose a failure against the observed events and the fixture's wiring. Change the expectation only when the intended App behavior changed. Report the case coverage and any runtime behavior that still needs real-model or integration evidence.

Assert progress and effects, not merely absence of exceptions or expected node count. For loops, include a no-progress response sequence and verify bounded exit or replanning. Scripted replies demonstrate routing under supplied outputs, not real-model selection quality.

The [organization comparison](../../docs/examples/organization-comparison.en.md) provides a complete task and source regression entry alongside the smaller scenario fixture. Read its actual exported factory and options before adapting it; it is a runnable module, not a workflow-scenarios fixture unless it exports that contract. Preserve assertions for business results and effects when comparing organizations.
