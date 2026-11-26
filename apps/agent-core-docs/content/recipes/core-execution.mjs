// Agent Core 文档站的 Core 执行配方：Engine 运行、Workflow 定义与扩展、route 生成器、
// 过程监听、尝试预算与 ContextJournal。默认导出配方数组，由 core-support.mjs 汇总。
const helloWorkflow = `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';

type State = { name: string; answer?: string };
const workflow = defineWorkflow<State, string>({
  id: 'greeting',
  nodes: [{
    id: 'greet', description: '根据本次姓名生成问候', startsRound: true,
    run: state => ({ answer: '你好，' + state.name }),
    routes: [route.deliver('answer')],
  }],
});`;

export default [
  {
    id: 'engine-run',
    title: 'Agent：先运行，再逐步绑定 Tool 与依赖',
    layer: 'core',
    matches: [
      'AgentCoreEngine',
      'AgentCoreEngine.run',
      'AgentCoreEngine.bindWorkflow',
      'AgentCoreEngine.workflow',
      'CoreStep',
      'StepOutcome',
      'AgentCoreEngineSetup',
      'AgentCoreEngineOptions',
    ],
    summary: 'Engine 执行有界循环；绑定 Workflow 后，每次只传状态中变化的数据。',
    details: `无 Workflow 时，run 接受 CoreStep，步骤返回明确的 continue 或 complete。绑定 Workflow 后，run 接受该 Workflow 的 State，返回业务 Result；不是新的结果信封。模型和工具调用另外返回带 invocation 的统一结果。

构造时可省略 Workflow，稍后 bindWorkflow 一次；两种装配方式使用同一个 run。一个 Engine 只绑定一个 Workflow，不提供运行时切换 Workflow。稳定依赖属于实例，本次输入、取消信号属于请求。默认最多 8 轮，maxRounds 是轮次预算，不是节点数；同轮多个阶段不多扣一轮。

节点 run 仅返回变化字段。Core 在取消及字段检查后提交；requires/provides 是运行时合同，不能把未得到的数据伪造成已完成。自编排 CoreStep 与显式 Workflow 都保留。`,
    examples: [
      {
        title: '一个普通步骤即可运行',
        level: '入门',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine } from '@jangts/agent-core/engine';

const agent = new AgentCoreEngine<string>();
const answer = await agent.run(() => ({ type: 'complete', value: '你好，Core' }));
console.log(answer);`,
      },
      {
        title: '增加显式 Workflow，仍然调用 run',
        level: '配置',
        environment: 'Node.js',
        ts: `${helloWorkflow}

const agent = new AgentCoreEngine({ workflow });
console.log(await agent.run({ name: 'Ivan' }));
console.log(await agent.run({ name: '访客' }));`,
      },
      {
        title: '依赖稍后就绪时绑定一次',
        level: '扩展',
        environment: 'Node.js',
        ts: `${helloWorkflow}

const agent = new AgentCoreEngine<string>({ maxRounds: 2 }).bindWorkflow(workflow);
const controller = new AbortController();
console.log(await agent.run({ name: 'Ivan' }, { signal: controller.signal }));`,
        note: '没有重新传 Workflow。传入的信号与实例信号合并；取消不会让迟到结果成为成功提交。',
      },
    ],
    policies: [
      {
        title: '有界循环、提交与取消的执行实现',
        file: 'src/execution/engine.ts',
        symbols: ['AgentCoreEngine'],
      },
    ],
  },
  {
    id: 'workflow-definition',
    title: 'Workflow：节点、路由与局部状态更新',
    layer: 'core',
    matches: [
      'AgentWorkflow',
      'defineWorkflow',
      'AgentWorkflowDefinition',
      'WorkflowNode',
      'WorkflowRoute',
      'WorkflowContext',
      'WorkflowFailure',
      'requireWorkflowValue',
      'AgentWorkflow.describe',
      'AgentWorkflow.require',
      'AgentWorkflow.definitions',
      'AgentWorkflow.ids',
      'AgentWorkflow.has',
      'AgentWorkflow.get',
      'AgentWorkflow.values',
      'AgentWorkflow.entries',
    ],
    summary: '用一份真实参与运行的节点定义，集中展示执行顺序、分支、错误去向和结束条件。',
    details: `省略 entryNodeId 时使用第一个节点；入口必须 startsRound。每个节点需要描述和至少一条路由。条件按数组顺序判断，未带 when 的路由一般放最后；目标跳转与 complete 结束二者择一。

Core 在构造时检查重复节点、失效引用、不可达节点及绕过轮次边界的循环。节点可以是普通对象，也可以是实现 WorkflowNode 结构的类；Core 固定回调及原接收者。describe 返回定义投影，不含本次状态与 handler 实现。`,
    examples: [
      {
        title: '一个节点完成问候',
        level: '入门',
        environment: 'Node.js',
        ts: `${helloWorkflow}
console.log(workflow.entryNodeId);
console.log(workflow.describe());`,
      },
      {
        title: '增加校验阶段，原状态与 run 方式不变',
        level: '配置',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
type State = { name: string; answer?: string; error?: string };
const workflow = defineWorkflow<State, string>({
  id: 'greeting',
  nodes: [
    { id: 'check', description: '检查姓名', startsRound: true,
      run: state => ({ error: state.name.trim() ? undefined : '姓名不能为空' }),
      routes: [route.toIfError('failure'), route.to('greet')] },
    { id: 'greet', description: '生成问候', provides: ['answer'],
      run: state => ({ answer: '你好，' + state.name }), routes: [route.deliver('answer')] },
    { id: 'failure', description: '返回校验提示', requires: ['error'], routes: [route.deliver('error')] },
  ],
});
console.log(await new AgentCoreEngine({ workflow }).run({ name: 'Ivan' }));`,
      },
      {
        title: '同一节点合同可由类实现',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
type State = { name: string; answer?: string };
class GreetingNode {
  readonly id = 'greet';
  readonly description = '根据姓名生成问候';
  readonly startsRound = true;
  readonly routes = [route.deliver('answer')];
  #prefix = '你好，';
  run(state: Readonly<State>) { return { answer: this.#prefix + state.name }; }
}
const workflow = defineWorkflow<State, string>({ id: 'greeting', nodes: [new GreetingNode()] });
console.log(await new AgentCoreEngine({ workflow }).run({ name: 'Ivan' }));`,
      },
    ],
    policies: [
      {
        title: '引用、可达性和有界循环校验',
        file: 'src/execution/workflow.ts',
        symbols: ['AgentWorkflow'],
      },
    ],
  },
  {
    id: 'workflow-extension',
    title: '复用基础 Workflow 与 Agent 分支',
    layer: 'core',
    matches: [
      'AgentWorkflow.add',
      'WorkflowExtension',
      'AgentCoreEngine.fork',
      'AgentCoreEngine.snapshot',
      'AgentCoreEngine.branch',
      'AgentBranch',
      'AgentSnapshot',
    ],
    summary: 'add 保留旧 Workflow，生成组合后的新 Workflow；fork 继承已有绑定及分支来源。',
    details: `add 接受节点配置或另一个 Workflow，并用 routes 显式改接原节点。它不会修改旧实例；重复节点、不可达节点及无界环仍会拒绝。仅仅新增一个不可达节点不能成为有效扩展。

fork 必须使用当前分支创建的 checkpoint。未传 workflow 时继承；传入则内部调用 add 组合，不是替换。含 App 依赖时，resume 必须恢复 App 依赖，工具运行时也由 resume 明确提供，避免把请求资源当作可随意复制的纯配置。checkpoint 使用结构化克隆保存 Data；不持久化，不自动恢复业务授权，不是跨请求任务系统。`,
    examples: [
      {
        title: '基础 Workflow 生成一个新版本',
        level: '入门',
        environment: 'Node.js',
        ts: `${helloWorkflow}
const extended = workflow.add({
  nodes: [{ id: 'format', description: '为现有回答增加结尾',
    run: state => ({ answer: state.answer + '！' }), routes: [route.deliver('answer')] }],
  routes: { greet: [route.to('format')] },
});
console.log(await new AgentCoreEngine({ workflow: extended }).run({ name: 'Ivan' }));
console.log(workflow.ids()); // 基础定义仍然只有 greet`,
      },
      {
        title: '继承基础 Agent 的绑定与分支来源',
        level: '配置',
        environment: 'Node.js',
        ts: `${helloWorkflow}
const base = new AgentCoreEngine({ workflow });
const checkpoint = base.snapshot({ name: 'Ivan' });
const branch = base.fork({ at: checkpoint });
console.log(await branch.run(checkpoint.read()));
console.log(branch.branch.parentBranchId === base.branch.branchId);`,
      },
      {
        title: '分支增添阶段而不是替换 Workflow',
        level: '扩展',
        environment: 'Node.js',
        ts: `${helloWorkflow}
const base = new AgentCoreEngine({ workflow });
const at = base.snapshot({ name: 'Ivan' });
const upgraded = base.fork({ at, workflow: {
  nodes: [{ id: 'format', description: '修饰基础回答',
    run: state => ({ answer: state.answer + '！' }), routes: [route.deliver('answer')] }],
  routes: { greet: [route.to('format')] },
} });
console.log(await upgraded.run(at.read()));`,
        note: '基础 Agent 没有自己的业务绑定时，也可以直接用 baseWorkflow.add(...) 构造新的 Agent。',
      },
    ],
    policies: [
      {
        title: '分支与检查点的实际限制',
        file: 'src/execution/engine.ts',
        symbols: ['AgentCoreEngine'],
      },
    ],
  },
  {
    id: 'routes',
    title: 'route：生成完整配置，沉淀常用判断',
    layer: 'core',
    matches: [
      'route',
      'route.to',
      'route.toIf',
      'route.toIfEqual',
      'route.toIfEqualWith',
      'route.toIfDefined',
      'route.toIfError',
      'route.toIfNotEmpty',
      'route.deliver',
      'route.deliverIfReady',
      'route.deliverWhenComplete',
    ],
    summary: 'route 函数组生成普通 WorkflowRoute 配置；手写对象与生成配置遵守同一个合同。',
    details: `所有 to* 的第一个参数都是目标节点。route(target, id?) 是 route.to 的别名，只有它与 to 的第二个参数直接是可选路由 ID。条件生成器在 options 中提供 id、conditionId、description；通常可省略。

| 生成器 | 判断与结果 |
| --- | --- |
| to(target, id?) | 不带 when，直接跳转 |
| toIf(target, options?) | 同名状态字段求真 Boolean(state[target]) |
| toIfDefined(target, field, options?) | 字段不为 undefined；null、false、0 也算已定义 |
| toIfError(target, options?) | 默认检测 error 是否已定义，可用 errorKey 指定其他字段 |
| toIfNotEmpty(target, key, options?) | 已知数组的 length 大于 0，不是任意值通用的空值检测 |
| toIfEqual(target, path, value, options?) | path 读取的值与固定 value 严格相等 |
| toIfEqualWith(target, leftPath, rightPath, options?) | 两个状态 path 读取的值严格相等 |
| deliver(field, options?) | 结束并读取必需字段；undefined 会拒绝 |
| deliverIfReady(field, options?) | 字段已定义才结束，否则继续匹配下一条 |
| deliverWhenComplete(field, options?) | StepOutcome.type 为 complete 才结束并取其 value |

Equal 两种生成器支持 profile.items.0.id 一类点路径；当前 toIfDefined、toIfNotEmpty 的参数是字段 key，不能擅自推断它们也支持路径。严格相等不会深比较对象；两个缺失路径都得到 undefined 时会相等，业务不接受时应先配前置检查。

现有 to* 一般按目标生成 to-target；toIfEqual 对可稳定表达的 path、值、目标组合生成 ID，toIfEqualWith 依据左右路径与目标生成；symbol 路径或非标量相等值不能得到同样的稳定默认 ID。deliver 系列习惯使用 complete。这些是各专用函数的习惯，不是 Workflow 强加的统一命名约束。

生成器常用 conditionId: {nid}.{rid}。普通手写对象同样支持这两个占位符；Workflow 只展开节点值和本地最终路由 ID，并为重复路由 ID 加 ~2 等后缀，不猜测未提供的 ID 或专用函数规则。`,
    examples: [
      {
        title: '最小跳转与结束',
        level: '入门',
        environment: 'Node.js',
        ts: `import { route } from '@jangts/agent-core/engine';
const jump = route('reply');
const sameJump = route.to('reply');
const finish = route.deliver('answer');
console.log(jump, sameJump, finish);`,
      },
      {
        title: '同一业务的常用分支',
        level: '配置',
        environment: 'Node.js',
        ts: `import { route } from '@jangts/agent-core/engine';
const reviewRoutes = [
  route.toIfError('failure'),
  route.toIf('recovered'),
  route.toIfNotEmpty('candidate', 'candidates'),
  route.toIfDefined('reply', 'answer'),
  route.toIfEqual('status', 'intent.id', 'status'),
  route.toIfEqualWith('reuse', 'cache.0.id', 'request.id'),
  route.to('fallback'),
];
const completionRoutes = [route.deliverIfReady('answer'), route.to('retry')];
const outcomeRoutes = [route.deliverWhenComplete('outcome'), route.to('retry')];
console.log(reviewRoutes, completionRoutes, outcomeRoutes);`,
      },
      {
        title: '按业务需要覆盖身份，手写对象也支持占位符',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { defineWorkflow, route } from '@jangts/agent-core/engine';
type State = { answer?: string; reviewError?: string };
const workflow = defineWorkflow<State, string>({ id: 'review', nodes: [
  { id: 'check', description: '检查既有结果', startsRound: true, routes: [
    route.toIfError('failure', { errorKey: 'reviewError', id: 'review-error' }),
    { id: 'ready', conditionId: '{nid}.{rid}', when: state => state.answer !== undefined,
      complete: state => state.answer! },
    route.to('failure'),
  ] },
  { id: 'failure', description: '给出当前缺失信息',
    run: () => ({ answer: '当前没有可交付结果' }), routes: [route.deliver('answer')] },
] });
console.log(workflow.describe());`,
        note: 'conditionId 不承担授权。它帮助日志解释命中了哪次判断。',
      },
    ],
    policies: [
      {
        title: '各 route 生成器的默认规则与判断过程',
        file: 'src/execution/state.ts',
        symbols: ['route'],
      },
    ],
  },
  {
    id: 'execution-observation',
    title: '过程监听与节点报告',
    layer: 'core',
    matches: [
      'CoreEvent',
      'CoreEventName',
      'CoreEventPayloads',
      'ExecutionObserver',
      'ExecutionOptions',
      'WorkflowNodeReport',
      'createDiagnostics',
      'DiagnosticContext',
      'coreEventCatalog',
      'normalizeDiagnosticEvent',
      'diagnosticError',
      'NodeReportingContext',
      'ReportedStepRecorder',
      'ScopedReportedStepRecorder',
      'ScopedReportedStepInput',
      'ReportedStepLog',
      'ReportedStepInput',
      'ReportedStepUpdate',
      'ReportedStepValue',
      'ReportedStepProgress',
      'ReportedStep',
      'ReportedStepRecord',
      'ReportedStepStatus',
      'DebugStepsOutput',
      'reportedStepStatusCatalog',
      'reportedStepStatuses',
    ],
    summary:
      'App 订阅 Core 执行事实；节点报告自身 usedModel，并用实例式子日志先记意图、再补结果，Loop 负责身份和日志。',
    details: `execution.observe.event 是旁路监听：观察失败不改变任务结果，也不形成交付背压。模型正文 sink.output 是另一种端口，Core 会按序等待并传播交付失败。不要把旁路日志监听器当作可靠的终端输出队列。

Workflow 节点在执行期间调用 context.report({usedModel, payload})，或提供 report(update, context) 描述完成细节。usedModel 表示本次节点自身上报的模型使用，未上报为未知，不汇总子节点。子日志必须通过 context.createStepRecorder() 创建实例，write 成功返回 ID、失败返回 -1，fix 成功返回 true、失败返回 false，readAll 读不可变的全量记录；不接收手写数组或普通对象。write 当时即记入既有 node.progress，短路仍保留计划，fix 追加修订且不改写历史事件。节点不创建运行身份，不反复传 diagnostics；Core 自动记录节点进入、转移、错误、模型和工具事实。App 决定哪些状态向用户展示；并非所有 Provider 都有或允许展示模型的内部思考正文。

write 的 name、kind 必填，status 默认为 planned；ID、初始顺序、createdAtMs 和 revision 由实例生成。running 表示实际开始，success、error、cancelled、skipped 为终态。fix 不能重开终态或覆盖已确定的事实，但可在本次执行仍活跃时补缺失结果。payload 接受 JSON 数据，父步骤和后继 ID 必须属于同一次节点执行的记录；readAll 是持续只读查询，记录不通过 report 提交。节点结束或取消后 write 返回 -1、fix 返回 false，持有实例的调用方仍可 readAll。完整 logger 可以 fork(subnodeId) 创建独立的 ScopedReportedStepRecorder 委托实例，它不存储记录，write 自动绑定分组，fix 只能关联本分组的原始 write；不能再次 fork 或传给 invoke。readAll 始终可读同一份全量记录。subnodeId 和业务 type 均可自定义，operation 单独表示 write／fix。

简易 agent.run(step) 与工具执行上下文同样提供 report 和 createStepRecorder。工具的 debugSteps(result, context) 使用本次 context 的 logger 直接记账，不返回或提交 logger；Workflow 的完成回调 report(update, context) 返回报告对象。两种完成回调均只在内容采集获准时求值，元数据标记应在执行中通过 context.report 提交。日志中的 subSteps 是规范化数组，payload.subStep 是 write／fix 的进度元数据；未获内容授权的消费者只接收获准元数据。

createDiagnostics 配置同一事实源的可选日志消费，不是另一份持久 journal。正文仍受内容记录策略控制。事件中的 run/span/invocation 关联是 Core 执行身份，不是 App message ID；App 自行关联自己的消息记录。`,
    examples: [
      {
        title: '监听任务经过的节点与模型事件',
        level: '入门',
        environment: 'Node.js',
        ts: `${helloWorkflow}
const agent = new AgentCoreEngine({ workflow, execution: {
  observe: { event(event) { console.log(event.type, event.eventId); } },
} });
console.log(await agent.run({ name: 'Ivan' }));`,
      },
      {
        title: '节点执行时报告业务阶段',
        level: '配置',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
type State = { name: string; answer?: string };
const workflow = defineWorkflow<State, string>({ id: 'greeting', nodes: [{
  id: 'greet', description: '生成问候', startsRound: true,
  run(state, context) {
    context.report({ payload: { phase: 'formatting' } });
    return { answer: '你好，' + state.name };
  }, routes: [route.deliver('answer')],
}] });
const agent = new AgentCoreEngine({ workflow, execution: {
  observe: { event(event) { console.log(event.type); } },
} });
console.log(await agent.run({ name: 'Ivan' }));`,
        note: '节点只报告它知道的事实；Core 负责节点身份和执行关联。',
      },
      {
        title: '先记异步计划，再补结果',
        level: '配置',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
type State = { result?: string };
const workflow = defineWorkflow<State, string>({ id: 'prepare', nodes: [{
  id: 'prepare', description: '准备资料', async run(_, context) {
    const subs = context.createStepRecorder();
    const read = subs.fork('material-read');
    const id = read.write({ name: '读取资料', kind: 'read', type: 'material.read' });
    read.fix(id, { status: 'running' });
    const result = await Promise.resolve('已准备');
    read.fix(id, { status: 'success', usedModel: false, payload: { result } });
    context.report({ usedModel: false });
    console.log(read.readAll());
    return { result };
  }, routes: [route.deliver('result')],
}] });
const agent = new AgentCoreEngine({ workflow, execution: { observe: {
  accepts: ({ event, content }) => content === 'metadata' || event === 'node.progress',
  event(event) { if (event.type === 'node.progress') console.log(event.payload.subStep, event.subSteps); },
} } });
console.log(await agent.run({}));`,
        note: '受限 logger 自动绑定分组并只修订自己的 write；readAll 仍可读全量。每次 fix 追加独立记录并关联原 write，节点无需提交 logger。',
      },
      {
        title: '自编排执行也使用同一报告上下文',
        level: '配置',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine } from '@jangts/agent-core/engine';
const agent = new AgentCoreEngine<string>({ execution: { observe: {
  event(event) {
    if (event.type === 'node.progress') console.log(event.payload.subStep);
  },
} } });
const answer = await agent.run(async (_, context) => {
  context.report({ usedModel: false });
  const subs = context.createStepRecorder();
  const id = subs.write({ name: '整理结果', kind: 'format', status: 'running' });
  const value = await Promise.resolve('已完成');
  subs.fix(id, { status: 'success', usedModel: false });
  return { type: 'complete', value };
});
console.log(answer);`,
        note: 'write／fix 会直接发出进度事件，无需为每次修订重复调用 report。默认监听器只接收元数据。',
      },
    ],
    policies: [
      {
        title: '共享执行事实源和消费隔离',
        file: 'src/execution/events.ts',
        symbols: ['createEventScope', 'executionEvents'],
      },
      {
        title: '子步骤状态及推进关系',
        file: 'src/structs/debug.ts',
        symbols: ['reportedStepStatusCatalog'],
      },
    ],
  },
  {
    id: 'attempts-errors',
    title: '尝试预算与错误归属',
    layer: 'core',
    matches: [
      'AttemptBudget',
      'AttemptBudget.take',
      'AttemptBudget.used',
      'AttemptBudget.available',
      'BudgetError',
      'ValidationError',
      'WorkflowContractError',
      'getErrorInfo',
      'modelProtocolError',
    ],
    summary: '将尝试次数、数据无效和流程合同错误分别表达，不把所有失败都转成成功正文。',
    details: `AttemptBudget 的 take 成功才消耗一次；额度不足返回 false，不再发放尝试。它是局部重试策略的计数器，不自动控制模型次数或全局截止时间。Engine 的轮次、ModelRunner 的调用额度和 App 的业务尝试属于不同计量。

BudgetError 表示预算拒绝，ValidationError 携带 issues；WorkflowContractError 表示节点／路由／结果违反运行合同。getErrorInfo 统一提取代码和可重试信息，但不意味着每种错误都应重试。模型解析错误、工具授权错误、持久化失败各自交还拥有该边界的 App handler。`,
    examples: [
      {
        title: '只给两次业务尝试',
        level: '入门',
        environment: 'Node.js',
        ts: `import { AttemptBudget } from '@jangts/agent-core/engine';
const attempts = new AttemptBudget(2);
while (attempts.take()) console.log('attempt', attempts.used);
console.log(attempts.available); // false`,
      },
      {
        title: '明确额度不足与数据无效',
        level: '配置',
        environment: 'Node.js',
        ts: `import { BudgetError, ValidationError, getErrorInfo } from '@jangts/agent-core';
function requireAnswer(answer: string) {
  if (!answer.trim()) throw new ValidationError([{ code: 'ANSWER_EMPTY', message: '回答不能为空' }]);
  return answer;
}
try { requireAnswer(''); }
catch (error) { console.log(getErrorInfo(error)); }
const exhausted = new BudgetError('本次业务的尝试额度已用尽');
console.log(getErrorInfo(exhausted));`,
      },
    ],
  },
  {
    id: 'journal-projection',
    title: 'ContextJournal：回执的请求内投影',
    layer: 'core',
    matches: [
      'ContextJournal',
      'ContextJournal.model',
      'ContextJournal.beginTool',
      'ContextJournal.finishTool',
      'ContextJournal.snapshot',
      'ContextRecord',
    ],
    summary: '将真实调用回执变成可用于后续上下文的请求内记录，不另起持久日志系统。',
    details: `ModelRunner 已维护自己的 journal。通过 result.invocation 将实际调用与上下文记录关联；模型生成的文本不能伪造调用身份。snapshot 返回隔离副本，修改副本不会改写 journal。

手动使用 beginTool/finishTool 只适用于 App 自己拥有的调用适配。一个 invocation 只能开始、结束一次。它们记录事实，不执行工具、不作授权，也不自动写关系数据库。需要持久诊断时，App 把 Core 事实交给自己的日志适配。`,
    examples: [
      {
        title: '读取 Runner 已记录的模型回执',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core';
const runner = new ModelRunner({ provider: { async *stream() { yield '服务运行正常'; } } });
const result = await runner.invoke('查询服务状态');
console.log(result.invocation.invocationId);
console.log(runner.journal.snapshot());`,
      },
      {
        title: '应用适配器记录它实际执行的本地工具',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ContextJournal } from '@jangts/agent-core/journal';
const journal = new ContextJournal();
const invocationId = journal.beginTool({ toolId: 'get_status', input: {} });
// 此处由 App 实际执行本地读取；不是模型提供的回执。
const status = '服务运行正常';
journal.finishTool({ invocationId, status: 'success', value: status });
console.log(journal.snapshot());`,
      },
    ],
  },
];
