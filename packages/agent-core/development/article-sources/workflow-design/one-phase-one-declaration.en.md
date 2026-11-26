# Prepare a model decision from one capability catalog

A ticket workflow has two model stages. The first proposes either a ticket lookup or a change-log read. The second explains the result using execution receipts. Even with one tool catalog, hand-maintained prompts, selection schemas, and parsers can expose stale names or the wrong write scope.

## Select the current capabilities from the catalog

Use `Support.defineToolCatalog` for descriptions, model-visible schemas, parsers, authorization, and execution. Build the stage's `Support.createModelInteraction` from the tools available for that decision. The model sees the choices needed at this stage. A broader domain catalog can still describe stable application goals. To measure or inspect a call before sending it, use the Runner's prepared handle and invoke with that handle and the intended input.

Operation IDs and arguments returned by the model are proposals. Bind the tool runtime to trusted request context, invoke the registered operation, and read its actual `value`. Authorization is evaluated at execution, including when permissions changed after selection. Build the explanation stage from the receipts it needs.

## Add checks at the real call boundaries

Capture the names and schemas sent to the Provider and assert that they came from the stage selection. Let an underprivileged account propose a registered operation, then assert that execution was denied and the business port was called zero times. Propose an unregistered name and check that the protocol or dispatch boundary rejects it with the appropriate cause.

From an installed project, run `node node_modules/@jangts/agent-core/development/examples/model-protocols.mjs` to see one read-only catalog used across five protocols. The lifecycle matrix can verify which hooks belong to a selected stage. [Capability configuration](../../docs/api/configuration-in-workflow.en.md) · [Workflow design Skill](../../skills/agent-core-workflow-design/SKILL.md)

[Technical articles](../README.en.md)
