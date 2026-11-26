/**
 * Optional standard decorators. Classes are definition implementations; public instance methods
 * keep their original host. Runtime decorators register actual Engine/Runner subclasses; definition decorators preserve their original contracts.
 */
import type { WorkflowNode } from '../../structs/execution/workflow.js';
import { AgentCoreEngine } from '../../execution/engine.js';
import { ModelRunner } from '../../model/runner.js';
import type { ToolDefinition } from '../../structs/capabilities/tools.js';
import type { ContextFragmentConfig } from '../../structs/support/context.js';
import { defineTool } from '../tools.js';
import { defineModelTools } from '../model/capabilities.js';
import { snapshotIntent } from '../../capabilities/tool-conditions.js';
import type { AsIntent, ModelTool } from '../../structs/capabilities/model.js';
import { defineContextFragments } from '../context/assembly.js';
import {
  classDecoration,
  methodDecoration,
  type ClassDecoration,
  type MethodDecoration,
  type DecorationOptions,
  type DefinitionBody,
} from './definition.js';
import type { IdentifiedDefinition, DefinitionKind } from './pool.js';
import {
  runtimeDecoration,
  type InstanceDecorationOptions,
  type RuntimeDecoration,
} from './runtime.js';
export { toolbox } from './toolbox.js';
export { ParseInput, ParseOutput, Authorize } from './parsers.js';
export type { Toolbox, ToolboxEntry } from './toolbox.js';
export type { InstanceDecorationOptions, RuntimeDecoration } from './runtime.js';

export { nodePool, toolPool, fragmentPool, agentPool, modelPool } from './pool.js';
export type { IdentifiedDefinition, DefinitionReader } from './pool.js';
export type { ClassDecoration, MethodDecoration, DecorationOptions } from './definition.js';
export type { Node, Tool, Fragment } from './types.js';

/** Method metadata describes the adapted handler, with optional external namespaces. */
type MethodOptions<Definition extends IdentifiedDefinition, Key extends keyof Definition> = Omit<
  Definition,
  'id' | Key
> &
  DecorationOptions;

/** Intent composition belongs to its own decorator, including on definition classes. */
type WithoutIntent<Definition> = Definition extends unknown
  ? Omit<Definition, 'asIntent'> & { readonly asIntent?: never }
  : never;

/** Metadata follows the actual decorated target, independently of decorator order. */
const intentKey = Symbol.for('@jangts/agent-core/tool-intent-metadata/v1');
const realm = globalThis as unknown as Record<symbol, WeakMap<object, AsIntent<any>> | undefined>;
const intentMetadata = realm[intentKey] ?? new WeakMap<object, AsIntent<any>>();
if (!realm[intentKey]) Object.defineProperty(globalThis, intentKey, { value: intentMetadata });

/** Mark a WorkflowTool for demand discovery; alone this decorator registers nothing. */
export function Intent<Context = any>(metadata: AsIntent<Context> = true) {
  const normalized = snapshotIntent(metadata)!;
  return (value: object, context: ClassDecoratorContext | ClassMethodDecoratorContext): void => {
    if (context.kind !== 'class' && context.kind !== 'method')
      throw new TypeError('Intent requires a class or method');
    if (intentMetadata.has(value)) throw new TypeError('Duplicate Intent decoration');
    intentMetadata.set(value, normalized);
  };
}

/** Internal conversion shared by node/tool/fragment; never a public free-function adapter. */
function decorate<Definition extends IdentifiedDefinition>(
  kind: DefinitionKind,
  id: string,
  options: DecorationOptions & object,
  key: keyof Definition,
  compile: (definition: Definition) => Definition,
): any {
  return (value: any, context: ClassDecoratorContext | ClassMethodDecoratorContext) => {
    const convert = (definition: Definition) => {
      if (kind !== 'tool') return compile(definition);
      if ('asIntent' in definition)
        throw new TypeError('Use @Intent instead of asIntent in @WorkflowTool');
      const metadata = intentMetadata.get(value);
      // Intent metadata is collected before class/method initializers compile definitions.
      if (metadata !== undefined)
        Object.defineProperty(definition, 'asIntent', { value: metadata, enumerable: true });
      return compile(definition);
    };
    if (context?.kind === 'class') {
      classDecoration(kind, id, options, convert)(value, context as ClassDecoratorContext<any>);
    } else {
      const { ns, ...metadata } = options;
      methodDecoration(
        kind,
        id,
        metadata as DefinitionBody<Definition>,
        key,
        { ns },
        convert,
      )(value, context as ClassMethodDecoratorContext);
    }
  };
}

/** Instantiate a node definition class once, injecting its id; graph validation stays in Workflow. */
export function node<State = any, Result = unknown, App = any>(
  id: string,
  options?: DecorationOptions,
): ClassDecoration<WorkflowNode<State, Result, App>>;
/** Bind a named host method as run without renaming or manually binding the original object. */
export function node<State = any, Result = unknown, App = any>(
  id: string,
  options: MethodOptions<WorkflowNode<State, Result, App>, 'run'>,
): MethodDecoration<NonNullable<WorkflowNode<State, Result, App>['run']>>;
export function node(id: string, options: object = {}): any {
  return decorate('node', id, options, 'run', (value: WorkflowNode<any, any, any>) => value);
}

/** Instantiate a tool definition class; schema and authorization stay with existing defineTool. */
export function tool<Input = any, Output = any, App = any>(
  id: string,
  options?: DecorationOptions,
): ClassDecoration<
  WithoutIntent<ToolDefinition<Input, Output, App> | ModelTool<Input, Output, App>>
>;
/** Bind an existing host method as the tool's execute callback. */
export function tool<Input = unknown, Output = unknown, App = any>(
  id: string,
  options: MethodOptions<Omit<ToolDefinition<Input, Output, App>, 'asIntent'>, 'execute'>,
): MethodDecoration<ToolDefinition<Input, Output, App>['execute']>;
/** A model-only tool method provides its synchronous resolver. */
export function tool<Input = unknown, Output = Input, App = any>(
  id: string,
  options: MethodOptions<Omit<ModelTool<Input, Output, App>, 'asIntent'>, 'resolve'>,
): MethodDecoration<ModelTool<Input, Output, App>['resolve']>;
export function tool(id: string, options: object = {}): any {
  if ('asIntent' in options)
    throw new TypeError('Use @Intent instead of asIntent in @WorkflowTool');
  const handlerKey = 'inputSchema' in options && !('authorize' in options) ? 'resolve' : 'execute';
  return decorate<any>('tool', id, options, handlerKey, (value: any) =>
    'kind' in value || 'authorize' in value || 'execute' in value
      ? defineTool(value)
      : defineModelTools([value]).require(value.id),
  );
}

/** Explicit workflow names share the same implementation and pools. */
export { tool as WorkflowTool, node as WorkflowNode };

/** Instantiate a self-describing fragment class; the original builder owns formatting checks. */
export function fragment<Input = unknown>(
  id: string,
  options?: DecorationOptions,
): ClassDecoration<ContextFragmentConfig<Input>>;
/** Bind a host's formatter method into an original fragment configuration. */
export function fragment<Input = unknown>(
  id: string,
  options: MethodOptions<ContextFragmentConfig<Input>, 'format'>,
): MethodDecoration<ContextFragmentConfig<Input>['format']>;
export function fragment(id: string, options: object = {}): any {
  return decorate('fragment', id, options, 'format', (value: ContextFragmentConfig<unknown>) => {
    defineContextFragments([value]);
    return value;
  });
}

/** Construct and register an actual Engine subclass; execution remains explicit. */
export function agent<const Args extends readonly unknown[] = readonly []>(
  id: string,
  options: InstanceDecorationOptions<Args> = {},
): RuntimeDecoration<AgentCoreEngine<any, any, any>, Args> {
  return runtimeDecoration('agent', AgentCoreEngine, id, options);
}

/** Construct and register an actual ModelRunner subclass without resetting its lifetime. */
export function model<const Args extends readonly unknown[] = readonly []>(
  id: string,
  options: InstanceDecorationOptions<Args> = {},
): RuntimeDecoration<ModelRunner<any>, Args> {
  return runtimeDecoration('model', ModelRunner, id, options);
}
