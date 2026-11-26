/** Run an App-owned fixture through the real Engine with scripted model replies and a route trace. */

/** Validate the selected fixture before constructing any App runtime. */
export function validateScenario(scenario) {
  if (
    !scenario ||
    typeof scenario.id !== 'string' ||
    !scenario.id.trim() ||
    typeof scenario.setup !== 'function'
  )
    throw new TypeError('Each scenario needs an id and setup()');
  if (
    Number(typeof scenario.verify === 'function') +
      Number(typeof scenario.verifyError === 'function') !==
      1 ||
    (scenario.verify !== undefined && typeof scenario.verify !== 'function') ||
    (scenario.verifyError !== undefined && typeof scenario.verifyError !== 'function')
  )
    throw new TypeError(`${scenario.id} needs exactly one of verify() or verifyError()`);
  if (
    scenario.timeoutMs !== undefined &&
    (!Number.isSafeInteger(scenario.timeoutMs) ||
      scenario.timeoutMs < 1 ||
      scenario.timeoutMs > 2_147_483_647)
  )
    throw new TypeError(`${scenario.id} has an invalid timeoutMs`);
  if (scenario.replies !== undefined && !Array.isArray(scenario.replies))
    throw new TypeError(`${scenario.id} replies must be an array`);
}

/** Each opened stream consumes one scripted reply, including replies with multiple native parts. */
function scriptedModel(replies) {
  const turns = [...replies].map((reply) => {
    const parts = typeof reply === 'string' ? [reply] : reply;
    if (
      !Array.isArray(parts) ||
      !parts.length ||
      [...parts].some((part) => typeof part !== 'string' && part?.type !== 'function-call-delta')
    )
      throw new TypeError(
        'Each reply must be text or a non-empty array of public ModelPart values',
      );
    return structuredClone(parts);
  });
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    provider: {
      stream(_messages, { signal }) {
        signal.throwIfAborted();
        const parts = turns[calls++];
        if (!parts)
          throw new Error('Unexpected model call. Supply a scripted reply for this call.');
        return (async function* () {
          for (const part of parts) {
            signal.throwIfAborted();
            yield part;
          }
        })();
      },
    },
    assertConsumed() {
      if (calls !== turns.length)
        throw new Error(`Expected ${turns.length} scripted model calls but observed ${calls}`);
    },
  };
}

/** Run one scenario, with an optional caller signal composed with its own deadline. */
export async function runScenario(scenario, { signal } = {}) {
  validateScenario(scenario);
  const model = scriptedModel(scenario.replies ?? []);
  const events = [];
  const controller = new AbortController();
  const execution = {
    signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    observe: {
      accepts: ({ event, content }) => event === 'workflow.event' && content === 'metadata',
      event({ payload }) {
        const { type, nodeId, targetNodeId, route, routeId, errorCode, phase } = payload.event;
        events.push({ type, nodeId, targetNodeId, route, routeId, errorCode, phase });
      },
    },
  };

  async function execute() {
    execution.signal.throwIfAborted();
    const { agent, state } = await scenario.setup({ execution, provider: model.provider });
    execution.signal.throwIfAborted();
    let outcome;
    try {
      outcome = { result: await agent.run(state), succeeded: true };
    } catch (error) {
      outcome = { error, succeeded: false };
    }
    execution.signal.throwIfAborted();
    model.assertConsumed();
    const trace = { events: [...events], modelCalls: model.calls };
    if (outcome.succeeded) {
      if (!scenario.verify) throw new Error('Expected the workflow to reject');
      await scenario.verify({ result: outcome.result, ...trace });
    } else {
      if (!scenario.verifyError) throw outcome.error;
      await scenario.verifyError({ error: outcome.error, ...trace });
    }
    return { id: scenario.id, ...trace };
  }

  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Scenario timed out: ${scenario.id}`);
      reject(error);
      controller.abort(error);
    }, scenario.timeoutMs ?? 5000);
  });
  try {
    return await Promise.race([deadline, execute()]);
  } finally {
    clearTimeout(timer);
  }
}
