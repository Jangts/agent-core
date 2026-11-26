# 共同类型与行为合同

[返回 API 手册](README.md)。本页说明各模块共用的基础类型与调用规则。

## Tool 的共同接口与扩展

模型可选择的接口统一使用 BaseTool；只有确实增加合同的类型才继承，不为每种用途建立同义子类。

```ts
interface BaseTool<Input = unknown, Selection = Input, Context = any> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: SchemaAdapter<Input>;
  readonly active?: boolean | ((context: Readonly<Context>) => boolean);
  readonly asIntent?: true | string
    | ((context: Readonly<Context>) => boolean)
    | {
        readonly description?: string;
        readonly when?: (context: Readonly<Context>) => boolean;
      };
  resolve(input: Input, context: Readonly<{ stageId: string }>): Selection;
}

interface ExecutableTool<Input, Output, App>
  extends Omit<BaseTool<Input, ToolProposal, App>, 'resolve'> {
  readonly kind: string;
  authorize(input: Input, context: OperationContext<App>): MaybePromise<void>;
  execute(input: Input, context: OperationContext<App> & NodeReportingContext): MaybePromise<Output>;
  parseOutput(value: unknown): Output;
  debugSteps?(result: Output, context: NodeReportingContext): void;
}
```

```text
ModelTool
├─ ExecutableTool：复用元数据，模型提议由投影生成；授权、执行、输出校验
├─ Tool：一个可选 lifecycle 块，覆盖调用、上下文与交付
├─ DomainTool：领域策略与允许 delegate
│  └─ 应用按业务收窄枚举与约束
└─ Support.PreviewTool：模型输出的流式预览
```

Tool 与 ExecutableTool 共享模型元数据，执行上下文与参数解析方式由各自合同定义。DomainTool 使用相同 Tool 身份、Schema 与 resolver，不是独立 Intent 实体；delegates 的缺省允许集合由关联工具推导，显式业务约束仅由 DomainTool.delegates 声明。DomainTool 属于应用，不成为 Core 的必填配置。

模型 Tool 的规范化合同包含 resolve；Support 可补齐恒等映射。执行工具不配置 resolve，模型投影统一产生原始 `{ toolId, input }` 提议。active 与 asIntent 的回调只在本地求值；Schema、名称及投影后的描述才提交给模型。完整子类字段和注册形式见[公开符号参考](reference.md)，选取方法见[Support](support.md)。

## 身份、配置和时间

```ts
type Id = string;
type TimestampMs = number;
type DurationMs = number;
type JsonSchema = Readonly<Record<string, unknown>>;
type MaybePromise<T> = T | Promise<T>;
```

这些别名只说明含义，不代替运行时验证，也不要求每个App使用品牌类型。id 必须满足所属目录／适配器约束；模型和客户端提供的ID不是权限证明。

| 字段 | 唯一含义 |
| --- | --- |
| id | 当前登记实体主键 |
| *Id / *Ids | 指向其他实体的标识 |
| name / description | 显示名／用途说明 |
| kind | 领域分类，例如只读工具或输出种类 |
| type | 消息／事件的判别标签 |
| version | 可序列化格式版本 |
| revision | 内容或声明的修订身份 |
| identity | 登记别名背后的真实模型／空间身份，不与id合并 |
| *AtMs / *Ms | 绝对毫秒时间／时长 |
| *Index / *Sequence / *Count | 0起索引／1起顺序／累计数量 |

`Definition` 是可复用声明；`Config` 是配置值；`Ports` 是执行依赖；`Options` 是构造／调用选项；`State` 是流程状态；`Runtime` 是绑定生命周期的实例。不得将一次请求的signal放进可复用Definition，也不得把数值额度藏进Ports。

## 执行上下文

```ts
interface ExecutionOptions {
  readonly signal?: AbortSignal;
  readonly diagnostics?: DiagnosticContext;
}
interface OperationContext<App> {
  readonly logger?: ReportedStepLog;
  readonly app: Readonly<App>;
  readonly signal: AbortSignal;
  readonly diagnostics?: DiagnosticContext;
}
```

Core 在创建请求实例时补足实际signal；已登记 handler 得到的signal始终存在。`app` 是调用方提供的业务依赖，模型不能覆盖它。Kit 可以定义继承本合同的局部执行上下文，不能要求其他Kit填充其字段。

- 请求实例在构造时绑定execution，后续invoke不用重复传signal。
- 可复用能力在每次run/read/resolve时接收context。
- App服务的身份、预算和取消沿真实调用链传递，不因嵌套Kit获得新额度。

## Schema 与解析

```ts
interface SchemaAdapter<Value> {
  readonly jsonSchema: JsonSchema;
  parse(input: unknown): Value;
}
```

`inputSchema` 使用 SchemaAdapter，包含可执行的 parse 与只读 jsonSchema；向模型只投影 jsonSchema。parse 同步执行，误返回 Promise 时拒绝并处理迟到拒绝，不能把 Promise 当解析值。

上下文相关的权限与协议refine由具名handler负责；不得为了把它们塞进纯schema而删除阶段、来源或权限检查。

## 布尔、断言、检查和授权

```ts
interface Issue {
  readonly code: string;
  readonly message: string;
  readonly path?: readonly (string | number)[];
  readonly checkId?: string;
}
interface CheckResult<Value = never> {
  readonly status: 'passed' | 'failed' | 'unavailable' | 'not-run';
  readonly issues: readonly Issue[];
  readonly value?: Value;
}
```

| 合同 | 返回 | 失败／副作用 |
| --- | --- | --- |
| `isX(input)` | boolean | 不做转换，false只是否定 |
| `assertX(input)` | void | 非法时抛错，不允许用false表示拒绝 |
| `parseX(input)` | Value | 校验、转换，失败抛错 |
| `checkX(input, context)` | CheckResult | 检查问题可返回报告，程序错误继续抛出 |
| `authorize(input, context)` | void或`Promise<void>`，由对应执行接口决定 | 拒绝抛错；同步入口不允许thenable |

passed 的issues为空；failed至少有一个Issue；unavailable/not-run不得当作passed。value只有通过自有属性检查确认提供时才替换原值（包括显式undefined），不能用truthy判断是否存在。检查状态不替代工具执行状态、任务状态或交付状态。

布尔权限测试命名为 isAllowed。TypeScript 允许某些返回非 void 的函数赋给 void 回调，执行器会检查 authorize/assert 的实际完成值：只有 undefined 表示通过；false、true 或其他值均为合同错误。异步入口在 await 后检查。适配布尔权限测试时，通过应返回 undefined，拒绝应抛错。

同步入口检测到thenable时拒绝，并消费其迟到拒绝，不能放任unhandled rejection；这不撤回已经发生的外部副作用，故异步授权和I/O必须使用异步入口。

## 调用结果：固定外形

同一调用API只能有一种成功返回外形。输入短写只做归一化，不能让一种输入直接返回string、另一种输入返回对象；不提供由fullResponse、raw或输入形状切换返回范式的选项。

```ts
interface InvocationMetadata {
  readonly runId?: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly invocationId: string;
  readonly startedAtMs: TimestampMs;
  readonly parentInvocationId?: string;
  readonly durationMs: number;
}
interface InvocationResult<Value, Metadata extends InvocationMetadata> {
  readonly value: Value;
  readonly invocation: Readonly<Metadata>;
}
type ModelResult<Value> = InvocationResult<Value, ModelCallRecord>;
type ToolResult<Value> = InvocationResult<Value, ToolCallRecord>;
```

模型与工具的invoke都使用此基础结构。ModelCallRecord和ToolCallRecord保留各自的已知元数据，均继承InvocationMetadata；模型usage只在provider实际提供时存在，不伪造为0。

纯文本对应`ModelResult<string>`，结构化协议对应`ModelResult<ParsedValue>`：外层不变，只是value的业务类型不同。失败始终抛错／拒绝Promise，不能再混入`{ success: false }`作为第二条异常通道。模型原始流、预览与诊断走各自明确接口，不成为invoke的其他返回模式。

这条规则约束同类调用边界。is/has、parse、read等不同职责仍按其明确合同返回，不为了统一invoke而包裹所有纯函数。

## 错误与观察

```ts
interface AgentErrorInfo {
  readonly code: string;
  readonly codes: readonly string[];
  readonly issues: readonly Issue[];
  readonly stageId?: string;
  readonly isRetryable?: boolean;
  readonly cause: unknown;
}
type Observer<Event> = (event: Readonly<Event>) => void | Promise<void>;
type AsyncSink<Event> = (event: Readonly<Event>) => Promise<void>; // 需要异步交付的端口
// 接受同步完成的 sink 类型可返回 void；执行器仍按序 await。
```

`getErrorInfo(error)` 归一错误视图，保留 App 异常／取消原因身份与结构化定位。SDK 的 ValidationError 与错误视图统一使用 issues；预算资源、阶段等细节不靠给同一异常再附另一个竞争 code 表示。归一器也可读取外部异常的 errors 数组，这属于输入格式适配，不让 SDK 同时输出两个字段。

Observer是旁路：不等待其完成，隔离异常，不改变授权、预算和重试。AsyncSink是交付：等待顺序及背压，失败传播，受取消与超时约束。critical handler不叫observe。

## 登记集合

```ts
interface ReadonlyCatalog<Definition extends { readonly id: string }> {
  readonly definitions: readonly Readonly<Definition>[];
  ids(): readonly string[];
  values(): IterableIterator<Readonly<Definition>>;
  entries(): IterableIterator<readonly [string, Readonly<Definition>]>;
  has(id: string): boolean;
  get(id: string): Readonly<Definition> | undefined;
  require(id: string): Readonly<Definition>;
}
interface Registry<Definition extends { readonly id: string }>
  extends ReadonlyCatalog<Definition> {
  register(definition: Definition): this;
  registerAll(definitions: Iterable<Definition>): this;
  seal(): this;
}
```

registerAll不隐式seal；创建一个已编译catalog的工厂直接返回只读catalog。byId如确需暴露，明确为Record，不使用definitions或entries命名它。纯算法不用为了实现此接口新增登记实体。

## 所有权、缺失值与泛型

- 纯定义数据（JSON schema、ID数组、策略参数）复制并冻结；含方法的对象不structuredClone、不展开丢弃原型，逐个读取合同方法并固定原方法及其原接收者，不冻结App实例。绑定接收者不快照其实例内部状态，handler仍须遵守静态／请求生命周期约束。
- 注册器查询返回真实保存的登记投影：规范方法绑定原接收者，App 附加数据与原型 getter 元信息在登记时读取；不承诺未登记的实例 helper。意图、范围和生命周期的规范列表为只读快照，describe 返回独立列表副本；自定义校验与策略回调仍接收原实现，允许调用其 helper。
- Readonly只约束TypeScript写入；Map/Set及嵌套业务对象不因Object.freeze自动不可变。目录不公开内部Map；业务值不承诺统一深拷贝，具体Kit的快照与持久化接口单独定义复制范围。
- 返回的快照/检查点结果须说明副本或视图；公开事件不给可写活引用。
- 流程控制采用显式判别，区分继续执行与完成值；合法泛型终值可以是 undefined。普通 read/render/search 直接返回业务值。
- 通用泛型角色按Input、Output、Context排序；无此角色则省略。复杂局部流程使用具名角色类型。
- 静态ID选择后类型随实际集合收窄；动态ID保持运行时校验与unknown边界，不允许调用者自报结果泛型冒充验证。

完整导出、精确重载和声明源码见[公开符号参考](reference.md)。示例中的签名用于阅读，不能据省略字段推断任意扩展选项。

## 类型入口与基础 Map

`import type { ... } from '@jangts/agent-core/types'`覆盖共同合同及各Kit的公开类型，运行时为空；根和所属模块也继续提供类型导入。`/structs`保留历史类型与已有常量，不作为新代码取运行值的首选入口。

`ProtocolRegistry<T>` 是允许任意协议载荷的唯一键 Map，提供 ids/require，不要求 T 一定有 id，所以不伪装成实体 Catalog；CommandCatalog 等真正的实体目录才实现共同集合表面。Normalization.steps 等有序算法配置不是可增量登记的 Registry。Intent/Scope 的 registerAll 只登记，封存使用后续 seal()；create 完整清单入口组合两者。
