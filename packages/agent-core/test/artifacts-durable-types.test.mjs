/*
 * Type-level contract for `kits/artifacts` and `kits/durable`.
 *
 * The fixture source below is compiled with the TypeScript compiler API instead
 * of being executed: the assertions are the `@ts-expect-error` directives, each
 * of which proves that a removed declaration (legacy resolver, `kind` field,
 * `validate`/`replay` options, positional `run` overload, numeric checkpoint
 * version) no longer type-checks. If such code ever compiled again, the unused
 * directive itself becomes an error, so the whole test fails.
 *
 * The source is never written to disk: it is injected into a virtual file name
 * through an overridden compiler host, and the loop recompiles it as `.mts` and
 * `.cts` so both published module formats resolve the same declarations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = `
import { defineArtifactCatalog, type ArtifactReference } from '@jangts/agent-core/kits/artifacts';
import { defineDurableTask, type DurableStore, type DurableStep, type DurableCheckpoint } from '@jangts/agent-core/kits/durable';
import type { OperationContext } from '@jangts/agent-core';
// @ts-expect-error Historical execution declarations are not part of the current contract.
import type { LegacyArtifactResolver } from '@jangts/agent-core/kits/artifacts';
type App = { owner: string };
type State = { values: string[] };
declare const context: OperationContext<App>;
declare const store: DurableStore<State>;
const artifacts = defineArtifactCatalog([{ id: 'file', resolve(reference: ArtifactReference, execution: OperationContext<App>) {
  return { id: reference.artifactId, owner: execution.app.owner };
} }]);
const reference: ArtifactReference = { resolverId: 'file', artifactId: 'saved', revision: 'v1' };
const artifact: Promise<{ id: string; owner: string }> = artifacts.resolve(reference, context);
// @ts-expect-error Execution only takes a canonical reference.
artifacts.resolve({ kind: 'file', id: 'saved' }, context);
// @ts-expect-error Execution takes one operation context, not app and signal.
artifacts.resolve(reference, context.app, context.signal);
// @ts-expect-error Resolver declarations use id, not the old kind field.
defineArtifactCatalog([{ kind: 'file', resolve: () => 'value' }]);
const isState = (value: unknown): value is State => !!value && typeof value === 'object' && Array.isArray((value as State).values);
const step: DurableStep<State, App> = { id: 'read', replayPolicy: 'safe', async run(state, execution) {
  return { values: [...state.values, execution.app.owner] };
} };
const confirmation: DurableStep<State, App> = { id: 'write', replayPolicy: 'reconcile', run: step.run,
  async reconcile(state, execution) {
    const zero: 0 = execution.maxModelCalls;
    const stable: string = execution.operationId;
    return { kind: 'completed', state: { values: [...state.values, stable, String(zero)] } };
  }
};
// @ts-expect-error A plain State cannot describe whether the operation actually happened.
const invalidConfirmation: DurableStep<State, App> = { ...confirmation, reconcile: async state => state };
const task = defineDurableTask({ id: 'job', revision: 'v1', isState, steps: [step] }, { now: () => 0 });
const result: Promise<State> = task.run({ taskId: 'id', store }, context);
// @ts-expect-error The result retains State inference.
const wrong: Promise<number> = task.run({ taskId: 'id', store }, context);
// @ts-expect-error The old validate field is not a definition contract.
defineDurableTask<State, App>({ id: 'job', revision: 'v1', validate: isState, steps: [step] });
// @ts-expect-error The old replay field is not a step contract.
const legacyStep: DurableStep<State, App> = { id: 'read', replay: 'safe', run: step.run };
// @ts-expect-error The old positional execution overload has been removed.
task.run('id', store, context.app, context.signal, () => 0);
declare const saved: DurableCheckpoint<State>;
const restored: State = saved.state;
// @ts-expect-error The store accepts only the current checkpoint format.
const oldCheckpoint: DurableCheckpoint<State> = { ...saved, version: 1 };
void [artifact, result, wrong, legacyStep, restored, oldCheckpoint];
`;

test('artifact and durable declarations keep inference and reject removed execution APIs in both module formats', () => {
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
  // Compile the same source once per module format so neither `.d.mts` nor
  // `.d.cts` declarations silently lose a rejection.
  for (const extension of ['mts', 'cts']) {
    const filename = new URL(`./artifacts-durable-types.fixture.${extension}`, import.meta.url)
      .pathname;
    const host = ts.createCompilerHost(options);
    const exists = host.fileExists.bind(host),
      read = host.readFile.bind(host),
      get = host.getSourceFile.bind(host);
    host.fileExists = (path) => path === filename || exists(path);
    host.readFile = (path) => (path === filename ? source : read(path));
    host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
      path === filename
        ? ts.createSourceFile(path, source, languageVersion, true)
        : get(path, languageVersion, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram([filename], options, host);
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter((item) => item.category === ts.DiagnosticCategory.Error);
    // Zero errors includes "unused @ts-expect-error", so a revived legacy API
    // fails here as loudly as a broken current one.
    assert.deepEqual(
      errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
      [],
      extension,
    );
  }
});
