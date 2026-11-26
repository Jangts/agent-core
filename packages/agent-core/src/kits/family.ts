/**
 * Branch versioning Kit: version App state that hangs off Core branches, with fork, merge and promote.
 *
 * Place in the package: an optional App-side library. A branch-version record is a bounded, expiring collection
 * of immutable versions; each version pairs a branch snapshot with App state. The Kit owns
 * revision checks, capacity, retention and lineage rules; the store, authorization, validation
 * and merge policy stay with the App. No executable function or authority is restored here.
 *
 * Exports: `defineBranchVersioning`, `BranchVersions`, the branch-version record/version/operation types and
 * `branchVersionOperations`.
 */
import { invocationId } from '../utils/invocation.js';
import { awaitWithSignal, awaitAssertion } from '../utils/cancellation.js';
import { booleanResult } from '../utils/synchronous.js';
import { breakWhile } from '../utils/rules.js';
import { snapshotBranch as branchSnapshot } from '../execution/branch.js';
import type { OperationContext } from '../structs/common.js';
import type {
  BranchVersioning,
  BranchVersioningDefinition,
  BranchVersionRecord,
  BranchVersion,
  BranchVersionOperation,
} from '../structs/kits/family.js';

/**
 * Compile a versioned family backed by an App-owned compare-and-swap store.
 *
 * Every mutation reads the record, verifies the caller's expected revision, then commits with
 * a compare-and-swap, so concurrent writers fail with a revision conflict rather than
 * overwriting each other. Reads are also treated as policy checks because the App binds its
 * read rules into the store it supplies.
 *
 * @param definition - Store, authorization, validation, state predicate, branch/state snapshots
 *   and optional merge handler, clock and bounds.
 * @returns A frozen family with `read`, `create`, `fork`, `merge` and `promote`.
 * @throws A configured error (often `TypeError`) for an invalid id, expired or unknown record,
 *   revision conflict, exhausted capacity, lineage mismatch, missing merge configuration,
 *   invalid merge result, or changed active version.
 */
export function defineBranchVersioning<State, App>(
  definition: BranchVersioningDefinition<State, App>,
): BranchVersioning<State, App> {
  const store = {
    load: definition.store.load.bind(definition.store),
    compareAndSwap: definition.store.compareAndSwap.bind(definition.store),
  };
  const authorize = definition.authorize.bind(definition),
    validate = definition.validate.bind(definition);
  const isState = definition.isState.bind(definition),
    merge = definition.merge?.bind(definition),
    now = definition.now?.bind(definition) ?? Date.now;
  // Bounds are encoded in the record itself: 32 versions and seven days of retention keep the
  // snapshot small enough to clone and compare on every operation.
  const maxVersions = definition.maxVersions ?? 32,
    retentionMs = definition.retentionMs ?? 7 * 86400_000;
  breakWhile(
    !Number.isSafeInteger(maxVersions) ||
      maxVersions < 1 ||
      !Number.isSafeInteger(retentionMs) ||
      retentionMs < 1,
    'Invalid family bounds',
  );
  const validId = (id: string) => typeof id === 'string' && !!id.trim() && id.length <= 200;
  const stateSnapshot = (value: unknown): State => {
    breakWhile(
      !booleanResult(isState(value), 'BranchVersions state predicates must be synchronous'),
      'Invalid family state',
    );
    return structuredClone(value as State);
  };
  /**
   * Load, validate and clone a family record.
   *
   * @param id - BranchVersions id, at most 200 characters.
   * @param context - Operation context supplying the abort signal.
   * @returns A cloned record whose versions, branches and states all passed validation.
   * @throws A configured error for an invalid id, a missing/expired record, or an inconsistent
   *   version.
   */
  const read = async (
    id: string,
    context: OperationContext<App>,
  ): Promise<BranchVersionRecord<State>> => {
    context.signal.throwIfAborted();
    breakWhile(!validId(id), 'Invalid family id');
    const record = structuredClone(await awaitWithSignal(store.load(id), context.signal));
    context.signal.throwIfAborted();
    breakWhile(
      !record ||
        record.id !== id ||
        !Number.isFinite(record.expiresAtMs) ||
        record.expiresAtMs <= now() ||
        !Number.isSafeInteger(record.revision) ||
        record.revision < 1 ||
        !Array.isArray(record.versions) ||
        !record.versions.length ||
        record.versions.length > maxVersions ||
        !record.versions.some((version) => version.id === record.activeId),
      'BranchVersions unavailable',
    );
    const ids = new Set(record!.versions.map((version) => version.id));
    breakWhile(ids.size !== record!.versions.length, 'Duplicate family version');
    for (const item of record!.versions) {
      breakWhile(
        !validId(item.id) ||
          !Number.isFinite(item.createdAtMs) ||
          item.createdAtMs < 0 ||
          [item.parentId, item.baseId, item.mergeSourceId].some(
            (value) => value !== undefined && !ids.has(value),
          ),
        'Invalid family version',
      );
      branchSnapshot(item.branch);
      stateSnapshot(item.state);
    }
    // Reading policy is part of the App's bound store. Mutations also require their explicit
    // operation grant.
    context.signal.throwIfAborted();
    return structuredClone(record!);
  };
  const commit = async (
    record: BranchVersionRecord<State>,
    expected: number | undefined,
    context: OperationContext<App>,
  ): Promise<BranchVersionRecord<State>> => {
    context.signal.throwIfAborted();
    breakWhile(record.expiresAtMs <= now(), 'BranchVersions expired');
    // Wait for storage acknowledgement even when cancellation arrives during its atomic write.
    const saved = await store.compareAndSwap(record.id, expected, structuredClone(record));
    breakWhile(saved !== true, 'BranchVersions revision conflict');
    context.signal.throwIfAborted();
    return structuredClone(record);
  };
  const check = async (
    operation: BranchVersionOperation,
    id: string,
    revision: number,
    context: OperationContext<App>,
  ) => {
    const record = await read(id, context);
    breakWhile(record.revision !== revision, 'BranchVersions revision conflict');
    await awaitAssertion(
      () => authorize(operation, structuredClone(record), context),
      context.signal,
      'BranchVersions authorization must return void',
    );
    return record;
  };
  const version = (record: BranchVersionRecord<State>, id: string): BranchVersion<State> => {
    const selected = record.versions.find((item) => item.id === id);
    breakWhile(!selected, 'Unknown family version');
    return selected!;
  };
  const add = async (
    record: BranchVersionRecord<State>,
    candidate: BranchVersion<State>,
    context: OperationContext<App>,
  ) => {
    breakWhile(record.versions.length >= maxVersions, 'BranchVersions version capacity exhausted');
    await awaitAssertion(
      () => validate(structuredClone(candidate), context),
      context.signal,
      'BranchVersions validation must return void',
    );
    return commit(
      { ...record, revision: record.revision + 1, versions: [...record.versions, candidate] },
      record.revision,
      context,
    );
  };
  return Object.freeze<BranchVersioning<State, App>>({
    /** Clone and validate one family record through the same read path used by mutations. */
    read,
    /**
     * Create a family with one initial version.
     *
     * @param request - BranchVersions id plus its first branch and state.
     * @param context - Operation context; authorization receives `'create'` and no record.
     * @returns The committed record at revision 1.
     * @throws A configured error for an invalid or existing id, or failed authorization or
     *   validation.
     */
    async create(request, context) {
      context.signal.throwIfAborted();
      const { id } = request;
      breakWhile(!validId(id), 'Invalid family id');
      const branch = branchSnapshot(request.branch),
        state = structuredClone(request.state);
      breakWhile(
        !!(await awaitWithSignal(store.load(id), context.signal)),
        'BranchVersions already exists',
      );
      await awaitAssertion(
        () => authorize('create', undefined, context),
        context.signal,
        'BranchVersions authorization must return void',
      );
      const candidate: BranchVersion<State> = {
        id: invocationId(),
        branch,
        state: stateSnapshot(state),
        createdAtMs: now(),
      };
      await awaitAssertion(
        () => validate(structuredClone(candidate), context),
        context.signal,
        'BranchVersions validation must return void',
      );
      return commit(
        {
          id,
          revision: 1,
          activeId: candidate.id,
          expiresAtMs: now() + retentionMs,
          versions: [candidate],
        },
        undefined,
        context,
      );
    },
    /**
     * Add a child version derived from one existing version.
     *
     * @param request - BranchVersions id, expected revision, parent version id, new branch and state.
     * @param context - Operation context; authorization receives `'fork'` and the record.
     * @returns The committed record with the new version appended.
     * @throws A configured error for a stale revision, unknown parent, broken lineage or full
     *   capacity.
     */
    async fork(request, context) {
      context.signal.throwIfAborted();
      const { id, revision, parentId } = request,
        state = structuredClone(request.state);
      const branch = branchSnapshot(request.branch);
      const record = await check('fork', id, revision, context),
        parent = version(record, parentId);
      breakWhile(
        branch.agentId !== parent.branch.agentId ||
          branch.parentBranchId !== parent.branch.branchId ||
          branch.parentAgentVersionId !== parent.branch.agentVersionId ||
          branch.branchId === parent.branch.branchId,
        'Fork lineage mismatch',
      );
      return add(
        record,
        {
          id: invocationId(),
          parentId: parent.id,
          baseId: parent.id,
          branch,
          state: stateSnapshot(state),
          createdAtMs: now(),
        },
        context,
      );
    },
    /**
     * Merge a source version into a target version over their shared base.
     *
     * Conflicts are reported, never resolved here: a non-empty conflict list returns
     * `saved: false` with the unchanged record, so the App decides how to reconcile.
     *
     * @param request - BranchVersions id, expected revision and the base, target and source version ids.
     * @param context - Operation context; authorization receives `'merge'` and the record.
     * @returns `{ saved, record, conflicts }`.
     * @throws A configured error for a stale revision, missing versions, no merge handler, a
     *   missing shared base, or an invalid merge result.
     */
    async merge(request, context) {
      const { id, revision, baseId, targetId, sourceId } = request;
      const record = await check('merge', id, revision, context);
      breakWhile(!merge, 'BranchVersions merge is not configured');
      const base = version(record, baseId),
        target = version(record, targetId),
        source = version(record, sourceId);
      breakWhile(
        source.baseId !== base.id || (target.id !== base.id && target.baseId !== base.id),
        'Merge requires a shared base',
      );
      const result = await awaitWithSignal(
        merge!(
          {
            base: stateSnapshot(base.state),
            target: stateSnapshot(target.state),
            source: stateSnapshot(source.state),
          },
          context,
        ),
        context.signal,
      );
      breakWhile(
        !result ||
          !Array.isArray(result.conflicts) ||
          result.conflicts.some((value) => typeof value !== 'string'),
        'Invalid merge result',
      );
      if (result.conflicts.length)
        return { saved: false, record, conflicts: [...result.conflicts] };
      const candidate: BranchVersion<State> = {
        id: invocationId(),
        parentId: target.id,
        baseId: target.id,
        mergeSourceId: source.id,
        branch: branchSnapshot(source.branch),
        state: stateSnapshot(result.value),
        createdAtMs: now(),
      };
      return { saved: true, record: await add(record, candidate, context), conflicts: [] };
    },
    /**
     * Make an existing version the active one.
     *
     * @param request - BranchVersions id, expected revision, candidate id and the active id the caller
     *   believes is current.
     * @param context - Operation context; authorization receives `'promote'` and the record.
     * @returns The committed record pointing at the candidate.
     * @throws A configured error for a stale revision or active id, an unrelated candidate, or
     *   failed validation.
     */
    async promote(request, context) {
      const { id, revision, candidateId, expectedActiveId } = request;
      const record = await check('promote', id, revision, context),
        candidate = version(record, candidateId);
      breakWhile(
        record.activeId !== expectedActiveId ||
          (candidate.id !== record.activeId && candidate.baseId !== record.activeId),
        'Active family version changed',
      );
      await awaitAssertion(
        () => validate(structuredClone(candidate), context),
        context.signal,
        'BranchVersions validation must return void',
      );
      return commit(
        { ...record, revision: record.revision + 1, activeId: candidate.id },
        record.revision,
        context,
      );
    },
  });
}

/** Namespace object for callers that prefer one import over named helpers. */
export const BranchVersions = Object.freeze({
  defineBranchVersioning,
  /** @deprecated Use defineBranchVersioning. */ defineAgentFamily: defineBranchVersioning,
});
export type * from '../structs/kits/family.js';
/** Operation names accepted by the family `authorize` hook. */
export { branchVersionOperations } from '../structs/kits/family.js';

/** @deprecated Use `defineBranchVersioning`. Kept as a 0.9 compatibility alias. */
export { defineBranchVersioning as defineAgentFamily };

/** @deprecated Use `BranchVersions`. Kept as a 0.9 compatibility alias. */
export { BranchVersions as Family };
