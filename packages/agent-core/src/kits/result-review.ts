/**
 * Result review: bounded inspection and optional review of App-owned results.
 * Scope and references are validated here; truth, authorization, persistence and commits stay
 * with the host. No Runner, storage, waiting gate or scheduler is created by this Kit.
 */
import { awaitWithSignal } from '../utils/cancellation.js';
import type * as T from '../structs/kits/result-review.js';
import type { OperationContext } from '../structs/common.js';

/** Require an opaque, nonempty host identity. */
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError('Invalid result review identity');
}
/** Copy a unique identity list; duplicate references are rejected rather than hidden. */
function ids(value: readonly string[]): string[] {
  if (!Array.isArray(value)) throw new TypeError('Expected result review references');
  Array.from(value).forEach(id);
  if (new Set(value).size !== value.length)
    throw new TypeError('Duplicate result review references');
  return [...value];
}
/** Limits are explicit and finite; zero allows a caller to report skipped coverage. */
function limit(value: number | undefined, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 0)
    throw new TypeError('Invalid result review limit');
  return result;
}
/** Snapshot trusted metadata while preserving the exact App result value. */
function requestOf<Value>(request: T.ResultReviewRequest<Value>): T.ResultReviewRequest<Value> {
  if (!request?.scope || !Array.isArray(request.inputs))
    throw new TypeError('Invalid review request');
  const { id: scopeId, contentRevision, policyRevision } = request.scope;
  [scopeId, contentRevision, policyRevision].forEach(id);
  ids(request.inputs.map((input) => input.id));
  const inputs = request.inputs.map((input: T.ResultReviewInput<Value>) => {
    id(input.sourceId);
    if (input.scopeId !== scopeId) throw new TypeError('Result outside trusted review scope');
    if (!Array.isArray(input.versions)) throw new TypeError('Invalid source versions');
    ids(
      input.versions.map(
        (version: { readonly resourceId: string; readonly revision: string }) => version.resourceId,
      ),
    );
    const versions = input.versions.map(
      (version: { readonly resourceId: string; readonly revision: string }) => {
        id(version.revision);
        return Object.freeze({ resourceId: version.resourceId, revision: version.revision });
      },
    );
    return Object.freeze({
      ...input,
      versions: Object.freeze(versions),
      evidenceIds: Object.freeze(ids(input.evidenceIds)),
    });
  });
  return Object.freeze({
    scope: Object.freeze({ id: scopeId, contentRevision, policyRevision }),
    inputs: Object.freeze(inputs),
    maxCandidates: limit(request.maxCandidates, 64),
  });
}
/** Verify a candidate cannot expand beyond the host-declared input set. */
function candidateOf(
  candidate: T.ResultReviewCandidate,
  known: Set<string>,
): T.ResultReviewCandidate {
  id(candidate?.id);
  const inputIds = ids(candidate.inputIds);
  if (!inputIds.length || inputIds.some((ref) => !known.has(ref)))
    throw new TypeError('Unknown review input');
  return Object.freeze({ id: candidate.id, inputIds: Object.freeze(inputIds) });
}
/** Validate model-facing findings and detach their mutable metadata. */
function findingOf(
  finding: T.ResultReviewFinding,
  candidate: T.ResultReviewCandidate,
  request: T.ResultReviewRequest<unknown>,
  detectorId: string,
): T.ResultReviewFinding {
  id(finding?.id);
  id(finding.kind);
  id(finding.reason);
  if (!['suspected', 'confirmed'].includes(finding.state) || typeof finding.blocking !== 'boolean')
    throw new TypeError('Invalid review finding');
  const inputIds = ids(finding.inputIds),
    evidenceIds = ids(finding.evidenceIds);
  const evidence = new Set(
    request.inputs
      .filter((input) => inputIds.includes(input.id))
      .flatMap((input) => [...input.evidenceIds]),
  );
  if (
    !inputIds.length ||
    inputIds.some((ref) => !candidate.inputIds.includes(ref)) ||
    evidenceIds.some((ref) => !evidence.has(ref))
  )
    throw new TypeError('Unknown finding reference');
  return Object.freeze({
    id: `${detectorId}:${finding.id}`,
    kind: finding.kind,
    state: finding.state,
    reason: finding.reason,
    blocking: finding.blocking,
    inputIds: Object.freeze(inputIds),
    evidenceIds: Object.freeze(evidenceIds),
  });
}
/** A result cannot be reused for another content or policy revision. */
function matches(result: T.ResultReviewResult, scope: T.ResultReviewScope): boolean {
  return (
    result?.scope?.id === scope.id &&
    result.scope.contentRevision === scope.contentRevision &&
    result.scope.policyRevision === scope.policyRevision
  );
}

/** Bind detector and strategy methods once, preserving prototype receivers. */
export function defineResultReview<Value, App>(
  definition: T.ResultReviewDefinition<Value, App>,
): T.ResultReview<Value, App> {
  if (!Array.isArray(definition?.detectors) || !Array.isArray(definition.strategies ?? []))
    throw new TypeError('Invalid review definition');
  ids(definition.detectors.map((detector) => detector.id));
  ids((definition.strategies ?? []).map((strategy) => strategy.id));
  const detectors = definition.detectors.map((detector) => {
    const blocking = detector.blocking;
    if (blocking !== undefined && typeof blocking !== 'boolean' && typeof blocking !== 'function')
      throw new TypeError('Invalid detector blocking policy');
    if (typeof detector.candidates !== 'function' || typeof detector.run !== 'function')
      throw new TypeError('Invalid detector');
    return {
      id: detector.id,
      blocking: typeof blocking === 'function' ? blocking.bind(detector) : blocking,
      candidates: detector.candidates.bind(detector),
      run: detector.run.bind(detector),
    };
  });
  const strategies = (definition.strategies ?? []).map((strategy) => {
    if (typeof strategy.when !== 'function' || typeof strategy.run !== 'function')
      throw new TypeError('Invalid review strategy');
    return {
      id: strategy.id,
      when: strategy.when.bind(strategy),
      run: strategy.run.bind(strategy),
    };
  });
  return Object.freeze({
    async inspect(input: T.ResultReviewRequest<Value>, context: OperationContext<App>) {
      const request = requestOf(input),
        signal = context.signal;
      signal.throwIfAborted();
      const known = new Set(request.inputs.map((item) => item.id));
      const findings: T.ResultReviewFinding[] = [],
        coverage: T.ResultReviewCoverage[] = [];
      let remaining = request.maxCandidates!;
      for (const detector of detectors) {
        signal.throwIfAborted();
        const raw = detector.candidates(request);
        if (!Array.isArray(raw)) throw new TypeError('Detector candidates must be synchronous');
        const candidates = raw.map((candidate) => candidateOf(candidate, known));
        ids(candidates.map((candidate) => candidate.id));
        const inspected: string[] = [],
          skipped: string[] = [];
        let failed = false,
          attempted = 0,
          reason: string | undefined;
        for (const candidate of candidates) {
          if (!remaining) {
            skipped.push(candidate.id);
            reason ??= 'candidate-limit';
            continue;
          }
          remaining--;
          attempted++;
          let output: Awaited<ReturnType<typeof detector.run>>;
          try {
            output = await awaitWithSignal(detector.run(candidate, request, context), signal);
          } catch (error) {
            signal.throwIfAborted();
            if (error instanceof Error && error.name === 'TimeoutError') throw error;
            failed = true;
            skipped.push(candidate.id);
            reason = error instanceof Error ? error.message : 'detector-failed';
            continue;
          }
          signal.throwIfAborted();
          if (!output || typeof output.complete !== 'boolean' || !Array.isArray(output.findings))
            throw new TypeError('Invalid detector result');
          for (const finding of output.findings) {
            let valid = findingOf(finding, candidate, request, detector.id);
            if (detector.blocking !== undefined) {
              const blocking =
                typeof detector.blocking === 'function'
                  ? detector.blocking(valid)
                  : detector.blocking;
              if (typeof blocking !== 'boolean')
                throw new TypeError('Review blocking predicates must return boolean synchronously');
              valid = Object.freeze({ ...valid, blocking });
            }
            if (findings.some((previous) => previous.id === valid.id))
              throw new TypeError('Duplicate review finding');
            findings.push(valid);
          }
          if (output.complete) inspected.push(candidate.id);
          else {
            skipped.push(candidate.id);
            reason ??= output.reason ?? 'detector-incomplete';
          }
        }
        const status = failed
          ? 'failed'
          : skipped.length
            ? attempted
              ? 'partial'
              : 'not-run'
            : 'complete';
        coverage.push(
          Object.freeze({
            detectorId: detector.id,
            status,
            inspected: Object.freeze(inspected),
            skipped: Object.freeze(skipped),
            ...(reason === undefined ? {} : { reason }),
          }),
        );
      }
      return Object.freeze({
        scope: request.scope,
        findings: Object.freeze(findings),
        coverage: Object.freeze(coverage),
      });
    },
    async resolve(
      input: T.ResultReviewRequest<Value>,
      result: T.ResultReviewResult,
      context: OperationContext<App>,
      options: { readonly maxRounds?: number } = {},
    ) {
      const request = requestOf(input),
        maxRounds = limit(options.maxRounds, 2),
        signal = context.signal;
      signal.throwIfAborted();
      const restored = checkedResult(result);
      if (!matches(restored, request.scope)) throw new TypeError('Stale result review');
      const all = { id: 'restored', inputIds: request.inputs.map((input) => input.id) };
      for (const finding of restored.findings) findingOf(finding, all, request, 'restored');
      const resolutions: T.ResultReviewResolution[] = [];
      for (const finding of restored.findings) {
        let selected: (typeof strategies)[number] | undefined;
        for (const strategy of strategies) {
          const eligible = strategy.when(finding);
          if (typeof eligible !== 'boolean')
            throw new TypeError('Review strategy predicates must be synchronous booleans');
          if (eligible) {
            selected = strategy;
            break;
          }
        }
        if (!selected) {
          resolutions.push({
            findingId: finding.id,
            strategyId: '',
            status: 'unresolved',
            reason: 'no-strategy',
            rounds: 0,
          });
          continue;
        }
        let resolution: T.ResultReviewResolution = {
          findingId: finding.id,
          strategyId: selected.id,
          status: 'unresolved',
          reason: 'round-limit',
          rounds: 0,
        };
        const progress = new Set<string>();
        for (let round = 0; round < maxRounds; round++) {
          signal.throwIfAborted();
          const output = await awaitWithSignal(selected.run(finding, request, context), signal);
          signal.throwIfAborted();
          if (!output || !['resolved', 'unresolved', 'needs-answer'].includes(output.status))
            throw new TypeError('Invalid review resolution');
          id(output.reason);
          resolution = {
            findingId: finding.id,
            strategyId: selected.id,
            status: output.status,
            reason: output.reason,
            rounds: round + 1,
          };
          if (output.status !== 'unresolved') break;
          if (!output.progress || progress.has(output.progress)) {
            resolution = { ...resolution, reason: 'no-progress' };
            break;
          }
          id(output.progress);
          progress.add(output.progress);
        }
        resolutions.push(Object.freeze(resolution));
      }
      return Object.freeze(resolutions);
    },
  });
}

/** Validate a restored result independently of any recipe-specific persistence decoder. */
function checkedResult(value: T.ResultReviewResult): T.ResultReviewResult {
  const data = (item: unknown): item is Record<string, unknown> => {
    if (
      !item ||
      typeof item !== 'object' ||
      (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)
    )
      return false;
    return Reflect.ownKeys(item).every(
      (key) =>
        typeof key === 'string' &&
        Object.getOwnPropertyDescriptor(item, key)?.enumerable &&
        'value' in Object.getOwnPropertyDescriptor(item, key)!,
    );
  };
  if (!data(value)) throw new TypeError('Invalid review result');
  const { scope, findings, coverage } = value;
  if (!data(scope) || !Array.isArray(findings) || !Array.isArray(coverage))
    throw new TypeError('Invalid review result');
  [scope.id, scope.contentRevision, scope.policyRevision].forEach(id);
  for (const finding of findings) {
    if (!data(finding)) throw new TypeError('Invalid review finding');
    [finding.id, finding.kind, finding.reason].forEach(id);
    if (
      typeof finding.blocking !== 'boolean' ||
      !['suspected', 'confirmed'].includes(finding.state as string)
    )
      throw new TypeError('Invalid review finding');
    if (!ids(finding.inputIds as string[]).length) throw new TypeError('Empty finding inputs');
    ids(finding.evidenceIds as string[]);
  }
  ids(findings.map((finding) => finding.id));
  for (const entry of coverage) {
    if (!data(entry)) throw new TypeError('Invalid review coverage');
    id(entry.detectorId);
    if (!['complete', 'partial', 'not-run', 'failed'].includes(entry.status as string))
      throw new TypeError('Invalid review coverage');
    const inspected = ids(entry.inspected as string[]),
      skipped = ids(entry.skipped as string[]);
    if (
      inspected.some((ref) => skipped.includes(ref)) ||
      (entry.status === 'complete' && skipped.length)
    )
      throw new TypeError('Invalid review coverage');
    if (entry.reason !== undefined) id(entry.reason);
  }
  ids(coverage.map((entry) => entry.detectorId));
  return { scope, findings, coverage };
}

/** Pure preflight only: hosts must reauthorize and recheck these conditions at atomic commit. */
export function checkReviewAdmission(request: T.ResultReviewAdmissionRequest): {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
} {
  ids(request.requiredDetectorIds);
  id(request.contentRevision);
  id(request.policyRevision);
  id(request.scopeId);
  const result = checkedResult(request.result);
  const reasons: string[] = [];
  if (
    result.scope.contentRevision !== request.contentRevision ||
    result.scope.policyRevision !== request.policyRevision ||
    result.scope.id !== request.scopeId
  )
    reasons.push('stale-review');
  for (const detectorId of request.requiredDetectorIds) {
    const coverage = result.coverage.find((item) => item.detectorId === detectorId);
    if (!coverage || coverage.status !== 'complete' || coverage.skipped.length)
      reasons.push(`incomplete:${detectorId}`);
  }
  const resolved = new Set(ids(request.resolvedFindingIds ?? []));
  const known = new Set(result.findings.map((finding) => finding.id));
  if ([...resolved].some((ref) => !known.has(ref))) throw new TypeError('Unknown resolved finding');
  for (const finding of result.findings)
    if (finding.blocking && !resolved.has(finding.id)) reasons.push(`blocking:${finding.id}`);
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons) });
}
export type * from '../structs/kits/result-review.js';
