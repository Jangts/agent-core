import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineAgentCatalog, domainToolDelegates } from '../dist/esm/kits/domains/catalog.js';
import { aggregateBranchResults } from '../dist/esm/kits/aggregation.js';
import { createContextCompressor } from '../dist/esm/support/context/compression.js';
import { createContextSelector } from '../dist/esm/support/context/selection.js';
import { modelMessageDiagnostics } from '../dist/esm/model/message-diagnostics.js';

test('only declared outcomes can contribute a branch patch', () => {
  for (const input of [null, { branches: ['a'] }, { branches: ['a'], results: [null] }])
    assert.throws(() => aggregateBranchResults(input), /declared branch/);
});

test('domain catalog fails closed when host relation declarations are incomplete', () => {
  const domains = [{ id: 'inspect', delegates: [] }];
  const scope = { id: 'sources', goalId: 'inspect', targetPolicy: 'optional', toolIds: ['find', 'missing'] };
  const executionTools = {
    values: () => [{ id: 'find', domainToolIds: ['inspect'], lifecycle: { call() {} } }],
    has: id => id === 'find',
    supportsDomainTool: id => id === 'inspect',
    describe: () => [{ id: 'find', goalIds: ['inspect'] }],
  };
  const ports = {
    domainToolIds: () => ['inspect'],
    domainTools: () => domains,
    scopes: () => [scope],
    currentTask: () => undefined,
    executionTools,
  };
  assert.throws(() => defineAgentCatalog({ ...ports, executionTools: undefined }), /catalog ports are required/);
  assert.throws(() => defineAgentCatalog({ ...ports, executionTools: { ...executionTools, supportsDomainTool: undefined } }),
    /support predicate is required/);
  assert.throws(() => defineAgentCatalog({ ...ports, currentTask: () => ({ scopeId: 'sources' }) }).modelCatalog({}),
    /current domain tool id is required/);
  assert.deepEqual(defineAgentCatalog(ports).domainScopeCatalog({}),
    [{ id: 'sources', domainToolId: 'inspect', targetMode: 'optional', toolIds: ['find'] }]);
  assert.deepEqual(domainToolDelegates(domains, [{ id: 'unbound', lifecycle: { call() {} } }]).get('inspect'), []);
});

test('model-backed context handlers require a registered interaction identity', () => {
  const base = { id: 'compact', interaction: '', maxOutputTokens: 100 };
  assert.throws(() => createContextSelector(base), /Context selector requires an interaction ID/);
  assert.throws(() => createContextCompressor({ ...base, instruction: 'shorten', parse: x => x }),
    /Context compressor requires an interaction ID/);
});

test('typed media payloads and tool arguments are redacted from model observations', () => {
  const input = [{
    role: 'assistant', content: '',
    parts: [{ type: 'text', text: 'excerpt' }, { type: 'audio', url: 'data:audio/pcm;base64,PRIVATE' }],
    toolCalls: [{ id: 'c1', name: 'lookup', arguments: '{"key":"PRIVATE"}' }],
  }];
  const output = modelMessageDiagnostics(input);
  assert.deepEqual(output[0].parts, [{ type: 'text', text: 'excerpt' }, { type: 'audio', url: '[media omitted]' }]);
  assert.deepEqual(output[0].toolCalls, [{ id: 'c1', name: 'lookup', arguments: '[tool arguments omitted]' }]);
  assert.match(JSON.stringify(input), /PRIVATE/);
  assert.doesNotMatch(JSON.stringify(output), /PRIVATE/);
});
