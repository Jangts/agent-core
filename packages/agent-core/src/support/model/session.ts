/**
 * Model tool-response interaction policy: one response may contain prose and several tool calls.
 *
 * Core owns the raw `ModelToolResponse`; this Support module adds the host-facing
 * decoding fields (`toolId`, JSON `input`, non-fatal `problem`) and the interaction
 * that advertises the stage's tools. Keeping the decoding policy here prevents Core
 * from depending on tool catalogs or business error categories.
 *
 * Exports: `DecodedModelResponseToolCall`, `DecodedModelToolResponse`, `PreparedModelToolInteraction`,
 * `ModelToolInteractionOptions`, `ModelToolInteractionRegistration`, `prepareModelToolInteraction`
 * and the internal session interaction constructor.
 */
import { synchronous } from '../../utils/synchronous.js';
import { wireName } from '../../model/interactions/arguments.js';
import { createToolCallCollector } from '../../model/interactions/calls.js';
import { snapshotModelOptions } from '../../model/options.js';
import type { ModelToolSource, RegisteredModelTool } from '../../structs/capabilities/model.js';
import type { ModelResponseCollector } from '../../structs/model/interactions.js';
import type {
  ModelOptions,
  ModelPart,
  ModelInteractionOptions as import_MODEL_OPTIONS,
} from '../../structs/model/messages.js';
import type { ModelInteractionDefinition } from '../../structs/model/runtime.js';
import type { ModelResponseToolCall, ModelToolResponse } from '../../structs/model/session.js';
import { modelProtocolError } from '../../utils/model-protocol.js';

/** One completed call with wire-name matching and JSON decoding; unknown tools and bad JSON stay non-fatal. */
export interface DecodedModelResponseToolCall extends ModelResponseToolCall {
  /** Registered tool id, absent when the name is unknown to this stage. */
  readonly toolId?: string;
  /** JSON object arguments for a known tool; not schema-validated, resolved or authorized. */
  readonly input?: Record<string, unknown>;
  /** Non-fatal problem the workflow should turn into a tool error message. */
  readonly problem?: 'unknown-tool' | 'invalid-arguments';
}

/** Complete result of one model tool response after wire-name matching and JSON decoding. */
export interface DecodedModelToolResponse extends Omit<ModelToolResponse, 'calls'> {
  readonly calls: readonly DecodedModelResponseToolCall[];
}

/** Prepared session interaction handed to the runner. */
export interface PreparedModelToolInteraction {
  readonly options: Pick<
    ModelOptions,
    | 'functions'
    | 'json'
    | 'temperature'
    | 'toolChoice'
    | 'parallelToolCalls'
    | 'requireCompletion'
    | 'outputSchema'
    | 'continuation'
    | 'onContinuation'
    | 'onContent'
  >;
  readonly schemaChars: number;
  readonly instruction: string;
  createResponse(): ModelResponseCollector<DecodedModelToolResponse>;
}

/** Options a session interaction may pass through to provider options. */
export interface ModelToolInteractionOptions extends import_MODEL_OPTIONS {
  readonly temperature?: number;
  readonly toolChoice?: 'auto' | 'required' | 'none';
  readonly parallelToolCalls?: boolean | 'omit';
}

/** Registration for one session interaction. */
export interface ModelToolInteractionRegistration {
  /** Transport id used by call requests and diagnostics. */
  readonly id: string;
  /** Tools advertised to the model for this stage. */
  readonly tools: ModelToolSource | ((stage: string) => ModelToolSource);
  readonly response: 'tools' | 'session';
  readonly adapter?: never;
  readonly requireStrictArguments?: never;
  /** Sampling and tool-selection settings. */
  readonly options?: ModelToolInteractionOptions;
}

/**
 * Parse one call's raw arguments without failing the whole response.
 *
 * @param raw - Raw JSON text; an empty string means an empty argument object.
 * @returns The parsed object, or undefined when the text is not a JSON object.
 */
function parseArguments(raw: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(raw === '' ? '{}' : raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build the session policy for one stage.
 *
 * @param tools - Registered tools available in this stage; may be empty for prose-only replies.
 * @param options - Sampling and tool-selection settings.
 * @returns A prepared interaction whose collector returns text and every completed call.
 * @throws TypeError When tool choice requires an empty list or two ids collide on the wire name.
 */
export function prepareModelToolInteraction(
  tools: readonly RegisteredModelTool[],
  options: ModelToolInteractionOptions = {},
): PreparedModelToolInteraction {
  if (!tools.length && options.toolChoice === 'required')
    throw new TypeError('Required tool choice needs registered tools');
  const names = new Map(tools.map((tool) => [wireName(tool.id), tool.id]));
  if (names.size !== tools.length) throw new TypeError('Model wire name collision');
  const functions = tools.map((tool) => ({
    name: wireName(tool.id),
    description: tool.description,
    parameters: tool.inputSchema.jsonSchema,
    strict: false,
  }));
  const instruction =
    'You may answer directly or call one or more registered tools. Prose and calls may appear together. A call is a proposal, not proof of execution.';
  return {
    options: {
      ...snapshotModelOptions(options),
      json: false,
      ...(functions.length ? { functions } : {}),
      toolChoice: options.toolChoice ?? 'auto',
      ...(options.parallelToolCalls === undefined
        ? {}
        : { parallelToolCalls: options.parallelToolCalls }),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    },
    schemaChars: JSON.stringify(functions).length + instruction.length,
    instruction,
    createResponse(): ModelResponseCollector<DecodedModelToolResponse> {
      const collector = createToolCallCollector();
      let text = '';
      return {
        get outputChars() {
          return (
            text.length +
            collector.calls.reduce(
              (sum, call) => sum + call.id.length + call.name.length + call.arguments.length,
              0,
            )
          );
        },
        get calls() {
          try {
            return collector.complete().map((call) => ({
              id: call.id,
              name: call.name,
              argumentChars: call.arguments.length,
              toolId: names.get(call.name),
            }));
          } catch {
            return undefined;
          }
        },
        push(part: ModelPart) {
          if (typeof part === 'string') {
            text += part;
            return;
          }
          collector.push(part);
        },
        finish() {
          const completed = collector.complete();
          if (text.trim() === '' && completed.length === 0)
            modelProtocolError('Model response is empty', 'MODEL_INCOMPLETE');
          const calls = completed.map((call): DecodedModelResponseToolCall => {
            const toolId = names.get(call.name);
            const input = toolId === undefined ? undefined : parseArguments(call.arguments);
            return {
              index: call.index,
              id: call.id,
              name: call.name,
              arguments: call.arguments,
              argumentChars: call.arguments.length,
              ...(toolId === undefined ? {} : { toolId }),
              ...(input === undefined ? {} : { input }),
              ...(toolId === undefined
                ? { problem: 'unknown-tool' as const }
                : input === undefined
                  ? { problem: 'invalid-arguments' as const }
                  : {}),
            };
          });
          return { text, calls };
        },
      };
    },
  };
}

/**
 * Create a session interaction.
 *
 * @param registration - Transport id, tool source and optional settings.
 * @returns A frozen interaction definition whose result contains text and every completed call.
 * @throws TypeError When the id is blank.
 */
export function createModelToolInteraction<const Id extends string>(
  registration: ModelToolInteractionRegistration & { readonly id: Id },
): ModelInteractionDefinition<DecodedModelToolResponse> & { readonly id: Id } {
  const id = registration.id;
  if (typeof id !== 'string' || !id.trim())
    throw new TypeError('Session interaction requires an ID');
  const source = registration.tools;
  const options = snapshotModelOptions(registration.options ?? {});
  return Object.freeze({
    id,
    prepare(stageId: string) {
      const tools =
        typeof source === 'function'
          ? synchronous(
              source.call(registration, stageId),
              'Model tool sources must be synchronous',
            )
          : source;
      return prepareModelToolInteraction([...tools.values()], {
        ...options,
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        ...(options.toolChoice === undefined ? {} : { toolChoice: options.toolChoice }),
        ...(options.parallelToolCalls === undefined
          ? {}
          : { parallelToolCalls: options.parallelToolCalls }),
      });
    },
  });
}

/** @deprecated Use `DecodedModelResponseToolCall`. Retained for the 0.9 migration. */
export type { DecodedModelResponseToolCall as DecodedSessionCall };
/** @deprecated Use `DecodedModelToolResponse`. Retained for the 0.9 migration. */
export type { DecodedModelToolResponse as DecodedSessionResult };
/** @deprecated Use `PreparedModelToolInteraction`. Retained for the 0.9 migration. */
export type { PreparedModelToolInteraction as PreparedSessionTransport };
/** @deprecated Use `ModelToolInteractionOptions`. Retained for the 0.9 migration. */
export type { ModelToolInteractionOptions as SessionFunctionOptions };
/** @deprecated Use `ModelToolInteractionRegistration`. Retained for the 0.9 migration. */
export type { ModelToolInteractionRegistration as SessionModelTransportRegistration };
/** @deprecated Use `prepareModelToolInteraction`. Retained for the 0.9 migration. */
export { prepareModelToolInteraction as prepareSessionFunctions };
/** @deprecated Use `createModelToolInteraction`. Retained for the 0.9 migration. */
export { createModelToolInteraction as createSessionTransport };
