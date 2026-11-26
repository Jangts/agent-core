// Locks `Support.createModelStrategy` budget projection: only canonical budget fields are read,
// forbidden model ports are rejected, and structural getters keep their receivers.
// Covers the Support model strategy helper; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

const provider = {
  async *stream() {
    yield 'ready';
  },
};

test('exact budget cannot replace providers or inject request and transport ports', () => {
  // These fields belong to the model, not its budget; even undefined values are rejected.
  for (const key of ['provider', 'execution', 'transports', 'sink', 'errors']) {
    assert.throws(
      () => Support.createModelStrategy({ model: { provider }, budget: { [key]: undefined } }),
      /Invalid model budget field/,
    );
  }
  // A forbidden field must be rejected without ever invoking its getter.
  for (const key of ['provider', 'execution', 'transports', 'sink', 'errors']) {
    const budget = Object.create(
      Object.defineProperty({}, key, {
        get() {
          assert.fail('forbidden getter must not execute');
        },
      }),
    );
    assert.throws(
      () => Support.createModelStrategy({ model: { provider }, budget }),
      /Invalid model budget field/,
    );
  }
});

test('exact budgets retain complete ModelRunnerSettings and class getter receivers', async () => {
  class Counter {
    counterId = 'fixture';
    contextWindowTokens = 4000;
    #tokens = 1;
    countTokens() {
      return this.#tokens;
    }
  }
  const tokenBudget = new Counter();
  const children = { maxDepth: 2, maxConcurrentCalls: 2, maxChildren: 4 };
  class Budget {
    #calls = 1;
    get maxCalls() {
      return this.#calls;
    }
    get callTimeoutMs() {
      return 1000;
    }
    get maxOutputChars() {
      return 100;
    }
    get usage() {
      return true;
    }
    get children() {
      return children;
    }
    get maxInputChars() {
      return 1000;
    }
    get maxSchemaChars() {
      return 1000;
    }
    get tokenBudget() {
      return tokenBudget;
    }
    get maxOutputTokens() {
      return 100;
    }
  }
  const settings = Support.createModelStrategy({ model: { provider }, budget: new Budget() });
  assert.equal(settings.maxCalls, 1);
  assert.equal(settings.tokenBudget, tokenBudget);
  assert.equal(settings.children, children);
  // The strategy copies values; the caller's token counter and policy stay mutable.
  assert.equal(Object.isFrozen(tokenBudget), false);
  assert.equal(Object.isFrozen(children), false);
  assert.equal((await new ModelRunner(settings).invoke('hello')).value, 'ready');
});

test('structural budget implementations may retain public state, metadata and prototype helpers', () => {
  class Budget {
    factor = 2;
    label = 'app-budget';
    get maxCalls() {
      return this.calls();
    }
    calls() {
      return this.factor * 2;
    }
    get metadata() {
      assert.fail('unused metadata must not be read');
    }
  }
  const budget = new Budget();
  Object.defineProperty(budget, 'extra', {
    enumerable: true,
    get() {
      assert.fail('own metadata must not be read');
    },
  });
  budget[Symbol('app-state')] = 'kept';
  const settings = Support.createModelStrategy({ model: { provider }, budget });
  assert.equal(settings.maxCalls, 4);
  // Unrelated prototype metadata and own enumerable getters must never be read.
  assert.equal(Object.hasOwn(settings, 'label'), false);
  assert.equal(Object.hasOwn(settings, 'factor'), false);
  assert.equal(Object.hasOwn(settings, 'extra'), false);
  assert.equal(Object.isFrozen(budget), false);
});
