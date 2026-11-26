# Result delivery, diagnostics, and operations

[Back to development handbook](README.md) · [Core API](api/core.md) · [Support API](api/support.md)

## Boundary of each run

Keep startup manifests separate from per-request state. For each request, establish identity, the allowed knowledge view, an `AbortSignal`, model/tool budget, and source and output state. Credentials, endpoints, model characteristics, and error mapping for connecting to the Provider are managed by the App server, and user materials or model parameters are not allowed to override these configurations.

Consider rounds, model call counts, timeouts, message and output characters, schema size, and business tool quotas separately. Repair, review, and fallback also consume budget; a step called "recovery" cannot mean unlimited retries. Core's model call budget covers only calls that actually pass through that runner; external HTTP, background jobs, and model calls made by the App itself must be limited by the App.

Cancellation must reach the actual model and business I/O; for writes already started, cancellation does not mean rollback. The App should be able to judge whether an operation has executed by idempotency key/real receipt, and query state before retrying. Synchronous ToolRegistry does not wait for arbitrary Promises; asynchronous business logic should be placed in suitable asynchronous handlers/nodes and must not fake synchronous success.

## Verify facts first, then form presentable output

```text
Parsed model proposal
  → authorization and real execution
  → input/output contracts and source checks
  → generate candidate reply
  → completeness/business fact checks
  → program binds sources, action states, and links
  → deliver in the form chosen by the App
```

A Knowledge Snapshot is a source reference, a tool event is an execution record, and model text is a candidate explanation; the three do not substitute for each other. Answering's tasks, checks, and bounded repair help organize this chain; the concrete fact checks are provided by the App. See the [knowledge answering API](api/knowledge-answering.md) for the relevant local contracts.

Presentation/Interaction is an optional Kit. InteractionProtocol/CommandCatalog does not determine how the App exchanges data between front end and back end; when used, the App registers commands, parsing, and presentation implementations, and still needs actual receipts from the peer. The App may also directly adopt its own HTTP/SSE/event protocol.

## Error exits

| Actual cause | Program handling | Direction of user-facing wording |
| --- | --- | --- |
| Source not provided or not allowed to read | Do not widen permissions, do not generate fake facts | State which kind of available knowledge is missing |
| Parameters or output violate the contract | Record the specific stage and code; repair or end within budget | State the actual action not completed this time |
| Provider stream break/timeout | Save known execution state, retry with bounds | Reply incomplete, can retry |
| Insufficient budget/read limit exceeded | Narrow the legal scope or split the task | State the scope limit; no silent truncation |
| User cancellation | Stop cancellable work, verify executed operations | State clearly that it stopped and what is confirmed |

Error messages should not show internal schemas, tokens, call protocols, or stack traces verbatim. Logs keep machine-locatable fields, and user copy keeps the accurate cause; not every failure should be described as a connectivity problem.

## What observation and persistence each own

Core's run records/diagnostics and Support's Provider observer provide observation boundaries; they do not automatically create a log database. The App decides whether to output to the console, files, telemetry systems, or a persistent repository, and how to authorize queries, redaction, and retention. `breakWhile` tags are classification hints for interruption, not permission or rule filtering switches; follow the [Support reference](api/support.md).

It is recommended to correlate request/run, stage, model or tool call ID, business error code, knowledge revision/snapshot id, and actual duration. By default do not collect credentials, full prompts, user materials, or model body text; when body-text diagnostics are needed, the product must explicitly enable and limit the scope. Observation callbacks should not change business returns or escalate a record failure into duplicate execution.

## Publication and recovery

Deliver code manifests, knowledge, task references, and configuration as one verifiable version. Validate references before publication and prepare a rollback version; new requests switch to the new catalog while existing requests hold old snapshots. Whether multi-file or database publication is atomic is implemented by the App; the Knowledge in-memory catalog itself provides no storage transactions.

When the App publishes, also state the enabled tools, knowledge version, configuration, and changes in externally visible behavior; the new version must still preserve the original permissions, budget, cancellation, and delivery guarantees.
