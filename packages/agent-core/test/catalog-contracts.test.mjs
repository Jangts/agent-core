/*
 * Negative-path contract for the public catalogs, declaration helpers and the
 * chat-completions adapter.
 *
 * Every case exercises the "default" branch a declarant rarely thinks about:
 * looking up a missing entry, declaring a tool without a handler, a JSON Schema
 * that never matches, a self-referential knowledge tree, a dynamic command
 * schema, and malformed streamed tool-call deltas. The point is that each
 * returns the catalog's own error instead of leaking an internal failure.
 *
 * Runs on `dist/esm`; the provider fake is a generator and no HTTP call is made.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support, ModelRunner } from '../dist/esm/index.js';
import { defineCandidateSelection } from '../dist/esm/kits/candidates.js';
import { defineNormalization } from '../dist/esm/kits/normalization.js';
import { defineTreeProjection } from '../dist/esm/kits/projection.js';
import { defineEvidenceProjection } from '../dist/esm/kits/evidence.js';
import { defineRecoveryChain } from '../dist/esm/kits/policies.js';
import { TextSearch } from '../dist/esm/kits/search.js';
import { compileKnowledgeDocument } from '../dist/esm/kits/knowledge/sections.js';
import { defineKnowledgeCatalog } from '../dist/esm/kits/knowledge/catalog.js';
import { defineCommand, commandSchema } from '../dist/esm/kits/interaction/command.js';
import { defineCommandCatalog } from '../dist/esm/kits/interaction/commands.js';
import { validateContextBudget } from '../dist/esm/context/fragments.js';
import { ScopeRegistry } from '../dist/esm/kits/domains/scopes.js';
import {
  chatCompletionFunctionOptions,
  chatCompletionMessages,
  chatCompletionParts,
} from '../dist/esm/support/model/chat-completions.js';
const provider = {
  async *stream() {
    yield 'ok';
  },
};
test('public catalogs classify missing entries and invalid schema/tool declarations', () => {
  for (const catalog of [
    Support.defineRegistrationCatalog([]),
    Support.defineCapabilityCatalog([]),
    Support.defineModelTools([]),
    Support.defineToolCatalog([]),
    defineRecoveryChain([]),
    defineKnowledgeCatalog([]),
  ])
    assert.throws(() => catalog.require('missing'), /Unknown/);
  assert.throws(() => Support.defineTool({ id: '', kind: 'read', description: 'x' }), /identity/);
  assert.throws(() => Support.defineTool({ id: 'x', kind: 'read', description: 'x' }), /handler/);
  // An empty JSON Schema accepts anything by definition; the injected compiler
  // returns false, so the rejection must come from the parsed result.
  const schema = Support.fromJsonSchema({}, { compile: () => () => false, error: () => undefined });
  assert.throws(() => schema.parse({}), /match JSON/);
  assert.throws(() => validateContextBudget(0, -1), /budget/);
  const scopes = new ScopeRegistry();
  assert.equal(scopes.is('missing', 'x'), false);
  assert.deepEqual(scopes.evidence('missing'), []);
  assert.equal(scopes.contextTier('missing'), undefined);
});
test('model configuration error factories enforce deprecated fields and safe finite budgets', () => {
  for (const value of [
    { observe: {} },
    { signal: new AbortController().signal },
    { maxInputChars: -1 },
    { maxOutputChars: -1 },
    { maxOutputTokens: 0 },
  ])
    assert.throws(() => new ModelRunner({ provider, ...value }), TypeError);
});
test('candidate, normalization and evidence defaults cover non-object members and legacy tool identifiers', () => {
  const candidates = defineCandidateSelection({ field: 'options', maxCandidates: 3 });
  assert.throws(() => candidates.parse({ value: {}, allowed: 1 }), /boolean/);
  for (const member of [null, 1, []])
    assert.throws(() => candidates.parse({ value: { options: [member] }, allowed: true }));
  const normalize = defineNormalization([
    {
      id: 'skip',
      when: () => false,
      normalize() {
        assert.fail();
      },
    },
    { id: 'run', normalize: (value) => value + 1 },
  ]);
  assert.equal(normalize.normalize(1), 2);
  assert.throws(() => defineTreeProjection({ maxDepth: -1 }), /maxDepth/);
  const parts = [];
  // A part that contains itself must be detected as a cycle, not recursed into.
  parts.push({ id: 's', parts });
  assert.throws(() => compileKnowledgeDocument({ id: 'd', revision: '1', parts }), /tree/);
  const project = defineEvidenceProjection({
    sourceId: (s) => s.id,
    providers: {
      read: { sources: (o) => o.sources, withSources: (o, sources) => ({ ...o, sources }) },
    },
  });
  // Only the requested source ids survive projection, so an observation cannot
  // smuggle unrelated sources into the evidence list.
  assert.deepEqual(
    project.project({
      observations: [{ tool: 'read', sources: [{ id: 'a' }, { id: 'b' }] }],
      sourceIds: ['b'],
    })[0].sources,
    [{ id: 'b' }],
  );
  const search = new TextSearch({
    indexRevision: '1',
    fields: ['a', 'b'],
    storedFields: [],
    boost: { b: 2, a: 1 },
  });
  assert.equal(search.search({ query: 'x', limit: 1, filter: () => true }).length, 0);
});
test('commands expose declaration metadata and legacy dynamic schemas while sealed mutation rejects', () => {
  const command = defineCommand({
    fields: ['x'],
    description: 'read',
    terminal: false,
    ownedFields: ['owned'],
  });
  assert.equal(command.description, 'read');
  assert.equal(command.terminal, false);
  assert.deepEqual(command.ownedFields, ['owned']);
  assert.deepEqual(commandSchema('x', { keys: () => ['type'] }).required, ['type']);
  const commands = defineCommandCatalog({ read: { fields: [] } });
  assert.throws(() => commands.delete('read'), /sealed/);
  assert.throws(() => commands.clear(), /sealed/);
  assert.throws(() => chatCompletionFunctionOptions({ functions: [] }), /Empty/);
  assert.deepEqual(chatCompletionFunctionOptions({}), {});
  assert.throws(
    () =>
      chatCompletionMessages([
        { role: 'user', content: 'x', images: [{ url: 'https://x', detail: 'bad' }] },
      ]),
    /image/,
  );
  assert.deepEqual(chatCompletionParts(null), []);
  for (const delta of [
    { tool_calls: [null] },
    { tool_calls: [{ index: 0, type: 'bad' }] },
    { tool_calls: [{ index: 0, function: [] }] },
    { tool_calls: [{ index: 0, function: { name: 1 } }] },
  ])
    assert.throws(() => chatCompletionParts(delta));
  // A delta carrying only an index is still a valid in-progress tool call; the
  // name and arguments may arrive in later frames.
  assert.deepEqual(chatCompletionParts({ tool_calls: [{ index: 0 }] }), [
    { type: 'function-call-delta', index: 0 },
  ]);
});
