/** Executable matrix App: one decision, real Tools Kit hooks, Core execution and observed hooks. */
import { AgentCoreEngine, Support, defineWorkflow } from '@jangts/agent-core';
import { ToolLifecycleRegistry } from '@jangts/agent-core/kits/tools';
import { pathToFileURL } from 'node:url';

const intents = [
  { id: 'status', toolIds: ['read', 'note'], description: 'Explain the demo status' },
  { id: 'greeting', toolIds: [], description: 'Reply without tools' },
];
const stages = [
  { nodeId: 'inspect', hook: 'inspect', mode: 'all', method: 'assertDecision' },
  { nodeId: 'authorize', hook: 'authorize', mode: 'selected', method: 'authorize' },
  { nodeId: 'complete', hook: 'complete', mode: 'selected', method: 'complete' },
  { nodeId: 'present', hook: 'visibleText', mode: 'all', method: 'visibleText' },
];
const identity = (value) => value;

/** Fresh ports isolate every request; the scripted provider is a test double, not semantic evidence. */
export function createMatrixReference(options = {}) {
  const controller = new AbortController();
  const ledger = { calls: [], tools: [], hooks: [], events: [] };
  const implementations = {
    inspectDecision() {},
    authorizeRead(_decision, context) {
      if (context.denied) throw new Error('Permission denied');
    },
    completeRead(decision) {
      return decision;
    },
    preserveText(text) {
      return text;
    },
    optionalText(text) {
      if (options.optionalFailure) throw new Error('Optional presentation unavailable');
      return text;
    },
  };
  const definitions = [
    {
      id: 'read',
      callable: true,
      hooks: {
        inspect: 'inspectDecision',
        authorize: 'authorizeRead',
        complete: 'completeRead',
        visibleText: 'preserveText',
      },
      execute() {
        if (options.cancel) controller.abort();
        controller.signal.throwIfAborted();
        if (options.toolFailure) throw new Error('Monitor unavailable');
        return { status: 'online', source: 'monitor:7' };
      },
    },
    {
      id: 'note',
      hooks: { inspect: 'inspectDecision', visibleText: 'optionalText' },
      execute: () => 'note',
    },
  ];
  const bindings = definitions.flatMap((tool) =>
    stages
      .filter((stage) => tool.hooks[stage.hook])
      .map((stage) => ({
        id: `${stage.nodeId}/${tool.id}/${stage.hook}`,
        nodeId: stage.nodeId,
        toolId: tool.id,
        hook: stage.hook,
        mode: stage.mode,
        handler: tool.hooks[stage.hook],
        intentIds: ['status'],
      })),
  );
  const registry = new ToolLifecycleRegistry({
    registration: {
      isValidId: () => true,
      kinds: ['read'],
      audiences: ['model'],
      effects: ['read'],
      goalExists: (id) => intents.some((item) => item.id === id),
    },
    outputs: () => [],
    domainToolIds: () => intents.map((item) => item.id),
    contextFragment: (_tool, field) => ({ value: { [field.key]: field.value } }),
  });
  for (const tool of definitions)
    registry.register({
      id: tool.id,
      description: tool.id,
      kind: 'read',
      audience: 'model',
      effect: 'read',
      domainToolIds: ['status'],
      parseInput: identity,
      parseOutput: identity,
      execute: tool.execute,
      lifecycle: Object.fromEntries(
        bindings
          .filter((binding) => binding.toolId === tool.id)
          .map((binding) => [
            binding.hook,
            function observed(value, context) {
              const record = { bindingId: binding.id, nodeId: binding.nodeId, toolId: tool.id };
              ledger.hooks.push(record);
              const step = context.logger.write({
                name: binding.handler,
                kind: 'lifecycle',
                relatedDefinitionId: binding.id,
                status: 'running',
              });
              try {
                const result = implementations[binding.handler](value, context);
                context.logger.fix(step, { status: 'success' });
                return result;
              } catch (error) {
                context.logger.fix(step, { status: 'error' });
                throw error;
              }
            },
          ]),
      ),
    });
  const toolCatalog = Support.defineToolCatalog(
    definitions
      .filter((tool) => tool.callable)
      .map((tool) => ({
        id: tool.id,
        description: tool.id,
        kind: 'read',
        inputSchema: { jsonSchema: { type: 'object' }, parse: identity },
        authorize(_input, { app }) {
          if (app.denied) throw new Error('Permission denied');
        },
        execute: tool.execute,
        parseOutput: identity,
      })),
  );
  const recover = (state) => ({
    answer: state.answer || 'The status could not be confirmed.',
    partial: true,
  });
  const hookContext = (context) => ({
    denied: options.denied,
    logger: context.createStepRecorder(),
  });
  const workflow = defineWorkflow({
    id: 'lifecycle-matrix',
    entryNodeId: 'decide',
    traceSource: async () => ({
      events: ledger.events,
      coverage: { complete: true, content: 'included', issues: [] },
    }),
    nodes: [
      {
        id: 'decide',
        description: 'One model proposal contains intent and next tool',
        onErrorNodeId: 'recover',
        async run(_state, { model }) {
          const { value } = await model.invoke({
            input: JSON.stringify({
              intents,
              callableTools: definitions.filter((tool) => tool.callable).map((tool) => tool.id),
              question: options.greeting ? 'Hello' : 'Demo status?',
            }),
          });
          const decision = JSON.parse(value);
          const intent = intents.find((item) => item.id === decision.intent);
          if (
            !intent ||
            (decision.next &&
              (!intent.toolIds.includes(decision.next.type) ||
                !definitions.some((tool) => tool.id === decision.next.type && tool.callable))) ||
            (!decision.next && decision.intent !== 'greeting')
          )
            throw new Error('Invalid intent/tool pairing');
          return { decision, ...(decision.intent === 'greeting' ? { answer: 'Hello!' } : {}) };
        },
        routes: [
          { when: (state) => Boolean(state.answer), targetNodeId: 'deliver' },
          { targetNodeId: 'inspect' },
        ],
      },
      ...stages
        .filter((stage) => stage.nodeId !== 'present')
        .map((stage) => ({
          id: stage.nodeId,
          description: `${stage.mode} lifecycle ${stage.hook}`,
          onErrorNodeId: 'recover',
          run(state, context) {
            const decision = registry[stage.method](state.decision, hookContext(context));
            if (stage.hook === 'complete' && decision) return { decision };
          },
          routes: [
            {
              targetNodeId: { inspect: 'authorize', authorize: 'execute', complete: 'present' }[
                stage.nodeId
              ],
            },
          ],
        })),
      {
        id: 'execute',
        description: 'Execute the authorized selected tool',
        onErrorNodeId: 'recover',
        async run(state, { tools }) {
          const result = await tools.invoke({ toolId: state.decision.next.type, input: {} });
          return {
            evidence: result.value,
            answer: `${result.value.status} (${result.value.source})`,
          };
        },
        routes: [{ targetNodeId: 'complete' }],
      },
      {
        id: 'present',
        description: 'Optional presentation keeps the verified answer',
        onErrorNodeId: 'recover',
        run(state, context) {
          return { answer: registry.visibleText(state.answer, hookContext(context)) };
        },
        routes: [{ targetNodeId: 'deliver' }],
      },
      {
        id: 'recover',
        description: 'Program recovery retains committed work',
        run: recover,
        routes: [{ targetNodeId: 'deliver' }],
      },
      {
        id: 'deliver',
        description: 'Deliver truthful result',
        routes: [
          {
            complete: (state) => ({
              answer: state.answer,
              partial: Boolean(state.partial),
              evidence: state.evidence,
            }),
          },
        ],
      },
    ],
  });
  const provider = {
    async *stream(messages) {
      ledger.calls.push(messages);
      if (options.modelFailure) throw new Error('Model unavailable');
      yield JSON.stringify(
        options.proposal ??
          (options.greeting
            ? { intent: 'greeting' }
            : { intent: 'status', next: { type: 'read' } }),
      );
    },
  };
  const engine = new AgentCoreEngine({
    workflow,
    model: { provider, maxCalls: 1 },
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
  }).bindToolRuntime(toolCatalog.bind({ app: { denied: options.denied } }));
  const inspection = {
    workflow,
    tools: definitions.map((tool) => ({
      id: tool.id,
      registered: true,
      description: tool.callable ? 'Callable read tool' : 'Lifecycle-only contributor',
    })),
    lifecycleMatrix: { intents, bindings },
  };
  return { engine, workflow, state: {}, ledger, inspection };
}

// Loading the inspector entry does not execute a model, hook or tool.
export const inspection = createMatrixReference().inspection;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reference = createMatrixReference();
  console.log(
    JSON.stringify(
      {
        result: await reference.engine.run(reference.state),
        hooks: reference.ledger.hooks,
        calls: reference.ledger.calls.length,
      },
      null,
      2,
    ),
  );
}
