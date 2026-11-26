# App integration checks

[Back to development handbook](README.md) · [API reference](api/README.md)

The following are the evidence expected for an integration, chosen by developers according to the tools actually enabled; they are not a full command suite to run on every change. Review what the source can confirm first, and run the minimum relevant checks when a concrete question exists. Success with an offline stand-in does not prove real model behavior, and being executable by the framework does not prove the business facts are correct.

| Boundary | What should be proven | Minimal example |
| --- | --- | --- |
| Independent consumption | Usable from the delivery package, dependencies, and documentation alone | Import from the public exports in a standalone directory, with no application path aliases |
| Empty knowledge preparation | Knowledge stays empty when there are no facts | With no sources in an existing project, knowledge files are empty and the manifest contains no fabricated content |
| Source import | Fidelity of sources and versions | supplied-source bytes match; illegal anchors, duplicate sections, or exceeding limits are rejected |
| Registration and references | The manifest truly drives execution and references resolve | Unknown node/tool/reader/section/check fails explicitly |
| Protocol parsing | Schema is consistent with the actual input checks | Unknown fields, invalid values, and wrong output are rejected; parse has no business side effects |
| Execution | Only the permitted scope is executed, and receipts are real | When the model claims success but nothing ran, success must not be returned |
| Knowledge selection | self/subtree/document boundaries are correct | Child sections excluded/included, unknown IDs, limits, and version changes |
| Isolation | Identity and state do not leak across users | Another user ID is rejected; an old request does not mix into a new catalog |
| Cancellation and budget | Both I/O and retries are bounded | Timeout, cancellation, broken stream, and exhausted repair budget end correctly |
| Output | References and action states are bound by the program | Numbers, sources, links, and incomplete results are checked |
| Growth and maintenance | Candidates are never automatically promoted | Preparing a candidate does not change the effective source; failures keep the old version; broken references are rejected |
| Diagnostics | Errors are locatable and records do not change execution | The same request correlates stage, code, and duration, with no credentials or unauthorized body text |

When long-term memory is chosen, additionally verify message watermarks, concurrent versions, lease recovery, idempotency, deletion propagation, and source priority; if not enabled, these services need not be built. When cross-end operation is chosen, verify the actual peer handler and receipts; not using the Interaction Kit does not prevent integration with Core.

When reviewing similar tools, compare horizontally the ordinary loop, Workflow, standalone Runner, tool catalog, hand-written port, and the Kit in use, and confirm the same guarantee is enforced by the actual entry, not only by validating the recommended Support style. For cancellation, check pre-cancellation, mid-flight cancellation, late returns, and cancellation during persistence separately; for input, check illegal budgets, replacement after registration, and mutable references across awaits; for publication, check validity before and after verification and before commit.

Cancellation cases should also cover cancellation triggered inside synchronous callbacks such as counters, checkers, and observers, plus multiple processing stages within the same node. A Provider stand-in should record both the ordinary `stream()` method entry and reads through the async iterator, so that tests with only a generator do not mask entering an I/O factory after cancellation. Readers ignoring cancellation, evidence expiring during reading, discovery leaving no partially readable range after a pagination failure, and iterator cleanup exceptions not overwriting the original result all need to be verified against their own boundaries.

Reports should distinguish run defects under a normal contract, insufficient rejection of illegal configuration/integration misuse, and internal hardening or performance optimization. Passing regression proves only the boundaries it covers; it cannot replace App permission facts, real storage atomicity, external side-effect receipts, or real model behavior verification, nor does it prove the absence of defects overall.

## Explicit scope of the current template

The development kit provides an existing-project integration guide, plus section parsing and catalog compilation, candidate preparation, a read-only plan, and a shared validation entry. During knowledge preparation, organize actual sources faithfully when they exist and keep empty files when no source exists. The production App's identity system, knowledge permissions, upload parsing, storage transactions, profile merging, experience publishing, and indexing still need to be implemented by the App itself.

For partial code examples see [Quick integration](getting-started.md) and [Examples](examples.md). The [Offline complete example](examples/offline-agent.md) contains copy-and-run service answering code that uses the Support tool catalog and an offline Provider, so no model credentials are required. Verifying real model behavior requires an available model service and App configuration, checking semantic results, tool selection, and completeness separately.
