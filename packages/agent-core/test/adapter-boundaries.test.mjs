/*
 * Boundary errors of the small Support factories and of the compatible provider's
 * stream teardown.
 *
 * These adapters sit between an App and Core, so each one must reject with its own
 * declared error instead of forwarding an incidental failure: a bad budget, a
 * non-array payload, a missing `provider.stream`, a non-terminal sub-flow record,
 * a foreign logger scope, an over-deep snapshot, a reply without text, a duplicate
 * retrieval, and an unregistered command key. The provider cases cover the other
 * direction: what is recorded when a consumer stops early or when cleanup of a
 * failed response itself throws.
 *
 * Runs on `dist/esm` with fake providers, ports and SSE `Response` objects.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CompatibleModelProvider } from '../dist/esm/index.js';
import { validateContextBudget } from '../dist/esm/context/fragments.js';
import { preparedInputSize } from '../dist/esm/model/preparation.js';
import { resolveModelSettings } from '../dist/esm/model/settings.js';
import {
  createSubFlowLogger,
  readSubFlowLogger,
  payloadSnapshot,
} from '../dist/esm/diagnostics/sub-flow.js';
import { publishReplyEvents } from '../dist/esm/kits/presentation/events.js';
import { defineEvidenceProjection } from '../dist/esm/kits/evidence.js';
import { ScopeRegistry } from '../dist/esm/kits/domains/scopes.js';
import { defineCommand, commandSchema } from '../dist/esm/kits/interaction/command.js';
import { defineTextSkillLoader } from '../dist/esm/kits/text-skills.js';
import { defineRetrieval } from '../dist/esm/kits/retrieval.js';
import { TextSearch } from '../dist/esm/kits/search.js';
test('remaining validation factories report their own boundary rather than leaking incidental failures', async () => {
  assert.throws(() => validateContextBudget(-1, 1), /input size/);
  assert.throws(() => preparedInputSize({}, {}), /array/);
  assert.throws(() => resolveModelSettings({}), /provider.stream/);
  const owner = {},
    logger = createSubFlowLogger(
      owner,
      () => true,
      () => true,
      () => {},
      { runId: 'r', spanId: 's' },
    );
  assert.equal(
    logger.write({ name: 'n', kind: 'k', status: 'running', startedAtMs: 0, endedAtMs: 1 }),
    -1,
  );
  assert.throws(() => readSubFlowLogger(logger, owner, { runId: 'r', spanId: 'foreign' }), /scope/);
  // Seventeen nested levels cross the snapshot depth limit; the failure must be the
  // declared "too complex" error, not a stack overflow.
  let nested = {};
  for (let i = 0; i < 17; i++) nested = { nested };
  assert.throws(() => payloadSnapshot(nested), /complex/);
  await assert.rejects(Array.fromAsync(publishReplyEvents({ text: 1 }, {})), /requires text/);
  const scopes = new ScopeRegistry().register({
    id: 'docs',
    description: 'Docs',
    category: 'docs',
    evidence: [{ kind: 'read', id: 'one' }],
    contextTier: 'primary',
  });
  assert.equal(scopes.is('docs', 'docs'), true);
  assert.equal(scopes.evidence('docs')[0].id, 'one');
  assert.equal(scopes.contextTier('docs'), 'primary');
  const command = defineCommand({ fields: { text: { owned: true } } });
  assert.deepEqual(command.ownedFields, ['text']);
  assert.deepEqual(
    commandSchema('dynamic', { fieldSchemas: { text: {} }, keys: () => ['type', 'text'] }).required,
    ['type', 'text'],
  );
  const evidence = defineEvidenceProjection({
    sourceId: (s) => s.id,
    providers: {
      read: { sources: (o) => o.sources, withSources: (o, sources) => ({ ...o, sources }) },
    },
  });
  assert.equal(
    evidence.project({
      observations: [{ toolId: 'read', sources: [{ id: 'a' }] }],
      sourceIds: ['a'],
    })[0].sources.length,
    1,
  );
  for (const kind of ['catalog', 'document']) {
    const errors = { [kind]: () => Error(kind) },
      loader = defineTextSkillLoader({ maxInstructionChars: 100, maxDescriptionChars: 50, errors });
    assert.throws(
      () =>
        loader.load(
          {
            entries:
              kind === 'catalog'
                ? null
                : [{ id: 'read', entry: 'read/SKILL.md', kind: 'text-workflow', toolIds: [] }],
          },
          { read: () => '' },
        ),
      new RegExp(kind),
    );
  }
  const state = { seen: new Set(), queryCount: 0, sources: [] };
  const retrieval = defineRetrieval({
    id: 'r',
    description: 'R',
    assertInput() {},
    state: () => state,
    limit: () => 2,
    execute: () => ({ sources: [] }),
    errors: { duplicate: () => Error('duplicate') },
  });
  retrieval.run('a', { signal: new AbortController().signal });
  assert.throws(() => retrieval.run('a', { signal: new AbortController().signal }), /duplicate/);
  const search = new TextSearch({
    indexRevision: '1',
    fields: ['a', 'b', 'c'],
    storedFields: [],
    boost: { a: 1, c: 3, b: 2 },
  });
  assert.ok(search.snapshot().configurationFingerprint.includes('"a":1'));
});
test('provider teardown records early consumption and failed best-effort cancellation', async () => {
  const config = { baseUrl: 'https://mock.invalid', apiKey: 'mock', model: 'mock' },
    events = [];
  const response = new Response('data: {"choices":[{"index":0,"delta":{"content":"one"}}]}\n\n', {
    headers: { 'content-type': 'text/event-stream' },
  });
  const compatible = new CompatibleModelProvider({
    config,
    observe: { provider: { write: (event) => events.push(event) } },
    ports: { request: async () => response },
  });
  const stream = compatible.stream([], { signal: new AbortController().signal });
  assert.equal((await stream.next()).value, 'one');
  // A consumer that stops early is still recorded, and the record must say the
  // stream did not complete normally.
  await stream.return();
  assert.equal(events.at(-1).payload.complete, false);
  // Cleanup of the failed response rejects; the classification must still be the
  // upstream status, with the cleanup failure not replacing it.
  const bad = new CompatibleModelProvider({
    config,
    ports: {
      request: async () => ({
        ok: false,
        status: 503,
        body: { cancel: () => Promise.reject(Error('cleanup')) },
        headers: new Headers(),
      }),
    },
  });
  await assert.rejects(
    Array.fromAsync(bad.stream([], { signal: new AbortController().signal })),
    /MODEL_UPSTREAM/,
  );
  await Promise.resolve();
  // Tool-call deltas on a plain-text transport are a protocol violation, not content.
  const native = new CompatibleModelProvider({
    config,
    ports: {
      request: async () =>
        new Response(
          'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"read","arguments":"{}"}}]}}]}\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    },
  });
  await assert.rejects(
    Array.fromAsync(native.stream([], { signal: new AbortController().signal })),
    /MODEL_PROTOCOL/,
  );
});
test('explicit projection selectors and observer predicates retain their configured receiver', async () => {
  const { createProviderObservationScope } = await import('../dist/esm/support/model/observer.js');
  const scope = createProviderObservationScope({
      allowed: true,
      accepts() {
        return this.allowed;
      },
      write() {},
    }),
    flat = {
      enabled: () => true,
      emit() {},
      deliver() {},
      child() {
        return this;
      },
      withObserver() {
        return this;
      },
    };
  // The predicate reads `this.allowed`, so the observer must be called with the
  // observation scope as its receiver.
  const diagnostics = scope.attach(flat, 'owner');
  assert.equal(
    scope.observer.accepts({ event: 'provider.end', content: 'metadata' }, { diagnostics }),
    true,
  );
  const evidence = defineEvidenceProjection({
    toolId: (o) => o.selected,
    sourceId: (s) => s.id,
    providers: {
      read: { sources: (o) => o.sources, withSources: (o, sources) => ({ ...o, sources }) },
    },
  });
  assert.equal(
    evidence.project({
      observations: [{ selected: 'read', sources: [{ id: 'a' }] }],
      sourceIds: ['a'],
    })[0].sources.length,
    1,
  );
  const { ToolLifecycleRegistry } = await import('../dist/esm/kits/tools.js');
  const registry = new ToolLifecycleRegistry({
    registration: {
      kinds: ['read'],
      isValidId: () => true,
      audiences: ['model'],
      effects: ['read'],
      goalExists: () => true,
    },
    
    outputs: () => [],
    goalIds: () => ['read'],
    contextFragment() {},
  });
  registry.register({
    id: 'read',
    kind: 'read',
    description: 'Read',
    audience: 'model',
    effect: 'read',
    goalIds: 'all',
    parseInput: (v) => v,
    parseOutput: (v) => v,
    execute: (v) => v,
    active: () => true,
    lifecycle: {  protocol: { keys: () => [] }, call() {} },
  });
  assert.deepEqual([...registry.modelProtocols({}).keys()], ['read']);
});
