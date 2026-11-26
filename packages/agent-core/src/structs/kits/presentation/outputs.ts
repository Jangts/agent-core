/**
 * Structured output contract for the Presentation Kit.
 *
 * Place in the package: an optional App-side catalog that turns a generated record into a typed
 * output. Ownership decides where each field value comes from; the catalog validates references
 * and renders the model-visible schema, while the meaning of every output stays with the App.
 *
 * Exports: `OutputField`, `OutputDefinition`, `OutputProvider`, `OutputIssue`,
 * `OutputComposeInput`, `OutputResult`, `OutputCatalogOptions`.
 */
import type { SchemaAdapter, OperationContext, Issue } from '../../common.js';

/** One field of an output definition. */
export interface OutputField {
  /** Field id, used as the property name and as a master-template slot name. */
  readonly id: string;
  /**
   * Where the value comes from: `generated` (model writes it), `bound` (provider resolves it),
   * `constant` (fixed `constantValue`) or `semantic` (model picks one of `semanticKeys`).
   */
  readonly owner: 'generated' | 'bound' | 'constant' | 'semantic';
  /** Whether the model must provide the field; defaults to true. */
  readonly required?: boolean;
  /** Value parser and schema. Defaults to a string parser when omitted. */
  readonly valueSchema?: SchemaAdapter<unknown>;
  /** Provider that resolves `bound` and `semantic` fields; required for those owners. */
  readonly providerId?: string;
  /** Fixed value for `constant` fields; snapshotted at registration. */
  readonly constantValue?: unknown;
  /** Allowlist for `semantic` fields; must be non-empty and unique. */
  readonly semanticKeys?: readonly string[];
}

/** One output shape. */
export interface OutputDefinition {
  /** Output id; duplicate ids are rejected. */
  readonly id: string;
  /** Shape family. `text` holds one required field; `group` holds program-assigned items. */
  readonly kind: 'text' | 'master' | 'record' | 'group';
  /** Fields of `text`, `master` and `record` outputs; forbidden for groups. */
  readonly fields?: readonly OutputField[];
  /** Master template for `master` outputs; its slots must match the field ids exactly. */
  readonly master?: string;
  /** Output ids a group may contain; required and unique for groups. */
  readonly allowedOutputIds?: readonly string[];
  /** Maximum group members; required for groups and at least 1. */
  readonly maxItems?: number;
}

/** App-owned value provider for `bound` and `semantic` fields. */
export interface OutputProvider<App> {
  readonly id: string;
  /** Produces the value; `key` carries the selected semantic key, when there is one. */
  resolve(request: { readonly key?: string }, context: OperationContext<App>): unknown;
}
/** Output problem with a guaranteed field path. */
export interface OutputIssue extends Issue {
  readonly path: readonly (string | number)[];
}
/** Input for composing one output: model values plus program-assigned group members. */
export interface OutputComposeInput {
  /** Values already produced for this output's fields, keyed by field id. */
  readonly generated?: Readonly<Record<string, unknown>>;
  /** Group members supplied by the program, in order. */
  readonly items?: readonly {
    readonly id: string;
    readonly outputId: string;
    readonly input: OutputComposeInput;
  }[];
}
/** Composed output value. */
export interface OutputResult {
  readonly outputId: string;
  readonly kind: OutputDefinition['kind'];
  readonly value: unknown;
}
/** Catalog construction options. */
export interface OutputCatalogOptions<App = unknown> {
  /** Providers referenced by `bound` and `semantic` fields. */
  readonly providers?: readonly OutputProvider<App>[];
  /** Observer invoked with every composed result. */
  readonly observe?: (result: OutputResult) => void | Promise<void>;
}
