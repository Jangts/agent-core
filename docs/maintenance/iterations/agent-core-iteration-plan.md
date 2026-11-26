# Agent Core 0.2.5 与 0.3.0 迭代计划（草案 v2.7）

日期：2026-11-08。草案修订版：v2.7。状态：0.2.5 已发布；0.3.0、0.3.1 与 0.3.2 已撤回，后续修正及文档以 0.3.5 发布；分阶段证据见[实施记录](iteration-execution-2026-11-08.md)。

v2.7 是文档修订号，不是 npm 包版本。0.2.5 与 0.3.0 分别表示本计划的两段迭代目标：缓存作为 0.2.x 的稳定功能先行，0.3.0 仅提供基于已稳定接口的辅助函数与可选装饰器。不因修订本文修改 package.json、跳过中间版本或自动发布。本文分开规定缓存的运行合同与装饰器的辅助边界；未定的端口细节集中列为编码前置项。

## 1. 总体原则

- 功能改变属于 0.2.x。缓存的接口、所有权、生命周期和行为先在 0.2.5 实现并验证，不能依赖 0.3.0 的辅助函数才能使用。
- 0.3.0 不增加主要运行能力，允许两类外部辅助：定义映射，以及定义注册池与池读取。映射结果与既有接口等价；注册池只负责登记、索引和查找定义，移除池后可将查得定义直接传入原接口，执行行为不变。
- 普通对象与现有 define、构造、bind、run 是基础路径。Core 不感知装饰器；辅助函数不增加预算、调度、取消、授权、缓存或资源生命周期语义。
- 节点、工具、资料、Agent 与 ModelRunner 的辅助定义均可评估，但不为覆盖类别而增加空壳入口。既有入口足够直接时继续使用。
- 遵守 [Core、Support 与 Kit](../../design/design-layers.md)、[接口设计规范](../../standards/interface-design-standard.md)和[文档规范](../../standards/documentation-standard.md)。正式手册在合同确定并实现后同步，不将草案写成已有能力。

## 2. 0.2.5：缓存稳定功能

### 2.1 目标与范围

提供与装饰器无关的节点缓存能力。缓存按提供者分为两级：Engine 提供 `context.cache`，service Agent 提供 `context.agentCache`。run 不再单独提供缓存；run 范围的临时数据由节点按约定写入 `state`，不新增 API。

| 缓存 | 提供者与寿命 | 用途与边界 |
| --- | --- | --- |
| cache | Engine；Engine 实例生命周期 | 同一 Engine 内跨节点、跨 run 复用可丢弃派生数据；默认按节点分区；Engine 每请求创建时即为请求级 |
| agentCache | service Agent；Agent 服务生命周期（进程内存或 App 外部存储） | 跨请求、跨会话复用可丢弃派生数据；由 App 显式提供端口，Core 不创建、不持久化 |

`cache` 由 Engine 直接提供；`agentCache` 是可选的 App 端口，未提供时不存在。不能为了获得长期缓存而把请求 Runner、用户身份或取消状态提升成全局单例。

`state` 不是缓存 API，也不提供 get／set。Workflow 节点读取 `Readonly<State>`，通过返回 `Partial<State>` 补丁由 Engine 提交，不直接执行 `state[key] = value`。run 范围的派生数据可由 App 在 state 类型中声明，键名可约定为 `x:{nodeId}:{keyname}`，通过补丁返回；该建议不要求添加任意字符串索引或绕过类型检查。

这些字段与业务 state 字段具有相同的提交、结果、checkpoint 和 fork 行为，不会因 `x:` 前缀自动变成临时或私有数据。需要剔除时由宿主明确投影／清理；缓存章节中“不进入 checkpoint／fork”的规则只指两类缓存，不包括这些 state 字段。

缓存丢失只能导致重新计算，不得改变业务正确性。影响结果、需要 checkpoint、重放或持久恢复的事实进入 Workflow State 或 App 存储，不依赖缓存成为事实来源。

#### 2.1.1 跨 run 与跨请求

`cache` 的寿命等于 Engine 实例，不等于进程、线程或业务 Agent 身份。Engine 被回收，缓存随之消失。

- Engine 每请求创建时，`cache` 就是请求级；这是当前两个应用的默认形态。
- 宿主保留同一 Engine 时，`cache` 跨 run、跨请求存在；条件见 2.1.2。
- `cache` 不跨 `fork`、恢复或新 Engine 自动继承。
- run 范围的记忆化由节点按约定写入 `state`，不新增缓存 API；复用 state 的隔离与重置由宿主负责。

`agentCache` 是 Engine 之外的跨请求路径，由 service Agent 提供：

- App 在 Engine 构造时注入缓存端口；Engine 只借用，不创建、不拥有、不清理。
- 端口可由业务 Agent 单例、Redis 或其他存储实现；容量、TTL、淘汰、租户隔离与持久化由 App 负责。
- 两个现有应用里，`BankerAgentService` 与 `AgentService` 是进程单例，可作为端口宿主。
- 未注入端口时，`context.agentCache` 不存在；需要它的节点应显式失败，不静默退化为 Engine 内存。

#### 2.1.2 宿主保留 Engine 的条件

适用于常驻单用户 Agent 或按租户隔离的 Engine 池：

- Engine 绑定的 `app` 必须是请求无关的稳定服务容器，用户与请求数据通过 `run(state)` 传入；
- 不能绑定请求级模型运行时，该运行时只服务一次请求；
- 不能把上一请求的身份、signal、journal 或权限结论保留给后续请求；Engine 原合同允许的 execution 仍可用于实例生命周期取消与诊断，不要求删除现有能力；
- 并发 `run` 时，缓存必须满足同步并发合同，用户数据必须带 App 提供的隔离键。

明确不支持：把请求级 Engine 提升为模块单例来获得跨请求缓存；让 `cache` 跨 `fork`、恢复或新 Engine 自动继承；通过持久化 `cache` 来保证业务正确性。

若 1 个业务 Agent 只持有 1 个 Engine 且不替换，`cache` 与 `agentCache` 的寿命重合；此时使用 `cache` 即可，不必再增加一层 Agent 缓存。若 Agent 替换 Engine，cache 随该 Engine 保留期结束；每请求新建 Engine 时 cache 才是请求级。跨 Engine 的复用由显式 agentCache 端口承担。寿命相同不代表两者的所有权、可选性或持久化能力相同。

### 2.2 接口与隔离

- `context.cache` 始终存在，Engine 所有；`context.agentCache` 可选，由 App 端口提供。
- 两者都提供读写操作：get、set、has、delete、clear，不是只读视图。统一用命名选项，避免位置布尔：
  ```ts
  // 调用形态示意，非有效 TypeScript 声明；返回类型见 C0 决策。
  cache.get(key, { nodeId? })
  cache.has(key)
  cache.set(key, value)
  cache.delete(key)
  cache.clear()

  agentCache.get(key, { nodeId?, persistence? })
  agentCache.has(key, { persistence? })
  agentCache.set(key, value, { persistence? })
  agentCache.delete(key, { persistence? })
  agentCache.clear({ persistence? })
  ```
- `cache` 只有 Engine 级，不再提供 run 子空间，也不新增 `scope` 参数；寿命由持有对象决定，run 范围的数据由节点按约定写入 `state`，不经过缓存 API。
- `nodeId` 只允许出现在 `get` 上，用于显式读取另一个节点的分区；`set`、`delete`、`clear` 不接受 `nodeId`，只能写、删、清当前节点自己的分区。`has` 也只检查当前节点分区。
- `clear` 只清当前节点自己的分区；不能指定其他节点，也不能清空整个缓存。整库清理由 Engine 生命周期或宿主管理接口负责。
- `key` 为字符串，`value` 为 unknown；Core 不自动序列化。`persistence` 默认 false，适用于 `agentCache` 的 get／set／has／delete／clear；为 true 时由 App 端口负责序列化、版本、TTL 与失败语义；端口不支持时明确报错，Core 不静默降级。
- 节点分区是命名隔离，不是用户／租户／权限隔离。共享 Engine 或 Agent 缓存中的用户数据必须由 App 提供完整作用域键或禁用共享缓存；不得缓存权限结论并跨请求复用。
- `cache` 必须有明确的容量上限与淘汰规则；`agentCache` 的容量、TTL、淘汰与持久化由 App 端口提供同等合同。不以无限 Map 作为稳定功能交付。
- 明确 undefined、缺失键、过期值、淘汰、异常、delete 与 clear 的行为。Engine cache 保持同步操作；agentCache 的 App 端口可能访问异步存储，不能一并宣称为同步。端口是否统一 Promise 或采用显式同步／异步合同须在 C0 确定，不允许阻塞 I/O 或把 Promise 当普通值返回。get/set 不承诺跨 await 的原子读改写或自动合并并发回源。
- 缓存不改变授权、预算、取消、状态提交或工具回执。缓存命中也不意味着跳过必要的真实权限与来源检查。
- 不自动缓存模型响应、工具结果、错误或外部副作用；`cache` 不自动持久化，`agentCache` 的持久化由 App 端口决定。

### 2.3 生命周期与兼容

- `cache` 随 Engine 创建，run 结束不清理；同一 Engine 的并发 run 共享该缓存，必须满足同步并发合同。
- `agentCache` 随 service Agent 的生命周期；Engine 结束不清理，清理由 App 端口负责。
- state 随 run 传入，run 结束不自动清理。Workflow 节点按原提交合同返回派生字段补丁；复用 state 的隔离、重置及输出投影由宿主负责。命名约定仅防冲突，不代表访问控制。
- 同一 Engine 可达的并发运行共享 `cache`，不能把它当作 per-run 隔离；需要 run 隔离的数据由节点写入 state，或使用带 run 标识的键。
- `cache` 与 `agentCache` 都只允许写／删／清当前节点分区；跨分区读取仅通过 `get(key, { nodeId })`，且不构成授权或用户隔离。
- 缓存不进入 checkpoint、fork 数据或 Durable 恢复。fork 的新 Engine 默认新建 `cache`，不隐式共享父实例；`agentCache` 是否共享由 App 端口决定。
- 节点 `clear` 只清自己的分区；整库清理由 Engine 生命周期或宿主管理接口负责，`agentCache` 的整库清理由 App 端口负责。不把 GC 时机当作立即销毁保证，不为外部 Provider、客户端新增无所有权的 dispose。
- 补充缓存字段时核对所有现有 WorkflowContext 构造、自定义实现和测试替身的兼容性；不无意增加 App handler 的必填实现负担。缓存操作与可选性在 workflow 节点和 run(step) 两条路径上应一致，但不能假设两者都有节点 ID 或 state。CoreStep 当前只接收 roundIndex 与执行／报告上下文；step 分区身份及兼容方式见 2.5。
- Core 拥有 Engine 作用域；service Agent 拥有 `agentCache` 端口。App 提供业务隔离键、资料版本与失效依据。不得把缓存实现藏到装饰器辅助层。

### 2.4 实施与验收

| 阶段 | 工作 | 结束条件 |
| --- | --- | --- |
| C0：合同 | 保持已定提供者、读写边界与 persistence 范围，关闭第 2.5 节端口、分区及兼容问题 | 返回类型、缺省、失效和异常有唯一合同后才进入 C1；不凭示意签名编码 |
| C1：实现 | 接入真实节点上下文、Engine 级 `cache`、App 端口的 `agentCache` 及清理；run 范围数据由节点自行写入 state，不新增缓存 API | 普通对象节点可直接使用，完全不依赖装饰器或新句柄 |
| C2：专项验证 | 验证跨 run 共享、并发、取消／失败、容量淘汰、用户隔离、跨分区只读、只能写／清自己的分区、fork、恢复、state 隔离及 `agentCache` 端口 | 缓存命中／丢失结果等价，预算及授权保持；证据对应实际边界 |
| C3：稳定交付 | 同步 API、示例、Skill、网站来源与消费者 | 0.2.5 功能经实际接入验证后，才作为后续辅助函数的既有接口依据 |

本部分是功能计划，不是已完成的稳定性声明。用户先行上线的顺序落实为先完成缓存合同、实现及验证，再推进依赖该合同的辅助写法；本次文档修改不等于已实现或发布。

### 2.5 缓存实施合同

缓存实现采用以下合同，公开细节见[节点缓存 API](../../../packages/agent-core/development/docs/api/workflow.md#节点缓存)：

| 项目 | 实施合同 |
| --- | --- |
| agentCache 异步 | 所有操作返回 Promise，固定接收者；App 接收不可变地址与本次 signal，检查返回布尔／void 合同，取消前后检查，不承诺回滚已开始写入 |
| persistence | false 与 true 独立空间，不回退或镜像；仅支持声明为 supportsPersistence: true 的端口，否则拒绝；delete／clear 仅影响指定空间 |
| 分区端口 | 当前节点绑定在每次访问视图闭包中，App 接收明确 nodeId，不以单例可变字段存当前分区 |
| step 分区 | 固定为 Engine 内 `$step`，不从函数名或 roundIndex 推导身份 |
| step 临时数据 | 继续使用宿主闭包／请求对象，不增加 state 参数；Workflow 保持原补丁提交 |
| 兼容 | Engine 统一构造 workflow 与 step 的 cache；agentCache 仅注入时存在，不改变既有调用签名 |
| 容量与值 | Engine 全实例默认最多 1024 项，正整数配置；LRU，TTL 可选且从写入起算，无后台任务；保留值引用，has 区分 undefined 与未命中，delete 返回 boolean，set／clear 返回 void |
| fork | 新建内存、保留容量配置；App 端口仅从 resume 显式重新提供，不复制缓存数据 |

C0 合同已用于实现；构建、回归、包体验证及发布状态分别记录，不把代码存在当作已公开发布。App 端口的真实外部持久化由 App 拥有，本次未部署 Redis 或变更业务存储政策。

## 3. 0.3.0：装饰器、底层映射与注册池

### 3.1 设计目标与转换边界

装饰器是面向开发者的新定义写法，底层转换不是公开产品入口。它必须实质减少手工接线，并让 handler 更自然地组织实现：类装饰代办定义实例化，方法装饰代办原对象绑定，类内部通过 this._xxx 等具名方法拆分流程与分支。不得以“执行行为等价”为由要求使用者仍手工 new、bind 或重复拼 options。

“不改变 0.2.x 功能”指不改变 Core 的执行、校验、预算、取消和结果合同，不禁止辅助层完成定义实例化、方法绑定、标识注入与登记。转换是内部实现机制，书写便利和实现组织才是开发者获得的收益。

0.3.0 提供定义辅助，不改变 0.2.x 的主要功能、缺省与执行路径。面向开发者支持类装饰与实例方法装饰；metadata＋函数映射只作为底层机制：

| 路径 | 输入 | 产物与用途 |
| --- | --- | --- |
| A：底层函数映射 | metadata + 函数；实例方法路径另有真实接收者 | 生成原 options；实例方法先与真实接收者绑定。只供装饰器底层复用，不公开为独立函数定义入口 |
| B：类装饰 | 装饰器提供 id；类实例结构满足原 options 去掉 id 后的类型 | 实例化定义类、注入 id，保留内部方法协作，得到等价 options 并支持登记／读取 |
| C：实例方法装饰 | 现有实例上的非 run／execute 方法及装饰 metadata | 将该方法适配到原 handler 字段并绑定原实例，不创建替代实例 |

B 中类本身就是完整处理单元：公开 run／execute／handle 编排流程，this._xxx 等具名方法拆分分支，私有成员封装内部实现，避免大函数或文件级函数散落。其主要价值是自然组织 handler 及内部协作，不是把 options 参数挪到类里，也不以字段数量减少作为唯一收益标准。配置通过实例字段表达，处理行为通过实例方法表达。装饰器不再接收一大块重复 metadata，不把类当空的静态配置载体，也不要求用户在类外重新拼装全部方法引用。

`id` 由装饰器提供；SDK 提供 Node、Tool、Fragment、Workflow、Agent、Model 具名合同，类直接使用对应类型，不把去除 id 的底层类型变换留给使用者。其他字段沿用原合同的必填、可选和缺省；没有 id 的原 options 不为统一形式强行加入必填 id，池登记标识作为外部辅助信息单独处理。两种标识的关系按类别在 H0 明确。

不提供 `tool(metadata, fn)`、`node(metadata, fn)` 这类公开独立函数写法；顶层函数直接填入现有 options 即可。A 不作为另一条用户接入路径，也不能为了“底层可复用”强制导出。禁止以“metadata 几乎写完 options，再用函数补一个 handler”作为对外方案。

原 options 完全合法的类也可以直接使用；装饰它仍有自动实例化、标识注入及登记／读取的价值。options 对象虽也能添加辅助方法，但类更自然地封装内部协作，不要求用户为拆分分支向参数对象塞入额外实现字段。不得把“options 也能做到”当作否定类式写法的理由。

### 3.2 options 对象与运行实例的区别

允许装饰器实例化定义类，并保持其原型方法、getter、私有字段及 this。可以保留实例作为 options，也可以由原 define 入口生成保持方法接收者的快照；不得对象展开后丢失类行为。

这不等于创建新的 Agent／模型运行时：装饰器不代替 App 创建 Engine、Runner，不新增 Handle/create，不接管请求预算、取消、授权、调度或资源销毁。注册得到的是可交给原接口的定义对象；真正运行仍走原构造、bind 与 run。

定义类的构造只初始化定义字段和辅助状态，不执行工具、模型或外部业务操作。首批支持可直接构造的定义类，不建立自动 DI；有必需构造依赖的类如何显式传入参数在 H0 定稿，不偷偷解析依赖，也不为此建立实例工厂框架。

装饰器在明确的定义阶段实例化一次，不在池每次读取时重新实例化。它不是每请求生命周期工厂。请求数据仍来自原 context/App；复用定义的类成员若保存辅助可变状态，必须说明共享语义，不能借此缓存用户身份、signal、journal 或请求预算。

### 3.3 类级写法示意

下例为候选装饰器与池 API，不是现有导出；省略 import，`lookup` 方法的 App 服务按原合同提供。

```ts
type QueryState = { name: string; answer?: string };
type QueryApp = { lookup(name: string): Promise<string> };

@node<QueryState, string, QueryApp>('lookup', { ns: 'query' })
class LookupNode
  implements Node<QueryState, string, QueryApp>
{
  readonly description = '读取资料';
  readonly startsRound = true;
  readonly requires = ['name'] as const;
  readonly provides = ['answer'] as const;
  readonly routes = [
    { complete: (state: Readonly<QueryState>) => state.answer! },
  ];

  async run(
    state: Readonly<QueryState>,
    context: WorkflowContext<QueryApp>,
  ): Promise<Partial<QueryState>> {
    const name = this._prepareName(state.name);
    const answer = await this._lookup(name, context);
    return { answer };
  }

  private _prepareName(name: string): string {
    return name.trim();
  }

  private _lookup(name: string, context: WorkflowContext<QueryApp>) {
    return context.app.lookup(name);
  }
}

// 读取带 id 的原 WorkflowNode；不会创建 Engine 或执行节点。
const workflow = defineWorkflow({
  id: 'query',
  nodes: nodePool.getAll('query'),
});
```

装饰器只提供 id 及必要的外部登记参数。description、schema、routes、authorize、run／execute 等属于原 options 的配置和行为，保留在类上，不在装饰器参数重复声明。装饰器注入的 id 与类中重复定义的 id 应在定义边界明确拒绝，不隐式覆盖。

装饰后的定义已可从池中读取，使用者不再手写 new LookupNode 或拼出其 run 引用。类的私有辅助方法属于实现组织，不作为模型能力、节点或额外 options 合同自动公开。

### 3.4 实例方法装饰

方法装饰的主要对象是已有实例的业务方法：因为原职责或已有接口命名不适合改为 run／execute，通过装饰将其接入原 handler 合同。不是为独立顶层函数增加一层写法；顶层函数直接填进原 options 即可。

- 装饰器提供 id 及目标 options 所需 metadata。业务方法保留原名，不要求宿主实例完整实现 options，也不要求新增 run 方法或包装类。
- 底层 A 在取得真实实例后合成 options，handler 等价于 originalMethod.bind(originalInstance)；不能只把未绑定方法赋给 run／execute，也不能把 this 改成 options 对象。
- 绑定必须保留原实例的依赖、私有字段及 this._xxx 内部协作。不能复制实例、重新 new 同类、把其他方法展开成丢失接收者的对象。
- 方法装饰发生在类定义阶段，绑定与登记发生在实际实例可用之后；实例由 App 按原生命周期创建，不在定义阶段假造实例。采用标准实例初始化钩子自动绑定并入池；宿主构造成功后才读取执行。构造失败不回滚已完成登记，应视为装配失败；不强制额外类装饰器，不扫描成员，不在初始化钩子内访问未初始化的宿主字段。
- 用户不需要手写 originalMethod.bind(instance) 或提供“metadata＋未绑定函数”的公开转换调用。装饰器通过声明上下文与实例初始化接入获得真实接收者；普通底层函数没有凭空发现接收者的能力，必须由该机制传入。不额外要求手动登记、重新枚举 metadata、方法名与绑定关系。
- 多个实例的同一方法应绑定各自接收者，不能仅按类／方法名缓存一个全局绑定；不同实例在同池的 id 冲突按池规则明确拒绝；不同用途选择不同命名空间，不隐式覆盖。
- 池读取已绑定的原 options，不替调用方创建实例。实例方法可返回同步或异步结果，保持原 handler 的时机、错误与取消语义。

以下是同一节点的实例方法候选写法：宿主已有业务职责，方法名保留为 lookup；装饰器在宿主实例可用后把它绑定为节点 run。这里 metadata 用于描述单个方法，宿主无需冒充完整节点类。

```ts
class QueryService {
  @node<QueryState, string, QueryApp>('lookup', {
    ns: 'query-service',
    description: '读取资料',
    startsRound: true,
    requires: ['name'],
    provides: ['answer'],
    routes: [{ complete: (state: Readonly<QueryState>) => state.answer! }],
  })
  async lookup(
    state: Readonly<QueryState>,
    context: WorkflowContext<QueryApp>,
  ): Promise<Partial<QueryState>> {
    const answer = await context.app.lookup(this._prepareName(state.name));
    return { answer };
  }

  private _prepareName(name: string): string {
    return name.trim();
  }
}
```

QueryService 仍由宿主按原方式创建；标准实例初始化钩子自动绑定并登记，无需 bind、registerFrom 或重复 metadata。钩子不调用 handler、不读取业务字段；宿主构造成功后才读取执行。构造失败不回滚初始化登记，属于装配失败。共享池只持有长期定义／服务实例，不承接请求级生命周期。

### 3.5 注册池与命名空间读取

- 每种定义一个共享读取池：nodePool、toolPool、fragmentPool、workflowPool、agentPool、modelPool。不公开创建、写入、清空、封存、owner 查询或转换函数。
- 装饰器仅接受外部登记参数 ns，不接收 pool 或 tags。ns 为 string 或 readonly string[]，默认 default；同类型、同命名空间内 id 唯一，不同空间可同名。名称精确匹配，无层级、通配或隐式回退；空白名称、空数组拒绝，重复空间去重。
- 多命名空间登记共享同一对象、不重复构造；所有目标先预检，有冲突则整次拒绝，无部分写入。ESM／CJS 在同一 JavaScript realm 内共享池，独立进程／Worker 不共享；独立加载的同空间同 id 定义明确拒绝。
- 读取为 get(id, ns = 'default')、getAll(ns = 'default')、pick(ids, ns = 'default')。get 缺失返回 undefined，getAll 返回该空间登记顺序快照，未知空间为空；pick 以 id 数组为参数，按顺序返回，缺失或重复 id 抛错。数组快照只读，池读取不重新构造。
- ns 不进入 Core options、不修改 id。将不同空间的同名定义装入同一 Workflow／ToolRegistry 时，原唯一性检查继续有效。节点顺序、路由及挂载由 App 明确组织，不能靠导入顺序决定业务行为。定义模块须在打包图中明确保留，不自动扫描。
- 类装饰器在静态初始化结束并成功构造后登记；方法装饰器在实例初始化钩子绑定并登记。登记是辅助副作用，不是挂载、执行或授权，不创建 Engine／Runner、不管理请求预算、取消和销毁。
- 普通对象继续直接走原 define 与构造入口，不强制经过池。不新增 AgentCatalog、defineAgentComposition、ModelProfile、DI 或缓存服务，不占用 Intents.defineAgentCatalog 命名。

### 3.6 五类对象的映射

| 类别 | 类结构依据与产物 | 后续使用 |
| --- | --- | --- |
| 节点 | WorkflowNode 去掉 id 的实例结构，装饰后补齐 id | 原 defineWorkflow、workflow.add 与 Engine |
| 工具 | ToolDefinition 去掉 id 的实例结构，类提供 schema、授权、执行与输出检查 | 原 defineTool、defineToolCatalog 与 ToolRegistry |
| 资料 | 已有片段／资料定义的配置及实现结构 | 原 defineContextFragments 或已有 Kit；按其真实结构适配，不机械把所有资料压成单函数 |
| Agent | 现有 Engine setup／绑定配置的实例结构 | 原 Engine 构造与绑定；装饰的定义类不等于实际 Engine |
| ModelRunner | 现有 ModelRunnerOptions／AgentModelBinding 的实例结构 | 原 createModelStrategy 或构造入口；装饰时不创建实际 Runner |

辅助字段不能变成 Core 必填字段，也不能通过“超能 options”引入新运行协议。增强体现在便捷定义、类行为保留、赋予标识、登记与读取；具体辅助能力直接列明，不以模糊名称承诺自动能力。

### 3.7 校验、类型与元数据

- A 组合原字段及已绑定函数，B 实例化定义类并补 id，C 绑定现有实例方法。三者均委托原 define／注册接口的校验，不复制 id 格式、schema、图结构、授权或预算规则。
- 装饰辅助自身检查重复装饰、id 来源冲突、构造失败及池登记错误。原入口若按原行为再次校验，不为追求“仅一次”绕过已有守卫。
- 首批支持类级与实例方法装饰器，不扫描成员、不做隐式继承合并。普通对象、数组与独立顶层函数不提供 @ 写法；A 内部函数转换不公开成独立函数定义入口。
- class implements 约束实例结构，不要求它声明装饰器提供的 id。不能声称 TypeScript 自动扩展装饰后类的实例／静态类型；池读取须显式提供正确的原 options 类型并保留泛型信息。
- 跨格式读取使用同一 realm 内共享池，不依赖模块级 WeakMap；类不要求静态 definition、空载体或冗长类型声明。池的读取泛型描述调用方预期合同，不是运行时类型证明。
- 0.2.5 缓存通过原 context 提供，辅助转换不注入缓存，不修改其提供者、寿命及持久化合同。

### 3.8 编译、验证与公开条件

- 零新增运行时依赖；esbuild 仅为打包测试的开发依赖，不使用 reflect-metadata 或自动参数反射。仅支持标准装饰器语义，明确 NestJS 旧版编译单元不适用，不自动双语义适配。
- Banker 与小可乐保持原对象路径；标准语法用受控编译样例验证，实例化定义与真实运行的证据分开记录。既有对象与装饰转换的对照使用同一 SDK 产物，版本升级另验。
- 类型、ESM／CJS 与打包验证是正式导出的必需条件。覆盖类结构缺字段／类型错误、id 注入、构造次数、getter／私有状态／this、命名空间隔离、多空间登记原子性、重复键与缺失键，以及跨格式读取同一装饰类。
- 打包验证明确装饰器的实例化与共享池登记副作用，不能因包 sideEffects 声明被裁剪丢失定义。分别加载生成的两个类不是同一实例，同一 realm 共享池；重复定义明确拒绝，不自动合并。
- 具备明确辅助职责、实际书写收益与必要测试后，可从 Support 可选子路径正式导出；根入口不自动聚合装饰器。样例与真实生产消费者分别报告，不声称已有生产验证。

### 3.9 实施阶段与验收

| 阶段 | 工作 | 继续条件 |
| --- | --- | --- |
| H0：写法、转换与池合同 | 定稿类与实例方法两种装饰写法、A 内部映射、B 自动实例化、C 自动绑定、id 注入与登记，给出原 options 等价对照 | 类路径不手写 new，方法路径不手写 bind；无重复 metadata、空类载体或公开格式转换入口 |
| H1：工具／节点试点 | 实现完整处理类与已有实例非 run 方法两种写法，均得到原 options；A 只作为底层 | 无公开独立函数定义入口；实例化一次、this 与原校验有效 |
| H2：其他定义适配 | 资料、Agent、模型按原结构逐项接入 | 仅实例化定义对象，不创建其描述的运行实例 |
| H3：公开交付 | 类型、双格式、打包验证及文档、示例、Skill、网站来源 | 原消费者不用装饰器时不变；类型与实际产物一致 |

验收重点：原 options 行为等价；类内分支与辅助方法自然协作；非 run 方法绑定真实原实例，多个实例绑定隔离；定义实例化与业务执行分离；id 只来自装饰器；池读取稳定且不重新构造；原授权、预算、取消、状态提交与回执不变。构造函数不能执行业务副作用，不将“允许定义实例化”继续扩大为 DI 或运行框架。

书写收益单独验收：类装饰代办 new，实例方法装饰代办 bind，分支通过类方法组织，池代办登记与查找。不能只验证产物等价而忽略便利性，也不要求配置字段本身凭空减少。若方案仅把完整 options 搬到装饰器参数、用空 class 携带 definition，或要求开发者手动调用底层格式转换，则不符合本计划。

## 4. 文档、执行与发布

按具体疑问执行最小范围检查，执行前说明疑问与范围；不默认全仓构建、测试、启动或视觉预览。正式 API、示例、Skill 与网站来源只同步实际实现的合同，生成内容从来源更新。

先交付 0.2.5 缓存功能，再在稳定的 0.2.x 合同上增加 0.3.0 辅助函数；包版本与实际发布操作在交付时处理，不因文档草案修订号自动变更。本次仅更新计划与引用。

## 5. 历史评审与本版取舍

保留 [v1 评估](0.3.0-iteration-plan-review.md)与 [v2.1 复审](0.3.0-iteration-plan-review-v2.md)的当时结论，仅因本文改名更新链接；历史章节编号不再作为本文当前导航。

本版纠正此前把“实例化定义类”误判为“新增运行机制”的限制。0.3.0 明确包含 A 的底层 metadata＋函数映射，以及 B 的类装饰、定义实例化、id 注入与注册池辅助。A 不公开成另一套独立函数定义入口；B 不再是把全部 metadata 写在类外的空载体。

评审中关于原校验复用、类型与双格式验证、零依赖及运行边界的约束保留；“禁止定义实例化”“完整 options 类不应装饰”“装饰器不能登记共享池”等结论被本版替代。0.2.5 缓存方向保持不变，0.3.0 不创建 Engine／Runner 或接管执行。

实例方法装饰纳入首批：它适配已有对象的非 run 方法，核心是保留真实接收者和内部方法能力；此前禁止方法装饰器的限制撤回。类装饰的主要价值是组织处理单元，而非单纯承载 metadata。
