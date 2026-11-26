# 覆盖范围与改造可行性

本页维护接口整改范围、落地约束和验收条件；当前结果见[实施记录](api-implementation-status.md)。[返回API](../../../packages/agent-core/development/docs/api/README.md)。

## 文档覆盖

现行手册覆盖共同规则、全部 package exports、单项 Kit、连贯示例与迁移要求。[公开符号参考](../../../packages/agent-core/development/docs/api/reference.md)由 package exports 与 TypeScript 实际导出生成，每个符号链接精确声明和源码。新增导出后运行 docs:api 更新索引。

主要概念、默认值、失败与取消规则在对应章节；完整重载、泛型和小型纯函数的参数以链接的声明为准。手册只维护现行签名；迁移表用于辨认已移除的写法。invoke 不按输入切换输出。

以下为本轮package.json.exports的覆盖映射。具体符号从实际源码生成，不以入口覆盖代替逐符号清点。

| 现有入口 | 目标合同归属 |
| --- | --- |
| `.` | [Core、Support与共同类型](../../../packages/agent-core/development/docs/api/core.md) |
| `./engine` | [Engine／Workflow；旧构造别名迁移](../../../packages/agent-core/development/docs/api/core.md) |
| `./model` | [ModelRunner与输入输出](../../../packages/agent-core/development/docs/api/core.md) |
| `./types` | [类型入口收敛；旧类型转出](../../../packages/agent-core/development/docs/api/types.md) |
| `./structs` | [运行值与类型分离；旧路径转出](../../../packages/agent-core/development/docs/api/types.md) |
| `./context` | [上下文构造与Core策略](../../../packages/agent-core/development/docs/api/support.md) |
| `./journal` | [单一调用身份与Journal](../../../packages/agent-core/development/docs/api/core.md) |
| `./events` | [保留交付迭代与显式流转换](../../../packages/agent-core/development/docs/api/knowledge-answering.md) |
| `./errors` | [Issue与统一错误视图](../../../packages/agent-core/development/docs/api/types.md) |
| `./tools` | [低层执行器](../../../packages/agent-core/development/docs/api/core.md) |
| `./protocols` | [通用Registry；非业务协议不强加实体](../../../packages/agent-core/development/docs/api/types.md) |
| `./sse` | [标准SSE字段保留](../../../packages/agent-core/development/docs/api/support.md) |
| `./json-transport` | [JSON切帧与解析](../../../packages/agent-core/development/docs/api/support.md) |
| `./diagnostics` | [事件身份与格式迁移](../../../packages/agent-core/development/docs/api/core.md) |
| `./kits/knowledge` | [knowledge局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/knowledge-answering.md) |
| `./kits/presentation` | [presentation局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/knowledge-answering.md) |
| `./kits/answering` | [answering局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/knowledge-answering.md) |
| `./support` | [Support统一命名空间](../../../packages/agent-core/development/docs/api/support.md) |
| `./kits/normalization` | [normalization局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/delivery` | [delivery局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/projection` | [projection局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/aggregation` | [aggregation局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/retrieval` | [retrieval局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/evidence` | [evidence局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/policies` | [policies局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/candidates` | [candidates局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/text-skills` | [text-skills局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/interaction` | [interaction局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/intents` | [intents局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/tools` | [tools局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./support/context` | [上下文辅助](../../../packages/agent-core/development/docs/api/support.md) |
| `./support/model` | [供应方与传输辅助](../../../packages/agent-core/development/docs/api/support.md) |
| `./kits` | [全量入口转出单项同一实现](../../../packages/agent-core/development/docs/api/kits.md) |
| `./mock` | [保留测试用Mock Provider；遵守迁移后的ChatProvider，生产不自动启用](../../../packages/agent-core/development/docs/getting-started.md) |
| `./kits/search` | [search局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/inference` | [inference局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/vector-search` | [vector-search局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/rank-fusion` | [rank-fusion局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/artifacts` | [artifacts局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |
| `./kits/durable` | [durable局部API；沿用本页未改变的领域规则](../../../packages/agent-core/development/docs/api/kits.md) |

## 源码复核后确认的设计约束

| 问题 | 修订后的合同／实施要求 |
| --- | --- |
| 只有泛型Output，没有传输ID到类型的关系 | creator保留字面量ID；runner保留只读传输元组，已知ID推断、动态ID返回unknown；不使用调用方自报泛型 |
| ModelCapability的输入schema误称Output | 泛型为能力参数Input，模型选择与工具实际Output分开 |
| 模型能力旧parse承载阶段转换，直接删除会破坏App协议 | 保留resolve及stageId；工具提议保持原始入参，真实调用只解析一次 |
| 文本没有ModelSelection，不能直接复用结构化collector.finish | PreparedModelTransport使用通用collector.finish(): Output；文本与结构化传输均实现同一收集合同 |
| authorize的void签名仍可能接收返回false的函数 | 执行器必须检查实际完成值，非undefined拒绝；同步thenable拒绝并消费迟到拒绝 |
| 返回封装会破坏旧调用与继承覆盖 | 同一包版本原子迁移调用者；不按输入切换新旧返回；迁移call覆盖及parseResult、向量探针 |
| 外层Kit与Core重复生成调用ID／记录成功 | 一次真实执行只有一位记账所有者；嵌套上下文传递同一ID，独立子调用关联父ID |
| 暂态lastCall／嵌套调用可能导致回执错配 | 成功结果持有自身完成记录；子调用独立记录，不能事后读取共享lastCall给外层结果填元数据 |
| parser／Map／类实例不能一律深拷贝冻结 | 纯配置复制；方法绑定原接收者；不复制冻结App服务；具体业务快照声明自己的复制范围 |
| 注册查询承诺返回完整实例，实际只保存部分字段 | 查询类型对应真实登记投影，保留 App 数据元信息及规范方法；额外实例 helper 不冒充已登记方法，策略回调仍获得原实现 |
| JSON Schema泛型不能自动证明业务类型 | 裸schema默认unknown，有类型parser／compiler才建立Value关系 |
| fallback的undefined同时代表业务值与未处理 | handled/unhandled显式判别，合法undefined不丢失 |
| 新造气泡归一／交付API改变原有迭代背压 | 保留replyBubbleTexts／publishReplyEvents及流转换；只迁命名请求和context，不强制新增sink门面 |
| 持久合同与运行字段不一致 | App 与 SDK 同步使用当前检查点、索引和引用结构；只校验当前格式，不引入旧版本读取或升级路径 |

## 落地依据

本轮复用原有 schema 解析、工作流、工具执行、调用预算、取消和 observer 隔离机制完成迁移。实际消费者同步升级：两个后端及 cafe 协议／流消费者使用现行入口；其余三端当前无 agent-core 源码导入。源码、测试、离线示例与开发脚本分别核对，开发脚本也按当前运行合同调用。

本地验证直接导入生产包，覆盖ESM／CommonJS公开类型、已知传输ID推断、工具select收窄、动态unknown、同形输出、assert拒绝、同步误接、接收者、子调用身份、observer隔离、sink背压、当前持久结构和期限／预算保持。连贯示例经过checkJs编译与离线执行。完整结果见完成记录；不把早期设计原型当作实现证据。

## 保留的边界

- 开发期旧参数、类型别名与平行执行入口已经移除；现行聚合路径只转出同一实现。持久数据只接受当前结构；外部错误格式由明确的输入适配处理。
- App原有wire字段、领域分类和业务状态仍由App拥有；不会为拼写整齐改写外部协议。纯算法与真正的执行生命周期明确区分。
- 未来图形实验、链查询服务、Bus路由和回放未实施，不属于本轮API落地。日志已提供可关联的基础事实，存储授权、正文开关和保留期保持原边界。
- 本次未访问真实模型、启动UI、部署或写运行数据库。本轮不迁移旧持久记录，不清库或批量改写数据。
