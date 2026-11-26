# 复盘、分支和资料发布

[Core](core.md)提供模型调用、执行、分支身份与取消合同。[Kit](kits.md)在 App 提供的授权和存储端口上处理复盘、数据版本和持久任务。

这些 Kit 的 authorize、BranchVersioningDefinition.validate 和 verifySources 都是断言式回调：成功返回 void，拒绝时抛错；同步或异步返回 false、true、null 等其他值均视为合同错误，不继续执行或保存。

BranchVersions 与资料发布在进入异步授权或读取前固定请求身份、目标和可序列化数据，后续修改原请求不改变本次操作。BranchVersions 的读取校验和授权取得隔离的数据，不能借检查回调改写存储原件或待提交记录。来源引用不得有缺失项，提交前仍检查有效期。

## 有界子任务组合

普通任务调用同一 `createChild` 入口。组合多个独立任务时，`Support.runChildren` 按根 runner 的容量启动子 runner，隔离 journal、signal 和输出；任务仍使用自己的普通 handler 或 Workflow。

```js
import { ModelRunner, Support } from '@jangts/agent-core';

export async function analyze(provider, inputs, signal) {
  const model = new ModelRunner({ provider, maxCalls: 8, execution: { signal },
    children: { maxDepth: 2, maxConcurrentCalls: 2, maxChildren: 8 } });
  return Support.runChildren(model, inputs.map((text, index) => ({
    id: `part-${index}`, maxCalls: 2, reserveCalls: 1, timeoutMs: 30000,
    interactions: [],
    async run(child) { return (await child.invoke(text)).value; },
  })), {
    concurrency: 2,
    accept(value) { if (typeof value !== 'string' || !value.trim()) throw Error('Empty analysis'); },
  });
}
```

`accept` 与 `commit` 成功时均返回 void；拒绝通过抛错表达，不以布尔返回值表示。子任务的传输清单在启动该组时固定。`accept` 检查每项结果，等待期间仍受该子任务的取消和期限约束；全部接受后，才按声明顺序调用可选 `commit(value, id)`。任一任务或接受检查失败会取消同组任务，迟到结果不能进入提交。`commit` 是 App 的真实副作用端口，已发生的提交不能因取消假装回滚；需要全组原子性时，由 App 在真实事务中提交整个返回数组。角色和工具清单显式登记，不能靠子执行自动继承权限。

accept 同样遵守断言合同：成功返回 void，其他返回值均拒绝，不能把 false 当成一次成功检查。

## 元数据复盘

```ts
import { defineReflection } from '@jangts/agent-core/kits/reflection';
import type { ReflectionSource } from '@jangts/agent-core/kits/reflection';
import type { ModelRunner, OperationContext } from '@jangts/agent-core';

export function review<App>(model: ModelRunner, source: ReflectionSource<App>,
  authorize: (question: string, context: OperationContext<App>) => Promise<void>) {
  return defineReflection({ model, source, authorize,
    maxCalls: 4, reserveCalls: 1, maxPages: 4, maxEvents: 64, maxEvidenceChars: 12000 });
}
```

`run(question, context)` 通过已注册的 `history.query` 工具取得证据，模型可选择发现运行、读取事件或提交报告。Source 对每次查询校验真实账号及范围；输出固定元数据字段，不传日志正文。报告区分 observed、hypothesis、recommendation；observed 必须引用本次实际返回的证据 ID。读取不完整、过期、预算不足或协议失败均保留真实限制，报告默认 `persisted: false`。

`defineReflectionLogSource({ reader, id, traceId, authorize })` 可适配 App 自有的结构化日志 reader：固定 trace 范围，只读取本次已发现的 run，并只投影 Core 元数据。实际时间、span／父 span、调用与分支身份通过固定清单保留，供报告引用真实关系。覆盖信息仅保留 consistency、complete 和 gaps，不转发来源附带的其他字段。App 拥有目录、账号校验、reader 的关闭和日志保留期。额外工具必须为 read，在构造时固定清单及规范方法，仍走普通工具输入、授权与输出合同。

日志按事件声明读取元数据：model.end 使用 payload.state，workflow.event 使用 payload.event，loop.event 使用自身载荷。工作流及循环的实际生命周期转换为 running／success／error／cancelled；错误码与耗时沿相同投影保留，不向模型发送原始错误正文。

读取许可、交给模型处理和披露结果是独立决定。日志缺失不能证明未执行，动态报告的子步骤不能证明真实内部调度。源数据在返回前到期时拒绝交付。

报告的 `createdAtMs`、证据与报告的 `expiresAtMs` 均为绝对毫秒时间，与事件的 `occurredAtMs` 使用同一单位。

## 持久分支与显式启用

```ts
import { defineBranchVersioning } from '@jangts/agent-core/kits/branch-versioning';
import type { BranchVersionStore } from '@jangts/agent-core/kits/branch-versioning';
import type { OperationContext } from '@jangts/agent-core';

type State = { goal: string; sourceRevision: string };
export function family<App>(store: BranchVersionStore<State>,
  authorize: (context: OperationContext<App>) => Promise<void>,
  verify: (state: State) => Promise<void>) {
  return defineBranchVersioning<State, App>({
    store, maxVersions: 16, retentionMs: 7 * 86400000,
    isState: (value): value is State => !!value && typeof (value as State).goal === 'string'
      && typeof (value as State).sourceRevision === 'string',
    authorize: (_operation, _record, context) => authorize(context),
    validate: candidate => verify(candidate.state),
    async merge({ base, target, source }) {
      if (target.goal !== base.goal && source.goal !== base.goal && target.goal !== source.goal)
        return { conflicts: ['goal'] };
      return { value: target.goal === base.goal ? source : target, conflicts: [] };
    },
  });
}
```

`create` 建立初始版本；`fork` 接收真实父分支身份和克隆状态；`merge` 需要共同 base，并由 App 的三方合并器报告冲突。新版本先作为候选保存。`promote({ id, revision, candidateId, expectedActiveId }, context)` 再次检查当前来源与批准责任，显式切换 activeId。只允许以当前 active 为 base 的候选启用。

`BranchVersionStore.compareAndSwap` 必须把完整版本集合和 activeId 在真实存储中原子提交；返回 true 才是成功回执。读取权限由绑定的 store 执行，变更另走 authorize。分支数据不恢复身份、预算授权、工具实例或正在运行的函数；App 在使用选定版本时重绑当前依赖。Engine 已绑定请求级模型或工具运行实例时，`fork` 的 `resume` 必须提供对应实例；缺少时在派生阶段拒绝。Engine 的 `exportSnapshot`／`restoreSnapshot` 处理可序列化宿主数据与分支快照，BranchVersions 管理 App 的版本集合。

版本使用 `createdAtMs`，集合使用 `expiresAtMs`，均为绝对毫秒时间。App 自有数据库字段可在 store 边界映射到这些合同字段。

## 持久专业任务

```js
import { defineDurableTask } from '@jangts/agent-core/kits/durable';

export function professionalTask(store, isState, authorize, analyze) {
  return defineDurableTask({ id: 'app.review', revision: '1', isState, authorize,
    steps: [{ id: 'analyze', replayPolicy: 'safe',
      async run(state, context) {
        // analyze binds its real model runner to context.maxModelCalls.
        return analyze(state, context);
      },
    }],
  }, { store });
}
```

App 创建 version=2 检查点，设置 definitionId/revision、state、nextStepIndex=0、attemptCount=0、maxAttempts、固定执行 deadlineAtMs 和 status=ready；需要累计模型额度时同时保存 modelBudget。初始 commitId 可省略，Kit 的新保存总会生成提交身份。只有 App 显式调用 run({ taskId }, context) 才执行。

safe 用于可安全重放的分析；可能已经写入的操作使用 reconcile。reconcile 返回 completed 加完整 state、not-executed 或 unknown，不能直接返回 State，也不能自己补发操作。它以稳定 operationId 查询真实回执，maxModelCalls 为 0。临时查不到记录不等于确认未发生；未知保留，不凭聊天文本猜测。

授权 context.operation 为 execute、reconcile 或 read。中断操作先只读确认，即使执行期限或额度已耗尽；确认 completed 不增加执行尝试或预留，not-executed 仍须重新通过原执行权限、期限和额度才能执行。已完成结果经 read 授权后可在执行期限之后返回；读取保留期及查询超时由 App 决定。

App 将执行预留绑定到真实 Runner，失败不退预留。保存确认丢失时 Kit 在锁内读回匹配 commitId；不能确认就保留原错误。已经开始的保存及读回须 settle 后释放锁。取消只阻止结果接纳，不能证明远端副作用被撤销；持久取消由宿主显式登记。完整三态、提交与授权边界见 [Durable](kits.md#durable)。


## 候选资料与发布

```js
import { Knowledge } from '@jangts/agent-core/kits/knowledge';

export function publication(store, authorize, verifySources) {
  return Knowledge.defineKnowledgePublication({ store, authorize, verifySources,
    maxCandidates: 32, candidateRetentionMs: 7 * 86400000,
    requiredReads: [{ documentId: 'guide', selection: { mode: 'document' } }],
    maxReadChars: 12000,
  });
}
```

`propose({ revision, document, sources }, context)` 使用同一 Knowledge 编译器检查完整替换后的文档集合及 requiredReads，只写候选。`publish({ revision, candidateId }, context)` 重新授权并核对来源版本、有效期与 publishedRevision，再用 CAS 一次替换正式集合并移除候选。`reject` 显式删除候选。修改正文或元信息必须给文档新 revision。

候选期限和来源期限在异步核验、文档编译及提交快照准备后再次检查，检查通过才启动 CAS；已经开始的存储提交继续等待真实回执，不因途中到期伪称回滚。

Store 的 revision 协调全部写入，publishedRevision 专门识别正式集合变化；候选基于过期的正式版本时需重新准备。普通知识读取从 record.documents 构造 catalog，不把 candidates 混成事实。人工资料、累计偏好和经验候选各有自己的来源、权限及生命周期；发布行为由 App 明确授权，不由模型自行取得权限。

同一实例缓存最近一次记录的编译校验结果，键包含 revision、publishedRevision 和完整文档内容；相同版本号下的内容变化仍会重检。缓存不替代 store 读取、操作授权、来源验证或有效期检查。

候选的 `createdAtMs`／`expiresAtMs` 和来源可选的 `expiresAtMs` 使用绝对毫秒时间；`candidateRetentionMs` 是时长。来源到期时不能借候选保留期延长其有效性。

共享 Runner 传给 runChildren 时，整组入口自动绑定一次，所有子调用共享同一预算；已绑定父 Runner 不刷新预算。Reflection 同样按本次 context 绑定共享 Runner，再创建子执行。
