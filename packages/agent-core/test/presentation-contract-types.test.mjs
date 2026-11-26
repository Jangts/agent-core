// Locks the published TypeScript surface of the presentation kit: structural implementations are
// accepted while removed fields and calls fail type-checking. Compiles one inline fixture twice
// (`.mts` and `.cts`) with the TypeScript compiler API; no files are written.
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = `
import { defineOutputCatalog, publishReplyEvents, type OutputComposeInput, type OutputCatalogOptions, type OutputDefinition, type OutputField, type OutputProvider, type AgentOutputEvent } from '@jangts/agent-core/kits/presentation';
import type { OperationContext, ExecutionContext } from '@jangts/agent-core';
// @ts-expect-error Old provider execution contracts have been removed.
import type { LegacyOutputProvider } from '@jangts/agent-core/kits/presentation';
// @ts-expect-error App state belongs to OperationContext, not an output input envelope.
import type { OutputInput } from '@jangts/agent-core/kits/presentation';
type App = { owner: string };
declare const context: OperationContext<App>;
declare const execution: ExecutionContext;
class Provider implements OutputProvider<App> {
  #prefix = 'bound:';
  get id() { return 'source'; }
  resolve(_request: { readonly key?: string }, current: OperationContext<App>) { return this.#prefix + current.app.owner; }
}
const options: OutputCatalogOptions<App> = { providers: [new Provider()] };
const definitions: readonly OutputDefinition[] = [{ id: 'text', kind: 'text', fields: [{ id: 'body', owner: 'bound', providerId: 'source' }] }];
const outputs = defineOutputCatalog(definitions, options);
const input: OutputComposeInput = {};
const result: unknown = outputs.compose({ outputId: 'text', input }, context).value;
const status: 'passed' | 'failed' = outputs.check({ outputId: 'text', value: {} }).status;
outputs.toModelSchema('text');
// @ts-expect-error The old query alias is not public.
outputs.modelView('text');
// @ts-expect-error Inspection has one CheckResult contract.
outputs.inspect('text', {});
// @ts-expect-error Composition requires a named request and OperationContext.
outputs.compose('text', { context: context.app });
// @ts-expect-error The provider array is part of the named registration configuration.
defineOutputCatalog(definitions, [new Provider()]);
// @ts-expect-error Value parsers use valueSchema rather than independent schema/validator members.
const legacySchema: OutputField = { id: 'body', owner: 'generated', schema: { type: 'string' } };
// @ts-expect-error Provider references use providerId.
const legacyProvider: OutputField = { id: 'body', owner: 'bound', provider: 'source' };
// @ts-expect-error Constant values use constantValue.
const legacyValue: OutputField = { id: 'body', owner: 'constant', value: 'fixed' };
// @ts-expect-error Semantic keys use semanticKeys.
const legacyKeys: OutputField = { id: 'body', owner: 'semantic', keys: ['one'], providerId: 'source' };
// @ts-expect-error Group references use allowedOutputIds.
const legacyGroup: OutputDefinition = { id: 'group', kind: 'group', maxItems: 1, outputs: ['text'] };
// @ts-expect-error Per-item data does not replace the execution context.
const nestedContext: OutputComposeInput = { context: context.app };
// @ts-expect-error Group items select outputId, not the old output alias.
const legacyItem: OutputComposeInput = { items: [{ id: 'first', output: 'text', input: {} }] };
const events: AsyncIterable<AgentOutputEvent> = publishReplyEvents({ text: 'reply', delivery: { chunkSize: 1 } }, execution);
// @ts-expect-error Delivery only accepts named options.
publishReplyEvents({ text: 'reply', delivery: 1 }, execution);
// @ts-expect-error The old positional delivery call is removed.
publishReplyEvents('reply', execution.signal, 1);
void [result, status, legacySchema, legacyProvider, legacyValue, legacyKeys, legacyGroup, nestedContext, legacyItem, events];
`;

test('presentation contracts accept structural implementations and reject old fields and calls in both module formats', () => {
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: [],
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
  };
  // ESM and CommonJS consumers must see exactly the same type surface.
  for (const extension of ['mts', 'cts']) {
    const filename = new URL(`./presentation-contract-types.fixture.${extension}`, import.meta.url)
      .pathname;
    const host = ts.createCompilerHost(options);
    const exists = host.fileExists.bind(host),
      read = host.readFile.bind(host),
      get = host.getSourceFile.bind(host);
    host.fileExists = (path) => path === filename || exists(path);
    // Serve the in-memory fixture as a virtual module without touching disk.
    host.readFile = (path) => (path === filename ? source : read(path));
    host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
      path === filename
        ? ts.createSourceFile(path, source, languageVersion, true)
        : get(path, languageVersion, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram([filename], options, host);
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(
      errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
      [],
      extension,
    );
  }
});
