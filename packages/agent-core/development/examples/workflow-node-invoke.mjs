/**
 * Example: a multi-node workflow that invokes schemas, tools and app services per node.
 *
 * Later forks extend the node graph from a checkpoint while keeping the Core result contract.
 */
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow, route, Support } from '@jangts/agent-core';

const text = Support.defineSchema({
  jsonSchema: { type: 'string' },
  parse(value) {
    if (typeof value !== 'string') throw new TypeError('Expected text');
    return value;
  },
});
const request = Support.defineSchema({
  jsonSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
  parse(value) {
    return { name: text.parse(value?.name) };
  },
});
const service = Support.defineSchema({
  jsonSchema: {
    type: 'object',
    required: ['name', 'online'],
    properties: {
      name: { type: 'string' },
      online: { type: 'boolean' },
    },
  },
  parse(value) {
    if (typeof value?.online !== 'boolean') throw new TypeError('Expected service availability');
    return { name: text.parse(value.name), online: value.online };
  },
});

const offline = ({ name }) => `${name}已离线`;

function statusTools(calls, online) {
  return Support.defineToolCatalog([
    {
      id: 'lookup_service',
      kind: 'read',
      description: '查询服务是否在线',
      inputSchema: request,
      authorize() {},
      parseOutput: service.parse,
      execute({ name }) {
        calls.push('lookup_service');
        return { name, online };
      },
    },
    {
      id: 'read_latency',
      kind: 'read',
      description: '生成状态，在线时读取延迟',
      inputSchema: service,
      authorize() {},
      parseOutput: text.parse,
      execute(status) {
        calls.push('read_latency');
        return status.online ? `${status.name}延迟 12ms` : offline(status);
      },
    },
  ]);
}

// 入门配置。每个节点声明调用、结果字段和下一条路由。
const lookup = {
  id: 'lookup',
  description: '查询服务是否在线',
  async run({ name }, { tools }) {
    const { value } = await tools.invoke({ toolId: 'lookup_service', input: { name } });
    return { service: value };
  },
  routes: [{ targetNodeId: 'latency' }],
};
const readLatency = {
  id: 'latency',
  description: '读取服务延迟',
  async run({ service }, { tools }) {
    const { value } = await tools.invoke({ toolId: 'read_latency', input: service });
    return { result: value };
  },
  routes: [route.deliver('result')],
};

const basic = defineWorkflow({
  id: 'status',
  nodes: [
    {
      ...lookup,
      routes: [
        { complete: ({ service }) => (service.online ? `${service.name}在线` : offline(service)) },
      ],
    },
  ],
});
const extension = {
  revision: 'latency',
  nodes: [readLatency],
  routes: {
    lookup: [
      { when: ({ service }) => service.online, targetNodeId: 'latency' },
      ...basic.require('lookup').routes,
    ],
  },
};

for (const online of [true, false]) {
  const calls = [];
  const tools = statusTools(calls, online).bind({ app: {} });
  const agent = new AgentCoreEngine().bindWorkflow(basic).bindToolRuntime(tools);
  const upgraded = agent.fork({
    at: agent.snapshot({ online }),
    workflow: extension,
    resume: (snapshot) => ({ tools: statusTools(calls, snapshot.online).bind({ app: {} }) }),
  });
  const before = { value: await agent.run({ name: '演示服务' }), calls: calls.splice(0) };
  const after = { value: await upgraded.run({ name: '演示服务' }), calls: calls.splice(0) };
  assert.deepEqual(before.calls, ['lookup_service']);
  assert.deepEqual(after.calls, online ? ['lookup_service', 'read_latency'] : ['lookup_service']);
  console.log(online ? '在线' : '离线', { basic: before, conditional: after });
}
