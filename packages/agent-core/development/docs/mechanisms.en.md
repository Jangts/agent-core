# How the mechanism works

[Back to development handbook](README.md) · [API handbook](api/README.md) · [Knowledge answering contract](api/knowledge-answering.md)

This document explains the current implementation with diagrams. Flows labeled "App composition example" are explicitly orchestrated by the application, not a fixed Agent flow built into Core; Core does not require the App to use Support, Kit, or task decomposition.

## 1. Overall collaboration relationship

```mermaid
flowchart LR
    User[User input] --> App[App: identity, configuration, business orchestration and delivery]
    App -->|calls runtime APIs, registers handlers| Core[Core: execution, model, tools, context contracts]
    Core -->|calls back according to registered contracts| Handler[App handler: business processing and actual ports]
    Handler -->|state updates, results or errors| Core
    App -->|optional integration assistance| Support[Support: builds configuration, adapters and handlers]
    Support -->|artifacts handed to the App for registration| App
    Handler -->|calls as needed| Kit[Optional Kit: knowledge, answering, presentation, interaction, etc.]
    Kit -->|local business results| Handler
    Handler --> IO[App databases, files and external services]
    Core -->|ChatProvider contract| Provider[Model connection provided by the App]
    Provider --> Model[Model service]
    App --> Output[User-visible output]
```

Core and App have a call/callback relationship. Support assists the App in integrating the same set of contracts; Kit is chosen one-way by the App, and a Kit may call Core APIs internally, still bound by the same budget, cancellation, and error contracts.

## 2. How task concepts map to execution mechanisms

```mermaid
flowchart TD
    Question[User question] --> Compose[App organizes this round's processing by business]
    Catalog[Central capability manifest: purpose, schema, constraints, handler] --> View[Capability view visible this round]
    Identity[Server-side identity and resource permissions] --> View
    View --> Compose
    Compose --> Workflow[Optional AgentWorkflow: declares execution nodes and routing]
    Workflow --> Node[Node: requires, run, provides, routes, onErrorNodeId]
    Node --> Handler[App handler]
    Handler --> Model[ModelRunner: obtains model proposals or answers]
    Handler --> Tool[ToolRegistry: executes registered tools]
    Handler --> Tasks[Optional Answering: domain answering tasks]
    Tasks --> Definition[Task declaration: id, inputSchema, readerId, outputId, checkIds, domainToolIds, scopeId]
    Definition --> Evidence[App reader: authorization, actual reading and evidence]
    Evidence --> Items[AnswerItem: source status and owning input ID]
    Items --> Answer[Generation, checks, local repair and delivery status]
    Model --> Update[Handler returns results or local state updates]
    Tool --> Update
    Answer --> Update
    Update --> Route[Core commits compliant updates, then selects a route per declarations]
    Route -->|continue| Node
    Route -->|complete| Result[Return to App for delivery]
```

The three concepts here are different: the **user question** is input, a **workflow node** is an execution stage, and an **answering task/item** is a domain object of the Answering Kit. One node can process multiple answer items; model proposals do not automatically create workflow nodes or install new handlers. A basic `ModelRunner.invoke` call needs neither a workflow nor answering tasks.

## 3. How a Core workflow advances

Corresponds to the actual rules of `AgentWorkflow` and a bound `AgentCoreEngine.run`.

```mermaid
flowchart TD
    Definition[App declares workflow manifest] --> Validate[Validate on construction: nodes, route references, reachability, bounded cycles]
    Validate --> Entry[entryNodeId corresponds to a startsRound node]
    Entry --> Abort[Check cancellation, obtain target node]
    Abort --> Round{Node marked startsRound?}
    Round -->|yes| Budget{Enough round budget?}
    Budget -->|no| Exhaust[Throw budget exhausted error]
    Budget -->|yes| Count[Consume one round]
    Round -->|no| Enter[Emit enter event]
    Count --> Enter
    Enter --> Requires[Check requires fields]
    Requires --> Run[Call node run, obtain local updates]
    Run --> Commit[Check cancellation, update shape and provides, then commit updates]
    Commit --> Select[Select the first match in routes order]
    Select --> Route{Match result}
    Route -->|target node| Transition[Emit transition, clear previous node error]
    Transition --> Abort
    Route -->|complete| Complete[Compute result, isResult, check cancellation]
    Complete --> End[Emit complete and return]
    Route -->|no match| Contract[Workflow contract error]
    Requires -.->|exception| Error[Error handling within the node try scope]
    Run -.->|exception| Error
    Commit -.->|exception| Error
    Complete -.->|exception| Error
    Contract --> Error
    Error --> Recover{Not cancelled, not a contract error, and onErrorNodeId present?}
    Recover -->|yes| ErrorNode[Move to the error node with context.error]
    ErrorNode --> Abort
    Recover -->|no| Throw[Throw to the caller]
```

Only entering a node with `startsRound: true` consumes a round; other stages in the same round do not count separately. Every possible cycle (including error routing) must pass through a round boundary. When the entry node omits the field, it starts a round by default. The budget entry check is outside the node's try scope, so exhaustion is not routed to that node's onErrorNodeId. `run(step)` uses an explicit StepOutcome: `{ type: 'continue' }` to continue, `{ type: 'complete', value }` to complete; value may legitimately be undefined.

The commit guard covers only local state updates managed by Core; it does not roll back external writes that the handler has already performed. A failed diagnostic observation does not change business execution.

## 4. Timing from model proposal to actual tool execution

**App composition example**: uses the Support tool catalog, ModelRunner, and the Core tool executor.

```mermaid
sequenceDiagram
    actor U as User
    participant A as App orchestration
    participant S as Support tool catalog
    participant M as ModelRunner
    participant P as ChatProvider / model
    participant T as Core ToolRegistry
    participant H as App tool handler
    U->>A: asks a question
    A->>S: Obtains capability view and in-request runtime from the same manifest
    S-->>A: Model declarations, parsers, real execution registration
    A->>M: invoke (input and registered interaction)
    M->>M: Check cancellation, call quota, input and schema budget
    M->>P: stream (input and visible tools)
    P-->>M: Model chunks
    M->>M: Full collection, protocol parsing
    M-->>A: ToolProposal (tool name and raw parameters)
    A->>T: runtime.invoke (tool name, parameters)
    T->>T: Look up registered tool, parseInput
    T->>H: authorize (parameters, server-side context, signal)
    alt Authorization passes
        H-->>T: Allowed
        T->>H: execute, and wait for actual I/O
        H-->>T: Actual result
        T->>T: parseOutput, record success event
        T-->>A: Validated result
        opt App needs to continue generation based on the result
            A->>M: invoke (tool result and follow-up input)
            M->>P: Generate within the remaining quota
            P-->>M: Complete response
            M-->>A: Parsed result
        end
        A->>A: Business checks, bind facts and deliver
        A-->>U: Final reply
    else Authorization denied or execution/output check fails
        H-->>T: Denied or exception
        T-->>A: Error and failure event
        A-->>U: App handles the failure according to the actual cause
    end
```

The error branch in the diagram also covers input/output check failures in the Registry itself, where a handler call may not occur. A model proposal is not a success receipt, and Core does not automatically execute a tool just because the model proposed its name; whether to call it subsequently, generate again, or end is decided by the App handler/workflow. A failed tool output check also does not mean side effects that already occurred are rolled back.

## 5. Internal flow of one model call

```mermaid
flowchart TD
    Invoke[invoke: normalize input, select registered interaction] --> Initial[Check cancellation and remaining call quota]
    Initial --> Prepare[Prepare or reuse this transport snapshot]
    Prepare --> Assemble[Core assembles text, messages, BuiltContext or ContextPlan]
    Assemble --> Check[Actual message, transport instruction, Schema and optional token budget checks]
    Check --> Consume[Obtain model call quota, set call deadline]
    Consume --> Stream[Provider stream: collect chunks and check output budget]
    Stream --> Finish[Complete response: finish, parse, resolve]
    Finish --> Deliver[Await content delivery in order, check cancellation]
    Deliver --> Journal[Commit Journal and completion information]
    Journal --> Result[Return value and invocation]
    Stream -.->|cancellation, timeout, upstream or output error| Error[Mark stage and error code and throw]
    Finish -.->|protocol parsing failure| Error
```

Core is responsible for generic input assembly and final budget checks and does not implicitly select or compress. When processing is needed, the App registers Support or custom processing nodes into the same Workflow and uses ordinary routes to decide when to execute them. Model calls inside processing nodes share the request quota, cancellation, and deadlines; see [Context nodes](api/context-processing.md) for details.

An ordinary invoke does not require prepare in advance. When early measurement is needed, use `model.prepare(...)` to obtain a single snapshot, call `prepared.measure(input)` repeatedly, then still consume the same handle through `model.invoke({ input, prepared })`. Measurement covers the actual transport instructions and Schema; the final check remains in effect, and the handle is not a quota reservation.

`ModelRunner.sink.output` waits in order for consumers of generated chunks, and the fully parsed value is still returned through invoke; `execution.observe.event` is side-channel observation with isolated failures. Chunk preview and final business delivery are different boundaries.

## 6. Task checks and local repair in the Answering Kit

Corresponds to the seven nodes currently registered by `defineAnswerFlow`; this flow exists only when the Kit is adopted.

```mermaid
flowchart TD
    Input[Validate input IDs, item ownership and count] --> Generate[generate: generate only source=ready items]
    Generate --> Validate[validate: local checks and keep normalized values]
    Validate --> Review[review: review per off / optional / required policy]
    Review --> Select[select-repair: select items that are ready and still have issues]
    Select --> Can{Failed items, repair count and call quota available?}
    Can -->|yes| Repair[repair: consume one repair chance, submit only failed items and issues]
    Repair --> Recheck[recheck: re-check only items generated this time]
    Recheck --> Select
    Can -->|no| Deliver[deliver: judge item by item]
    Deliver --> Accepted[accepted: source ready, value present and checks satisfied]
    Deliver --> Fallback[fallback: App fallback provided a value]
    Deliver --> Blocked[blocked: no deliverable value]
```

Initial generation and each repair consume one workflow round; `maxRepairs` additionally limits the number of repairs. `canInvoke` reads the real quota provided by the App, and the Kit does not create an extra model budget. Non-ready sources do not enter generation or repair; items whose review has explicitly failed cannot become passing because review later becomes unavailable. Cancellation, invalid item ownership, and program contract errors throw, and are not automatically disguised as fallback.

## 7. Composition timing of App knowledge answering

The diagram below illustrates an App composition organized by the [Knowledge, Answering, and Presentation contracts](api/knowledge-answering.md); the concrete orchestration and ports are provided by the App. For complete code that can be copied and run directly see [Offline service answering](examples/offline-agent.md); that code does not enable Knowledge/Answering.

```mermaid
sequenceDiagram
    actor U as User
    participant A as App answer
    participant T as Answering task catalog
    participant K as Knowledge / App reader
    participant F as Answering Flow
    participant M as Same ModelRunner
    participant C as App checks and review
    participant O as Presentation
    U->>A: question, signal
    A->>T: Parse task parameters and read
    T->>K: Call the registered reader
    K->>K: App authorize, read the fixed revision snapshot
    K-->>A: Question and source evidence
    A->>F: Run declared answer items
    F->>M: generate: call with evidence
    M-->>F: Draft
    F->>C: Local checks and policy review
    C-->>F: Check results and issues
    loop issues remain and repair count, real quota allow
        F->>M: Repair only failed items
        M-->>F: Repaired draft
        F->>C: Re-check and review
        C-->>F: Latest check results
    end
    F-->>A: accepted / fallback / blocked
    opt A deliverable value exists
        A->>O: Bind program source fields and render the template
        O-->>A: Body text and sources
    end
    A-->>U: status, text (if any), issues
```

If review uses a model, it should consume quota through the same ModelRunner passed in. Fallback evidence and allowed wording are provided by the App; when no deliverable value is provided, blocked is returned. Authorization, reading, cancellation, or contract errors may be thrown directly, with no guarantee of reaching final delivery.
