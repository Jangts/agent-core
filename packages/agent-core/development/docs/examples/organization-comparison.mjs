/** Two App organizations over the same service-status task; Core owns all scheduling. */
import { AgentCoreEngine, Support, defineWorkflow } from '@jangts/agent-core';
import { pathToFileURL } from 'node:url';

const fact = { service: 'demo', status: 'online', latencyMs: 12, source: 'monitor:7', revision: 7 };
const identity = (value) => value;
const scope = 'account-demo';
const request = { scope, key: 'request-7' };
const checkCancellation = (controller) => controller.signal.throwIfAborted();

/** Construct fresh fixture ports. Writes use a stable request key and authoritative receipts. */
function fixture(options, ledger) {
  const receipts = new Map(options.receipt ? [['request-7', options.receipt]] : []);
  return Support.defineToolCatalog(
    [
      {
        id: 'read',
        kind: 'read',
        execute() {
          if (options.cancelAt === 'read') options.controller.abort();
          if (options.readFailure) throw new Error('monitor unavailable');
          return {
            ...fact,
            status: options.status ?? fact.status,
            noise: 'duplicate '.repeat(options.longContext ? 1000 : 1),
          };
        },
      },
      {
        id: 'save',
        kind: 'write',
        execute(input) {
          if (options.cancelAt === 'save') options.controller.abort();
          if (receipts.has(input.key)) return receipts.get(input.key);
          ledger.effects++;
          const receipt = { id: input.key, scope: input.scope, confirmed: true };
          receipts.set(input.key, receipt);
          if (options.unknownWrite) throw new Error('connection lost after write');
          return receipt;
        },
      },
      {
        id: 'receipt',
        kind: 'read',
        execute(input) {
          if (options.receiptFailure) throw new Error('receipt store unavailable');
          return options.unresolvedWrite ? null : receipts.get(input.key);
        },
      },
      ...['incident', 'deployment'].map((id) => ({
        id,
        kind: 'read',
        execute() {
          return options.noProgress
            ? null
            : {
                source: id + ':7',
                explanation:
                  id === 'incident' ? 'Regional disruption confirmed' : 'Deployment in progress',
              };
        },
      })),
      {
        id: 'optional',
        kind: 'read',
        execute() {
          if (options.optionalFailure) throw new Error('optional checker unavailable');
          return 'checked';
        },
      },
    ].map((tool) => ({
      ...tool,
      description: tool.id,
      inputSchema: { jsonSchema: { type: 'object' }, parse: identity },
      authorize(input, { app }) {
        ledger.authorizations.push({ toolId: tool.id, scope: input.scope, key: input.key });
        if (
          input.scope !== app.scope ||
          (['save', 'receipt'].includes(tool.id) && input.key !== app.key) ||
          (tool.id === 'receipt' && options.denyReceipt)
        )
          throw new Error('Outside authorized request scope');
      },
      parseOutput: identity,
    })),
  );
}

/** Shared business handlers commit durable-in-state outputs before optional work. */
function handlers(options, ledger, controller) {
  return {
    async understand(state, { model }) {
      if (!state.question) return { blocked: 'Which service should be checked?' };
      const { value } = await model.invoke({
        input: 'Interpret service request: ' + state.question,
      });
      if (value !== 'demo') return { blocked: 'Please identify a supported service.' };
      return { service: value };
    },
    async read(state, { tools }) {
      if (state.evidence) return {};
      try {
        return { evidence: (await tools.invoke({ toolId: 'read', input: request })).value };
      } catch {
        checkCancellation(controller);
        return { blocked: 'The monitor is unavailable; status is unverified.' };
      }
    },
    async detail(state, { tools }) {
      const toolId = state.evidence.status === 'degraded' ? 'incident' : 'deployment';
      try {
        const { value } = await tools.invoke({ toolId, input: request });
        return {
          detail: value,
          detailAttempted: true,
          ...(value ? {} : { partial: 'No new explanation evidence; investigation stopped.' }),
        };
      } catch {
        checkCancellation(controller);
        return {
          detailAttempted: true,
          partial: 'Explanation evidence unavailable; status retained.',
        };
      }
    },
    async draft(state, { model, report }) {
      // Project known redundant fields, retain authoritative facts; no summarizer is needed.
      const { noise, ...evidence } = state.evidence;
      ledger.projection = {
        before: JSON.stringify(state.evidence).length,
        after: JSON.stringify(evidence).length,
      };
      report({ payload: { phase: 'projected', ...ledger.projection } });
      ledger.assessment = Support.assessModelBudget({
        budget: model.callBudget,
        work: { execution: 0, review: 0, delivery: 1, recovery: 0 },
        alternativesExhausted: true,
      });
      if (ledger.assessment.action === 'expand') {
        ledger.budget = model.adjustCallBudget({
          limit: ledger.assessment.suggestedLimit,
          reason: ledger.assessment.reason,
        });
      }
      if (!model.callBudget.remaining)
        return {
          answer: `${evidence.service}: ${evidence.status}, ${evidence.latencyMs}ms (${evidence.source})`,
          partial: 'Synthesis unavailable at the authorized ceiling.',
        };
      try {
        return {
          answer: (
            await model.invoke({
              input:
                'Explain verified facts: ' + JSON.stringify({ ...evidence, detail: state.detail }),
            })
          ).value,
        };
      } catch {
        checkCancellation(controller);
        return {
          answer: `${evidence.service}: ${evidence.status}, ${evidence.latencyMs}ms (${evidence.source})`,
          partial: 'Narrative generation failed; verified facts retained.',
        };
      }
    },
    async save(state, { tools }) {
      if (
        state.receipt?.confirmed &&
        state.receipt.id === request.key &&
        state.receipt.scope === request.scope
      )
        return {};
      try {
        return {
          receipt: (
            await tools.invoke({
              toolId: 'save',
              input: { ...request, answer: state.answer },
            })
          ).value,
        };
      } catch {
        checkCancellation(controller);
        // Never retry the write on an unknown result. Reconcile against the source of truth.
        try {
          const { value } = await tools.invoke({ toolId: 'receipt', input: request });
          return value
            ? { receipt: value }
            : { pending: 'Save outcome unknown; verify request-7 before retrying.' };
        } catch {
          checkCancellation(controller);
          return { pending: 'Save outcome unknown; receipt verification unavailable.' };
        }
      }
    },
    async format({ answer }) {
      try {
        if (options.formatFailure) throw new Error('format repair failed');
        return { formatted: answer.trim() };
      } catch {
        return { formatWarning: 'Presentation repair unavailable; original answer retained.' };
      }
    },
    async optional(_state, { tools }) {
      if (options.cancel) controller.abort();
      try {
        await tools.invoke({ toolId: 'optional', input: request });
        return {};
      } catch (error) {
        if (controller.signal.aborted) throw error;
        return { warning: 'Optional check unavailable; the answer is retained.' };
      }
    },
  };
}

/** Select the next unresolved evidence gap, never replaying a completed effect. */
function nextWork(state) {
  if (!state.service) return 'understand';
  if (!state.evidence) return 'read';
  if (state.evidence.status !== 'online' && !state.detailAttempted) return 'detail';
  if (!state.answer) return 'draft';
  if (!state.saveAttempted) return 'save';
  if (!state.checked) return 'optional';
  if (!state.formatAttempted) return 'format';
  return undefined;
}
const deliver = (state) => ({
  answer: state.answer,
  evidence: state.evidence,
  receipt: state.receipt,
  blocked: state.blocked,
  partial: state.partial,
  pending: state.pending,
  warning: state.warning,
  formatWarning: state.formatWarning,
  formatted: state.formatted,
  detail: state.detail,
});

/** Choose lifecycle boundaries without adding a scheduler or model-driven known transitions. */
export function createReference(organization = 'use-case', options = {}) {
  if (!['use-case', 'exploration'].includes(organization)) throw new Error('Unknown organization');
  const ledger = { calls: [], tools: [], events: [], authorizations: [], effects: 0 };
  const controller = new AbortController();
  const work = handlers(options, ledger, controller);
  const workflow = defineWorkflow({
    id: `service-${organization}`,
    nodes:
      organization === 'use-case'
        ? [
            {
              id: 'understand',
              description: 'Resolve the service request',
              run: work.understand,
              routes: [
                { when: (s) => Boolean(s.blocked), complete: deliver },
                { targetNodeId: 'explain-status' },
              ],
            },
            {
              id: 'explain-status',
              description:
                'Produce a sourced service explanation: read, resolve evidence gaps, synthesize',
              async run(state, context) {
                const update = { ...(await work.read(state, context)) };
                if (update.blocked) return update;
                const current = { ...state, ...update };
                if (current.evidence.status !== 'online')
                  Object.assign(update, await work.detail(current, context));
                return { ...update, ...(await work.draft({ ...state, ...update }, context)) };
              },
              routes: [
                { when: (s) => Boolean(s.blocked), complete: deliver },
                { targetNodeId: 'save' },
              ],
            },
            {
              id: 'save',
              description: 'Save answer or reconcile an uncertain write',
              run: work.save,
              routes: [{ targetNodeId: 'optional' }],
            },
            {
              id: 'optional',
              description: 'Optional check without vetoing the answer',
              run: work.optional,
              routes: [{ targetNodeId: 'format' }],
            },
            {
              id: 'format',
              description: 'Repair presentation locally without reopening tools',
              run: work.format,
              routes: [{ complete: deliver }],
            },
          ]
        : [
            {
              id: 'explore',
              description: 'Resolve the next evidence gap until an answer and save outcome exist',
              async run(state, context) {
                const action = nextWork(state);
                context.report({ payload: { action } });
                const update = await work[action](state, context);
                return {
                  ...update,
                  ...(action === 'save' ? { saveAttempted: true } : {}),
                  ...(action === 'optional' ? { checked: true } : {}),
                  ...(action === 'format' ? { formatAttempted: true } : {}),
                };
              },
              routes: [
                { when: (state) => Boolean(state.blocked) || !nextWork(state), complete: deliver },
                { targetNodeId: 'explore' },
              ],
            },
          ],
  });
  const catalog = fixture({ ...options, controller }, ledger);
  const provider = {
    async *stream(messages) {
      const input = messages.at(-1).content;
      ledger.calls.push(input);
      if (options.modelFailure && input.startsWith('Explain')) throw new Error('model unavailable');
      if (options.cancelAt === (input.startsWith('Interpret') ? 'understand' : 'draft'))
        controller.abort();
      if (input.startsWith('Interpret')) yield 'demo';
      else {
        const facts = JSON.parse(input.slice('Explain verified facts: '.length));
        yield (
          `${facts.service} is ${facts.status} with ${facts.latencyMs}ms latency (${facts.source}).` +
          (facts.detail ? ' ' + facts.detail.explanation : '')
        );
      }
    },
  };
  const engine = new AgentCoreEngine({
    workflow,
    model: { provider, maxCalls: 1, maxTotalCalls: options.hardLimit ? 1 : 2 },
    execution: {
      signal: controller.signal,
      observe: {
        accepts: () => true,
        event(event) {
          ledger.events.push(event);
          if (event.type === 'tool.call') ledger.tools.push(event.payload.toolId);
        },
      },
    },
  }).bindToolRuntime(catalog.bind({ app: request }));
  return {
    engine,
    workflow,
    ledger,
    state: {
      question: options.missing ? '' : 'Explain demo status and save the answer.',
      ...(options.cached ? { evidence: { ...fact } } : {}),
      ...(options.receipt ? { receipt: options.receipt } : {}),
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const organization of ['use-case', 'exploration']) {
    const { engine, state, ledger } = createReference(organization, {
      longContext: true,
      optionalFailure: true,
    });
    const result = await engine.run(state);
    console.log(
      JSON.stringify(
        {
          organization,
          result: {
            ...result,
            evidence: result.evidence && { ...result.evidence, noise: undefined },
          },
          calls: ledger.calls.length,
          tools: ledger.tools,
          effects: ledger.effects,
          budget: ledger.budget,
          projection: ledger.projection,
          visits: ledger.events
            .filter((e) => e.type === 'workflow.event' && e.payload.event.type === 'enter')
            .map((e) => e.payload.event.nodeId),
        },
        null,
        2,
      ),
    );
  }
}
