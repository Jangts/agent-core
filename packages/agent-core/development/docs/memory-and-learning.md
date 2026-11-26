# 记忆与持续积累

[返回开发指南](README.md) · [共享流程](flows/knowledge-maintenance.md) · [记录模板](records.md)

库没有开箱即用的长期记忆数据库、用户画像合并服务或业务经验自动学习器。Core 提供执行合同，Support 帮忙装配上下文和调用，Knowledge／Answering 等 Kit 提供选用后的局部处理。是否记录、怎样归属、何时更新与删除，均由 App 明确实现；不记录也是合法选择。

## 不同数据需要不同规则

| 数据 | 推荐用途 | 不应直接等同于 |
| --- | --- | --- |
| 最近问答 | 会话连续性、消歧 | 工具执行日志、永久知识 |
| 累计用户偏好 | 称呼、表达偏好、持续话题 | 身份、权限、公共事实 |
| 业务经验候选 | 从结果归纳可复用建议、发现失败模式 | 已证实规则、自动授权 |
| 已发布知识 | 明确来源、范围和版本的业务事实 | 未核实用户自述 |
| 原始材料及提取结果 | 当前任务证据或经授权的档案 | 自动共享知识 |

不要用一个无来源的大 summary 容纳所有类别。每类记录至少有稳定身份、归属、来源、版本、状态及保留策略。模板字段只是起点，App 自行定义并校验，不是所有消费者必须遵守的新 Core 协议。

## 用户偏好更新的应用流程

```text
选择允许记录的最终问答与水位
  → 旧摘要 + 新问答 + 明确合并规则
  → 受预算约束的模型提取候选
  → 解析和长度／来源／敏感范围检查
  → 以旧版本为前提提交摘要与新水位
  → 后续请求按身份读取，标为低可信记忆
```

不将模型内部推理、纠错或未执行动作混入用户画像。新表达与旧偏好冲突时采用 App 明确规则；人工权威事实仍由对应数据源提供。模型失败或版本冲突时保留旧摘要和未消费水位，再有界重试，避免丢消息或重复合并。定时任务、存储事务／CAS、租约和重试由 App 实现；不能假定 Core 的单请求预算覆盖后台作业。

## 经验增长的应用流程

用固定任务类型登记提取、校验、查询与发布实现；新增经验记录只是数据变化，不自动新增 handler。候选应关联实际来源和结果，保留适用范围、反例与冲突，不将一次成功当作普适规则。

候选形成 → 查重／冲突检查 → 业务验证或人工确认 → 版本化发布 → 受控读取，与 [共同流程](flows/knowledge-maintenance.md) 一致。若要接入 Knowledge，App 将已允许的记录转换为 `KnowledgeDocument`，编译新目录并切换请求引用；活跃请求继续使用旧快照。

`prepare-source.mjs` 用于开发期整理文本候选。运行期持久化学习可复用其中的编译逻辑和来源约束，存储、并发与发布策略由 App 提供。

## 运行期接入前必须决定

记录范围与用户选择、租户隔离、可见范围、保留和删除、来源优先级、更新冲突、幂等键／消费水位、失败恢复，以及哪些内容永远只作为候选。没有这些实现时，文档与界面应明确“本轮／会话使用”或“人工维护”，不能声称已自动学习。

## 可选个人记忆 Kit

`@jangts/agent-core/kits/memory`提供纯快照转换，不提供数据库、自动学习服务、身份或后台调度。`preference`是自动小摘要采用的保留种类，`goal`要求期限；其他登记kind只参与通用条目处理，不自动进入偏好摘要。App拥有不同kind、范围及敏感资料的准入政策。

| API | 合同 |
| --- | --- |
| `memoryUpdateSchema(kinds, scopes?)` | 注册允许种类，生成同源JSON schema与parser；最多16条操作 |
| `applyMemoryUpdate(previous, operations, sources, now, legacy?, legacyValidUntil?)` | 仅接受App授权来源的用户原话引句；写时复制、版本替代与撤回、过期和容量处理；不提交存储 |
| `batchMemorySources(sources, target, maxBatches?, maxChars?)` | 完整时间组分批，返回安全水位；不截断用户原话 |
| `memoryModelView(state, sources, maxChars?)` | 有界模型专用视图，保留真实scopeId；遗漏不意味着删除 |
| `memoryContext(state, query, now, scope?)` | 最多300码点偏好、3条相关记忆及单独标明未核实的过渡旧摘要 |
| `reviewMemorySources / memoryReviewBatch / completeMemoryReview` | 来源可用性、轮换选择和实际复核完成标记；来源由App解析 |
| `isMemoryState(value)` | 持久化边界校验；损坏辅助记忆的业务降级由App处理 |

最小接线（`load`、`commit`和`extract`是App提供的端口，不是SDK存储API）：

```ts
import { memoryUpdateSchema, applyMemoryUpdate, memoryModelView, memoryContext } from '@jangts/agent-core/kits/memory';
import type { MemoryState, MemorySource } from '@jangts/agent-core/kits/memory';
const schema = memoryUpdateSchema(['preference', 'goal']);
async function update(
  load: () => Promise<MemoryState | undefined>,
  extract: (input: unknown) => Promise<unknown>,
  commit: (expected: number, state: MemoryState) => Promise<void>,
  sources: MemorySource[],
) {
  const old = await load(); // App先按账号、可见性、完成状态和保留期过滤sources
  const proposal = schema.parse(await extract({ memory: memoryModelView(old, sources), sources }));
  const now = Date.now();
  const next = applyMemoryUpdate(old, proposal.operations, sources, now);
  await commit(old?.revision ?? 0, next); // App以CAS/租约原子提交快照及消费水位
  return memoryContext(next, '当前问题', now, '当前会话ID');
}
```

实际模型调用继续使用ModelRunner，App独立设置后台调用、输入、输出、超时和取消预算；返回未知对象必须经过schema.parse，登记kind不是权限。引句只在校验期间使用，不进入快照。匹配只证明原文存在，不证明提取结论的语义支持、用户归属或现实真伪；材料、角色扮演、敏感内容和模型注入需App政策及真实模型负例验收。

活跃条目最多64条；较旧溢出条目降为needs-review，不再自动注入，新表达可重新激活。总版本最多128条；退休时间下界阻止旧来源重新创建清退内容。一次完整时间组超过批次预算会失败，App应记录并人工检查，不能推进水位略过它。

同毫秒来源可由 App 提供持久化的 `MemorySource.orderKey`，使用字符串字典序，旧到新递增。Kit 将其写入证据引用，供后续批次比对。旧快照仍可读。同一时间戳的两条来源都在本批时可用 App 的来源顺序判断，否则顺序不明时保留已建立条目。追赶导入时已经过期的目标只保留历史版本。

legacySummary是未逐条核实的旧资料；App可提供固定过渡期限，不能在每次更新延长。有证据的操作可用legacyQuote删除精确旧片段；超长旧摘要经明确legacySummary压缩字段进入过渡区，不伪造引用、不静默截断。新的有来源条目及当前表达优先于过渡内容。

设计依据：[Anthropic记忆分层](https://www.anthropic.com/research/components-of-agent-memory)、[Dreaming实现教程](https://platform.claude.com/cookbook/managed-agents-cma-dreaming-with-a-dynamic-workflow)。分层和后台整理不保证所有场景都有收益，应分别评估正确率、陈旧记忆影响、召回质量与费用。
