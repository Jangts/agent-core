/**
 * Locks down handler retention in Core registries: tools, tools, text transports
 * and structured transports keep prototype methods and private state after registration,
 * ignore later reassignment, and pin registered instances. Stage projection pins its
 * resolver while a dynamic source refreshes per interaction. Runs under node --test using
 * local classes with private fields and no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelToolRegistry, ModelRunner, ToolRegistry, Support } from '../dist/esm/index.js';

class Capability {
  #prefix = 'original';
  get id() {
    return 'answer';
  }
  get description() {
    return 'answer';
  }
  get inputSchema() {
    return { jsonSchema: { type: 'object' }, parse: (value) => value };
  }
  resolve(value) {
    return `${this.#prefix}:${value.text}`;
  }
}

test('Core model tools retain prototype methods/private state through selection and pin registered parsers', () => {
  const declaration = new Capability();
  const registry = new ModelToolRegistry([declaration]).seal();
  declaration.resolve = () => 'replaced';
  const selected = registry.select(['answer']);
  // The sealed registry kept the prototype method and its private prefix, so reassigning
  // the instance method after registration has no effect.
  assert.equal(
    selected.resolve({ toolId: 'answer', input: { text: 'hello' } }, { stageId: 'decision' }),
    'original:hello',
  );
  // The declared JSON schema is deep-frozen so later callers cannot widen it.
  assert.ok(Object.isFrozen(selected.get('answer').inputSchema.jsonSchema));
  assert.equal(
    Support.defineModelTools([new Capability()]).resolve(
      { toolId: 'answer', input: { text: 'typed' } },
      { stageId: 'decision' },
    ),
    'original:typed',
  );
});

class Tool {
  #factor = 2;
  get id() {
    return 'multiply';
  }
  get kind() {
    return 'pure';
  }
  parseInput(value) {
    return value + this.#factor;
  }
  execute(value) {
    return value * this.#factor;
  }
  parseOutput(value) {
    return value - this.#factor;
  }
}

test('Core tools retain prototype methods/private state and pin all execution handlers', async () => {
  const declaration = new Tool(),
    registry = new ToolRegistry();
  registry.register(declaration);
  declaration.parseInput =
    declaration.execute =
    declaration.parseOutput =
      () => {
        throw new Error('replaced');
      };
  // 3 -> parseInput (3 + 2 = 5) -> execute (5 * 2 = 10) -> parseOutput (10 - 2 = 8).
  assert.equal(registry.invoke({ toolId: 'multiply', input: 3 }).value, 8);
  assert.equal((await registry.invokeAsync({ toolId: 'multiply', input: 3 })).value, 8);
  assert.deepEqual(
    registry.events.map((event) => event.status),
    ['success', 'success'],
  );
});

class TextTransport {
  #prefix = 'decoded';
  get id() {
    return 'custom-text';
  }
  prepare(stageId) {
    const prefix = this.#prefix;
    return {
      options: {},
      schemaChars: 0,
      createResponse() {
        let raw = '';
        return {
          get outputChars() {
            return raw.length;
          },
          push(part) {
            raw += part;
          },
          finish: () => `${prefix}:${stageId}:${raw}`,
        };
      },
    };
  }
}

test('Core text transports keep prototype preparation and registered instance identity', async () => {
  const transport = new TextTransport();
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield 'hello';
      },
    },
    transports: [transport],
  });
  transport.prepare = () => {
    throw new Error('replaced');
  };
  assert.equal(
    (await runner.invoke({ stageId: 'body', input: 'question', transport })).value,
    'decoded:body:hello',
  );
  // A structurally identical but separately constructed transport is not the registered
  // instance, so identity is by object, not by shape.
  await assert.rejects(
    runner.invoke({ stageId: 'body', input: 'question', transport: new TextTransport() }),
    /registered transport instance/,
  );
});

class StructuredTransport {
  #delegate = Support.createModelTransport({
    id: 'delegate',
    tools: new ModelToolRegistry([new Capability()]).seal(),
  });
  get id() {
    return 'custom-structured';
  }
  prepare(stage) {
    return this.#delegate.prepare(stage);
  }
}

test('Core structured transports retain prototype interaction creators', async () => {
  const transport = new StructuredTransport();
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield {
          type: 'function-call-delta',
          index: 0,
          id: 'c1',
          name: 'answer',
          arguments: JSON.stringify({ text: 'hello' }),
        };
      },
    },
    transports: [transport],
  });
  transport.prepare = () => {
    throw new Error('replaced');
  };
  assert.equal(
    (await runner.invoke({ stageId: 'decision', input: 'question', transport })).value,
    'original:hello',
  );
});

test('static stage projection pins its resolver while dynamic sources refresh on the next interaction', () => {
  const catalog = new ModelToolRegistry([new Capability()]).seal();
  const source = { values: () => catalog.values(), resolve: () => 'original' };
  const registration = {
    id: 'staged',
    stages: [{ id: 'decision', toolIds: ['answer'] }],
    tools: source,
  };
  const fixed = Support.createStageModelTransport(registration);
  const dynamic = Support.createStageModelTransport({
    ...registration,
    tools: () => source,
  });
  const prepared = dynamic.prepare('decision');
  source.resolve = () => 'replaced';
  const resolve = (prepared) => {
    const response = prepared.createResponse();
    response.push({
      type: 'function-call-delta',
      index: 0,
      id: 'c1',
      name: 'answer',
      arguments: '{}',
    });
    return response.finish();
  };
  assert.equal(resolve(fixed.prepare('decision')), 'original');
  assert.equal(resolve(prepared), 'original');
  // Only a dynamic source re-reads the resolver, and only for a later prepare().
  assert.equal(resolve(dynamic.prepare('decision')), 'replaced');
});
