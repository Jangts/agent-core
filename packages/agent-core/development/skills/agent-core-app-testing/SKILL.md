---
name: agent-core-app-testing
description: Build and run an offline test suite for an Agent Core App. Cover complete Agent features, workflow node contracts, and executable tools with App-registered Node.js test cases.
---

# Test an Agent Core App

Use `development/skills/agent-core-app-testing/scripts/test-agent.mjs` from the App's installed SDK. Start with the [bundled runnable fixture](examples/agent-tests.mjs) and follow the SDK handbook at `development/docs/workflow-development.en.md#test-agent-features-nodes-and-tools` for the registration contract.

1. **Pick the smallest boundary that can prove the behavior.** Feature cases send representative requests through the App's real Engine. Node cases run the actual node in a minimal Workflow and assert the committed state and observed route, including failure or recovery where relevant. Tool cases invoke the real binding and assert input validation, authorization, output and the execution receipt. Verify that rejected requests do not reach the effect.
2. **Register cases and isolate dependencies.** Export an `agentTests` array with unique IDs, a `feature`, `node`, or `tool` layer, and a `run({ signal, runScenario })` handler. Use fresh state and synthetic ports per case. Use the supplied `runScenario` when scripted model responses and execution events are needed. Send the case signal through App-owned tool and provider ports. Load trusted fixture modules whose top-level imports are safe to execute.
3. **Cover meaningful boundaries.** For features, include the expected result and denied or incomplete work. For nodes, check prerequisites and route priority as relevant. For tools, cover accepted and rejected inputs, access denial, and invalid output. Check cancellations, budgets, retries, and duplicate effects on paths that actually depend on them.
4. **Run and diagnose.** Select the affected layer with `--layer` or an exact case with `--case`. Use the failed assertion, observed route, and effect count to locate the failing boundary. Report which behaviors were demonstrated by offline tests and where real-model or integration evidence is needed.

Keep evidence levels explicit: static registration, offline behavior, real-model semantics and production outcomes. Passing offline tests or inspection does not approve node boundaries or prove production reliability. Include actual App composition when testing whether optional modules can veto a completed principal result.

For a complete runnable task, follow [the organization comparison](../../docs/examples/organization-comparison.en.md) and its source regression entry. Compare both organizations using the same facts and injected failures; assert outcomes and effect counts rather than approving a node count. Keep untested summary, persistence and delivery behaviors separate from the demonstrated fixture paths.

For reply wording, input/output formats, style or reference design even when the graph is unchanged, use [reply development](../agent-core-reply-development/SKILL.md). Keep fully model-driven, program-driven and hybrid choices valid.
