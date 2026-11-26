# Agent Core 仓库文档

## 协作规范

从[协作约定](../AGENTS.md)了解项目边界，从[协作规范索引](standards/README.md)查阅文档、接口、代码、日志、素材和验收规则。

## 现行设计

[现行设计索引](design/README.md)说明 Core、Support 与 Kit 的职责、执行机制、传输协议和诊断。公开调用合同以 API 手册和类型声明为准。

## SDK 使用文档

- [开发者指南](../packages/agent-core/development/docs/README.md)
- [API 手册](../packages/agent-core/development/docs/api/README.md)
- [工作机制](../packages/agent-core/development/docs/mechanisms.md)
- [示例](../packages/agent-core/development/examples/README.md)

## 仓库维护

[维护资料索引](maintenance/README.md)收录发布、专题迭代、历史规划和决策记录。源码、文档与发布的检查方式见[项目检查入口](standards/review-entrypoints.md)。

## 源码维护

Agent Core 是独立 npm 包。根 `package.json` 声明公开入口和发布文件，根 `package-lock.json` 锁定依赖。运行实现位于 `src/`，构建、生成和接口抽取入口位于 `scripts/`，库级回归位于 `test/`。

在 Agent Core 根目录运行 `npm ci` 安装锁定依赖，`npm run build` 生成文章、Skill 和 ESM／CommonJS 产物。构建后可运行 `npm test`，或运行 `npm run test:agent-audit` 做覆盖率审计。`npm run docs:api` 直接从当前源码抽取公开声明。检查频率和授权见[协作约定](../AGENTS.md)。

随包使用文档和示例位于 `packages/agent-core/development/`。技术文章的编辑源稿在 [article-sources](../packages/agent-core/development/article-sources)，[文档站](../apps/agent-core-docs/README.md) 从本仓库的 SDK 源码、手册、文章与素材生成。使用 `npm run build:docs:agent-core` 构建。
