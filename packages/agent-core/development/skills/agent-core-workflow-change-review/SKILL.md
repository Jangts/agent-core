---
name: agent-core-workflow-change-review
description: Review two registered Agent Core workflow snapshots to identify changed routing, tool schemas, adapters or handler contracts and the nodes directly affected. Use for baseline-to-candidate review before merging an App workflow change.
---

# Review an Agent Core workflow change

Use the App's installed SDK. The [development handbook](../../docs/workflow-development.en.md#review-a-declaration-change) gives the invocation for `development/scripts/workflow-diff/cli.mjs`.

1. Identify the intended baseline and candidate. Reuse their actual exported registrations or export each from its declaration-only entry. Preserve the revision and source information for reference. If a baseline cannot be obtained, explain the evidence available and the comparison that remains open.
2. Run the diff with `--json`. Start from changed route priority, recovery targets, field requirements and parameter schemas. Trace the affected nodes and each adapter's binding on both sides. Inspect the actual handler or condition when a stable ID still points to changed implementation.
3. Report incompatible or unintended changes with the old and new contract, the affected consumers and a source location. A missing optional inventory leaves that part of the review open. The affected-node list contains direct references. Use recorded execution or an offline case when route selection, access checks or side effects need verification.

A declaration diff cannot prove unchanged handler behavior, dynamic authorization or semantic quality. Compare boundary benefit with handoff and recovery costs; do not prefer business-named nodes solely by name. No diff findings does not approve the design.

For a worked comparison with common facts and effects, see [the organization example](../../docs/examples/organization-comparison.en.md). Compare the current registrations together with handler outputs and failure behavior; the example organizations are alternatives to evaluate, not a required migration direction.

For reply wording, input/output formats, style or reference design even when the graph is unchanged, use [reply development](../agent-core-reply-development/SKILL.md). Keep fully model-driven, program-driven and hybrid choices valid.
