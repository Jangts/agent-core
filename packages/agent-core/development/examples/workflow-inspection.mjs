/** Declaration-only example for the workflow inspector. Importing it does not run the workflow. */
import { Support, defineWorkflow } from '@jangts/agent-core';

const isReady = (state) => state.ready === true;
const needsAnotherPass = (state) => state.retry === true;
const object = { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] };
const toolCatalog = Support.defineToolCatalog(
  [
    { id: 'lookup', description: 'Read an item from a supplied local collection' },
    { id: 'explain', description: 'Format the requested topic' },
  ].map(({ id, description }) => ({
    id,
    description,
    kind: 'pure',
    inputSchema: { jsonSchema: object, parse: (value) => value },
    authorize() {},
    execute: ({ topic }) => topic,
    parseOutput: (value) => value,
  })),
);

const workflow = defineWorkflow({
  id: 'workflow-inspection-example',
  revision: 'demo',
  entryNodeId: 'receive',
  nodes: [
    {
      id: 'receive',
      description: 'Collect the topic and select a review route',
      startsRound: true,
      requires: ['topic'],
      routes: [
        { id: 'ready', conditionId: 'topic-ready', when: isReady, targetNodeId: 'review' },
        { id: 'fallback', targetNodeId: 'review' },
      ],
    },
    {
      id: 'review',
      description: 'Review the available facts',
      onErrorNodeId: 'recover',
      onErrorRouteId: 'recover-review',
      routes: [
        {
          id: 'another-pass',
          conditionId: 'retry-requested',
          when: needsAnotherPass,
          targetNodeId: 'receive',
        },
        { id: 'accepted', targetNodeId: 'deliver' },
      ],
    },
    {
      id: 'recover',
      description: 'Give a minimal result after a handled error',
      routes: [{ targetNodeId: 'deliver' }],
    },
    {
      id: 'deliver',
      description: 'Return the requested topic',
      routes: [{ complete: (state) => state.topic }],
    },
  ],
});

const lookup = { toolId: toolCatalog.require('lookup').id, access: 'read' };
const explain = { toolId: toolCatalog.require('explain').id, access: 'format' };

export const inspection = {
  workflow,
  toolCatalog,
  nodeCapabilities: [
    { nodeId: 'receive', kind: 'control', tools: [lookup] },
    {
      nodeId: 'review',
      tools: [lookup, explain],
      adapters: [
        { id: 'local-read', toolIds: [lookup.toolId], parameters: object },
        {
          id: 'text-only',
          toolIds: [explain.toolId],
          parameters: { type: 'object', properties: { topic: { type: 'string', maxLength: 120 } } },
        },
      ],
    },
  ],
  nodeMetadata: [
    {
      nodeId: 'deliver',
      completion: 'Return the current topic',
      source: 'workflow-inspection.mjs',
    },
  ],
  routeConditions: [
    {
      sourceNodeId: 'receive',
      order: 0,
      conditionSource: 'isReady',
      source: 'workflow-inspection.mjs',
    },
    {
      sourceNodeId: 'review',
      order: 0,
      conditionSource: 'needsAnotherPass',
      source: 'workflow-inspection.mjs',
    },
  ],
};
