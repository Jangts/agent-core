import { domainAlias, domainProjection } from '../domains/compatibility.js';
/**
 * Answering Kit: answer tasks, their readers, schemas and metadata.
 *
 * Place in the package: part of the `answering` Kit. A task binds an intent set, a scope, an
 * output contract, check ids and a reader; this module compiles that binding, validates the
 * reader ids and exposes read/describe entry points. Readers stay App-owned I/O.
 *
 * Exports: `defineAnswerReaderCatalog`, `defineAnswerTaskCatalog`, and the task/reader types.
 */
import { nativeSubFlowSync, nativeSubFlowAsync } from '../../diagnostics/native-sub-flow.js';
import { readonlyCatalog } from '../../utils/catalog.js';
import { assertion, synchronous } from '../../utils/synchronous.js';
import { freezeSchema } from '../../utils/object.js';
import { awaitWithSignal } from '../../utils/cancellation.js';
import { snapshotSchemaAdapter } from '../../utils/schema-adapter.js';
import type { OperationContext } from '../../structs/common.js';
import type {
  AnswerTaskDefinition,
  AnswerReader,
  AnswerTaskPorts,
} from '../../structs/kits/answering/tasks.js';

/**
 * Compile a reader catalog.
 *
 * @param definitions - Readers with unique ids and a `read` handler.
 * @returns A frozen catalog; unknown ids fail through `require`.
 * @throws TypeError When a reader has no `read` handler.
 */
export function defineAnswerReaderCatalog<Input, Evidence, App, Data = unknown>(
  definitions: readonly AnswerReader<Input, Evidence, App, Data>[],
) {
  return readonlyCatalog(
    definitions.map((reader) => {
      if (typeof reader.read !== 'function') throw new TypeError('Invalid answer reader');
      return Object.freeze({ id: reader.id, read: reader.read.bind(reader) });
    }),
    (id) => new TypeError(`Unknown answer reader: ${id}`),
  );
}
/**
 * Compile the answer task catalog from its declarations and shared ports.
 *
 * Task ids, schemas, readers, outputs and checks have one compiled authority: a task can only
 * reference a reader or check that the ports actually registered, and metadata is cloned and
 * frozen so later mutation by the caller cannot change a registered task.
 *
 * @param definitions - Task declarations with identity, reader/output/scope references,
 *   intent ids, check ids, input schema and metadata.
 * @param ports - Registered readers, checks, outputs and an optional definition assertion.
 * @returns A frozen catalog extended with `describe`, `read` and `readAsync`.
 * @throws TypeError For a task with missing identity, an unknown reader/output/check, empty or
 *   duplicate intent ids, a duplicate check id, or a failed definition assertion.
 */
export function defineAnswerTaskCatalog<Input, Evidence, App, Data = unknown>(
  definitions: readonly AnswerTaskDefinition<Input, Data>[],
  ports: AnswerTaskPorts<Input, Evidence, App, Data>,
) {
  const readers = defineAnswerReaderCatalog([...ports.readers.values()]);
  const checkIds = ports.checks.ids();
  const assertDefinition = ports.assertDefinition?.bind(ports);
  const outputs = new Set(ports.outputs.ids());
  const tasks = definitions.map((definition) => {
    const goalIds = domainAlias<readonly string[]>(definition, 'domainToolIds', 'goalIds') ?? [];
    if (
      !definition.id?.trim() ||
      !definition.description?.trim() ||
      !readers.has(definition.readerId) ||
      !outputs.has(definition.outputId) ||
      !Array.isArray(goalIds) ||
      !goalIds.length ||
      goalIds.some((id) => typeof id !== 'string' || !id.trim()) ||
      new Set(goalIds).size !== goalIds.length ||
      !Array.isArray(definition.checkIds) ||
      new Set(definition.checkIds).size !== definition.checkIds.length ||
      definition.checkIds.some((id) => !checkIds.includes(id))
    )
      throw new TypeError(`Invalid answer task: ${definition.id}`);
    const metadata = structuredClone(definition.metadata);
    freezeSchema(metadata);
    const task = Object.freeze({
      ...definition,
      id: definition.id,
      description: definition.description,
      readerId: definition.readerId,
      outputId: definition.outputId,
      scopeId: definition.scopeId,
      goalIds: Object.freeze([...goalIds]),
      domainToolIds: Object.freeze([...goalIds]),
      checkIds: Object.freeze([...definition.checkIds]),
      inputSchema: snapshotSchemaAdapter(definition.inputSchema),
      metadata,
    });
    assertion(assertDefinition?.(task), 'Task assertions must return void synchronously');
    return task;
  });
  const catalog = readonlyCatalog(tasks, (id) => new TypeError(`Unknown answer task: ${id}`));
  const prepare = (request: { taskId: string; input: unknown }, context: OperationContext<App>) => {
    context.signal.throwIfAborted();
    const task = catalog.require(request.taskId);
    const input = synchronous(
      task.inputSchema.parse(request.input),
      'Answer task parsers must be synchronous',
    );
    context.signal.throwIfAborted();
    return { input, task, reader: readers.require(task.readerId) };
  };
  return Object.freeze({
    ...catalog,
    /** Task metadata with the JSON schema flattened for model or admin presentation. */
    describe: () =>
      tasks.map(({ inputSchema, ...task }) => ({
        ...task,
        inputJsonSchema: inputSchema.jsonSchema,
      })),
    /** Canonical descriptions omit legacy relation names. */
    describeDomainTasks: () =>
      tasks.map(({ inputSchema, ...task }) =>
        domainProjection({ ...task, inputJsonSchema: inputSchema.jsonSchema }),
      ),
    /**
     * Read evidence through a task's registered reader, synchronously.
     *
     * @throws TypeError For an unknown task, a parse failure, or a reader returning a Promise.
     */
    read(request: { taskId: string; input: unknown }, context: OperationContext<App>): Evidence {
      return nativeSubFlowSync(context, 'task', request.taskId, () => {
        const { input, task, reader } = prepare(request, context);
        const value = synchronous(
          reader.read(input, {
            ...context,
            app: context.app,
            signal: context.signal,
            diagnostics: context.diagnostics,
            task,
          }),
          'Synchronous answer readers must not return a Promise',
        );
        context.signal.throwIfAborted();
        return value as Evidence;
      });
    },
    /**
     * Read evidence through a task's registered reader, awaiting an async reader.
     *
     * @throws TypeError For an unknown task or a parse failure; aborts with the caller's signal.
     */
    async readAsync(
      request: { taskId: string; input: unknown },
      context: OperationContext<App>,
    ): Promise<Evidence> {
      return nativeSubFlowAsync(context, 'task', request.taskId, async () => {
        const { input, task, reader } = prepare(request, context);
        const value = await awaitWithSignal(
          reader.read(input, {
            ...context,
            app: context.app,
            signal: context.signal,
            diagnostics: context.diagnostics,
            task,
          }),
          context.signal,
        );
        context.signal.throwIfAborted();
        return value as Evidence;
      });
    },
  });
}
export type * from '../../structs/kits/answering/tasks.js';
