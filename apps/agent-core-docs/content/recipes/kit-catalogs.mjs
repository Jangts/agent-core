/**
 * Kit 声明式目录示例：领域 Tool 与范围、Agent Tool 菜单、交互命令与工具生命周期。
 * 重点展示“同一份声明生成模型可见清单和真实执行入口”，由产生文档的脚本聚合。
 */
/** 构造示例条目；note 用于补充离线限制或容易误读的约束。 */
const sample = (title, level, ts, note) => ({
  title,
  level,
  environment: 'Node.js',
  ts,
  ...(note ? { note } : {}),
});

export default [
  {
    // 演示领域 Tool 与范围的注册/封存及关系查询；描述关系不等于服务端授权。
    id: 'kit-intents',
    title: 'Domain Tools：Tool 声明与范围关系',
    layer: 'kit',
    matches: [
      'DomainToolRegistry',
      'createDomainToolRegistry',
      'ScopeRegistry',
      'createScopeRegistry',
    ],
    summary: '同一清单提供可用 Tool、允许 delegate、范围别名、来源和工具关系。',
    details: `DomainToolRegistry.create(definitions,policy?) 与 createDomainToolRegistry 创建并封存完整目录；new DomainToolRegistry(policy) 则允许 register/registerAll 后 seal。定义至少包含 id、description，可选 delegates 必须非空且无重复；asIntent 只描述该 Tool 参与需求识别的用途，不产生独立 Intent 实体。

ScopeRegistry 的定义还需 category；domainToolIds、queryScopeIds、knowledgeTopicIds、toolIds、aliases 缺省为空数组。它不替 App 推断关系。normalize 使用已登记别名，acceptsDomainTool/acceptsQuery 检查关系，topics/evidence 返回声明。create 同样封存，构造器允许后续集中登记。相同数据在登记时形成只读快照，回调保留原接收者；App 服务仍由原实现访问。

描述和关系不是权限本身。模型看见某个 Tool 或资料范围，不意味着服务端已经授权工具。`,
    examples: [
      sample(
        '先登记一个接口说明 Tool',
        '入门',
        `import { DomainToolRegistry, ScopeRegistry } from '@jangts/agent-core/kits/domains';
const tools = DomainToolRegistry.create([
  { id: 'explain', description: '根据资料解释 SDK', delegates: ['read', 'reply'], asIntent: true },
]);
console.log(tools.ids(), tools.allows('explain', 'read'));
const scopes = ScopeRegistry.create([
  { id: 'sdk', description: 'SDK 说明资料', category: 'knowledge' },
]);
console.log(scopes.require('sdk').knowledgeTopicIds);`,
      ),
      sample(
        '增加约束和范围关联，查询入口保持一致',
        '配置',
        `import { DomainToolRegistry, ScopeRegistry } from '@jangts/agent-core/kits/domains';
const tools = new DomainToolRegistry({ idPattern: /^[a-z-]+$/, delegates: ['read', 'reply'] })
  .registerAll([{ id: 'explain', description: '根据资料解释 SDK', delegates: ['read', 'reply'], asIntent: '用户希望了解 SDK 接口或用法。' }]).seal();
const scopes = ScopeRegistry.create([
  { id: 'sdk', description: 'SDK 说明资料', category: 'knowledge', aliases: ['agent-core'], domainToolIds: ['explain'], knowledgeTopicIds: ['manual'], toolIds: ['read-source'] },
], { categories: ['knowledge'], requireGoals: true, requireSources: true });
console.log(tools.describe(), scopes.normalize('agent-core'));
console.log(scopes.acceptsDomainTool('agent-core', 'explain'), scopes.topics('sdk'));`,
      ),
    ],
    policies: [
      {
        title: 'LifecycleTool 校验与封存',
        file: 'src/kits/domains/registry.ts',
        symbols: ['DomainToolRegistry', 'createDomainToolRegistry'],
      },
      {
        title: '范围关系与别名',
        file: 'src/kits/domains/scopes.ts',
        symbols: ['ScopeRegistry', 'createScopeRegistry'],
      },
    ],
  },
  {
    // 演示从真实目录投影模型菜单；任务接受后默认收窄范围，但菜单仍不等于执行许可。
    id: 'kit-agent-catalog',
    title: 'Agent Catalog：从真实注册结果生成 LifecycleTool 菜单',
    layer: 'kit',
    matches: ['defineAgentCatalog', 'domainToolDelegates'],
    summary: 'LifecycleTool、范围和工具菜单由真实目录投影，不单独维护一份提示词 LifecycleTool 清单。',
    details: `defineAgentCatalog 接受结构化端口。domainToolDelegates(goals, tools, protocols, context?) 直接复用同一关系推导，可用于无运行实例的协议边界；默认从工具 domainToolIds 和终态协议生成下一步，DomainTool.delegates 仅用于显式收窄。domainToolIds/goals/scopes 从真实注册结果读取；tools 提供 values、has、supportsDomainTool、describe；currentTask 返回本次已接受任务 { domainToolId, scopeId } 或 undefined。

modelCatalog(app) 返回 availableGoalIds、availableGoals、availableScopes、availableTools。默认 restrictToTask=true，任务接受后限制到该 LifecycleTool 及范围；配置 false 才保留完整菜单。domainToolDelegates 从工具 domainToolIds 与终态协议推导下一步；显式 DomainTool.delegates 只用于收窄，所有调用仍引用工具自身 id。运行时可用条件仍由 App 端口确定，菜单不代替执行授权。`,
    examples: [
      sample(
        '把已有 LifecycleTool 与范围投影成模型菜单',
        '入门',
        `import { DomainToolRegistry, ScopeRegistry, defineAgentCatalog } from '@jangts/agent-core/kits/domains';
const tools = DomainToolRegistry.create([{ id: 'explain', description: '解释接口', delegates: ['reply'], asIntent: true }]);
const scopes = ScopeRegistry.create([{ id: 'sdk', description: 'SDK 资料', category: 'knowledge', domainToolIds: ['explain'] }]);
const catalog = defineAgentCatalog({
  domainToolIds: () => tools.ids(), goals: ids => tools.describe(ids), scopes: ids => scopes.describe(ids), currentTask: () => undefined,
  tools: { values: () => [], has: () => false, supportsDomainTool: () => true, describe: () => [] },
});
console.log(catalog.modelCatalog(undefined));`,
      ),
      sample(
        '相同菜单接上实际工具声明和当前任务',
        '配置',
        `import { DomainToolRegistry, ScopeRegistry, defineAgentCatalog } from '@jangts/agent-core/kits/domains';
const goals = DomainToolRegistry.create([{ id: 'explain', description: '解释接口', delegates: ['reply'], asIntent: true }]);
const scopes = ScopeRegistry.create([{ id: 'sdk', description: 'SDK 资料', category: 'knowledge', domainToolIds: ['explain'], toolIds: ['read-source'] }]);
const tools = [{ id: 'read-source', kind: 'read', description: '读取允许的说明资料', audience: 'model', effect: 'read', domainToolIds: ['explain'], lifecycle: { id: 'read' } }];
type App = { current?: { domainToolId: string; scopeId: string } };
const catalog = defineAgentCatalog<App, string, ReturnType<typeof goals.describe>[number], ReturnType<typeof scopes.describe>[number]>({
  domainToolIds: () => goals.ids(), goals: ids => goals.describe(ids), scopes: ids => scopes.describe(ids), currentTask: app => app.current,
  tools: { values: () => tools, has: id => tools.some(tool => tool.id === id), supportsDomainTool: () => true, describe: audience => tools.filter(tool => !audience || tool.audience === audience) },
});
console.log(catalog.modelCatalog({ current: { domainToolId: 'explain', scopeId: 'sdk' } }));`,
        '此例的 tools 是一个结构化投影端口；实际应用应直接连接真实工具注册器的对应方法，避免平行维护。',
      ),
    ],
    policies: [
      {
        title: '从真实目录生成任务范围内的菜单',
        file: 'src/kits/domains/catalog.ts',
        symbols: ['defineAgentCatalog'],
      },
    ],
  },
  {
    // 演示命令字段声明同时生成模型 Schema 与本地 handler 绑定；category 只是用途。
    id: 'kit-interaction',
    title: 'Interaction：声明命令并绑定本地处理器',
    layer: 'kit',
    matches: [
      'Interaction',
      'InteractionProtocol',
      'defineInteractionProtocol',
      'defineCommand',
      'compileCommands',
      'commandSchema',
      'CommandCatalog',
      'defineCommandCatalog',
      'bindInteraction',
      'INTERACTION_CATEGORIES',
    ],
    summary: '命令的字段、目的、选择器、检查和 handler 来自同一声明，模型不能添加可执行处理器。',
    details: `defineCommand 编译单命令；compileCommands/CommandCatalog 编译一组；Interaction.define（即 defineInteractionProtocol）再提供 commandField 与命令选择。receive 返回 {id,result}，parse 只返回 result；dispatch 根据已校验的命令 ID 调用已绑定 handler，不按 format 返回值重新分发。

字段声明生成模型 Schema，并检查字段存在、未知字段、选择器、ownedFields、checks 和 refine。字段的 jsonSchema 不等于自动执行完整 JSON Schema 类型校验；类型和业务约束应在 checks/refine 或自己的 SchemaAdapter 中实现。默认 additionalProperties=false、optionalPresence='own'。occur 为遇到即拒绝；when 只决定启用此检查。

category 只能是 query/action/presentation/input/receipt，是命令用途，不是权限等级或执行成功的声明。HTTP、SSE、实际工具执行与服务端鉴权不属于这个协议编译器。`,
    examples: [
      sample(
        '先定义一种说明命令并校验',
        '入门',
        `import { Interaction } from '@jangts/agent-core/kits/interaction';
const protocol = Interaction.define({
  commandField: 'type', commands: {
    reply: { category: 'presentation', description: '展示已确认说明', fields: { text: { required: true, jsonSchema: { type: 'string' } } },
      checks: [{ occur: value => typeof value.text !== 'string', error: 'text 必须是字符串' }] },
  },
});
console.log(protocol.receive({ type: 'reply', text: '普通对象也能实现接口。' }));
console.log(protocol.modelJsonSchema);`,
      ),
      sample(
        '保留同一协议，增加完整 handler 绑定',
        '配置',
        `import { Interaction } from '@jangts/agent-core/kits/interaction';
const protocol = Interaction.define({
  commandField: 'type', commands: {
    reply: { category: 'presentation', description: '展示已确认说明', fields: { text: { required: true, jsonSchema: { type: 'string' } } }, checks: [{ occur: value => typeof value.text !== 'string', error: 'text 必须是字符串' }] },
    unavailable: { category: 'receipt', description: '说明资料不可用', fields: {} },
  },
});
const dispatcher = Interaction.bind(protocol, {
  reply: value => '说明：' + String(value.text),
  unavailable: () => '资料暂不可用',
});
console.log(dispatcher.dispatch({ type: 'reply', text: '普通对象也能实现接口。' }, undefined));
console.log(dispatcher.catalog);`,
      ),
      sample(
        '直接复用单命令与批量编译入口',
        '扩展',
        `import { defineCommand, compileCommands, commandSchema, CommandCatalog } from '@jangts/agent-core/kits/interaction';
const reply = defineCommand({ fields: { text: { required: true } }, checks: [{ occur: value => typeof value.text !== 'string', error: '需要文本' }] });
console.log(reply.parse({ text: '接口说明' }));
const compiled = compileCommands({ reply: { fields: { text: { required: true } } } });
const commands = new CommandCatalog(Object.entries(compiled));
console.log(commandSchema('reply', commands.require('reply')), commands.manifest());`,
        '使用 Interaction 时选择器由它生成；自行用 defineCommand 时也可以显式提供 discriminator。此例没有执行任何工具。',
      ),
    ],
    policies: [
      {
        title: '字段、检查与模型 Schema',
        file: 'src/kits/interaction/command.ts',
        symbols: ['defineCommand', 'compileCommands', 'commandSchema'],
      },
      {
        title: '选择器与命令接收',
        file: 'src/kits/interaction/transfer.ts',
        symbols: ['InteractionProtocol'],
      },
      {
        title: '按已校验命令绑定本地 handler',
        file: 'src/kits/interaction/handlers.ts',
        symbols: ['bindInteraction'],
      },
    ],
  },
  {
    // 演示已有复杂工具的生命周期扩展；只有需要步骤/交付阶段时才使用这套 Kit。
    id: 'kit-tool-lifecycle',
    title: 'Tools：App 工具生命周期与内容贡献',
    layer: 'kit',
    matches: ['ToolLifecycleRegistry', 'ToolLifecycleRegistry'],
    summary: '对已有复杂 App 工具统一登记工具调用、输出规则、上下文贡献和交付处理。',
    details: `Tools 是 ToolLifecycleRegistry 的别名，面向拥有 delegate、DomainTool、展示及交付阶段的 App。只需执行普通工具时，可直接使用 Core ToolRegistry；此 Kit 不要求每个 Agent 配置这一整套生命周期。

构造时配置 registration、invocationId、outputs、domainToolIds、contextFragment 和可选调用端口；批量 registerAll 后 seal。invoke 返回统一 ToolResult；call(next,context) 通过已登记 invocation 同步执行。可选 contribution 提供 inspect、rules、modelFields、visibleText、reviewDraft、recoveryContext、composition、finalize 等局部行为。调用和最终提交仍应经过 App 编排中的实际授权。

rules 按 order 排序，composition 最多一个贡献者拥有本次模板。normalizer/finalizer 各只允许登记一次。copyTo 复制已编译声明，不能绕过目标注册策略；运行时服务依赖仍由原实现拥有。该 Kit 的阶段、DomainTool 和上下文字段不是 Core 的必需合同。`,
    examples: [
      sample(
        '为已有 App 登记一个只读工具',
        '入门',
        `import { ToolLifecycleRegistry } from '@jangts/agent-core/kits/tools';
type Runtime = { decision: { type: string }; context: { canRead: boolean }; composition: string; phase: string; placement: string; normalizerArgs: []; result: string; receiver: undefined };
const tools = new Tools<Runtime>({
  registration: { kinds: ['read'], audiences: ['model'], effects: ['read'], isValidId: tool => !!tool.id, goalExists: id => id === 'explain' },
  invocationId: decision => decision.type, outputs: () => [], domainToolIds: () => ['explain'],
  contextFragment() { throw new Error('这个工具没有登记上下文字段'); },
});
tools.registerAll([{ id: 'read-source', kind: 'read', description: '读取已允许说明', audience: 'model', effect: 'read', domainToolIds: ['explain'], parseInput: value => value, parseOutput: value => value, execute: () => '接口说明' }]).seal();
console.log(tools.invoke({ toolId: 'read-source', input: {} }).value);
console.log(tools.describe('model', { canRead: true }));`,
      ),
      sample(
        '同一注册方式增加 App 规则和展示贡献',
        '配置',
        `import { ToolLifecycleRegistry } from '@jangts/agent-core/kits/tools';
type Runtime = { decision: { type: string }; context: { canRead: boolean }; composition: string; phase: string; placement: string; normalizerArgs: []; result: string; receiver: undefined };
const tools = new Tools<Runtime>({
  registration: { kinds: ['read'], audiences: ['model'], effects: ['read'], isValidId: tool => !!tool.id, goalExists: id => id === 'explain' },
  invocationId: decision => decision.type, outputs: () => [], domainToolIds: () => ['explain'],
  contextFragment() { throw new Error('这个工具没有登记上下文字段'); },
});
tools.registerAll([{ id: 'read-source', kind: 'read', description: '读取已允许说明', audience: 'model', effect: 'read', domainToolIds: ['explain'], active: app => app.canRead,
  parseInput: value => value, parseOutput: value => value, execute: () => '接口说明',
  lifecycle: { rules: () => [{ order: 10, text: '只根据真实读取结果回答。' }], visibleText: text => text.trim() },
}]).seal();
console.log(tools.taskRules({ canRead: true }));
console.log(tools.visibleText(' 已确认说明 ', { canRead: true }));
console.log(tools.describe('model', { canRead: false }));`,
        'active 影响真实工具可用性及描述；业务授权仍必须在实际调用边界核对服务端身份。',
      ),
    ],
    policies: [
      {
        title: '注册策略、生命周期绑定和内容投影',
        file: 'src/kits/tools.ts',
        symbols: ['ToolLifecycleRegistry', 'ToolLifecycleRegistry'],
      },
    ],
  },
];
