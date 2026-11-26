/*
 * Shared fixture for the context tests: an App-style adapter around `ModelRunner`.
 *
 * `contextRunner` builds the two shapes a real App uses. Inputs without fragments
 * go straight to the Runner (so budget and transport behaviour stays the plain
 * Core path), while a ContextPlan goes through a `createContextProcessingNode`
 * followed by a `send` node that invokes the same Runner with the prepared
 * request. That is what makes "context processing and answer share one call
 * budget" testable without repeating the wiring in every file.
 *
 * Exports adapter only; no tests are defined here.
 */
import {
  AgentCoreEngine,
  ModelRunner,
  Support,
  ValidationError,
  defineWorkflow,
} from '../dist/esm/index.js';

/** App-style test adapter: explicit context node, then the same request-bound Core Runner. */
export function contextRunner(options) {
  const {
    contextPolicy: policy,
    contextCompressors: compressors,
    contextSelectors: selectors,
    ...settings
  } = options;
  const runner = new ModelRunner(settings).bind(settings.execution ?? {}),
    invoke = runner.invoke.bind(runner);
  const model = {
    prepare: runner.prepare.bind(runner),
    invoke,
    execution: runner.execution,
    get remainingCalls() {
      return runner.remainingCalls;
    },
    get callCount() {
      return runner.callCount;
    },
    get totalCallCount() {
      return runner.totalCallCount;
    },
  };
  const workflow = defineWorkflow({
    id: 'context-fixture',
    nodes: [
      Support.createContextProcessingNode({
        id: 'context',
        description: 'Process this request context',
        policy,
        compressors,
        selectors,
        timeoutMs: settings.callTimeoutMs,
        plan: (state) => state.call.input,
        request: (state) => ({
          stageId: state.call.stageId,
          transport: state.call.transport,
          maxOutputTokens: state.call.maxOutputTokens,
        }),
        update: (result) => ({ context: result }),
        routes: [{ targetNodeId: 'send' }],
      }),
      {
        id: 'send',
        description: 'Send the measured request',
        async run(state, context) {
          return {
            result: await invoke({
              input: state.context.input,
              prepared: state.context.prepared,
              diagnostics: context.diagnostics,
              signal: context.signal,
            }),
          };
        },
        routes: [{ complete: (state) => state.result }],
      },
    ],
  });
  runner.invoke = async (request) => {
    const call = typeof request === 'string' ? { input: request } : request;
    // Non-plan input skips the workflow, but a reducing policy still refuses it:
    // the App contract is that fragments-based callers must supply a ContextPlan.
    if (Array.isArray(call.input) || !call.input?.fragments) {
      if (policy && policy.mode !== 'validate')
        throw new ValidationError([
          { code: 'CONTEXT_POLICY', message: 'This App context workflow requires a ContextPlan' },
        ]);
      return invoke(request);
    }
    const engine = new AgentCoreEngine({
      workflow,
      execution: {
        signal: runner.signal,
        diagnostics: call.diagnostics ?? runner.execution.diagnostics,
      },
    });
    return engine.bindModelRuntime(model).run({ call });
  };
  return runner;
}
