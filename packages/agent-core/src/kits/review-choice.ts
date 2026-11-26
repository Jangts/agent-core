/**
 * Optional existing-summary review recipe. Hosts own projection, hashing, identity, current
 * source checks and atomic storage. This module performs no business writes or model routing.
 */
import { defineResultReview, checkReviewAdmission } from './result-review.js';
import { defineWaitGate } from './waiting.js';
import { defineReviewDecision } from './review-decision.js';
import type * as T from '../structs/kits/review-choice.js';

const gateId = 'professional-result-choice';
/** Strict plain data records avoid getters, hidden fields and implicit coercion on stored data. */
function record(v: unknown): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === 'object' &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null) &&
    Reflect.ownKeys(v).every(
      (k) =>
        typeof k === 'string' &&
        Object.getOwnPropertyDescriptor(v, k)?.enumerable &&
        'value' in Object.getOwnPropertyDescriptor(v, k)!,
    )
  );
}
/** Validate finite schema keys, including optional fields. */
function keys(v: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(v).every((k) => allowed.includes(k));
}
function text(v: unknown, max = 10000): v is string {
  return typeof v === 'string' && !!v.trim() && v.length <= max;
}
function strings(v: unknown): v is string[] {
  return Array.isArray(v) && Array.from(v).every((x) => text(x)) && new Set(v).size === v.length;
}
/** JSON comparison independent of object insertion order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (record(v))
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
/** Validate local binding shape; actual resource versions and parent identity are host facts. */
function binding(v: unknown): boolean {
  return (
    record(v) &&
    keys(v, [
      'parentTaskId',
      'disputeId',
      'contentRevision',
      'sourceVersions',
      'policyRevision',
      'waitIdentity',
      'actionId',
      'deadlineAtMs',
    ]) &&
    ['parentTaskId', 'disputeId', 'contentRevision', 'policyRevision', 'actionId'].every((k) =>
      text(v[k]),
    ) &&
    record(v.sourceVersions) &&
    Object.entries(v.sourceVersions).every(([k, r]) => text(k) && text(r)) &&
    record(v.waitIdentity) &&
    keys(v.waitIdentity, ['taskId', 'waitId', 'subject']) &&
    ['taskId', 'waitId', 'subject'].every((k) =>
      text((v.waitIdentity as Record<string, unknown>)[k]),
    ) &&
    Number.isSafeInteger(v.deadlineAtMs) &&
    (v.deadlineAtMs as number) >= 0
  );
}
/** Validate only the bounded answer syntax. Coverage checks belong to isReviewChoiceAnswer. */
function answer(v: unknown): v is T.ReviewChoiceAnswer {
  return record(v) && keys(v, ['inputId', 'reason']) && text(v.inputId, 100) && text(v.reason, 800);
}
/** A user cannot choose an incomplete member or bypass unfinished mandatory comparison. */
export function isReviewChoiceAnswer(
  review: T.ReviewChoice,
  v: unknown,
): v is T.ReviewChoiceAnswer {
  return (
    answer(v) &&
    review.inputs.every((i) => i.complete) &&
    review.assessment.coverage.length === 1 &&
    review.assessment.coverage[0].detectorId === 'semantic' &&
    review.assessment.coverage[0].status === 'complete' &&
    review.assessment.coverage[0].skipped.length === 0 &&
    review.inputs.some((i) => i.id === v.inputId)
  );
}
/** Strict shape and local association validation; deliberately does not verify business hashes. */
export function isReviewChoice(value: unknown): value is T.ReviewChoice {
  if (
    !record(value) ||
    !keys(value, ['version', 'status', 'inputs', 'assessment', 'binding', 'wait', 'accepted']) ||
    value.version !== 1 ||
    !['ready', 'waiting', 'incomplete'].includes(value.status as string) ||
    !Array.isArray(value.inputs) ||
    value.inputs.length < 1 ||
    value.inputs.length > 2 ||
    !binding(value.binding)
  )
    return false;
  if (
    !value.inputs.every(
      (i) =>
        record(i) &&
        keys(i, ['id', 'summary', 'complete']) &&
        text(i.id, 100) &&
        text(i.summary, 4000) &&
        typeof i.complete === 'boolean',
    ) ||
    new Set(value.inputs.map((i) => i.id)).size !== value.inputs.length
  )
    return false;
  const b = value.binding as unknown as T.ReviewChoice['binding'],
    a = value.assessment;
  if (
    !record(a) ||
    !keys(a, ['scope', 'findings', 'coverage']) ||
    !record(a.scope) ||
    !keys(a.scope, ['id', 'contentRevision', 'policyRevision']) ||
    a.scope.id !== b.parentTaskId ||
    a.scope.contentRevision !== b.contentRevision ||
    a.scope.policyRevision !== b.policyRevision ||
    !Array.isArray(a.findings) ||
    !Array.isArray(a.coverage) ||
    a.coverage.length !== 1
  )
    return false;
  const inputIds = new Set(value.inputs.map((i) => i.id));
  if (
    !a.findings.every(
      (f) =>
        record(f) &&
        keys(f, ['id', 'kind', 'state', 'reason', 'blocking', 'inputIds', 'evidenceIds']) &&
        text(f.id) &&
        text(f.kind) &&
        text(f.reason) &&
        ['suspected', 'confirmed'].includes(f.state as string) &&
        typeof f.blocking === 'boolean' &&
        strings(f.inputIds) &&
        f.inputIds.length > 0 &&
        f.inputIds.every((i) => inputIds.has(i)) &&
        strings(f.evidenceIds) &&
        f.evidenceIds.length === 0,
    ) ||
    new Set(a.findings.map((f) => f.id)).size !== a.findings.length
  )
    return false;
  if (
    !a.coverage.every(
      (c) =>
        record(c) &&
        keys(c, ['detectorId', 'status', 'inspected', 'skipped', 'reason']) &&
        c.detectorId === 'semantic' &&
        ['complete', 'partial', 'not-run', 'failed'].includes(c.status as string) &&
        strings(c.inspected) &&
        strings(c.skipped) &&
        c.inspected.every((i) => i === 'opinions') &&
        c.skipped.every((i) => i === 'opinions') &&
        c.inspected.every((i) => !(c.skipped as string[]).includes(i)) &&
        (c.reason === undefined || text(c.reason)) &&
        (c.status !== 'complete' || (c.skipped.length === 0 && c.inspected.length === 1)),
    )
  )
    return false;
  const r = value as unknown as T.ReviewChoice;
  if (
    value.accepted !== undefined &&
    (!record(value.accepted) ||
      !keys(value.accepted, ['submissionId', 'result']) ||
      !text(value.accepted.submissionId) ||
      !isReviewChoiceAnswer(r, value.accepted.result))
  )
    return false;
  if (value.wait !== undefined) {
    const w = value.wait;
    if (
      !record(w) ||
      !keys(w, [
        'version',
        'definitionId',
        'revision',
        'identity',
        'expiresAtMs',
        'status',
        'submission',
      ]) ||
      w.version !== 1 ||
      w.definitionId !== gateId ||
      w.revision !== '1' ||
      canonical(w.identity) !== canonical(b.waitIdentity) ||
      !Number.isSafeInteger(w.expiresAtMs) ||
      (w.expiresAtMs as number) < 0 ||
      (w.expiresAtMs as number) > b.deadlineAtMs ||
      !['pending', 'resolved', 'cancelled'].includes(w.status as string)
    )
      return false;
    if (w.status === 'resolved') {
      if (
        !record(w.submission) ||
        !keys(w.submission, ['id', 'answer']) ||
        !text(w.submission.id) ||
        !isReviewChoiceAnswer(r, w.submission.answer)
      )
        return false;
    } else if (w.submission !== undefined) return false;
  }
  if (
    r.accepted &&
    (r.wait?.status !== 'resolved' ||
      r.wait.submission.id !== r.accepted.submissionId ||
      canonical(r.wait.submission.answer) !== canonical(r.accepted.result))
  )
    return false;
  const covered =
    r.inputs.every((i) => i.complete) &&
    r.assessment.coverage.every((c) => c.status === 'complete' && c.skipped.length === 0);
  const blocking = r.assessment.findings.some((f) => f.blocking);
  if (r.status === 'ready' && (!covered || (blocking && !r.accepted))) return false;
  if (r.status === 'waiting' && (!covered || !blocking || r.accepted)) return false;
  if (r.status === 'incomplete' && covered) return false;
  return true;
}
function checkedReviewChoice(value: unknown, message: string): T.ReviewChoice {
  if (!isReviewChoice(value)) throw new TypeError(message);
  return value;
}

/** Inspect trusted projections using the caller's existing model port and cancellation lifetime. */
export async function inspectReviewChoices(
  options: T.ReviewChoiceInspection,
): Promise<T.ReviewChoice> {
  const inputs = structuredClone(options.inputs),
    scope = structuredClone(options.scope),
    b = structuredClone(options.binding);
  if (
    !Array.isArray(inputs) ||
    inputs.length < 1 ||
    inputs.length > 2 ||
    !Array.from(inputs).every(
      (i) =>
        record(i) &&
        keys(i, ['id', 'summary', 'complete']) &&
        text(i.id, 100) &&
        text(i.summary, 4000) &&
        typeof i.complete === 'boolean',
    ) ||
    new Set(inputs.map((i) => i.id)).size !== inputs.length
  )
    throw new TypeError('Invalid review choice inputs');
  if (
    !binding(b) ||
    scope.id !== b.parentTaskId ||
    scope.contentRevision !== b.contentRevision ||
    scope.policyRevision !== b.policyRevision ||
    canonical(Object.fromEntries(options.versions.map((v) => [v.resourceId, v.revision]))) !==
      canonical(b.sourceVersions) ||
    new Set(options.versions.map((v) => v.resourceId)).size !== options.versions.length
  )
    throw new TypeError('Invalid review choice association');
  const review = defineResultReview<T.ReviewChoiceInput, {}>({
    detectors: [
      {
        id: 'semantic',
        candidates: () => [{ id: 'opinions', inputIds: inputs.map((i) => i.id) }],
        async run(candidate) {
          if (inputs.some((i) => !i.complete))
            return { findings: [], complete: false, reason: 'member-incomplete' };
          if (inputs.length < 2) return { findings: [], complete: true };
          const parsed: unknown = JSON.parse(await options.compare(structuredClone(inputs)));
          if (
            !record(parsed) ||
            !keys(parsed, ['conflict', 'reason']) ||
            typeof parsed.conflict !== 'boolean' ||
            !text(parsed.reason, 800)
          )
            throw new TypeError('Invalid review comparison');
          return {
            complete: true,
            findings: parsed.conflict
              ? [
                  {
                    id: 'opinion',
                    kind: 'opinion-disagreement',
                    state: 'suspected' as const,
                    inputIds: candidate.inputIds,
                    evidenceIds: [],
                    reason: parsed.reason,
                    blocking: true,
                  },
                ]
              : [],
          };
        },
      },
    ],
  });
  const assessment = await review.inspect(
    {
      scope,
      inputs: inputs.map((i) => ({
        id: i.id,
        sourceId: i.id,
        scopeId: scope.id,
        versions: options.versions,
        evidenceIds: [],
        value: i,
      })),
    },
    { app: {}, signal: options.signal },
  );
  const covered =
    inputs.every((i) => i.complete) && assessment.coverage.every((c) => c.status === 'complete');
  const allowed = checkReviewAdmission({
    result: assessment,
    requiredDetectorIds: ['semantic'],
    scopeId: scope.id,
    contentRevision: scope.contentRevision,
    policyRevision: scope.policyRevision,
  }).allowed;
  const result: T.ReviewChoice = {
    version: 1,
    inputs,
    assessment,
    binding: b,
    status: allowed ? 'ready' : covered ? 'waiting' : 'incomplete',
  };
  return checkedReviewChoice(result, 'Invalid review choice result');
}
/** Bind selection under a shared host record lock; no model call or new budget is introduced. */
export function bindReviewChoiceDecision(
  initial: T.ReviewChoice,
  host: T.ReviewChoiceHost,
): T.ReviewChoiceDecision {
  const snapshot = structuredClone(checkedReviewChoice(initial, 'Invalid review choice')),
    authorize = host.authorize.bind(host),
    read = host.read.bind(host),
    save = host.save.bind(host);
  const context = { app: {}, signal: host.signal };
  const current = async () => checkedReviewChoice(await read(), 'Invalid stored review choice');
  const gate = defineWaitGate<T.ReviewChoiceAnswer, {}>(
    {
      id: gateId,
      revision: '1',
      isAnswer: (v) => isReviewChoiceAnswer(snapshot, v),
      authorize: () => authorize(),
    },
    {
      store: {
        exclusive: (_key, run) => run(),
        load: async () => (await current()).wait,
        save: async (_key, wait) => {
          const r = await current();
          await save({ ...r, wait });
        },
      },
    },
  );
  const decision = defineReviewDecision<T.ReviewChoiceAnswer, T.ReviewChoiceAnswer, {}>({
    binding: snapshot.binding,
    gate,
    authorize: () => authorize(),
    read: async () => {
      const r = await current();
      return r.accepted
        ? { binding: r.binding, status: 'accepted', ...r.accepted }
        : { binding: r.binding, status: 'pending' };
    },
    accept: async ({ binding, submissionId, answer }) => {
      await authorize();
      const r = await current();
      if (
        canonical(r.binding) !== canonical(binding) ||
        Date.now() >= binding.deadlineAtMs ||
        !isReviewChoiceAnswer(r, answer)
      )
        throw new Error('REVIEW_CHOICE_STALE');
      if (
        r.accepted &&
        (r.accepted.submissionId !== submissionId ||
          canonical(r.accepted.result) !== canonical(answer))
      )
        throw new Error('REVIEW_CHOICE_CONFLICT');
      if (
        r.wait?.status !== 'resolved' ||
        r.wait.submission.id !== submissionId ||
        canonical(r.wait.submission.answer) !== canonical(answer)
      )
        throw new Error('REVIEW_CHOICE_STALE');
      if (!r.accepted)
        await save(
          { ...r, status: 'ready', accepted: { submissionId, result: answer } },
          r.inputs.find((i) => i.id === answer.inputId)!.summary,
        );
      return { binding, status: 'accepted', submissionId, result: answer };
    },
  });
  return { context, decision };
}
export type * from '../structs/kits/review-choice.js';
