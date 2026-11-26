# 上下文节点

Core 接受文本、消息、BuiltContext 或 ContextPlan，负责通用输入装配、信任与结构约束、实际请求测量和最终预算。App 决定装配、选择、分组裁切、摘要与保留策略，并提供所需的业务 handler；Support 的普通 Workflow 节点按配置执行通用处理流程，Core 执行信任、结构和预算边界检查。App 无须重写通用处理循环，也可提供自定义节点。

从直接消息到片段与处理节点的推荐路径、自动行为和模块分工，见[提示词与上下文](../../articles/prompts-and-context.md)。

## 从同一个调用渐进配置

不需要处理时直接 `runner.invoke({ input })` 或 `context.model.invoke({ input })`。ContextPlan 超限会拒绝，不会隐式插入处理步骤。

需要处理时，在同一 Workflow 中登记 Support 节点：

```ts
const processing = Support.createContextProcessingNode({
  id: 'context', description: '处理本轮上下文',
  plan: state => state.plan,
  request: { stageId: 'reply', interaction, maxOutputTokens: 1000 },
  policy: { mode: 'reduce', steps: [
    { id: 'summary', kind: 'compress', fragmentId: 'history',
      targetChars: 4000, handlerId: 'summary' },
  ] },
  compressors: [compressor],
  update: result => ({ input: result.input, prepared: result.prepared }),
  routes: [route.to('answer')],
});
// answer 是普通节点：
// (await context.model.invoke({ input: state.input, prepared: state.prepared })).value
```

该生成器返回普通 WorkflowNode，通过 defineWorkflow 配置，由 agent.run 执行。自定义实现可以直接提供节点的 run。plan、request、prepared、update 的规范方法在装配时绑定接收者，策略与 handler 清单形成快照；App 服务保持原身份。

## 显式选择和压缩

需要在主图上分别观察选择、压缩及装配时，使用三个普通节点，并由 App 路由决定执行顺序：

| 生成器 | 实际工作 | 结果 |
| --- | --- | --- |
| createContextSelectionNode | 验证候选与保护边界，按策略选择可负担的登记步骤 | ContextSelectionResult：plan、prepared、stepIds、report |
| createContextReductionNode | 执行 stepId 指定的一项裁切或压缩，审计结果 | ContextStageResult：处理后的 plan、prepared、report |
| createContextProcessingNode | 按配置处理并完成装配；默认 validate 只检查并装配 | ContextNodeResult：input、prepared、report |

三个生成器使用相同的基础节点字段、plan/prepared/request 输入及 update 输出映射。后续节点通过 prepared 回调复用前一节点的句柄，避免重新执行动态 prepare。App 选择自己的状态字段；这些 Support 结果不成为 Core 必需的全局状态。独立实现仍只需满足对应 Workflow 的输入／输出合同。

同一份超限数据不启用处理时会拒绝；加入选择、缩减和装配节点后可以继续。替换缩减节点时，独立类只需提供相同的 id、run 和 routes，并保留 plan 的审计输入；Core 的 enter 事实证明节点真实进入。

## 场景推荐与精确覆盖

`createContextStrategy` 从已登记的片段生成同一份节点配置：

```ts
const strategy = Support.createContextStrategy({
  kind: 'continuity', fragment: historyDefinition, field: 'history', compressor,
  targetChars: 4000, keepGroups: 3,
});
const node = Support.createContextProcessingNode({
  ...strategy,
  id: 'context', description: '保留近期原文并整理旧历史',
  plan: state => state.plan,
  update: result => ({ input: result.input, prepared: result.prepared }),
  routes: [route.to('answer')],
});
```

recent 生成本地完整轮次窗口，不调用模型；continuity 生成旧段摘要与近期原文保护，模型成本取决于所提供 compressor。步骤 ID、handlerId 与登记数组由同一输入生成。targetChars 缺省复用片段 maxChars，grouping 缺省 user-turn，keepGroups 缺省 1；精确值优先，0 不会被当成缺省。需要模型选择器或完整自定义策略时，直接补充同一节点的 policy、selectors 或替换节点实现，不切换调度协议。

## 推荐策略的低层配置

Support.ContextPolicy 有三个模式：

| 模式 | 行为 |
| --- | --- |
| validate | 不缩减，只校验与装配 |
| reduce | 按 steps 与 selection 选择有限的处理操作 |
| audit | 检查 App 处理前后的片段，只允许 mutableFragmentIds 修改值 |

reduce 的选择方式为 sequence、fixed、auto、model。未配置选择时按 steps 顺序执行；fixed 限定 trim 或 compress；auto 预演完整分组的裁切损失，优先安全裁切，否则选择可负担的压缩；model 调用登记的选择器返回步骤 ID。选择器不能提供新工具、handler、权限或预算。

auto 的 maxTrimLossRatio 默认 0.25，是 JSON 字符缩减启发式，不是语义损失或最优质量保证。同一片段的多次裁切累计计算，不能通过小步骤绕过上限。空选择表示没有安全处理项，最终超限仍拒绝，不伪装处理成功。

triggerChars／triggerTokens 是提前触发水位，targetInputChars／targetInputTokens 是软目标。各步骤最多执行一次；达不到软目标但满足最终硬限制可以继续，超出硬限制则拒绝。裁切目标使用片段 value 的完整 JSON 长度，不能截断单条消息。

## 保护、分组和原文

片段保持 id、sourceId、trust、role、lifetime、maxChars 与结构化顶层字段。system、instruction 和不在处理清单中的片段不可改。缩减结果不能变长，也不把低信任历史提升为指令。审计只能证明结构与边界，不能证明摘要事实无误。

历史支持 fixed 完整组或 user-turn 分组。user-turn 从 user 消息开始，保留其后的多个 assistant 消息及尚未回答的用户轮次；孤立开头、未知角色和非文本条目拒绝处理。近期原文保留可配置在压缩步骤中：

```ts
{
  id: 'summary', kind: 'compress', fragmentId: 'history', targetChars: 8000,
  handlerId: 'summary',
  preserve: { field: 'history', keepGroups: 3, grouping: { kind: 'user-turn' } },
}
```

Support 只把旧段交给 handler，把近期尾段原样拼回。返回值须维持字段和合法分组。保留内容本身超限时拒绝，不删除保留原文；无旧段不调用摘要模型。App 负责确定保留数、事实检查以及是否保存摘要，本能力不修改历史存储。

Core 的 ContextPlan 可提供可信 originalFragments 与 mutableFragmentIds 做通用差异审计；它不会把原始片段发给模型。额外图片消息通过 additionalMessages 保留，其文本计入正文预算。图片二进制继续遵守独立输入边界。

## 实际测量与额度

节点准备一次真实传输，并复用同一快照进行测量和发送。正文受 maxInputChars 约束，传输指令与声明受 maxSchemaChars 约束；JSON Schema 若嵌入指令，不重复计入实际合计。配置 tokenBudget 时，计数器接收包含指令、Schema 与图片的实际中立请求字段，并扣除输出预留和安全余量；Core 不猜字符与 token 的比例或供应商容量。

最终 Provider 调用前继续校验实际输入。节点预估、处理报告及 withinBudget 都不是放行凭证。准备句柄属于本次 Runner／Workflow 请求且只能消费一次。

selector/compressor 的 maxCalls 声明每次 handler 可用的模型次数，默认 1，纯本地实现为 0。Support 实际限制 callModel，并共享同一 Runner／Workflow 的总额度。auto/model 的 reserveCalls 默认且至少为 1，保护最终回答；候选预算按声明的最大调用数保守判断。Core 仍原子扣减实际调用次数，失败不退回。

节点默认处理期限采用 Core 的基础单次时限，可通过 timeoutMs 精确覆盖；与父 signal 组合，不延长期限。内部模型请求也接收该 signal。忽略取消的 handler、迟到结果和挂起的内容 sink 不得提交成功。

## 过程观察

选择、压缩和装配使用普通节点的开始、跳转、完成、失败与耗时事实。context.report 补充获准的处理报告，节点不创建 span、写日志或管理 diagnostics。监听与持久日志开关独立，详见[过程观察](observability.md#运行中的状态和输出)。
