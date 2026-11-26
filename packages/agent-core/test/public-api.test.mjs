/**
 * Locks down the published API surface: individual and bulk Kit entries, constructor
 * statics, root Support aggregation and removal of legacy convenience exports. It also
 * compiles the shipped declaration fixtures and the unified example in both ESM and
 * CommonJS with strict TypeScript. Runs under node --test; the compiler is driven
 * in-process with an in-memory host and no emitted build.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as core from '@jangts/agent-core';
import * as Kit from '@jangts/agent-core/kits';

const require = createRequire(import.meta.url);
const names = {
  interaction: 'Interaction',
  tools: 'ToolLifecycleRegistry',
  knowledge: 'Knowledge',
  answering: 'Answering',
  presentation: 'Presentation',
  normalization: 'Normalization',
  delivery: 'Delivery',
  projection: 'Projection',
  aggregation: 'Aggregation',
  retrieval: 'Retrieval',
  evidence: 'Evidence',
  policies: 'Policies',
  candidates: 'Candidates',
  'text-skills': 'TextSkills',
  'text-blocks': 'TextBlocks',
};

test('individual and bulk Kit entries share objects and constructors in ESM and CommonJS', async () => {
  const cjsKit = require('@jangts/agent-core/kits');
  // A Kit entry must resolve to the same object through bulk, per-path ESM and per-path
  // CommonJS, and must never appear as a Core export.
  for (const [path, name] of Object.entries(names)) {
    assert.equal(Kit[name], (await import(`@jangts/agent-core/kits/${path}`))[name]);
    assert.equal(cjsKit[name], require(`@jangts/agent-core/kits/${path}`)[name]);
    assert.equal(Object.hasOwn(core, name), name === 'ToolLifecycleRegistry', `${name} must use a Kit entry`);
  }
});

test('constructor statics preserve aliases and support actual registration and dispatch', async () => {
  const interaction = await import('@jangts/agent-core/kits/interaction');
  const domains = await import('@jangts/agent-core/kits/domains');
  assert.equal(Kit.Interaction, interaction.InteractionProtocol);
  assert.equal(Kit.Interaction.Commands, interaction.CommandCatalog);
  assert.equal(Kit.Interaction.Commands.define, interaction.defineCommandCatalog);
  assert.equal(Kit.GoalRegistry.create, domains.createGoalRegistry);
  assert.equal(core.AgentCoreEngine.Workflow, core.AgentWorkflow);
  assert.equal(core.AgentCoreEngine.AttemptBudget, core.AttemptBudget);
  const protocol = Kit.Interaction.define({
    commandField: 'kind',
    commands: {
      reply: {
        fields: { text: { required: true, jsonSchema: { type: 'string' } } },
        format: (value) => value.text,
      },
    },
  });
  const bound = Kit.Interaction.bind(protocol, { reply: (text, context) => text + context.suffix });
  assert.equal(bound.dispatch({ kind: 'reply', text: 'hello' }, { suffix: '!' }), 'hello!');
  const registry = Kit.GoalRegistry.create([
    { id: 'reply', description: 'reply', delegates: ['reply'] },
  ]);
  assert.equal(registry.require('reply').delegates.includes('reply'), true);
  assert.throws(
    () => registry.register({ id: 'other', description: 'other', delegates: ['reply'] }),
    /sealed/,
  );
});

test('root Support owns adapters and excludes legacy Kit convenience exports', async () => {
  const supportEntry = await import('@jangts/agent-core/support');
  // SDK and Helper used to be convenience exports and are no longer part of Core.
  for (const name of ['SDK', 'Helper']) assert.equal(Object.hasOwn(core, name), false);
  assert.deepEqual(Object.keys(core.Support).sort(), Object.keys(supportEntry).sort());
  for (const key of Object.keys(supportEntry)) assert.equal(core.Support[key], supportEntry[key]);
  assert.equal(core.Support.CompatibleModelProvider, supportEntry.CompatibleModelProvider);
  assert.equal(core.Support.readSse, (await import('@jangts/agent-core/sse')).readSse);
  assert.equal(
    core.Support.parseJsonFrames,
    (await import('@jangts/agent-core/json-transport')).parseJsonFrames,
  );
  for (const name of [
    'GoalRegistry',
    'ScopeRegistry',
    'ToolLifecycleRegistry',
    'defineWAITP',
    'defineWAIIC',
  ])
    assert.equal(Object.hasOwn(core.Support, name), false, name);
});

test('public declarations and generic contracts compile strictly in both module formats', async () => {
  // All fixtures consume the same stable dependency declarations. Reuse their
  // parsed ASTs while each program still binds/checks its own fixture and mode.
  const dependencies = new Map();
  for (const fixture of [
    'public-api.types.txt',
    'model-strategy.types.txt',
    'json-value.types.txt',
    'mock-kit.types.txt',
  ]) {
    const source = await readFile(new URL('./' + fixture, import.meta.url), 'utf8');
    const options = {
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      types: fixture === 'mock-kit.types.txt' ? ['node'] : [],
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
    };
    for (const extension of ['mts', 'cts']) {
      // The same fixture must compile both as an ESM .mts and a CommonJS .cts program.
      const filename = new URL(`./public-api.fixture.${extension}`, import.meta.url).pathname;
      const host = ts.createCompilerHost(options);
      const exists = host.fileExists.bind(host),
        read = host.readFile.bind(host),
        get = host.getSourceFile.bind(host);
      host.fileExists = (path) => path === filename || exists(path);
      host.readFile = (path) => (path === filename ? source : read(path));
      host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
        if (path === filename) return ts.createSourceFile(path, source, languageVersion, true);
        const key = path + ':' + JSON.stringify(languageVersion);
        if (!dependencies.has(key))
          dependencies.set(key, get(path, languageVersion, onError, shouldCreateNewSourceFile));
        return dependencies.get(key);
      };
      const program = ts.createProgram([filename], options, host);
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((item) => item.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(
        errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
        [],
        fixture + ':' + extension,
      );
    }
  }
});

test('context policy, plan and compressor creators are available in both module formats', async () => {
  for (const api of [core, require('@jangts/agent-core')]) {
    const builder = api.Support.defineContextFragments([
      {
        id: 'request',
        sourceId: 'test',
        role: 'user',
        trust: 'user',
        lifetime: 'turn',
        maxChars: 100,
        format: () => ({ message: 'hello' }),
      },
    ]);
    const runner = new api.ModelRunner({
      provider: {
        async *stream() {
          yield 'ok';
        },
      },
      maxCalls: 1,
      callTimeoutMs: 1000,
      execution: { signal: new AbortController().signal },
      maxInputChars: 1000,
      transports: [api.Support.createTextTransport({ id: 'text' })],
    });
    assert.equal(
      (
        await runner.invoke({
          stageId: 'reply',
          input: builder.plan({ input: {}, maxInputChars: 1000 }),
          maxOutputTokens: 100,
          transport: 'text',
        })
      ).value,
      'ok',
    );
    assert.equal(typeof api.Support.createContextCompressor, 'function');
    assert.equal(typeof api.Support.createContextSelector, 'function');
    assert.equal(typeof api.Support.defineTool, 'function');
    assert.equal(typeof api.Support.defineToolCatalog, 'function');
    assert.equal(typeof api.Support.contextSelectionCatalog.auto.choose, 'function');
    assert.equal(api.Support.contextPolicyCatalog.reduce.run instanceof Function, true);
  }
});

test('the documented unified API example typechecks and runs offline', async () => {
  const { spawnSync } = await import('node:child_process');
  const filename = new URL('../development/examples/unified-api.mjs', import.meta.url).pathname;
  const options = {
    strict: true,
    noEmit: true,
    allowJs: true,
    checkJs: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: [],
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
  };
  const program = ts.createProgram([filename], options);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(
    errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
    [],
  );
  const result = spawnSync(process.execPath, [filename], { encoding: 'utf8' });
  // The example is also executed, so the documentation cannot drift into non-runnable code.
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '42');
});
