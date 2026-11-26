/**
 * Associate one persisted result-review decision with an existing Waiting gate.
 * This optional App-side adapter centralizes expected identity checks, not a scheduler.
 */
import type { OperationContext } from '../structs/common.js';
import type {
  ReviewDecision,
  ReviewDecisionBinding,
  ReviewDecisionDefinition,
  ReviewDecisionState,
} from '../structs/kits/review-decision.js';
import { awaitAssertion } from '../utils/cancellation.js';

/** Fail with a stable diagnostic category; messages are technical, not user presentation. */
function reject(code: string): never {
  throw Object.assign(new Error(code), { code });
}

/** Copy validated plain association data so caller mutation cannot retarget a decision. */
function bindingOf(value: ReviewDecisionBinding): ReviewDecisionBinding {
  if (!value || !value.waitIdentity || !value.sourceVersions) reject('REVIEW_DECISION_BINDING');
  const identity = value.waitIdentity;
  const { parentTaskId, disputeId, contentRevision, policyRevision, actionId, deadlineAtMs } =
    value;
  if (
    [
      parentTaskId,
      disputeId,
      contentRevision,
      policyRevision,
      actionId,
      identity.taskId,
      identity.waitId,
      identity.subject,
    ].some((v) => typeof v !== 'string' || !v.trim()) ||
    !Number.isSafeInteger(deadlineAtMs) ||
    deadlineAtMs < 0
  )
    reject('REVIEW_DECISION_BINDING');
  const sources = Object.entries(value.sourceVersions);
  if (
    sources.some(([key, version]) => !key.trim() || typeof version !== 'string' || !version.trim())
  )
    reject('REVIEW_DECISION_BINDING');
  return {
    parentTaskId,
    disputeId,
    contentRevision,
    policyRevision,
    actionId,
    deadlineAtMs,
    waitIdentity: { taskId: identity.taskId, waitId: identity.waitId, subject: identity.subject },
    sourceVersions: Object.fromEntries(sources.sort(([a], [b]) => a.localeCompare(b))),
  };
}

/** Bind stable ports once; request identity, signal and current authorization remain per call. */
export function defineReviewDecision<Answer, Result, App>(
  definition: ReviewDecisionDefinition<Answer, Result, App>,
): ReviewDecision<Answer, Result, App> {
  const binding = bindingOf(definition?.binding);
  if (
    !definition?.gate ||
    typeof definition.authorize !== 'function' ||
    typeof definition.read !== 'function' ||
    typeof definition.accept !== 'function'
  )
    throw new TypeError('Invalid review decision ports');
  const authorize = definition.authorize.bind(definition),
    read = definition.read.bind(definition),
    accept = definition.accept.bind(definition);
  const gate = definition.gate,
    now = definition.now?.bind(definition) ?? Date.now;
  const expected = JSON.stringify(binding);
  const check = (state: ReviewDecisionState<Result>): ReviewDecisionState<Result> => {
    if (!state || JSON.stringify(bindingOf(state.binding)) !== expected)
      reject('REVIEW_DECISION_STALE');
    if (state.status !== 'pending' && state.status !== 'accepted') reject('REVIEW_DECISION_STATE');
    if (
      state.status === 'accepted' &&
      (typeof state.submissionId !== 'string' || !state.submissionId.trim())
    )
      reject('REVIEW_DECISION_STATE');
    return structuredClone(state);
  };
  const current = async (
    operation: 'open' | 'respond' | 'read' | 'continue',
    context: OperationContext<App>,
  ) => {
    context.signal.throwIfAborted();
    await awaitAssertion(
      () => authorize(structuredClone(binding), { ...context, operation }),
      context.signal,
      'Review authorization must return void',
    );
    const state = check(await read(structuredClone(binding), context));
    context.signal.throwIfAborted();
    return state;
  };
  return Object.freeze({
    async open(request, context) {
      await current('open', context);
      if (
        !Number.isSafeInteger(request.expiresAtMs) ||
        request.expiresAtMs > binding.deadlineAtMs ||
        now() >= binding.deadlineAtMs
      )
        reject('REVIEW_DECISION_EXPIRED');
      return gate.open({ ...request, identity: structuredClone(binding.waitIdentity) }, context);
    },
    async respond(request, context) {
      await current('respond', context);
      return gate.respond({ ...request, identity: structuredClone(binding.waitIdentity) }, context);
    },
    async read(context) {
      const state = await current('read', context);
      if (state.status === 'accepted') {
        const wait = await gate.read(structuredClone(binding.waitIdentity), context);
        if (wait.status !== 'resolved' || state.submissionId !== wait.submission.id)
          reject('REVIEW_DECISION_CONFLICT');
      }
      return state;
    },
    async continue(context) {
      const state = await current('continue', context);
      const wait = await gate.read(structuredClone(binding.waitIdentity), context);
      context.signal.throwIfAborted();
      if (state.status === 'accepted') {
        if (wait.status !== 'resolved' || state.submissionId !== wait.submission.id)
          reject('REVIEW_DECISION_CONFLICT');
        return state;
      }
      if (wait.status !== 'resolved') return state;
      if (now() >= binding.deadlineAtMs) reject('REVIEW_DECISION_EXPIRED');
      context.signal.throwIfAborted();
      // Do not abandon an in-flight atomic acceptance on cancellation. The host must settle it.
      const accepted = check(
        await accept(
          {
            binding: structuredClone(binding),
            submissionId: wait.submission.id,
            answer: structuredClone(wait.submission.answer),
          },
          context,
        ),
      );
      if (accepted.status !== 'accepted' || accepted.submissionId !== wait.submission.id)
        reject('REVIEW_DECISION_CONFLICT');
      context.signal.throwIfAborted();
      return accepted;
    },
  } satisfies ReviewDecision<Answer, Result, App>);
}

export type * from '../structs/kits/review-decision.js';
