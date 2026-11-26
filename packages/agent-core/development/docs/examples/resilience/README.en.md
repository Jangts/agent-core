# Preserve confirmed work and bound recovery

A report is saved and then its detail fails to generate. The user can receive an accurate account if the App distinguishes a business receipt, an unconfirmed operation, and a message that has yet to reach the client. Run the offline cases to check those boundaries before applying the assertions to real ports.

## Run the cases

Use Node.js 22.12 or newer in a project with Agent Core installed.

```sh
node node_modules/@jangts/agent-core/development/docs/examples/resilience/request-recovery.mjs
```

The [example source](request-recovery.mjs) uses in-memory ports and asserts every outcome. The write count tracks operations received by the simulated port. The receipt represents what the App can confirm.

| Injected failure | Expected outcome | Invariant |
| --- | --- | --- |
| Detail format rejected after saving | `source: 'recovery'` repairs detail from the original receipt | One write, one repair |
| Repair also fails | `source: 'fallback'` confirms the save and reports unavailable detail | The same receipt survives and both errors remain available |
| A simulated write loses its acknowledgement | `status: 'unconfirmed'` | No receipt or success message, one write |
| Optional audit throws | Deliver the confirmed result | Check observations retain the audit error |
| Request cancelled after saving | End with cancellation | Retain the receipt and skip both repair and fallback |

## Limit recovery to confirmed work

The main operation stores the receipt as soon as it obtains one. Use `defineCompletionChecks` to distinguish required delivery format from an optional audit. On a format failure, the recovery function passed to `createRequestRecovery` reads the existing receipt and replaces only the detail. The synchronous fallback reports what the receipt establishes and retains the errors for diagnostics.

When a write is unconfirmed, use a stable operation identity to query the authoritative receipt. Retry only after the port confirms that it did not execute and current authorization and original limits still permit the operation. The in-memory example preserves uncertainty. Verify cross-process storage, exclusion, receipt lookup, and redelivery with the actual ports. Cancellation stops ongoing work. The business receipt remains the authority for an effect that already occurred.

Test that an execution-only timeout leaves room within the outer request deadline for recovery. Test user cancellation separately. Keep the failure stage in diagnostics. The host's delivery protocol and message records determine whether the response reached its client.

[Resources, completion, and recovery](../../api/reliability.en.md) · [Cross-process waiting and confirmation](../../../examples/harness-durable.en.md) · [Workflow development and verification](../../workflow-development.en.md)
