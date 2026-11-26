# Registration, assembly, and execution

[Back to development handbook](README.md)

## Ordinary tool integration

Prefer putting static tool definitions in a separate, readable, typed manifest, preserving item types with Support.defineTool, and assembling with Support.defineToolCatalog. Each item contains id, kind, description, inputSchema, authorize, execute, and parseOutput; inputSchema provides both jsonSchema and parse; model tools and execution registration consume the same definition. For complete code see [Tool integration](basic-usage.en.md#tools-are-declared-only-once).

Create catalog.bind({ app: context, execution: { signal } }) per request; the model first produces a ToolProposal, and the App then calls runtime.invoke. The latter reuses Core ToolRegistry.invokeAsync, performing input parsing, actual authorization, execution, and output checks in order. When the available set changes, use catalog.select(ids) to project the same manifest, and still check the real identity at execution. This Support adapter does not replace workflows or the business specifications of Kits.

## Two different kinds of registration

| Registered object | Purpose | Update method |
| --- | --- | --- |
| Tools/model capabilities/workflows/checks/output | Declare what the program can do, when it is available, what it accepts, and who implements it | The App compiles manifests and provides the available set by stage and real identity |
| Documents/sections/knowledge versions | Declare what content a given read can see | The App loads sources and creates a Knowledge catalog; on update, explicitly rebuild the catalog and related views |

Adding one knowledge document usually does not require adding a tool. Keep a single `knowledge.read`, and let the catalog authorized for this round provide legal document/section IDs. The model may propose read requests from the provided set, but cannot use them to register arbitrary new handlers, discover disk directories, or publish knowledge.

## What a manifest should state

At minimum it should be possible to read: stable identifier, purpose, input and output, real execution entry, availability conditions, read scope, side effects, errors, and receipts. Derive the model-visible catalog, schema, and reference validation from the manifest wherever possible; do not maintain one prompt capability list and another actual execution list.

- `ModelToolRegistry` registers the structures the model can propose along with `inputSchema` and `resolve`. inputSchema.jsonSchema is used for model declarations; business parsing, value ranges, and authorization must still be enforced by the program.
- `ToolRegistry` registers `id/kind/parseInput/execute/parseOutput`. invoke is for synchronous implementations; invokeAsync waits for asynchronous execution before checking output and recording results; do not hand a Promise to the synchronous entry as a completed result.
- `AgentCoreEngine` workflow nodes declare `requires/provides/routes/onErrorNodeId`. Only updates that pass cancellation and state contract checks are committed; branches are selected in declaration order.
- `Support.defineContextFragments` assembles request input and fragments. Trust, source, and budget must be correctly labeled by the App; client self-reporting alone is not acceptable.
- Knowledge, Answering, Presentation, Interaction, Domain Tools, and Tools each own local contracts and are chosen according to business needs. They are not automatically installed by Core.

For named constructors, static helpers, and instance methods see [Core](api/core.md), [Support](api/support.md), and [Kit](api/kits.md).

## Separate model proposals from actual execution

```text
Server establishes identity and the available capability view
  → model proposes capability + parameters
  → Core collects the complete response, validates with inputSchema.parse, then calls the registered resolve
  → App selects the actual execution entry
  → tool parameter parsing → authorization by server-side identity → execute → output checks
  → program records actual sources/execution receipts
  → generation, checks, binding, and delivery
```

`parse` should not incidentally perform writes, send messages, or call business tools. Nor should a success receipt be generated merely because the model says it is "done". Using the Interaction Kit for cross-end actions merely selects an optional exchange specification; the App still needs to implement peer handlers, identity, permissions, and confirmation of actual results.

## Static manifests and in-request views

Known tools and local protocols are suitable for registration at startup. Authorization, page environment, current tenant, and allowed knowledge change per request and should be projected into the visible set during this round's assembly. Model visibility limits do not replace execution-time authorization.

When new documents must be available immediately: load new knowledge → validate catalog and task references → build a new version catalog → atomically switch the App's current reference. Existing requests keep their old catalog and snapshots; new requests use the new catalog. Do not mix body text, schema, sources, and revisions from before and after the reload within the same answer.

When program tools must genuinely be added dynamically, the App explicitly decides the code source, publication, and registration point, and reconstructs the corresponding registry. The library has no model-driven arbitrary code installation, automatic file discovery, or hot-unloading platform.

## Checks at startup and per request

| Timing | What to check |
| --- | --- |
| Startup/publication | Whether handlers exist; whether node and output references are valid; whether knowledge/sections exist; whether the Skill's tools are actually registered; whether parameter schema and parser agree |
| Request start | Identity, knowledge access scope, budget, signal, current catalog revision, and capability set |
| Before real execution | Current permissions, resource ownership, parameter value ranges, and necessary confirmation |
| Before delivery | Tool result contracts, sources and numbers, generated fields, program-bound fields, output completeness |

A Kit's validator can only validate the local structure it knows about. It does not know your tenants, storage paths, data permissions, or business facts; these checks cannot be omitted just because "a creator was used".
