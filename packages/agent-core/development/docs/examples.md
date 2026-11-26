# 示例与接入参考

先按需要守住的行为选择离线案例，再进入对应接口。场景断言覆盖真实执行路径和状态。语义质量、外部副作用及跨进程持久化需要用相应真实端口和环境验证。

## 优先验证稳健性

| 要守住的行为 | 运行案例 | 接入参考 |
| --- | --- | --- |
| 解释失败仍可交付已保存的成果 | [请求恢复与取消](examples/resilience/README.md) · [有界 Agent 组合](../examples/harness-composition.md) | [预算、完成检查与恢复](api/reliability.md) |
| 拒绝权限或监控不可用时返回无法确认 | 用 [服务台 fixture](examples/service-helpdesk/cases.mjs) 运行场景和分层测试 | [工具调用与请求接线](basic-usage.md) |
| 输入过量、取证停滞或调用将尽仍能如实收尾 | [同一任务的两种组织方式](examples/organization-comparison.md) | [上下文策略](api/context-processing.md) |
| 子任务失败、取消或缓慢结束时父任务仍然一致 | [受控并行](../examples/harness-parallel.md) | [有界子任务与分支](api/advanced-agents.md) |
| 跨进程重建等待、核对已发生的操作 | [持久等待](../examples/harness-durable.md) | [等待、持久任务与授权](api/advanced-agents.md) |
| 部分评审或版本移动时拒绝接纳 | [协作断点探针](../examples/collaboration-probe.mjs) | [结果评审与裁决](api/result-review.md) |
| 记忆纠正、过期和撤回仍维持原范围 | [个人记忆示例](examples/personal-memory.mjs) | [记忆快照](memory-and-learning.md) |
| 诊断路由、生命周期钩子及调用次数 | [节点与工具矩阵](examples/lifecycle-matrix.md) | [检查器](workflow-inspector.md) · [变更与测试](workflow-development.md) |

从安装项目运行随包示例时，将路径置于 `node_modules/@jangts/agent-core/development/` 下。服务台 fixture 使用 [工作流场景运行器](workflow-development.md#跑离线用例) 或分层测试入口。

## 选用接入范式

- 从一个可运行的功能开始：[创建应用](create-app.md) · [离线服务问答](examples/offline-agent.md) · [工作机制](mechanisms.md)
- 接入模型与外部操作：[模型与工具调用](basic-usage.md) · [模型协议与生命周期](api/model-protocols.md) · [Core API](api/core.md)
- 接入资料和结构化答复：[知识问答接口](api/knowledge-answering.md) · [上下文处理](api/context-processing.md) · [答复组织](../articles/reply-organization.md)

## 维护工具

以下路径相对于已安装包的 `development/`。脚本需要 Node 22+ 及可解析的 Core 产物。

| 入口 | 输入 | 输出与副作用 |
| --- | --- | --- |
| `skills/agent-core-app/scripts/validate-knowledge.mjs PROJECT` | 已有项目资料清单、源稿和必需读取引用 | 检查结果；不改文件 |
| `skills/agent-core-app/scripts/prepare-source.mjs PROJECT --source UTF8_FILE --id DOCUMENT_ID` | 已有项目、明确提供的来源和稳定文档 id | 待审来源与 proposal；不覆盖生效资料和配置 |
| `skills/agent-core-app/scripts/plan.mjs PROJECT [--source UTF8_FILE]` | 已有项目、可选来源路径 | Agent 开发计划；具体行为见 Skill |
| `skills/agent-core-app/scripts/create-app.mjs TARGET [--write]` | 空目录目标、名称和用途，可选真实来源 | 默认只读计划；显式创建 TypeScript／Node 工程与未发布来源候选 |
| `skills/agent-core-app/scripts/create-app.mjs TARGET --check` | 生成回执、当前受管文件与所选模板 | 只读差异报告；不覆盖用户修改 |

资料维护工具按项目显式提供的配置工作，不扫描或执行项目代码。初始化及差异检查见[创建应用](create-app.md)。资料格式、流程及发布责任见 [维护指南](maintenance.md)。失败以非零退出码和错误报告；无效 UTF-8、预算或章节错误不能靠放宽校验绕过。

工具不会代替文档审核、资源授权、数据库写回或发布，也不默认承担 PDF/OCR、网页采集和任意材料摄取。
