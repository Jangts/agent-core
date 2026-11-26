/**
 * Bounded, self-reported sub-flow logging.
 *
 * A node or tool may report the steps it believes it performed. Such reports are optional
 * evidence, never proof of Core scheduling: they are marked `origin: 'reported'`, validated
 * against a fixed field whitelist, and capped in count, text length and nested payload depth.
 *
 * Issued loggers are tracked in a module-private registry, so only the execution that created
 * one can read it. A lookalike object with a `readAll` method is never accepted.
 *
 * Exports: `payloadSnapshot`, `createStepRecorder`, `readReportedStepRecorder`, `captureReportedStepSnapshot`.
 */
import { breakWhile } from '../utils/rules.js';
import { invocationId } from '../utils/invocation.js';
import { reportedStepStatusCatalog } from '../structs/debug.js';
import type {
  ReportedStepRecord,
  ReportedStepLog,
  ReportedStepInput,
  ReportedStepUpdate,
  ReportedStepProgress,
  ReportedStepValue,
} from '../structs/debug.js';
import type { DiagnosticIdentity } from '../structs/diagnostics.js';

type Step = ReportedStepRecord &
  Required<Pick<ReportedStepRecord, 'createdAtMs' | 'revision' | 'status'>>;
/**
 * Registry of issued loggers: owner, diagnostic identity and reader for each instance. Kept
 * private so a structurally identical object cannot impersonate a real logger.
 */
const instances = new WeakMap<
  object,
  {
    owner: object;
    identity?: Readonly<DiagnosticIdentity>;
    read: () => readonly Step[];
    detach: () => void;
  }
>();
/** Only recorder-issued snapshots may enter a diagnostic fact, within their original span. */
const snapshots = new WeakMap<object, { identity?: Readonly<DiagnosticIdentity> }>();

/** Validate a committed snapshot without consulting its logger or invoking App code. */
export function captureReportedStepSnapshot(
  steps: readonly Readonly<ReportedStepRecord>[] | undefined,
  identity?: Readonly<DiagnosticIdentity>,
) {
  const empty = { subSteps: Object.freeze([]), subStepsDropped: 0, subStepsTruncated: false };
  if (steps === undefined) return empty;
  const scope = snapshots.get(steps);
  if (
    !scope ||
    (identity &&
      (scope.identity?.runId !== identity.runId || scope.identity?.spanId !== identity.spanId))
  )
    return { ...empty, subStepsDropped: 1 };
  return { ...empty, subSteps: steps };
}

/** Fields accepted by `write`; anything else is rejected so a declaration cannot smuggle state. */
const writeFields = [
  'type',
  'subnodeId',
  'name',
  'kind',
  'parentStepId',
  'relatedDefinitionId',
  'relatedInvocationId',
  'status',
  'usedModel',
  'startedAtMs',
  'endedAtMs',
  'nextStepIds',
  'caseId',
  'summary',
  'payload',
];
/** Fields accepted by `fix`: identity and creation data are intentionally not patchable. */
const fixFields = [
  'status',
  'usedModel',
  'startedAtMs',
  'endedAtMs',
  'summary',
  'payload',
  'nextStepIds',
];
/** Per-field character caps, bounding what one reported step can add to a persisted record. */
const textLimits = {
  type: 256,
  subnodeId: 1024,
  name: 256,
  kind: 128,
  parentStepId: 256,
  relatedDefinitionId: 256,
  relatedInvocationId: 256,
  caseId: 256,
  summary: 1024,
} as const;

/**
 * Validate a step input: plain prototype, whitelisted keys, own data properties only.
 *
 * Property descriptors are inspected instead of values being read, so an accessor on the input
 * cannot execute application code during validation.
 */
function fields(input: object, allowed: readonly string[]): void {
  breakWhile(
    !input || Object.getPrototypeOf(input) !== Object.prototype,
    () => new TypeError('Sub-flow input must be a plain parameter object'),
  );
  breakWhile(
    Reflect.ownKeys(input).some((key) => typeof key !== 'string' || !allowed.includes(key)),
    () => new TypeError('Unknown sub-flow field'),
  );
  for (const key of Reflect.ownKeys(input))
    breakWhile(
      !['payload', 'summary'].includes(String(key)) &&
        !('value' in Object.getOwnPropertyDescriptor(input, key)!),
      () => new TypeError('Sub-flow metadata must be plain data'),
    );
}
/**
 * Check a fully built step: text caps, status vocabulary, time ordering, and the rules tying
 * timestamps to planned and terminal statuses.
 */
function validate(step: Step): void {
  for (const [key, limit] of Object.entries(textLimits)) {
    const value = step[key as keyof typeof textLimits];
    breakWhile(
      value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > limit),
      () => new TypeError(`Invalid sub-flow ${key}`),
    );
  }
  breakWhile(
    !step.name || !step.kind || !Object.hasOwn(reportedStepStatusCatalog, step.status),
    () => new TypeError('Invalid sub-flow description or status'),
  );
  breakWhile(
    step.usedModel !== undefined && typeof step.usedModel !== 'boolean',
    () => new TypeError('Invalid sub-flow usedModel'),
  );
  for (const time of [step.startedAtMs, step.endedAtMs])
    breakWhile(
      time !== undefined && (!Number.isFinite(time) || time < 0),
      () => new TypeError('Invalid sub-flow time'),
    );
  breakWhile(
    step.startedAtMs !== undefined &&
      step.endedAtMs !== undefined &&
      step.endedAtMs < step.startedAtMs,
    () => new TypeError('Invalid sub-flow time order'),
  );
  breakWhile(
    step.endedAtMs !== undefined && !reportedStepStatusCatalog[step.status].terminal,
    () => new TypeError('Only terminal sub-flow steps have an end time'),
  );
  breakWhile(
    ['planned', 'skipped'].includes(step.status) && step.startedAtMs !== undefined,
    () => new TypeError('A planned or skipped sub-flow step has not started'),
  );
  breakWhile(
    step.nextStepIds !== undefined &&
      (!Array.isArray(step.nextStepIds) ||
        step.nextStepIds.length > 64 ||
        new Set(step.nextStepIds).size !== step.nextStepIds.length ||
        step.nextStepIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 256)),
    () => new TypeError('Invalid sub-flow successors'),
  );
}
/**
 * Validate and deep-copy a reported payload.
 *
 * Accessors, class instances, cycles and non-JSON values are rejected without evaluating
 * application getters, so a payload can neither run code nor alias live state. Accepted data is
 * frozen.
 *
 * @param input Object to snapshot. It must be a plain object, not an array.
 * @returns A deeply frozen JSON-shaped copy.
 * @throws TypeError when the value is not plain JSON data, contains a getter, or is cyclic.
 * @throws RangeError when node count, nesting depth, string length or array length exceeds the
 *   limits below.
 */
export function payloadSnapshot(input: unknown): Readonly<Record<string, ReportedStepValue>> {
  let nodes = 0;
  // Ancestors rather than all visited nodes: a shared subtree is fine, a cycle is not.
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): ReportedStepValue => {
    breakWhile(
      ++nodes > 4096 || depth > 16,
      () => new RangeError('Sub-flow payload is too complex'),
    );
    breakWhile(
      typeof value === 'string' && value.length > 65536,
      () => new RangeError('Sub-flow payload is too large'),
    );
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    breakWhile(
      !value ||
        typeof value !== 'object' ||
        (typeof value === 'object' && value !== null && ancestors.has(value)) ||
        // Only plain objects survive: a class instance may hide lazy state behind getters.
        (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype),
      () => new TypeError('Sub-flow payload must contain JSON data'),
    );
    breakWhile(
      Array.isArray(value) && value.length > 4096,
      () => new RangeError('Sub-flow payload array is too large'),
    );
    const data = value as object;
    ancestors.add(data);
    const result: Record<string, ReportedStepValue> = {};
    for (const key of Reflect.ownKeys(data)) {
      if (Array.isArray(value) && key === 'length') continue;
      const field = Object.getOwnPropertyDescriptor(value, key)!;
      breakWhile(
        typeof key !== 'string' ||
          !('value' in field) ||
          !field.enumerable ||
          // Array keys must be canonical indices; extra or sparse keys cannot survive JSON.
          (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)),
        () => new TypeError('Sub-flow payload must contain plain data fields'),
      );
      Object.defineProperty(result, key, { value: copy(field.value, depth + 1), enumerable: true });
    }
    ancestors.delete(data);
    return Array.isArray(value)
      ? Object.freeze(Array.from({ length: value.length }, (_, i) => result[i] ?? null))
      : Object.freeze(result);
  };
  breakWhile(
    !input || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype,
    () => new TypeError('Sub-flow payload must be an object'),
  );
  return copy(input, 0) as Readonly<Record<string, ReportedStepValue>>;
}
/**
 * Merge a payload patch into a recorded payload without replacing recorded facts.
 *
 * Nested objects merge recursively; an existing leaf must keep its value. A mismatch is
 * rejected rather than overwritten, because a fix may add results but not rewrite history.
 */
function fill(
  previous: Readonly<Record<string, ReportedStepValue>>,
  patch: Readonly<Record<string, ReportedStepValue>>,
): Readonly<Record<string, ReportedStepValue>> {
  const result = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(previous, key))
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    else if (
      value &&
      previous[key] &&
      typeof value === 'object' &&
      typeof previous[key] === 'object' &&
      !Array.isArray(value) &&
      !Array.isArray(previous[key])
    ) {
      result[key] = fill(
        previous[key] as Readonly<Record<string, ReportedStepValue>>,
        value as Readonly<Record<string, ReportedStepValue>>,
      );
    } else
      breakWhile(
        JSON.stringify(previous[key]) !== JSON.stringify(value),
        () => new TypeError('Cannot overwrite a recorded sub-flow fact'),
      );
  }
  return Object.freeze(result);
}

/** Stable diagnostic reasons; untrusted error text and caller payloads never reach the console. */
const rejectionReasons = {
  inactive: 'logger is detached or execution is cancelled',
  scope: 'target does not belong to this subnode',
  target: 'original write record was not found',
  fields: 'input contains a forbidden field',
  transition: 'status transition is not allowed',
  sealed: 'an established fact cannot be overwritten',
  limit: 'recording limit exceeded',
  input: 'invalid input or result patch',
} as const;
type RejectionReason = keyof typeof rejectionReasons;
const rejectionMessages: Readonly<Record<string, RejectionReason>> = {
  'Unknown sub-flow field': 'fields',
  'Unknown sub-flow step': 'target',
  'Invalid sub-flow status transition': 'transition',
  'Terminal sub-flow status is sealed': 'transition',
  'Terminal sub-flow model use is sealed': 'sealed',
  'Cannot undo reported model use': 'sealed',
  'Cannot overwrite a sub-flow time': 'sealed',
  'Cannot overwrite sub-flow successors': 'sealed',
  'Cannot overwrite a sub-flow summary': 'sealed',
  'Sub-flow log limit exceeded': 'limit',
};
/** Map only known own data messages; arbitrary thrown values are described generically. */
function rejectionReason(error: unknown): RejectionReason {
  try {
    const message =
      error instanceof Error ? Object.getOwnPropertyDescriptor(error, 'message')?.value : undefined;
    return typeof message === 'string' && Object.hasOwn(rejectionMessages, message)
      ? rejectionMessages[message]
      : 'input';
  } catch {
    return 'input';
  }
}

/** Unexported issuance token prevents constructing counterfeit full or scoped loggers. */
const loggerToken = Symbol('sub-flow-logger');
type Store = ReportedStepLog & {
  owns(stepId: string | -1, subnodeId: string): boolean;
  isActive(): boolean;
  nextNativeSubnodeId(kind: string, definitionId: string): string;
  warn(operation: 'write' | 'fix', reason: RejectionReason): void;
};
const stores = new WeakMap<ReportedStepRecorder, Store>();

/** Full execution-owned recorder. Owns its store and may issue restricted delegates. */
export class ReportedStepRecorder implements ReportedStepLog {
  #store: Store;
  constructor(token: typeof loggerToken, store: Store) {
    if (token !== loggerToken)
      throw new TypeError(
        'Use context.createStepRecorder() (legacy context.createSubFlowLogger())',
      );
    this.#store = store;
    stores.set(this, store);
    Object.freeze(this);
  }
  write(input: ReportedStepInput): string | -1 {
    return this.#store.write(input);
  }
  fix(stepId: string | -1, patch: ReportedStepUpdate): boolean {
    return this.#store.fix(stepId, patch);
  }
  readAll(): readonly Readonly<ReportedStepRecord>[] {
    return this.#store.readAll();
  }
  /** Issue a delegate for an App-owned logical group; no execution or scheduling is implied. */
  fork(subnodeId: string): ScopedReportedStepRecorder {
    if (typeof subnodeId !== 'string' || !subnodeId.trim() || subnodeId.length > 1024)
      throw new TypeError('Invalid subnode id');
    return new ScopedReportedStepRecorder(loggerToken, this, subnodeId);
  }
}

/** Non-inheriting delegate. Stores only the original logger and its bound subnode identity. */
export class ScopedReportedStepRecorder implements ReportedStepLog {
  #logger: ReportedStepRecorder;
  #subnodeId: string;
  constructor(token: typeof loggerToken, logger: ReportedStepRecorder, subnodeId: string) {
    if (token !== loggerToken) throw new TypeError('Use logger.fork(subnodeId)');
    this.#logger = logger;
    this.#subnodeId = subnodeId;
    Object.freeze(this);
  }
  write(input: Omit<ReportedStepInput, 'subnodeId'>): string | -1 {
    if (!stores.get(this.#logger)!.isActive()) {
      stores.get(this.#logger)!.warn('write', 'inactive');
      return -1;
    }
    try {
      fields(
        input,
        writeFields.filter((field) => field !== 'subnodeId'),
      );
      // Copy descriptors so private content getters remain subject to the original policy.
      const bound = Object.defineProperties({}, Object.getOwnPropertyDescriptors(input));
      Object.defineProperty(bound, 'subnodeId', { value: this.#subnodeId, enumerable: true });
      return this.#logger.write(bound as ReportedStepInput);
    } catch (error) {
      stores.get(this.#logger)!.warn('write', rejectionReason(error));
      return -1;
    }
  }
  fix(stepId: string | -1, patch: ReportedStepUpdate): boolean {
    const store = stores.get(this.#logger)!;
    if (!store.isActive()) {
      store.warn('fix', 'inactive');
      return false;
    }
    if (!store.owns(stepId, this.#subnodeId)) {
      store.warn('fix', 'scope');
      return false;
    }
    return this.#logger.fix(stepId, patch);
  }
  readAll(): readonly Readonly<ReportedStepRecord>[] {
    return this.#logger.readAll();
  }
}

/** Runtime check complements nominal invocation types; scoped or forged inputs cannot invoke. */
export function requireReportedStepRecorder(
  logger: unknown,
): asserts logger is ReportedStepRecorder | undefined {
  if (logger !== undefined && (!(logger instanceof ReportedStepRecorder) || !instances.has(logger)))
    throw new TypeError(
      'Native invocation requires a full ReportedStepRecorder (legacy full SubFlowLogger)',
    );
}

/** Allocate a short node-local group; the owning node visit already supplies the namespace. */
export function bindNativeReportedStepRecorder(
  logger: ReportedStepRecorder,
  kind: string,
  definitionId: string,
): ScopedReportedStepRecorder {
  requireReportedStepRecorder(logger);
  return logger.fork(stores.get(logger)!.nextNativeSubnodeId(kind, definitionId));
}

/**
 * Create a logger bound to one active execution visit.
 *
 * Only execution contexts inside this package should call it: the resulting object is the sole
 * way to append reported steps to the current record.
 *
 * @param owner Object that owns the visit. `readReportedStepRecorder` compares this identity before
 *   returning any step.
 * @param active Reports whether the visit is still open; a detached logger returns write=-1 and fix=false.
 * @param content Reports whether content-level detail is enabled. When false, summaries and
 *   payloads are dropped before anything is stored.
 * @param changed Runtime receiver called after each accepted write/fix with its delta and immutable snapshot.
 * @param identity Diagnostic run and span the logger belongs to; used to reject cross-scope reads.
 * @returns A frozen logger instance.
 */
export function createStepRecorder(
  owner: object,
  active: () => boolean,
  content: () => boolean,
  changed: (
    logger: ReportedStepRecorder,
    progress: ReportedStepProgress,
    steps: readonly Step[],
  ) => void,
  identity?: Readonly<DiagnosticIdentity>,
): ReportedStepRecorder {
  let root: ReportedStepRecorder;
  let visit:
    { active: typeof active; content: typeof content; changed: typeof changed } | undefined = {
    active,
    content,
    changed,
  };
  // A reentrant detach can invalidate the scope while its activity callback is running.
  const activeVisit = () => {
    const current = visit;
    const isActive = current?.active;
    return isActive?.() && visit === current ? current : undefined;
  };
  const hasContent = () => {
    const includeContent = visit?.content;
    return includeContent?.() === true;
  };
  class Logger {
    #steps: readonly Step[] = Object.freeze([]);
    #records: readonly Step[] = Object.freeze([]);
    #warnings = new Set<string>();
    #nativeCalls = new Map<string, number>();
    constructor() {
      instances.set(this, {
        owner,
        identity,
        read: () => this.#records,
        detach: () => {
          // Retained read-only instances must not keep the runtime or App consumers alive.
          owner = {};
          instances.get(this)!.owner = owner;
          visit = undefined;
        },
      });
      snapshots.set(this.#records, { identity });
      Object.freeze(this);
    }
    #save(step: Step, operation: 'write' | 'fix'): boolean {
      if (!activeVisit()) return false;
      // Logical heads validate revisions; only the immutable ledger is published or queried.
      const next =
        operation === 'write'
          ? [...this.#steps, step]
          : this.#steps.map((item) => (item.stepId === step.stepId ? step : item));
      // Successors must resolve inside this logger, otherwise the recorded graph would have
      // dangling edges.
      breakWhile(
        step.nextStepIds?.some((id) => !next.some((item) => item.stepId === id)),
        () => new TypeError('Sub-flow successors must belong to this logger'),
      );
      const record: Step = Object.freeze({
        ...step,
        operation,
        stepId: operation === 'write' ? step.stepId : invocationId(),
        ...(operation === 'fix' ? { targetStepId: step.stepId } : {}),
        sequence: this.#records.length + 1,
        createdAtMs: Date.now(),
      });
      const records = Object.freeze([...this.#records, record]);
      breakWhile(
        next.length > 256 || records.length > 1024 || JSON.stringify(records).length > 65536,
        () => new RangeError('Sub-flow log limit exceeded'),
      );
      const publish = activeVisit()?.changed;
      if (!publish) return false;
      this.#steps = Object.freeze(next);
      this.#records = records;
      snapshots.set(records, { identity });
      publish(
        root,
        {
          operation,
          type: record.type,
          subnodeId: record.subnodeId,
          relatedInvocationId: record.relatedInvocationId,
          stepId: record.stepId,
          ...(record.targetStepId ? { targetStepId: record.targetStepId } : {}),
          sequence: record.sequence,
          revision: record.revision,
          createdAtMs: record.createdAtMs,
          status: record.status,
          ...(record.usedModel === undefined ? {} : { usedModel: record.usedModel }),
        },
        records,
      );
      return true;
    }
    write(input: ReportedStepInput): string | -1 {
      if (!activeVisit()) {
        this.warn('write', 'inactive');
        return -1;
      }
      try {
        const id = this.#append(input);
        if (id === -1) this.warn('write', 'inactive');
        return id;
      } catch (error) {
        this.warn('write', rejectionReason(error));
        return -1;
      }
    }
    /** Validate a new record before committing it; public write returns -1 on failure. */
    #append(input: ReportedStepInput): string | -1 {
      fields(input, writeFields);
      breakWhile(
        input.nextStepIds !== undefined && !Array.isArray(input.nextStepIds),
        () => new TypeError('Invalid sub-flow successors'),
      );
      const now = Date.now(),
        status = input.status === undefined ? 'planned' : input.status;
      // Timestamps are derived from the status: a running or terminal step gets a start time,
      // a terminal step also an end time, using the caller's value when one is supplied.
      const step: Step = {
        origin: 'reported',
        stepId: invocationId(),
        sequence: this.#records.length + 1,
        revision: 1,
        createdAtMs: now,
        type: input.type ?? input.kind,
        ...(input.subnodeId === undefined ? {} : { subnodeId: input.subnodeId }),
        name: input.name,
        kind: input.kind ?? input.type!,
        status,
        ...(input.parentStepId === undefined ? {} : { parentStepId: input.parentStepId }),
        ...(input.relatedDefinitionId === undefined
          ? {}
          : { relatedDefinitionId: input.relatedDefinitionId }),
        ...(input.relatedInvocationId === undefined
          ? {}
          : { relatedInvocationId: input.relatedInvocationId }),
        ...(input.caseId === undefined ? {} : { caseId: input.caseId }),
        ...(input.usedModel === undefined ? {} : { usedModel: input.usedModel }),
        ...(input.startedAtMs === undefined && status !== 'running'
          ? {}
          : { startedAtMs: input.startedAtMs ?? now }),
        ...(input.endedAtMs === undefined && !reportedStepStatusCatalog[status]?.terminal
          ? {}
          : { endedAtMs: input.endedAtMs ?? now }),
        ...(input.nextStepIds === undefined
          ? {}
          : { nextStepIds: Object.freeze([...input.nextStepIds]) }),
      };
      if (hasContent()) {
        // Summaries and payloads are omitted entirely when content logging is off, so a
        // metadata-only consumer never receives them.
        if (input.summary !== undefined) Object.assign(step, { summary: input.summary });
        if (input.payload !== undefined)
          Object.assign(step, { payload: payloadSnapshot(input.payload) });
      }
      validate(step);
      breakWhile(
        step.parentStepId && !this.#steps.some((item) => item.stepId === step.parentStepId),
        () => new TypeError('Sub-flow parent must belong to this logger'),
      );
      return this.#save(Object.freeze(step), 'write') ? step.stepId : -1;
    }
    fix(stepId: string | -1, patch: ReportedStepUpdate): boolean {
      if (!activeVisit()) {
        this.warn('fix', 'inactive');
        return false;
      }
      if (stepId === -1) {
        this.warn('fix', 'target');
        return false;
      }
      try {
        const fixed = this.#applyFix(stepId, patch);
        if (!fixed) this.warn('fix', 'inactive');
        return fixed;
      } catch (error) {
        this.warn('fix', rejectionReason(error));
        return false;
      }
    }
    /** Validate a revision completely before committing it; public fix reports failure as false. */
    #applyFix(stepId: string, patch: ReportedStepUpdate): boolean {
      fields(patch, fixFields);
      const previous = this.#steps.find((step) => step.stepId === stepId)!;
      // The assertion above only satisfies the type checker; this check rejects an unknown id.
      breakWhile(!previous, () => new TypeError('Unknown sub-flow step'));
      const terminal = reportedStepStatusCatalog[previous.status].terminal;
      // A terminal step is sealed: its outcome, model use and timestamps cannot be rewritten.
      breakWhile(
        terminal && patch.status !== undefined && patch.status !== previous.status,
        () => new TypeError('Terminal sub-flow status is sealed'),
      );
      breakWhile(
        terminal &&
          previous.usedModel !== undefined &&
          patch.usedModel !== undefined &&
          previous.usedModel !== patch.usedModel,
        () => new TypeError('Terminal sub-flow model use is sealed'),
      );
      breakWhile(
        previous.usedModel === true && patch.usedModel === false,
        () => new TypeError('Cannot undo reported model use'),
      );
      breakWhile(
        patch.status !== undefined &&
          patch.status !== previous.status &&
          // Transitions are catalog-driven; a terminal status has no successors at all.
          !(reportedStepStatusCatalog[previous.status].next as readonly string[]).includes(
            patch.status,
          ),
        () => new TypeError('Invalid sub-flow status transition'),
      );
      for (const key of ['startedAtMs', 'endedAtMs'] as const)
        breakWhile(
          previous[key] !== undefined && patch[key] !== undefined && patch[key] !== previous[key],
          () => new TypeError('Cannot overwrite a sub-flow time'),
        );
      const status = patch.status ?? previous.status;
      breakWhile(
        patch.nextStepIds !== undefined &&
          (!Array.isArray(patch.nextStepIds) ||
            (previous.nextStepIds !== undefined &&
              JSON.stringify(previous.nextStepIds) !== JSON.stringify(patch.nextStepIds))),
        () => new TypeError('Cannot overwrite sub-flow successors'),
      );
      // A start time is auto-stamped only when the step becomes running and had none; an end
      // time is added once the status becomes terminal.
      const step: Step = {
        ...previous,
        revision: previous.revision + 1,
        status,
        ...(patch.nextStepIds === undefined
          ? {}
          : { nextStepIds: Object.freeze([...patch.nextStepIds]) }),
        ...(patch.usedModel === undefined ? {} : { usedModel: patch.usedModel }),
        ...(patch.startedAtMs === undefined &&
        !(status === 'running' && previous.startedAtMs === undefined)
          ? {}
          : { startedAtMs: patch.startedAtMs ?? Date.now() }),
        ...(patch.endedAtMs === undefined &&
        (!reportedStepStatusCatalog[status]?.terminal || previous.endedAtMs !== undefined)
          ? {}
          : { endedAtMs: patch.endedAtMs ?? Date.now() }),
      };
      if (hasContent()) {
        // A fix may add a summary once and fill missing payload fields, but it cannot replace
        // a summary or a recorded payload value.
        if (patch.summary !== undefined) {
          breakWhile(
            previous.summary !== undefined && previous.summary !== patch.summary,
            () => new TypeError('Cannot overwrite a sub-flow summary'),
          );
          Object.assign(step, { summary: patch.summary });
        }
        if (patch.payload !== undefined)
          Object.assign(step, {
            payload: fill(previous.payload ?? {}, payloadSnapshot(patch.payload)),
          });
      }
      validate(step);
      return this.#save(Object.freeze(step), 'fix');
    }
    owns(stepId: string | -1, subnodeId: string): boolean {
      return this.#steps.some((step) => step.stepId === stepId && step.subnodeId === subnodeId);
    }
    isActive(): boolean {
      return activeVisit() !== undefined;
    }
    /** Count starts, including failed/cancelled calls; each node visit owns a fresh store. */
    nextNativeSubnodeId(kind: string, definitionId: string): string {
      const key = JSON.stringify([kind, definitionId]);
      const next = (this.#nativeCalls.get(key) ?? 0) + 1;
      this.#nativeCalls.set(key, next);
      return `${kind}:${encodeURIComponent(definitionId)}:${next}`;
    }
    /** Deduplicate safe developer warnings in the sole owning store, including delegated calls. */
    warn(operation: 'write' | 'fix', reason: RejectionReason): void {
      const key = `${operation}:${reason}`;
      if (this.#warnings.has(key)) return;
      this.#warnings.add(key);
      try {
        console.warn(`[agent-core:subflow] ${operation} rejected: ${rejectionReasons[reason]}`);
      } catch {
        /* A console extension cannot change logging return values. */
      }
    }
    readAll(): readonly Step[] {
      return this.#records;
    }
  }
  const store = new Logger();
  root = new ReportedStepRecorder(loggerToken, store);
  instances.set(root, instances.get(store)!);
  return root;
}

/**
 * Read the steps recorded by a logger issued by this module.
 *
 * The instance is resolved through the private registry, so a lookalike's `readAll` method is
 * never called and a logger cannot be borrowed across executions.
 *
 * @param input Candidate logger; must be an instance created by `createStepRecorder`.
 * @param owner Expected owning execution visit. Omit to accept any owner.
 * @param identity Expected run and span. Omit to accept any diagnostic scope.
 * @returns The recorded steps in write order, as an immutable list shared with the logger.
 * @throws TypeError when the value is not a registered logger, belongs to another owner, or
 *   belongs to another diagnostic scope.
 */
export function readReportedStepRecorder(
  input: unknown,
  owner?: object,
  identity?: Readonly<DiagnosticIdentity>,
): readonly Readonly<ReportedStepRecord>[] {
  const instance = input && typeof input === 'object' ? instances.get(input) : undefined;
  breakWhile(
    !instance || (owner !== undefined && owner !== instance.owner),
    () => new TypeError("Expected this execution's ReportedStepRecorder instance"),
  );
  breakWhile(
    identity &&
      (instance!.identity?.runId !== identity.runId ||
        instance!.identity?.spanId !== identity.spanId),
    () => new TypeError('Sub-flow logger belongs to another diagnostic scope'),
  );
  return instance!.read();
}

/** Release execution callbacks while preserving the instance's immutable query history. */
export function detachReportedStepRecorder(logger: ReportedStepRecorder): void {
  instances.get(logger)?.detach();
}

/** @deprecated Use `ReportedStepRecorder`. Kept as a 0.9 compatibility alias. */
export { ReportedStepRecorder as SubFlowLogger };

/** @deprecated Use `ScopedReportedStepRecorder`. Kept as a 0.9 compatibility alias. */
export { ScopedReportedStepRecorder as ScopedSubFlowLogger };

/** @deprecated Use `captureReportedStepSnapshot`. Kept as a 0.9 compatibility alias. */
export { captureReportedStepSnapshot as captureSubFlowSnapshot };

/** @deprecated Use `requireReportedStepRecorder`. Kept as a 0.9 compatibility alias. */
export { requireReportedStepRecorder as requireSubFlowLogger };

/** @deprecated Use `bindNativeReportedStepRecorder`. Kept as a 0.9 compatibility alias. */
export { bindNativeReportedStepRecorder as bindNativeSubFlowLogger };

/** @deprecated Use `createStepRecorder`. Kept as a 0.9 compatibility alias. */
export { createStepRecorder as createSubFlowLogger };

/** @deprecated Use `readReportedStepRecorder`. Kept as a 0.9 compatibility alias. */
export { readReportedStepRecorder as readSubFlowLogger };

/** @deprecated Use `detachReportedStepRecorder`. Kept as a 0.9 compatibility alias. */
export { detachReportedStepRecorder as detachSubFlowLogger };
