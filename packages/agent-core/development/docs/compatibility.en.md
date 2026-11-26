# Version compatibility and maintenance

Agent Core's stable contracts cover public entries, types, configuration, defaults, results, error categories, event semantics and declared storage formats. Concept names describe long-term responsibilities rather than changing with implementation details, providers or fashionable terminology.

## Stable, experimental and internal

| Scope | Compatibility rule |
| --- | --- |
| Stable | Publicly documented package exports that are not explicitly experimental are maintained as stable contracts. Aggregate subpaths expose the same implementation, not a second execution mechanism. |
| Experimental | A contract is experimental only when explicitly marked with its scope of change. This designation cannot weaken authorization, identity, budget or cancellation guarantees. |
| Internal | Private implementation details have no stability promise. Readable source, discoverable build files or resolvable private paths do not make their contracts public. |

A public entry cannot be relabeled internal retroactively to evade compatibility obligations. Extensions retain each entry's optional capabilities: operation-only and realtime-only providers need not implement unrelated generation methods.

## The 1.x contract

Breaking changes to stable interfaces normally belong in the next major version. Removal or renaming, narrower inputs, changed result shapes, defaults, error categories or event order, and union additions that require consumer handling all need impact assessment. An additive field or successful type check alone does not establish compatibility.

Budgets, cancellation, authorization, tool-result checks, state acceptance and side-effect guarantees are behavioral contracts. Stopping a wait does not revoke a remote action; a model tool proposal does not authorize execution. Compatibility updates must preserve these distinctions.

Deprecated entries identify replacements. Legacy-name compatibility entries shipped with stable 1.0 remain supported throughout 1.x; removal belongs in 2.0. They refer to the same canonical implementation rather than independent behavior. See [upgrading](upgrading.en.md) for the explicit 0.9 type-migration exception and input bridges.

## Storage formats and the host

Format versions, definition revisions, CAS revisions, operation identities and commit identities have separate meanings. Each format independently chooses unchanged storage, a local compatible reader, explicit migration or rejection. There is no universal multi-version recovery engine. Durable accepts only its declared current format and does not promise arbitrary old-format or workflow-call-stack recovery.

Renaming a type or method does not require rewriting existing storage keys, IDs, deadlines, accumulated budgets or committed receipts. Reading history does not establish resumability. Recovery rebinds host resources and current authorization without restoring credentials or old permission decisions. The host supplies storage atomicity, identity isolation, retention and real external side-effect guarantees.

## Dependencies, external protocols and security fixes

Runtime, dependency and optional-peer requirements are defined by the package manifest and the relevant interfaces. Ordinary paths that do not use an optional dependency remain usable without it. New dependencies and higher environment requirements require compatibility assessment.

Provider capabilities apply only to declared protocols, endpoints, models and lifecycles. Compatible protocols do not establish product-wide equivalence. Simulator, provider-service, local-transport and media-device evidence are distinct. Unobservable provider costs, production capacity and availability are not unlimited guarantees of this library.

A security fix requiring behavioral changes should state its trigger, affected scope, replacement and version boundary; it must not silently change default authorization or replay behavior. A useful issue report includes a minimal public-interface example, versions, runtime, error category and redacted diagnostics. Do not supply keys, credentials or raw private state. This policy promises no fixed response SLA, support lifetime or production throughput.
