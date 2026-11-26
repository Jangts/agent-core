# 节点与工具生命周期矩阵

矩阵式把通用执行阶段与工具生命周期分开组织，适合能力较多、处理阶段相似、需要合并目标理解与下一步选择的 App。用例式适合完整业务成果有独立接管、授权或恢复边界；探索式适合后续动作取决于新证据。可以组合这些方式，不以节点数量或拓扑相似度判断质量。

## 单份声明与执行

[可运行案例](lifecycle-matrix.mjs)使用已有 `AgentCoreEngine`、`Support.defineToolCatalog` 和 `ToolLifecycleRegistry`。模型一次返回 `{intent, next}`；程序校验意图与工具配对，调用真实生命周期检查、授权、执行及完成钩子。模型不参与计数、真实权限或已知路由推进。当前事实已足够时程序直接交付；真实任务若需要根据新资料解释，可再调用模型，不能把一次合并决策描述为整轮永远只需一次调用。

工具目录、钩子包装和检查器矩阵从同一份 definitions 与 stages 生成。`inspect`、`visibleText` 使用注册器的全工具遍历，`authorize`、`complete` 只使用选中工具；未声明钩子的组合为空。矩阵不是节点之间的拓扑边，不表示所有工具都执行。案例只在 status 目标进入矩阵，greeting 直接交付。App 接入时必须依据真实注册及调度规则导出适用范围，不能按工具名称猜测。

```sh
node node_modules/@jangts/agent-core/development/docs/examples/lifecycle-matrix.mjs
node node_modules/@jangts/agent-core/development/scripts/workflow-inspector/cli.mjs inspect \
  --entry node_modules/@jangts/agent-core/development/docs/examples/lifecycle-matrix.mjs \
  --output .tmp/matrix.html
```

入口可安全导入，不运行模型、工具或 App。脚本直接运行时使用内存工具和固定 Provider，无凭据或网络。源码仓库从根目录将 `node_modules/@jangts/agent-core` 替换为 `.`；回归入口为 `node --test test/lifecycle-matrix.test.mjs`。

## 可选检查快照

在 `inspection` 或 JSON 快照中提供 `lifecycleMatrix`：

```js
const lifecycleMatrix = {
  intents: [{ id: 'status', toolIds: ['read'], description: 'Explain service status' }],
  bindings: [{
    id: 'authorize/read/authorize', nodeId: 'authorize', toolId: 'read',
    hook: 'authorize', handler: 'authorizeRead', mode: 'selected', intentIds: ['status'],
  }],
};
```

`intents` 的 ID 唯一，toolIds 无重复；每个绑定有稳定唯一 ID、真实 nodeId/toolId、钩子和 handler 说明、`selected` 或 `all` 执行范围及非空无重复 intentIds。绑定工具须在所列意图的 toolIds 内。此处是 App 提供的解释合同，不是 Core 的强制 Intent 注册系统。ID 不绑定某个业务词汇；hook 与 handler 也不由检查器调用。未提供矩阵表示未知，不使其他合法范式失败。

检查器验证节点、工具、意图配对和唯一引用，缺少工具注册状态时仍提示未知。报告可点击阶段或工具，查看声明；diff 比较 `matrixIntents`、`matrixBindings` 并追踪到直接受影响节点。旧快照不含矩阵仍可使用；任一侧没有该声明时 diff 标明未比较，而不是证明矩阵没有变化。

## 运行记录与证据边界

案例用 `context.createStepRecorder()` 在钩子调用时写入 `relatedDefinitionId = binding.id`，记录成功或失败。App 通过授权数据源取得 `workflow.toTrace(runId)`，使用检查器的 `--trace run.json --run-id ID` 关联报告。矩阵单元按 nodeId 和 relatedDefinitionId 关联每次 span 的记录，可点击查看；同一阶段反复访问不合并身份。

关联只说明 App 报告了该钩子记录，不证明权限正确、业务完成或写入成功。没有记录显示未观察到，不推断未执行；部分链、旧定义或日志配额均可能形成缺口。未知字段和事件正文仍不进入报告。来源、handler 名称和意图说明也需按受众检查隐私。

## 故障与质量验收

离线用例验证：普通交流直达；一次决策同时选择目标与工具；全工具与选中钩子范围；非法配对和授权拒绝不执行；模型或工具失败有真实交代；附属呈现失败保留已提交的事实和正文；取消终止；声明变更影响追踪；HTML 脚本可从矩阵访问运行记录。示例没有写操作、动态扩额或语义摘要，不将只读回归当作写入恢复或模型能力证据。预算、长上下文、未知写入及两种其他组织方式见[组织对照](organization-comparison.md)。

真实 App 还须验收首次选择率、后续资料解释、工具可见性、实时授权、剩余必要工作评估、压缩保护、未知副作用核实及交付恢复；这些质量合同适用于矩阵式、用例式和探索式。实际 Cafe 的目标、工具和权限仍由 App 自己拥有，不随此案例导入。

矩阵中的 toolIds 表示生命周期参与范围，不自动授予模型调用权。仅提供呈现钩子的工具仍可参与全工具阶段；实际调用候选应另由同源声明中的 callable／可见性条件投影。示例的 note 只参与钩子，非法提议调用它会在执行前拒绝。
