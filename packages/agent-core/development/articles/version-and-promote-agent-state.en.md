# Save branch versions and promote them explicitly

A help application wants to trial a revised answering policy while continuing to serve the active policy. Save the change as a branch candidate and explicitly promote it after checking evidence and authority. A request's current execution step has its own runtime record.

## Save data the application needs to restore

Use the Engine's `exportSnapshot` to export serializable host state with its full branch identity. Construct a matching Engine before calling `restoreSnapshot`, and bind the current tool, authorization, and request dependencies. A snapshot holds data. Use durable task records when the application needs to resume an approval or reconcile an interrupted write.

## Keep candidates and the active version readable

`defineBranchVersioning` owns the version set. `fork` from the active version or use the application's three-way merge to prepare a candidate. Report conflicts when branches change the same field incompatibly. Promotion supplies the set revision, candidate ID, and expectedActiveId, and checks current evidence and authority. The host store atomically writes the version set and activeId through `compareAndSwap` so concurrent approvals cannot overwrite one another.

Test two candidates against the same active version. After the first candidate is promoted, submitting the second with its old base should fail. Revoking publisher authority should also leave the active version intact. Run `node node_modules/@jangts/agent-core/development/docs/examples/branch-promotion.mjs` to verify candidate persistence and stale-base rejection. [Example source](../docs/examples/branch-promotion.mjs) · [Branches and promotion](../docs/api/advanced-agents.en.md) · [Change review Skill](../skills/agent-core-workflow-change-review/SKILL.md)

[Technical articles](README.en.md)
