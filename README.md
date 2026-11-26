# Agent Core

[SDK quickstart / SDK 快速开始](packages/agent-core/README.md) · [开发手册](packages/agent-core/development/docs/README.md) · [在线文档](https://agent-core-docs.pages.jangts.cafe/) · [项目文档](docs/README.md)

`packages/agent-core/` 维护并发布 SDK。 `apps/agent-core-docs/` 从本仓库生成中英文文档站。

使用 Node.js 22.12 或更高版本，在仓库根目录运行：

```sh
npm ci
npm run build
npm run build:docs:agent-core
```

SDK 和站点独立构建，分别使用 [SDK 发布清单](packages/agent-core/package.json) 与 [站点维护入口](apps/agent-core-docs/README.md)。
