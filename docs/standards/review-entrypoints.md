# 项目检查入口

全面或专项检查使用全局 `$comprehensive-code-review`。SDK 重点核对公开入口、Core／Support／Kit、可选适配与宿主端口。宿主绑定真实身份、业务授权及存储策略，SDK 保证公开合同中的输入、预算、状态隔离、取消与恢复。跨实例保证依据状态端口的提交合同，恢复须核对旧快照兼容、身份、预算和真实回执。命令在 Agent Core 项目根目录执行。需要编译产物的回归使用当前源码构建的 `packages/agent-core/dist/`。执行范围遵守[协作约定](../../AGENTS.md)。

| 范围 | 入口和证据 |
| --- | --- |
| 公开导出与依赖边界 | [内核回归](../../packages/agent-core/test/core.test.mjs)核对公开入口的 ESM／CommonJS 导出、类型、运行依赖和源码边界。 |
| 分层与契约 | [层间兼容回归](../../packages/agent-core/test/boundary-migration.test.mjs)核对公开入口的共同实现。[工作流与概念检查](../../packages/agent-core/scripts/check-concepts.mjs)通过 `npm run check:concepts` 运行。 |
| 模型模拟与流式协议 | [MockGPT 集成回归](../../packages/agent-core/test/yi-mockgpt.test.mjs)使用模拟响应核对模型适配、流式文本与工具联动。 |
| 预算与重复工作 | [预算投影回归](../../packages/agent-core/test/projection-budget.test.mjs)核对历史、预算和投影路径。[诊断回归](../../packages/agent-core/test/diagnostics.test.mjs)核对运行事件、开关和隐私边界。 |
| 工作流检查器 | [检查器回归](../../packages/agent-core/test/workflow-inspector.test.mjs)核对实际注册投影、报告输入输出及观察范围。 |
| 库级覆盖审计 | `npm run test:agent-audit` 通过[审计入口](../../packages/agent-core/development/scripts/audit/audit-libraries.mjs)检查全部 SDK 编译模块。覆盖率结果保存在 `.tmp/agent-audit/`。 |
| 公开 API 与交付文档 | `npm run docs:api` 从当前源码抽取公开声明。技术文章一致性使用 `node packages/agent-core/scripts/sync-articles.mjs --check`。发布检查以[公开包文档规范](documentation-standard.md#公开包的使用入口与发布检查)为准。 |

验证记录区分类型检查、离线回归、模拟组件和真实外部服务。库回归的结论覆盖其运行时与开发工具，调用方的业务配置、权限和应用集成由各自项目验证。
