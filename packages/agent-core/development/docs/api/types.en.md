# Shared types and behavior contracts

## Common Tool contract and extensions

BaseTool is the common model-facing interface. Subtypes add actual contracts rather than names for different uses.

```ts
interface BaseTool<Input = unknown, Selection = Input, Context = any> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: SchemaAdapter<Input>;
  readonly active?: boolean | ((context: Readonly<Context>) => boolean);
  readonly asIntent?: true | string
    | ((context: Readonly<Context>) => boolean)
    | {
        readonly description?: string;
        readonly when?: (context: Readonly<Context>) => boolean;
      };
  resolve(input: Input, context: Readonly<{ stageId: string }>): Selection;
}

interface ExecutableTool<Input, Output, App>
  extends Omit<BaseTool<Input, ToolProposal, App>, 'resolve'> {
  readonly kind: string;
  authorize(input: Input, context: OperationContext<App>): MaybePromise<void>;
  execute(input: Input, context: OperationContext<App> & NodeReportingContext): MaybePromise<Output>;
  parseOutput(value: unknown): Output;
  debugSteps?(result: Output, context: NodeReportingContext): void;
}
```

ExecutableTool adds execution, Tool adds one optional lifecycle block for invocation and delivery hooks, DomainTool adds optional domain policies, and Support.PreviewTool adds streaming presentation. Lifecycle execution uses a different context from typed execution, so they share model metadata without forcing identical resolution or execution handlers. Cafe's DomainTool narrows domain policies in the App.

There is no independent Intent identity. asIntent marks discovery use and optionally supplies a demand-facing description, condition. active conditions remain distinct from authorization. Normalized model tools have resolve; executable declarations do not configure a resolver, and their model projection produces raw Tool proposals. Neither mapping executes a business operation. See [Support](support.en.md) and [Public Symbol Reference](reference.en.md) for the full registration and subtype signatures.

[Back to API handbook](README.md). This page describes the base types and invocation rules shared by all modules.

## Identity, configuration, and time

```ts
type Id = string;
type TimestampMs = number;
type DurationMs = number;
type JsonSchema = Readonly<Record<string, unknown>>;
type MaybePromise<T> = T | Promise<T>;
```

These aliases only state meaning. They do not replace runtime validation, and they do not require every App to use branded types. An id must satisfy the constraints of its catalog or adapter; IDs supplied by models and clients are not proof of permission.

| Field | Sole meaning |
| --- | --- |
| id | Primary key of the currently registered entity |
| *Id / *Ids | Identifiers that point to other entities |
| name / description | Display name / description of purpose |
| kind | Domain classification, such as a read-only tool or an output kind |
| type | Discriminant tag of a message or event |
| version | Version of a serializable format |
| revision | Revision identity of content or a declaration |
| identity | Real model or space identity behind a registered alias, not merged with id |
| *AtMs / *Ms | Absolute millisecond time / duration |
| *Index / *Sequence / *Count | 0-based index / 1-based sequence / cumulative quantity |

`Definition` is a reusable declaration; `Config` is a configuration value; `Ports` are execution dependencies; `Options` are construction or invocation options; `State` is workflow state; `Runtime` is an instance with a bound lifecycle. A single request's signal must not be placed in a reusable Definition, and numeric budgets must not be hidden in Ports.

## Execution context

```ts
interface ExecutionOptions {
  readonly signal?: AbortSignal;
  readonly diagnostics?: DiagnosticContext;
}
interface OperationContext<App> {
  readonly logger?: ReportedStepLog;
  readonly app: Readonly<App>;
  readonly signal: AbortSignal;
  readonly diagnostics?: DiagnosticContext;
}
```

Core supplies the actual signal when it creates a request instance; the signal received by a registered handler always exists. `app` is the business dependency supplied by the caller, and models cannot override it. A Kit may define a local execution context that extends this contract, but it cannot require other Kits to fill its fields.

- A request instance binds execution at construction, so later invoke calls do not need to pass signal again.
- Reusable tools receive context on every run/read/resolve.
- App service identity, budget, and cancellation travel along the real call chain; nesting a Kit never grants new budget.

## Schema and parsing

```ts
interface SchemaAdapter<Value> {
  readonly jsonSchema: JsonSchema;
  parse(input: unknown): Value;
}
```

`inputSchema` uses SchemaAdapter and contains an executable parse plus a read-only jsonSchema; only jsonSchema is projected to the model. parse runs synchronously; a Promise returned by mistake is rejected and the late rejection is handled. A Promise must never be treated as a parsed value.

Context-dependent permission and protocol refinements belong to named handlers; stage, source, or permission checks must not be deleted just to fit them into a pure schema.

## Booleans, assertions, checks, and authorization

```ts
interface Issue {
  readonly code: string;
  readonly message: string;
  readonly path?: readonly (string | number)[];
  readonly checkId?: string;
}
interface CheckResult<Value = never> {
  readonly status: 'passed' | 'failed' | 'unavailable' | 'not-run';
  readonly issues: readonly Issue[];
  readonly value?: Value;
}
```

| Contract | Returns | Failure / side effects |
| --- | --- | --- |
| `isX(input)` | boolean | Performs no conversion; false is only a negation |
| `assertX(input)` | void | Throws on invalid input; false must not be used to express rejection |
| `parseX(input)` | Value | Validates and converts; throws on failure |
| `checkX(input, context)` | CheckResult | Check issues may be returned as a report; program errors still throw |
| `authorize(input, context)` | void or `Promise<void>`, decided by the corresponding execution interface | Throws on rejection; synchronous entry points do not allow thenables |

A passed result has empty issues; failed has at least one Issue; unavailable/not-run must not be treated as passed. value replaces the original only when an own-property check confirms it was provided (including an explicit undefined); truthiness must not be used to test presence. Check status does not replace tool execution status, task status, or delivery status.

Boolean permission tests are named isAllowed. TypeScript allows functions that return non-void values to be assigned to void callbacks, so executors check the actual completion value of authorize/assert: only undefined means approval; false, true, or any other value is a contract error. Asynchronous entry points check after await. When adapting a boolean permission test, approval returns undefined and rejection throws.

A synchronous entry point rejects on detecting a thenable and consumes its late rejection so it does not become an unhandled rejection; this does not roll back external side effects that already occurred, so asynchronous authorization and I/O must use asynchronous entry points.

## Invocation results: fixed shape

A single invocation API can have only one success return shape. Input shorthand only normalizes; it must not return a string for one input and an object for another, and no option may switch return paradigms through fullResponse, raw, or input shape.

```ts
interface InvocationMetadata {
  readonly runId?: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly invocationId: string;
  readonly startedAtMs: TimestampMs;
  readonly parentInvocationId?: string;
  readonly durationMs: number;
}
interface InvocationResult<Value, Metadata extends InvocationMetadata> {
  readonly value: Value;
  readonly invocation: Readonly<Metadata>;
}
type ModelResult<Value> = InvocationResult<Value, ModelCallRecord>;
type ToolResult<Value> = InvocationResult<Value, ToolCallRecord>;
```

Both model and tool invoke use this base structure. ModelCallRecord and ToolCallRecord keep their own known metadata and both extend InvocationMetadata; model usage exists only when the provider actually supplies it and is not fabricated as 0.

Plain text corresponds to `ModelResult<string>`, and structured protocols correspond to `ModelResult<ParsedValue>`: the outer layer is unchanged, only the business type of value differs. Failure always throws or rejects the Promise and must not be mixed with `{ success: false }` as a second error channel. The model raw stream, previews, and diagnostics use their own explicit interfaces and do not become alternative return modes of invoke.

This rule governs the boundaries of similar invocations. is/has, parse, read, and other distinct responsibilities still return per their explicit contracts; not every pure function is wrapped just to unify invoke.

## Errors and observation

```ts
interface AgentErrorInfo {
  readonly code: string;
  readonly codes: readonly string[];
  readonly issues: readonly Issue[];
  readonly stageId?: string;
  readonly isRetryable?: boolean;
  readonly cause: unknown;
}
type Observer<Event> = (event: Readonly<Event>) => void | Promise<void>;
type AsyncSink<Event> = (event: Readonly<Event>) => Promise<void>; // 需要异步交付的端口
// 接受同步完成的 sink 类型可返回 void；执行器仍按序 await。
```

`getErrorInfo(error)` normalizes the error view and preserves the identity of App exceptions or cancellation reasons together with structured location. The SDK's ValidationError and the error view both use issues; budget resource, stage, and other details are not expressed by attaching another competing code to the same exception. The normalizer can also read the errors array of external exceptions; this is input format adaptation and does not make the SDK output two fields at once.

Observer is out of band: it is not awaited, its exceptions are isolated, and it does not change authorization, budget, or retries. AsyncSink is delivery: it awaits order and backpressure, propagates failures, and is subject to cancellation and timeouts. A critical handler is not called observe.

## Registration collections

```ts
interface ReadonlyCatalog<Definition extends { readonly id: string }> {
  readonly definitions: readonly Readonly<Definition>[];
  ids(): readonly string[];
  values(): IterableIterator<Readonly<Definition>>;
  entries(): IterableIterator<readonly [string, Readonly<Definition>]>;
  has(id: string): boolean;
  get(id: string): Readonly<Definition> | undefined;
  require(id: string): Readonly<Definition>;
}
interface Registry<Definition extends { readonly id: string }>
  extends ReadonlyCatalog<Definition> {
  register(definition: Definition): this;
  registerAll(definitions: Iterable<Definition>): this;
  seal(): this;
}
```

registerAll does not implicitly seal; a factory that creates an already-compiled catalog returns a read-only catalog directly. If byId must be exposed, declare it explicitly as a Record and do not name it definitions or entries. A pure algorithm does not add registration entities just to implement this interface.

## Ownership, missing values, and generics

- Pure definition data (JSON schema, ID arrays, policy parameters) is copied and frozen; objects with methods are not structuredClone'd and not spread in a way that drops their prototype. Contract methods are read one by one, and the original methods and their original receivers are fixed; App instances are not frozen. Binding a receiver does not snapshot the instance's internal state, and handlers must still honor static and request lifecycle constraints.
- A registrar query returns the real stored registration projection: canonical methods are bound to their original receivers, and App-attached data and prototype getter metadata are read at registration; unregistered instance helpers are not promised. The canonical lists for intent, scope, and lifecycle are read-only snapshots, and describe returns an independent list copy; custom validation and policy callbacks still receive the original implementation so they can call its helpers.
- Readonly only constrains TypeScript writes; Map/Set and nested business objects are not automatically immutable through Object.freeze. A catalog does not expose its internal Map; business values are not promised a uniform deep copy, and each Kit defines the copy scope of its snapshot and persistence interfaces.
- Returned snapshots or checkpoint results must state whether they are copies or views; public events do not provide writable live references.
- Flow control uses explicit discrimination to distinguish continuation from a completion value; a legitimate generic final value may be undefined. Ordinary read/render/search returns the business value directly.
- Generic roles are ordered Input, Output, Context; roles that are absent are omitted. Complex local flows use named role types.
- After a static ID selection, types narrow with the actual collection; dynamic IDs keep runtime validation and the unknown boundary, and callers must not pass a self-reported result generic off as validation.

For complete exports, exact overloads, and declaration sources, see [Public symbol reference](reference.md). Signatures in examples are for reading only; omitted fields cannot be used to infer arbitrary extension options.

## Type entry points and base maps

`import type { ... } from '@jangts/agent-core/types'` covers shared contracts and the public types of each Kit and is empty at runtime; the root and owning modules also continue to provide type imports. `/structs` keeps historical types and existing constants and is not the preferred entry point for runtime values in new code.

`ProtocolRegistry<T>` is the only keyed Map that allows arbitrary protocol payloads and provides ids/require without requiring T to have an id, so it is not disguised as an entity Catalog; real entity catalogs such as CommandCatalog implement the shared collection surface. Ordered algorithm configurations such as Normalization.steps are not incrementally registerable Registries. Intent/Scope registerAll only registers, and sealing uses the subsequent seal(); create is the complete-list entry that combines both.
