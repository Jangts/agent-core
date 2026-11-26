/**
 * Answer task contract for the Answering Kit.
 *
 * Place in the package: part of the `answering` Kit. A task binds an intent set, an optional scope,
 * one reader, one output contract and a list of checks; readers remain App-owned I/O.
 *
 * Exports: `AnswerTaskDefinition`, `AnswerReader`, `AnswerTaskPorts`.
 */
import type {
  MaybePromise,
  OperationContext,
  SchemaAdapter,
  ReadonlyCatalog,
} from '../../common.js';

/** Static binding of one answerable task. */
export interface AnswerTaskBase<Input = unknown, Data = unknown> {
  /** Unique task id. */
  readonly id: string;
  readonly description: string;
  /** Reader that produces the evidence for this task; must be registered. */
  readonly readerId: string;
  /** Output contract the answer must satisfy; must be registered. */
  readonly outputId: string;
  /** Goals this task serves; non-empty. */

  /** Optional scope narrowing the task. */
  readonly scopeId?: string;
  /** Checks applied to the produced value; every id must be registered. */
  readonly checkIds: readonly string[];
  /** Schema for the task input, validated before the reader runs. */
  readonly inputSchema: SchemaAdapter<Input>;
  /** App metadata passed back through the reader context; opaque to the Kit. */
  readonly metadata: Data;
}
/** Required domain membership with an explicit 0.9 input compatibility form. */
export type AnswerTaskDefinition<Input = unknown, Data = unknown> = AnswerTaskBase<Input, Data> &
  (
    | { readonly domainToolIds: readonly string[]; readonly goalIds?: readonly string[] }
    | { readonly goalIds: readonly string[]; readonly domainToolIds?: readonly string[] }
  );
/** App-owned reader that gathers evidence for one task. */
export interface AnswerReader<Input, Evidence, App, Data = unknown> {
  readonly id: string;
  /** Produces evidence for the validated input; the task is passed through for context. */
  read(
    input: Input,
    context: OperationContext<App> & { readonly task: Readonly<AnswerTaskDefinition<Input, Data>> },
  ): MaybePromise<Evidence>;
}
/** Registries a task catalog validates its references against. */
export interface AnswerTaskPorts<Input, Evidence, App, Data = unknown> {
  readonly readers: ReadonlyCatalog<AnswerReader<Input, Evidence, App, Data>>;
  readonly outputs: ReadonlyCatalog<{ readonly id: string }>;
  readonly checks: ReadonlyCatalog<{ readonly id: string }>;
  /** Extra App assertion over a raw definition, before it is compiled. */
  assertDefinition?(task: Readonly<AnswerTaskDefinition<Input, Data>>): void;
}
