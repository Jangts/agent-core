# 装饰器与定义池

装饰器与读取池从 `@jangts/agent-core/support/decorators` 导入，仅支持 TypeScript 标准装饰器语义。启用了 experimentalDecorators 的 NestJS 编译单元不能直接使用。普通对象、define、构造与 bind 入口保持可用。无新增运行时依赖，不使用 reflect-metadata 或自动 DI。

类装饰器代办定义实例化与 id 注入；实例方法装饰器将原方法绑定为 handler，保留原对象及 this。node、tool、fragment 产出原合同定义；agent、model 构造并登记对应基类的真实子类实例，沿用原预算、取消、授权和状态提交合同。

## 类：处理单元与内部协作

从同一子路径导入 Node、Tool、Fragment 类型，描述类应提供的原字段与方法；id 由装饰器补齐，无需重复写 Omit。Runner 与 Agent 直接继承各自基类。

```ts
import { AgentCoreEngine, defineWorkflow } from '@jangts/agent-core';
import { node, nodePool } from '@jangts/agent-core/support/decorators';
import type { Node } from '@jangts/agent-core/support/decorators';

type State = { text: string; answer?: string };

@node<State, string>('greet', { ns: 'chat' })
class Greeting implements Node<State, string> {
  readonly description = '问候';
  readonly routes = [{ complete: (state: Readonly<State>) => state.answer! }];
  #prefix = '你好，';
  run(state: Readonly<State>) {
    return { answer: this._format(state.text) };
  }
  private _format(text: string) { return this.#prefix + text.trim(); }
}

const workflow = defineWorkflow<State, string>({
  id: 'greeting', nodes: nodePool.getAll('chat'),
});
console.log(await new AgentCoreEngine({ workflow }).run({ text: '访客' }));
```

id 只来自装饰器；类中重复声明 id 会拒绝。node、tool、fragment 定义类必须可无参构造，在静态初始化完成后构造一次；池读取不再构造。配置字段、handler 及内部方法由类提供，不在装饰器中重复 metadata。私有字段、getter 和原型方法保留真实接收者。构造函数只初始化定义，不执行业务操作。

## 命名空间与读取

每种定义各有一个共享读取池：nodePool、toolPool、fragmentPool、agentPool、modelPool。调用方无需创建池或手动登记。所有装饰器接受可选的 `{ ns: string | readonly string[] }`，缺省为 `'default'`。

```ts
nodePool.get('greet', 'chat');            // 单个定义，缺失为 undefined
nodePool.getAll('chat');                  // 此命名空间全部定义
nodePool.pick(['greet', 'answer'], 'chat'); // 按指定顺序选取，缺失或重复 id 抛错
nodePool.get('greet');                    // 等价于 get('greet', 'default')
nodePool.getAll();                        // 只读 default，不跨命名空间合并
nodePool.pick(['greet']);                 // 在 default 中选取
```

同一类型、同一命名空间内 id 唯一；不同命名空间或不同类型可同名。ns 精确匹配，不支持层级、通配或隐式回退，空白名称与空数组拒绝。数组中的重复命名空间去重。`ns: ['chat', 'assistant']` 将同一已构造定义登记到两个空间，不重复构造、不复制实例；任一目标重名则整次登记拒绝，不留下部分写入。

getAll 返回登记顺序的只读数组快照；未知命名空间返回空数组。pick 返回入参顺序的只读数组快照，空 id 数组返回空数组。读取方法可使用原定义类型泛型，如 `nodePool.get<WorkflowNode<State, string>>('greet', 'chat')`；泛型描述调用方预期合同，不是运行时类型证明。

ns 仅用于辅助登记，不进入 Core options；取出的 id 仍为原 id。把不同命名空间的同名定义装入同一 Workflow／ToolRegistry 时，原入口仍拒绝重名。Workflow 节点顺序与路由由 App 明确组织，不把模块导入顺序当成业务执行顺序。池不公开创建、写入、清空或封存接口，不支持 tags 或 owner 查询。

## 已有实例：保留业务方法名

```ts
class GreetingService {
  constructor(private readonly prefix: string) {}
  @node<State, string>('reply', {
    ns: 'chat-service',
    description: '调用已有服务',
    routes: [{ complete: (state: Readonly<State>) => state.answer! }],
  })
  answer(state: Readonly<State>) {
    return { answer: this._format(state.text) };
  }
  private _format(text: string) { return this.prefix + text; }
}
const service = new GreetingService('你好，'); // 创建原宿主，自动绑定与登记
const definition = nodePool.get('reply', 'chat-service');
```

方法装饰器用标准实例初始化钩子绑定并登记，不需要 registerFrom、手写 bind 或额外类装饰器。该钩子先于实例字段与构造函数体运行，因此只绑定、不执行 handler，不访问未初始化的业务字段。调用方必须等待宿主构造成功后再读取并运行定义；构造失败不回滚已完成的初始化登记，应视为装配失败。池持有真实宿主的绑定引用，适用于长期存活的定义／服务实例，不是请求级实例工厂。同命名空间同 id 的第二个实例拒绝登记，不覆盖第一个绑定。

metadata 中的直接回调同样绑定到宿主；嵌套 schema 与 routes 保留原合同接收者，箭头函数保留词法 this。仅支持公开实例方法，不支持静态／私有方法、普通顶层函数的 @ 语法或隐式继承合并。

## getter 与按状态选路

```ts
get routes(): Node<State, string>['routes'] {
  return [
    { when: state => this._hasAnswer(state), complete: state => state.answer! },
    { complete: () => '没有可交付的回答' },
  ];
}
private _hasAnswer(state: Readonly<State>) {
  return Boolean(state.answer?.trim());
}
```

Workflow 装配时读取并固定路由表；getter 应无副作用，不依赖调用次数，也不读取本次请求状态。每次 run 提交补丁后，when／complete 获得最新 state，并可调用原类辅助方法。getter 不会每轮重建路由；不要把请求 state 存在共享节点 this 上。

## 定义类型与原入口

| 装饰器 | 类的结构 | 方法适配 | 读取池 | 后续入口 |
| --- | --- | --- | --- | --- |
| node | `Node<State, Result, App>` | run | nodePool | defineWorkflow |
| tool | `Tool<Input, Output, App>` | execute | toolPool | defineTool／defineToolCatalog |
| fragment | `Fragment<Input>` | format | fragmentPool | defineContextFragments |
| agent | extends AgentCoreEngine | 不提供 | agentPool | 直接 run |
| model | extends ModelRunner | 不提供 | modelPool | 直接 invoke |

agent／model 的 id 是辅助登记键，不覆盖 Core 分支、模型或 transport 身份。工具复用原 defineTool 校验；节点在 defineWorkflow 构造的完整图中验证；fragment 复用原 builder 的 formatter 检查，数据、信任与预算保持原合同；model 由子类构造函数调用原 Runner 初始化，不消耗模型调用。辅助层不公开 metadata＋普通函数转换入口，顶层函数直接填入原 options。

同一 JavaScript realm 内 ESM／CJS 副本共享池；不同进程、Worker 或独立 realm 不共享。两次独立加载并装饰同命名空间同 id 的类仍会重名拒绝，不自动合并。定义模块必须被打包图明确保留；被 tree-shaking 删除的纯副作用导入不能保证登记。共享节点、工具与 fragment 定义不能保存请求身份、signal 或请求预算；池读取不是执行或授权。

## WorkflowTool 与 Intent

WorkflowTool、WorkflowNode 分别是 tool、node 的明确命名入口。WorkflowTool 支持定义类与公开实例方法。模型 Tool 提供 inputSchema 和 resolve；执行 Tool 另外提供 kind、authorize、execute 和 parseOutput。归一化定义进入同一个 toolPool。

```ts
import { WorkflowTool, Intent, toolPool } from '@jangts/agent-core/support/decorators';
import { Support } from '@jangts/agent-core';

@Intent('用户希望记录事情或设置提醒')
@WorkflowTool('memo', { ns: 'assistant' })
class MemoTool {
  description = '接收备忘草案';
  inputSchema = memoSchema;
  resolve(input) { return input; }
}
const candidates = Support.defineModelTools(toolPool.getAll('assistant')).select({ intent: true }, context);
```

Intent 支持无参数、描述字符串、同步布尔判断函数或 `{ description?, when? }`。必须与同一目标的 WorkflowTool 配合，没有独立 ID，单用不注册；两者书写顺序均可。WorkflowTool 参数和被装饰类中不提供 asIntent，使用独立 Intent 装饰器；普通配置对象仍支持 asIntent。

工作流直接使用 `defineWorkflow({ id, nodes, entryNodeId?, revision?, isResult?, traceSource? })` 或 `new AgentWorkflow(definition)` 构造，由 Engine 执行。

## Runner 与 Agent 实例

`@model` 的类必须继承 `ModelRunner`，`@agent` 的类必须继承 `AgentCoreEngine`。装饰器在静态初始化结束后构造一次并注入登记 id；池中保存并返回真实子类实例，保留私有字段、自定义方法和父类行为，不需要再次传配置构造执行器。构造依赖通过可选 `args` 元组显式传入，不使用自动 DI。

```ts
import { AgentCoreEngine, ModelRunner, defineWorkflow } from '@jangts/agent-core';
import { agent, model, agentPool, modelPool } from '@jangts/agent-core/support/decorators';

const flow = defineWorkflow<{ answer: string }, string>({
  id: 'reply',
  nodes: [{ id: 'done', description: '交付', routes: [{ complete: s => s.answer }] }],
});
@agent('chat', { ns: 'app' })
class ChatAgent extends AgentCoreEngine<string, { answer: string }> {
  constructor() { super({ workflow: flow }); }
}
console.log(await agentPool.get<ChatAgent>('chat', 'app')!.run({ answer: 'hello' }));

@model('main', { ns: 'app', args: ['hello'] })
class MainModel extends ModelRunner {
  constructor(text: string) {
    // 示例 Provider；应用可在此初始化自己的真实 Provider。
    super({ provider: { async *stream() { yield text; } }, maxCalls: 2 });
  }
}
console.log((await modelPool.get<MainModel>('main', 'app')!.invoke({ input: 'hi' })).value);
```

未传 `execution` 构造的 Runner 可长期共享：每次顶层 `invoke` 使用独立预算、取消、journal 和调用记录；共享宿主没有隐式的当前请求，直接读取 callCount、totalCallCount、remainingCalls、lastCall、journal 或 signal 会抛错，必须从 `bind(execution)` 返回的绑定读取。多步调用使用 `runner.bind(execution)`，相同 execution 对象返回同一绑定，或直接在构造时传 execution；在绑定实例上读取实时计数和 journal。已绑定实例再次 bind 不重置寿命或赠送额度。共享实例的 `prepare` 固定本次执行，句柄只能由原实例使用一次；`createChild` 须先绑定或显式传 execution，子调用仍扣减祖先预算。同一绑定同时只执行一次调用。Engine 接入共享 Runner 后按每次 run 自动绑定；已有请求绑定仍累计预算并拒绝重叠运行。子类 handler 保留真实接收者；覆写方法通过请求参数中的 execution 调用 `this.bind(request.execution)`，读取与 super 调用一致的执行状态。自定义字段仍共享，请求数据通过参数或 context 传递。

## 共享实例工具组

`@toolbox({ id: options }, { ns?, args?, compile?, error? })` 用于类。options 放 description、kind、active、asIntent 等工具元信息；类内 `inputSchemas[id]` 只放原始 JSON Schema，同名公开方法提供处理逻辑。`@ParseInput(id)`、`@ParseOutput(id)` 将任意命名的公开实例方法挂到该工具的输入与输出解析环节。一个解析方法可叠加多个装饰器供多个工具复用。

执行工具共用 `@Authorize()` 标记的方法，`@Authorize(id)` 给指定工具追加检查。顺序为输入解析、公共授权、单项授权、处理、输出解析；公共拒绝后立即停止。执行工具必须有输入校验、输出解析和公共或单项授权，不隐式放行。没有 kind 的条目遵守 ModelTool 合同，同名方法为同步 resolve，可选 ParseOutput；这种纯模型映射不构成执行授权边界，不能挂单项 Authorize。

`compile` 与 `error` 复用 `Support.fromJsonSchema` 的合同，由 App 提供编译器与错误工厂，不引入内置编译器。登记时复制、冻结并编译 schema；同组中同一 schema 对象只编译一次。调用顺序是 schema 校验、可选 ParseInput 转换或附加检查、授权、处理、ParseOutput。提供 compile 后可省略 ParseInput；未提供 compile 时必须由 ParseInput 完成真实输入校验，JSON Schema 本身不等于校验。编译、校验及输入输出解析必须同步，Promise 会被拒绝；登记失败不发布任何工具。

```ts
import { Support } from '@jangts/agent-core';
import type { ToolDefinition, OperationContext } from '@jangts/agent-core';
import { toolbox, ParseInput, ParseOutput, Authorize, toolPool } from '@jangts/agent-core/support/decorators';
type Input = { text: string };
type App = { allowed: boolean };
@toolbox({
  search: { description: 'Search', kind: 'read' },
  summarize: { description: 'Summarize', kind: 'read' },
}, { ns: 'knowledge' })
class KnowledgeTools {
  #count = 0;
  inputSchemas = {
    search: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
    summarize: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  };
  @ParseInput('search') @ParseInput('summarize')
  parseInput(raw: unknown): Input {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => key !== 'text') || typeof (raw as Input).text !== 'string') throw new TypeError('Invalid input');
    return raw as Input;
  }
  @ParseOutput('search') @ParseOutput('summarize')
  parseOutput(raw: unknown): string { if (typeof raw !== 'string') throw new TypeError('Invalid output'); return raw; }
  @Authorize()
  checkAccess(_input: Input, context: OperationContext<App>) { if (!context.app.allowed) throw new Error('Denied'); }
  search(input: Input) { return input.text + ':' + ++this.#count; }
  summarize(input: Input) { return this.search(input); }
}
const tools = Support.defineToolCatalog<App>(toolPool.getAll<ToolDefinition<Input, string, App>>('knowledge')).bind({ app: { allowed: true } });
console.log((await tools.invoke({ toolId: 'summarize', input: { text: 'hello' } })).value);
```

所有工具与解析、授权方法绑定同一个真实宿主，共享私有字段。`this.search()` 是普通方法组合，不产生第二条工具回执或自动再做授权；独立工具调用仍走现有运行入口。辅助方法不自动登记。整组先完成配置、schema、方法、解析目标及命名空间冲突校验，再一次性写入现有 toolPool；缺失、重复或未知的解析目标都拒绝，不留下部分登记。共享内存不保存请求身份、signal 或请求预算，它们继续来自本次 context。

复用应用已有编译器时，第二个参数直接写 `{ ns: 'knowledge', compile: schema => validator.compile(schema) }`（validator 由应用提供）；上例 ParseInput 可仅保留业务转换，或直接省略。多个工具可在 inputSchemas 中引用同一个 schema 对象。
