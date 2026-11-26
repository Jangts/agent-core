/**
 * Class implementation contracts for definition decorators. The decorator supplies id;
 * classes implement these named contracts instead of repeating Omit at every use site.
 */
import type { WorkflowNode } from '../../structs/execution/workflow.js';
import type { ToolDefinition } from '../../structs/capabilities/tools.js';
import type { ContextFragmentConfig } from '../../structs/support/context.js';
import type { DefinitionBody } from './definition.js';

/** A node implementation; its public id is supplied by @node. */
export type Node<State, Result, App = undefined> = DefinitionBody<WorkflowNode<State, Result, App>>;
/** A tool implementation with the original schema, authorization and execution contracts. */
export type Tool<Input = unknown, Output = unknown, App = unknown> = DefinitionBody<
  Omit<ToolDefinition<Input, Output, App>, 'asIntent'>
> & { readonly asIntent?: never };
/** A formatter and its original provenance, trust and budget configuration. */
export type Fragment<Input = unknown> = DefinitionBody<ContextFragmentConfig<Input>>;
