---
name: agent-core-reply-development
description: Guide the design or review of Agent Core App replies, including processing choices, input/output formats, style, references and evidence. Use for answer behavior even when the workflow graph is unchanged.
---

# Develop an App reply

Use the App's installed SDK and actual entry/use-case registration. Read [Reply organization](../../articles/reply-organization.en.md) for format choices and worked counterexamples. Core owns execution contracts; the App owns business meaning, permissions, facts and copy.

Fully model-driven, program-driven and hybrid replies are normal choices. Look for useful opportunities to prepare data or bind output, without treating the absence of either as a defect or requiring an exemption. A reply can also be an appropriate UI result with no assistant text.

## Guide a design

Start with the concrete request, current entry and required result. Use the [design and review card](references/design-card.md) only for relevant decisions. Identify the selected processing method, fact/structure/wording ownership, style and reference purposes. Compare alternatives when there is a real tradeoff, rather than designing three solutions for every question.

Deliver a concrete or conditional reference answer, necessary facts and prohibited inferences, a usable input/output example, App integration points and focused failure cases. Open-ended tasks may use evaluation criteria instead of a unique expected answer. Style examples are not current business facts.

Choose ordinary text, tables, structured values or a constrained template according to the task. Existing Presentation, Knowledge and Answering contracts are available options, not required stages. Async reads precede synchronous output providers. Validate a model-proposed template before binding; a valid slot does not prove its label, unit or surrounding claim correct.

For overly long replies, inspect the actual model input instead of only adding another document. On user-facing calls, consider optional `replyGuidance` resolved from trusted App defaults, the selected node/tools and call configuration. The article shows `Support.resolveReplyGuidance`, precedence and conflicts. Keep explicit user detail/format requests and output protocols intact; do not enable it on every reasoning call or claim hard length control. Put richer tone/audience/reference guidance in task-appropriate trusted context.

Use [workflow design](../agent-core-workflow-design/SKILL.md) when node handoffs or recovery change. Keep authorization, prepared actions and committed effects with their original owner.

## Guide a review

Trace the observed answer to the actual question, facts, references and applicable style. Separate factual/logic errors, unsuitable expression, structural/reference errors and possible optimizations. Do not reject a correct fully model-driven or untemplated reply for its architecture.

Use [the snapshot contract](references/snapshot.md) and scripts/check-replies.mjs when declared entry/output/reference relationships or reported evidence need a repeatable check. The default tool only reads one local JSON file; it does not import an App, run providers or validate receipt contents. A structurally consistent report is not semantic approval.

For behavior, reuse [App testing](../agent-core-app-testing/SKILL.md) with trusted fixtures. The runner imports the fixture before selecting cases: --case is not a sandbox. [The examples](examples/facts-and-reference.mjs) and [presentation/style examples](examples/presentation-and-style.mjs) use synthetic inputs and scripted models, not live services.

Deliver the triggering case, evidence and scope, exact failing boundary, user impact, proposed correction and focused regression. Keep source review, semantic/style review, offline behavior, real-model and UI evidence separate. An extracted paragraph, nonempty answer, empty check set or Answering accepted result does not establish semantic correctness.

Repair wording from retained facts/receipts; never replay a completed action to improve a sentence. Use [change review](../agent-core-workflow-change-review/SKILL.md) for changed registered contracts and [recovery guidance](../agent-core-resilience-review/SKILL.md) where needed. Preserve the user's existing execution permissions; do not silently start a service, model run or browser.
