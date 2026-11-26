/**
 * Locks down the type-level projection contract of the registries: App metadata and
 * literal unions survive registration, while implementation helpers and nested instance
 * methods are not promised on query results. The fixture is compiled in-process with
 * TypeScript under strict mode as both `.mts` and `.cts`; every `@ts-expect-error` line is
 * part of the required contract.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = `
import { ToolRegistry } from '@jangts/agent-core/tools';
import { GoalRegistry, ScopeRegistry } from '@jangts/agent-core/kits/domains';
import { ToolLifecycleRegistry as Tools, type ToolRuntimeTypes, type ToolsOptions } from '@jangts/agent-core/kits/tools';
class Tool {
  readonly id = 'double' as const;
  readonly kind = 'pure' as const;
  get label() { return 'App metadata' as const; }
  helper() { return 2; }
  parseInput(value: unknown) { return Number(value); }
  parseOutput(value: unknown) { return Number(value); }
  execute(value: unknown) { return Number(value) * this.helper(); }
}
const core = new ToolRegistry<Tool>().register(new Tool());
const coreId: 'double' = core.require('double').id;
const coreKind: 'pure' = core.definitions[0].kind;
const coreLabel: 'App metadata' = core.values().next().value!.label;
// @ts-expect-error Extra implementation helpers are not copied to the registered tool.
core.require('double').helper();

class DomainTool {
  readonly id = 'inspect' as const;
  readonly description = 'Inspect';
  readonly delegates = ['read'] as const;
  readonly scopePolicy = 'required' as const;
  get displayName() { return 'Inspection' as const; }
  helper() { return this.id; }
}
const domainTools = GoalRegistry.create([new DomainTool()], { assertDefinition(value) { const id: 'inspect' = value.helper(); void id; } });
const toolId: 'inspect' = domainTools.get('inspect')!.id;
const toolStep: 'read' = domainTools.require('inspect').delegates[0];
const toolTupleLength: 1 = domainTools.require('inspect').delegates.length;
const toolPolicy: 'required' = domainTools.describe()[0].scopePolicy;
const toolDisplay: 'Inspection' = domainTools.describe()[0].displayName;
domainTools.describe()[0].delegates.push('read');
const mutableDomainTools = GoalRegistry.create([{ id: 'mutable', description: 'Mutable source list', delegates: ['read'], auxiliaryActions: ['inspect'] }]);
// @ts-expect-error Registered delegates are frozen even when the source array was mutable.
mutableDomainTools.require('mutable').delegates.push('read');
// @ts-expect-error Registered auxiliary actions are also frozen.
mutableDomainTools.require('mutable').auxiliaryActions.push('inspect');
mutableDomainTools.describe()[0].delegates.push('read');
// @ts-expect-error Description delegates preserve the declared vocabulary.
domainTools.describe()[0].delegates.push('other');
// @ts-expect-error Queries expose data, not source-instance helpers.
domainTools.require('inspect').helper();
// @ts-expect-error Descriptions also expose data rather than the full source instance.
domainTools.describe()[0].helper();
// @ts-expect-error Batch registration has no legacy sealing argument.
domainTools.registerAll([new DomainTool()], true);

class Evidence {
  readonly kind = 'knowledge' as const;
  readonly id = 'city';
  get label() { return 'Evidence metadata' as const; }
  helper() { return this.id; }
}
class Scope {
  readonly id = 'city' as const;
  readonly description = 'City';
  readonly category = 'place' as const;
  readonly goalIds = ['inspect'] as const;
  readonly toolIds = ['read'] as const;
  readonly evidence = [new Evidence()] as const;
  get extensionLink() { return true as const; }
  helper() { return this.extensionLink; }
}
const scopes = ScopeRegistry.create([new Scope()], {
  assertDefinition(value) { const enabled: true = value.helper(); void enabled; },
  acceptsGoal(value, id) { return value.helper() && id === 'inspect'; },
});
const scopeId: 'city' = scopes.require('city').id;
const scopeKind: 'place' = scopes.describe()[0].category;
const scopeTool: 'read' = scopes.require('city').toolIds[0];
const scopeTupleLength: 1 = scopes.require('city').toolIds.length;
const evidenceTupleLength: 1 = scopes.require('city').evidence.length;
const extensionLink: true = scopes.get('city')!.extensionLink;
const projectedLink: true = scopes.describe()[0].extensionLink;
const evidenceKind: 'knowledge' = scopes.evidence('city')[0].kind;
const evidenceLabel: 'Evidence metadata' = scopes.describe()[0].evidence[0].label;
const mutableScopes = ScopeRegistry.create([{ id: 'mutable', description: 'Mutable source lists', category: 'place', goalIds: ['inspect'], toolIds: ['read'], aliases: ['alias'], evidence: [new Evidence()] }]);
// @ts-expect-error Registered scope lists are frozen even when the source was mutable.
mutableScopes.require('mutable').toolIds.push('read');
// @ts-expect-error Registered aliases are frozen as well.
mutableScopes.require('mutable').aliases.push('alias');
// @ts-expect-error The evidence array is a frozen registration snapshot.
mutableScopes.require('mutable').evidence.push(new Evidence());
mutableScopes.describe()[0].toolIds.push('read');
mutableScopes.describe()[0].aliases.push('alias');
mutableScopes.describe()[0].evidence.push({ kind: 'knowledge', id: 'city', label: 'Evidence metadata' });
// @ts-expect-error Scope queries do not claim unregistered helpers.
scopes.require('city').helper();
// @ts-expect-error Scope descriptions do not claim unregistered helpers.
scopes.describe()[0].helper();
// @ts-expect-error Nested evidence is also a data projection.
scopes.evidence('city')[0].helper();
// @ts-expect-error Batch registration has no legacy sealing argument.
scopes.registerAll([new Scope()], false);

interface Types extends ToolRuntimeTypes {
  decision: { next: { type: string } };
  context: {};
  placement: 'catalog';
}
const protocol = { keys: (_value: Record<string, unknown>) => ['type'], assert: (_value: { type: 'read' }) => {}, terminal: true as const };
class Lifecycle {
  readonly protocol = protocol;
  get label() { return 'Lifecycle metadata' as const; }
  helper() { return 'rule'; }
  call() { this.helper(); }
  rules() { return [{ order: 1, text: this.helper() }]; }
}
class LifecycleTool extends Tool {
  readonly description = 'Read';
  readonly audience = 'model' as const;
  readonly effect = 'read' as const;
  readonly goalIds = ['inspect'] as const;
  readonly lifecycle = new Lifecycle();
  identity() { return this.id; }
}
const options: ToolsOptions<Types, LifecycleTool> = {
  registration: { kinds: ['pure'], audiences: ['model'], effects: ['read'], goalExists: () => true,
    isValidId(value) { return value.identity() === 'double'; } },
  goalIds: () => ['inspect'],  outputs: () => [],
  contextFragment(tool, field) { return { id: tool.identity(), sourceId: tool.id, role: 'user', trust: 'server', lifetime: 'step', maxChars: 1000, value: { extra: field.value } }; },
};
const lifecycle = new Tools<Types, LifecycleTool>(options).register(new LifecycleTool());
const lifecycleId: 'double' = lifecycle.require('double').id;
const lifecycleAudience: 'model' = lifecycle.require('double').audience;
const lifecycleStep: 'double' = lifecycle.require('double').id;
const lifecycleLabel: 'Lifecycle metadata' = lifecycle.require('double').lifecycle!.label;
const preciseProtocol: typeof protocol = lifecycle.require('double').lifecycle!.protocol;
lifecycle.protocols().require('double').assert({ type: 'read' });
lifecycle.copyTo(new Tools<Types, LifecycleTool>(options));
class MutableLifecycle extends Tool {
  readonly description = 'Read'; readonly audience = 'model' as const; readonly effect = 'read' as const;
  readonly goalIds = ['inspect'];
}
const mutableLifecycle = new Tools<Types, MutableLifecycle>({ ...options,
  registration: { ...options.registration, isValidId: tool => tool.id === 'double' },
  contextFragment: (tool, field) => ({ id: tool.id, sourceId: tool.id, role: 'user', trust: 'server', lifetime: 'step', maxChars: 1000, value: { extra: field.value } }),
}).register(new MutableLifecycle());
// @ts-expect-error Lifecycle intent IDs are frozen even when the source list was mutable.
mutableLifecycle.require('double').goalIds.push('inspect');
// @ts-expect-error Tool helpers remain on the original implementation.
lifecycle.require('double').identity();
// @ts-expect-error Nested lifecycle helpers are not a registered callback contract.
lifecycle.require('double').lifecycle!.helper();
void [coreId, coreKind, coreLabel, toolId, toolStep, toolTupleLength, toolPolicy, toolDisplay, scopeId, scopeKind, scopeTupleLength, evidenceTupleLength,
  scopeTool, extensionLink, projectedLink, evidenceKind, evidenceLabel, lifecycleId, lifecycleAudience,
  lifecycleStep, lifecycleLabel, preciseProtocol];
`;

test('registry projections preserve App data and literal contracts without promising extra instance methods in either module format', () => {
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
  // Both module formats must agree: the type contract cannot depend on ESM interop rules.
  for (const extension of ['mts', 'cts']) {
    const filename = new URL(`./registry-projection-types.fixture.${extension}`, import.meta.url)
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
    assert.deepEqual(
      errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')),
      [],
      extension,
    );
  }
});
