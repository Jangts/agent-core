/**
 * Locks down Support adapter boundaries: text-transport option snapshots, selection
 * transport getter precedence, one structural option snapshot shared by measurement and
 * provider execution, usage-handler receivers, and tool binding's app requirement. Runs
 * under node --test with fixture providers and no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

test('text transport snapshots temperature from a prototype getter', () => {
  class Options {
    value = 0.4;
    get temperature() {
      return this.value;
    }
  }
  const options = new Options();
  const transport = Support.createTextTransport({ id: 'text', options });
  options.value = 0.9;
  // Construction snapshots the getter, so the later mutation is invisible, and text
  // transports explicitly disable the JSON adapter.
  assert.equal(transport.prepare('reply').options.temperature, 0.4);
  assert.equal(transport.prepare('reply').options.json, false);
});

test('selection transport preserves getter options and the existing adapter override precedence', async () => {
  const tools = Support.defineModelTools([
    {
      id: 'answer',
      description: 'Answer',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
      resolve: (value) => value.text,
    },
  ]);
  class Defaults {
    get temperature() {
      return 0.4;
    }
  }
  class JsonOptions {
    get json() {
      return true;
    }
  }
  class Override extends JsonOptions {
    get temperature() {
      return 0;
    }
  }
  class Cleared extends JsonOptions {
    get temperature() {
      return undefined;
    }
  }
  for (const [options, temperature] of [
    // Adapter-supplied options win over declared defaults: absent keeps 0.4, an explicit
    // 0 overrides it, and an explicit undefined clears the value rather than falling back.
    [new JsonOptions(), 0.4],
    [new Override(), 0],
    [new Cleared(), undefined],
  ]) {
    const adapter = {
      id: 'getter-json',
      features: { strictArguments: false },
      prepare(definitions) {
        return { ...Support.jsonObjectInteraction.prepare(definitions), options };
      },
    };
    const transport = Support.createModelTransport({
      id: 'selection',
      tools,
      adapter,
      options: new Defaults(),
    });
    const model = new ModelRunner({
      transports: [transport],
      provider: {
        async *stream(_messages, { options: actual }) {
          assert.equal(actual.json, true);
          assert.equal(actual.temperature, temperature);
          yield '{"name":"answer","input":{"text":"done"}}';
        },
      },
    });
    assert.equal((await model.invoke({ input: 'question', transport })).value, 'done');
  }
});

test('Core measurements and provider execution share one snapshot of structural transport options', async () => {
  const functions = [{ name: 'answer', description: 'Answer', parameters: { type: 'object' } }];
  class Options {
    reads = { json: 0, functions: 0, temperature: 0 };
    get json() {
      this.reads.json++;
      return false;
    }
    get functions() {
      this.reads.functions++;
      return functions;
    }
    get temperature() {
      this.reads.temperature++;
      return 0.3;
    }
    get maxOutputTokens() {
      return 1;
    }
  }
  const options = new Options();
  const transport = {
    id: 'structural',
    prepare() {
      return {
        options,
        schemaChars: JSON.stringify(functions).length,
        createResponse() {
          let text = '';
          return {
            get outputChars() {
              return text.length;
            },
            push(part) {
              text += part;
            },
            finish() {
              return text;
            },
          };
        },
      };
    },
  };
  let measured = 0;
  const model = new ModelRunner({
    transports: [transport],
    tokenBudget: {
      counterId: 'fixture',
      contextWindowTokens: 1000,
      countTokens(input) {
        measured++;
        assert.equal(input.json, false);
        assert.deepEqual(input.functions, functions);
        return 10;
      },
    },
    provider: {
      async *stream(_messages, { options: actual }) {
        assert.equal(actual.json, false);
        assert.deepEqual(actual.functions, functions);
        assert.equal(actual.temperature, 0.3);
        assert.equal(actual.maxOutputTokens, 100);
        yield 'done';
      },
    },
  });
  assert.equal(
    (await model.invoke({ input: 'question', transport, maxOutputTokens: 100 })).value,
    'done',
  );
  assert.equal(measured, 1);
  // Each getter is read exactly once and the same snapshot feeds both token measurement and
  // the provider request, so the two cannot disagree.
  assert.deepEqual(options.reads, { json: 1, functions: 1, temperature: 1 });
});

test('provider option snapshots bind prototype usage handlers to their private receiver', async () => {
  class Options {
    #total = 0;
    get includeUsage() {
      return true;
    }
    get maxOutputTokens() {
      return 20;
    }
    get total() {
      return this.#total;
    }
    onUsage(usage) {
      this.#total = usage.totalTokens;
    }
  }
  const options = new Options();
  const provider = new Support.CompatibleModelProvider({
    config: { baseUrl: 'https://fixture.invalid', apiKey: 'fixture', model: 'fixture' },
    ports: {
      async request(_url, init) {
        const body = JSON.parse(init.body);
        assert.equal(body.max_tokens, 20);
        assert.deepEqual(body.stream_options, { include_usage: true });
        const frames =
          [
            { choices: [{ index: 0, delta: { content: 'done' }, finish_reason: 'stop' }] },
            { choices: [], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } },
          ]
            .map((frame) => `data: ${JSON.stringify(frame)}\n\n`)
            .join('') + 'data: [DONE]\n\n';
        return new Response(frames, { headers: { 'content-type': 'text/event-stream' } });
      },
    },
  });
  assert.deepEqual(
    await Array.fromAsync(provider.stream([], { signal: new AbortController().signal, options })),
    ['done'],
  );
  // The trailing usage frame has empty choices but still reaches the bound handler, which
  // writes the 5 total tokens into its own private field.
  assert.equal(options.total, 5);
});

test('tool binding accepts an app getter and retains async execution and output validation receivers', async () => {
  class Tool {
    #factor = 2;
    id = 'double';
    kind = 'math';
    description = 'Double';
    inputSchema = { jsonSchema: { type: 'object' }, parse: (value) => value.number };
    authorize(_input, { app }) {
      assert.equal(app.allowed, true);
    }
    async execute(value, { app }) {
      return value * this.#factor + app.offset;
    }
    parseOutput(value) {
      assert.equal(typeof value, 'number');
      return value + this.#factor;
    }
  }
  class Request {
    #app = { allowed: true, offset: 3 };
    get app() {
      return this.#app;
    }
  }
  const tools = Support.defineToolCatalog([Support.defineTool(new Tool())]);
  const runtime = tools.bind(new Request());
  // 2 -> execute (2 * 2 + offset 3 = 7) -> parseOutput (7 + 2 = 9).
  assert.equal((await runtime.invoke({ toolId: 'double', input: { number: 2 } })).value, 9);
  assert.throws(() => tools.bind({}), /requires app/);
});

test('an explicitly undefined app is a valid binding when the tool does not require application state', async () => {
  const tools = Support.defineToolCatalog([
    {
      id: 'constant',
      kind: 'pure',
      description: 'Constant',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
      authorize(_input, { app }) {
        assert.equal(app, undefined);
      },
      execute() {
        return 1;
      },
      parseOutput(value) {
        assert.equal(typeof value, 'number');
        return value;
      },
    },
  ]);
  assert.equal(
    (await tools.bind({ app: undefined }).invoke({ toolId: 'constant', input: {} })).value,
    1,
  );
});
