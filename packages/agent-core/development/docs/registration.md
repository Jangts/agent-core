# 注册、装配与执行

[返回开发指南](README.md)

## 常规工具接入

优先把静态工具定义放在独立、可阅读的类型化清单中，使用 Support.defineTool 保留单项类型，交给 Support.defineToolCatalog 装配。每项包含 id、kind、description、inputSchema、authorize、execute 和 parseOutput；inputSchema 同时提供 jsonSchema 与 parse；模型能力与执行注册消费同一份定义。完整代码见[工具接入](basic-usage.md#工具只声明一次)。

按请求建立 catalog.bind({ app: context, execution: { signal } })，模型先产生 ToolProposal，App 再调用 runtime.invoke。后者复用 Core ToolRegistry.invokeAsync，依次进行输入解析、实际授权、执行和输出检查。可用集合变化时用 catalog.select(ids) 投影同一清单，执行时仍检查真实身份。这个 Support 适配器不替代工作流或 Kit 的业务规范。

## 两种不同的登记

| 登记对象 | 目的 | 更新方式 |
| --- | --- | --- |
| 工具／模型能力／工作流／检查／输出 | 声明程序能做什么、何时可用、接受什么、由谁实现 | App 编译清单，按阶段和真实身份提供可用集合 |
| 文档／章节／资料版本 | 声明某次读取能看到哪些内容 | App 加载来源并创建 Knowledge 目录；更新时显式重建目录和相关视图 |

增加一篇资料通常不需要增加一个工具。可以保持一个 `knowledge.read`，由本轮授权目录提供合法 document／section ID。模型可从已提供的集合提出读取请求，不能据此注册任意新 handler、发现磁盘目录或发布资料。

## 一份清单应说明什么

至少可读出：稳定标识、用途、输入与输出、真实执行入口、可用条件、读取范围、副作用、错误和回执。优先从清单派生模型可见目录、schema 和引用校验；不要维护一份 prompt 能力列表、另一份实际执行列表。

- `ModelToolRegistry` 登记模型可提出的结构与 `inputSchema`、`resolve`。inputSchema.jsonSchema 用于模型声明；业务解析、值域和授权仍要由程序执行。
- `ToolRegistry` 登记 `id/kind/parseInput/execute/parseOutput`。invoke 用于同步实现，invokeAsync 会等待异步执行再检查输出和记录结果；不要把 Promise 当作已完成结果交给同步入口。
- `AgentCoreEngine` 的工作流节点声明 `requires/provides/routes/onErrorNodeId`。只提交通过取消与状态合同检查的更新；分支按声明顺序选择。
- `Support.defineContextFragments` 装配请求输入与片段。信任、来源和预算由 App 正确标注，不是客户端自报即可接受。
- Knowledge、Answering、Presentation、Interaction、Domain Tools、Tools 各自拥有局部契约，按业务需要选择。它们不由 Core 自动安装。

具名构造器、静态辅助、实例方法见 [Core](api/core.md)、[Support](api/support.md)、[Kit](api/kits.md)。

## 模型提议与实际执行要分开

```text
服务端建立身份和可用能力视图
  → 模型提出 capability + 参数
  → Core 收集完整响应，经 inputSchema.parse 校验后调用已登记 resolve
  → App 选择实际执行入口
  → 工具参数解析 → 按服务端身份授权 → execute → 输出检查
  → 程序记录实际来源／执行回执
  → 生成、检查、绑定及交付
```

`parse` 不应顺手执行写入、发送消息或调用业务工具。也不要因为模型说“已经完成”就生成成功回执。跨端动作采用 Interaction Kit 只是选择了一套可选交换规范，仍需 App 实现对端 handler、身份、权限及实际结果确认。

## 静态清单与请求内视图

已知工具及局部协议适合在启动时登记。授权、页面环境、当前租户和允许的资料会随请求变化，应在本轮装配时投影成可见集合。模型可见性限制不替代执行时授权。

需要新文档即时可用时：加载新资料 → 校验目录和任务引用 → 建立新版本目录 → 原子切换 App 的当前引用。现有请求继续持有其旧目录与快照；新请求使用新目录。不要在同一回答中混用重载前后的正文、schema、来源和 revision。

需要真正动态增加程序能力时，由 App 明确决定代码来源、发布和登记时点，重新构造相应注册表。库没有模型驱动的任意代码安装、自动文件发现或热卸载平台。

## 启动和请求各自检查

| 时机 | 应检查 |
| --- | --- |
| 启动／发布 | handler 是否存在；节点和输出引用是否有效；资料／章节是否存在；Skill 的 tools 是否真已登记；参数 schema 与解析器是否一致 |
| 请求开始 | 身份、资料访问范围、预算、signal、当前目录 revision 与能力集合 |
| 真实执行前 | 当前权限、资源归属、参数值域和必要确认 |
| 交付前 | 工具结果合同、来源和数字、生成字段、程序绑定字段、输出完整性 |

某个 Kit 的 validator 只能验证它知道的局部结构。它不知道你的租户、存储路径、数据权限或业务事实；这些检查不能因为“已用 creator”就省略。
