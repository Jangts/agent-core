# Agent Core 协作约定

本项目位于 Jangts 的 `agent-core/`，根目录是私有 npm workspace，包含 `packages/agent-core/` 和 `apps/agent-core-docs/`。安装、构建与回归从仓库根目录运行，依赖由根 `package-lock.json` 固定。保留已发布的包名、版本及公开入口，发布与 Git 操作遵守当前用户授权。

SDK 运行时、公开手册、技术文章、Skill、示例与库回归归本项目维护。SDK 目录中的 `development/article-sources/` 为文章源稿，由包内 `scripts/sync-articles.mjs` 生成随包分发的 `development/articles/`。本站从本仓库的 SDK 源码和手册生成，外部依赖使用锁定发布包。业务数据、领域权限、配置与应用集成测试归调用方。修改公开契约时同步检查实现、公开入口、文档和受影响调用方。

## 设计与实现

接口遵守[接口设计规范](docs/standards/interface-design-standard.md)及 [Agent Core 接口设计约定](docs/design/interface-design-conventions.md)。Core 定义 App 调用和回调合同及运行保证，Support 辅助 App 接入并沿用 Core 合同，Kit 提供 App 可选用的局部协议与实现。Core 的执行入口独立于 Support 和 Kit，底层纯逻辑可共用。细节见[分层设计](docs/design/design-layers.md)。

[代码组织与职责](docs/standards/code-organization.md)适用于 SDK 和配套工具。可枚举的能力、协议、节点、工具、状态和路由通过类型化清单驱动装配、校验、匹配和分发，并以类型检查或回归核对引用。保留身份、授权、输入输出验证、预算、取消和真实副作用的合同。公共源码注释使用英文或中英双语，正式工具说明文件职责和关键函数。

文档站界面遵守[前端结构规范](docs/standards/frontend-structure.md)。

## 文档、素材与诊断

仓库文档从[总入口](docs/README.md)进入。协作规范归 `docs/standards/`，现行实现设计归 `docs/design/`，发布和实施过程归 `docs/maintenance/`。正式文档、公开包检查与生成来源按[文档规范](docs/standards/documentation-standard.md)维护。本地规范变动时同步核对受影响项目。

事件、错误与敏感信息按[日志规范](docs/standards/logging-standard.md)处理，宿主负责持久化与披露。标志、图标和手册配图按[图片素材规范](docs/standards/image-assets.md)维护。

## 检查与维护

全面代码检查、专项检查和修复复查使用全局 `$comprehensive-code-review`，自动读取[项目检查入口](docs/standards/review-entrypoints.md)。按具体疑问选择最小验证。真实外部服务、视觉预览、截图、压测和发布分别按当前任务授权执行。保留已有改动，临时产物放在 `.tmp/`，凭据与运行数据留在私有位置。
