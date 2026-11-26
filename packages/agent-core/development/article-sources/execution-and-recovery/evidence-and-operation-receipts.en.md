# Reuse evidence and reconcile operation receipts

When a write succeeds, its client may still see a timeout. Before retrying, distinguish the evidence you read, the receipt for the original operation, and the record of delivering a reply. Each has its own identity and retention rules.

## Check that an existing fact is still applicable

| Object | Identity | Conditions for reuse |
| --- | --- | --- |
| Source evidence | Source, query scope, revision, observation time | Access is still allowed and the evidence applies to the task |
| Write receipt | Stable operation ID, business object, and source | The business port confirms the same logical operation |
| Reply delivery | Request or message ID and saved result reference | Current access and the delivery protocol allow it to be sent again |

An existing result can inform several replies. Check access and revision each time. A different output format can reuse the same facts. On timeout or a failed local save of a confirmed remote result, query the business port using the stable operation identity.

## Use the reconciliation outcome to decide what comes next

Read back the actual effect after confirmed execution. If the source confirms that execution did not occur, check current authorization and the original limits before retrying. Preserve uncertainty when a record is temporarily invisible. Keep reconciliation read-only and give the application ownership of review and subsequent queries. After reconnecting, look up authorized results and resume message delivery under its own identity.

Run `node node_modules/@jangts/agent-core/development/examples/harness-durable.mjs` to observe read-back after losing a save acknowledgement. In the business store, inject a fault after the write commits and before its response arrives. Check the write count, reconstructed result, and message delivery independently. [Cross-process recovery](approval-and-durable-recovery.en.md) · [Change review Skill](../../skills/agent-core-workflow-change-review/SKILL.md)

[Technical articles](../README.en.md)
