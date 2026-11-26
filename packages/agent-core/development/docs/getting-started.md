# 安装与接入

[返回开发指南](README.md) · [API 手册](api/README.md)

将 Agent Core 作为依赖安装到应用中，再按需要接入模型、工具和工作流。

从空目录开始时，可先按[创建应用](create-app.md)生成 TypeScript／Node 工程，再沿本页完成依赖和模型接入。

## 安装

从 npm 安装：

```sh
npm install @jangts/agent-core
```

依赖由包管理器根据 `package.json` 安装。使用维护方提供的本地包时，可指定 tarball 路径：

```sh
npm install /artifacts/jangts-agent-core-0.1.0.tgz
```

路径与版本按实际交付替换。离线安装需要维护方提供完整的本地依赖源，由包管理器解析全部依赖。

包提供 ESM、CommonJS 和 TypeScript 声明。Node.js 使用 22.12.0 或更高版本；运行环境需具备 `fetch`、`AbortSignal`、`ReadableStream` 等所用 API。模型凭据由应用的服务端配置管理。

## 接通第一次调用

先提供 App 已配置的 ChatProvider，再传入原始问题；其余运行设置都有默认值：

```ts
import { Support, ModelRunner } from '@jangts/agent-core';

const provider = new Support.CompatibleModelProvider({ config: {
  baseUrl: process.env.AI_BASE_URL!,
  apiKey: process.env.AI_API_KEY!,
  model: process.env.AI_MODEL!,
} });
const model = new ModelRunner({ provider });
const text = (await model.invoke('你好')).value;
```

以上使用应用现有环境配置，服务需兼容 Chat Completions；baseUrl 不包含 /chat/completions。Provider自行处理HTTP／SSE，无需另外实现stream。先跑[离线完整示例](examples/offline-agent.md)无需模型凭据；它不调用真实模型。普通文本调用无需 Knowledge、工具或工作流。Kit 按需要从 `@jangts/agent-core/kits/<name>` 导入，具体组合见对应任务文档。

| 由 App 提供 | 由现有接口执行 |
| --- | --- |
| Provider 的真实连接配置与用户输入；signal／预算按需覆盖 | ModelRunner 检查预算、处理取消／超时并调用模型 |
| 集中工具声明、服务端身份和业务实现 | Core ToolRegistry 执行注册；可选 Support 减少重复接线，授权约束由实际声明提供 |
| 继续／结束条件和业务错误出口 | AgentCoreEngine 按已登记的流程执行 |
| 资料读取、可见范围、来源与版本 | Knowledge 等 Kit 按局部合同处理已提供数据 |

接下来按[模型与工具接入](basic-usage.md)依次完成文本调用、工具提议与真实执行。ModelRunner.invoke 是一次完整模型调用；多步执行由 App 用既有 Core API 明确编排。参数和错误查 [Core](api/core.md)、[Support](api/support.md)、[Kit](api/kits.md)。

## 资料与输出接入

- [知识资料](knowledge.md)：章节、版本、选择和快照；parse／define 只处理内存数据，不创建存储。
- [知识回答合同](api/knowledge-answering.md)：Knowledge、Answering 和 Presentation 的局部接口，由 App 连接 reader、授权、模型、复核与输出。
- [人工维护](maintenance.md) 与 [Agent 辅助开发](agent-development.md)：共享规则和脚本，用于现有代码及资料的维护。
- [运维](operations.md)：Core 输出、Support observer、App 日志、取消与预算。

有原始资料时据实准备；只有构想时保留空资料和待补项，不将推测或演示文字写为事实。资料增长由现有 App 的授权、存储和更新流程承担。

## 生命周期接线

静态声明可在现有项目的装配阶段校验；用户材料、读取证据、已用预算和会话状态应有明确的请求／会话归属。不要在跨用户共享对象中保存可变的当前请求。

接入前先验证不含真实副作用的小范围行为，再按需求验证真实模型与业务执行。文档中的调用代码不是独立应用模板，也不自动获得发布或操作权限。

## 使用模拟模型调试

没有模型凭据时，可用 [MockGPT Kit](api/mock.md) 配置固定回复、输入相关生成器、工具提议和故障。直接调用从 `@jangts/agent-core/mock` 导入；需要独立 HTTP 模型服务时，从 `@jangts/agent-core/mock/node` 使用 createMockServer。模型客户端连接其本地地址即可，应用的工作流、工具授权和预算合同保持相同。
