# Agent Core 缓存与装饰器实施记录

日期：2026-11-08。计划：[0.2.5 与 0.3.0](agent-core-iteration-plan.md)。本文件记录实际实施、检查与发布证据，不替代正式 API。

## 0.2.5

已实现 Engine 实例级、全实例最多 1024 项的同步 LRU；可配置写入 TTL，缓存值保留原引用。节点只写／删／清自己的分区，get 允许显式跨节点读取。低层循环使用固定 `$step` 分区。

agentCache 为可选异步 App 端口，volatile 与 persistent 地址独立、不回退。Core 固定节点地址与接收者，检查本次取消；外部写入不能承诺取消回滚。fork 新建内存，保留容量配置；App 端口只能通过 resume 显式重新提供。

自检按代码检查标准选取接口、类型、状态、资源、隔离、验证与交付条目，针对缓存边界实施，不做容量／性能实测。SDK 全量 792 项通过；新增缓存专项包含 4 项，类型／双格式公开 API 6 项通过；Banker 真实 Agent 源码离线回归 23 项通过；网站 Agent 工作流、完成及离线可靠性 24 项通过。两服务端 TypeScript 编译通过。未运行真实模型、运行数据库维护或 UI 视觉检查。

全量回归发现既有 VectorSearch 缺陷：filter 与 groupBy 共用可变 metadata 快照，违反已有隔离回归。已分别给 filter、groupBy 和输出提供独立副本，原失败用例与全量复查通过。

首次两端回归与 SDK 清理／重建重叠而读取不到 dist，结果作废；SDK 构建结束后重跑。网站 HTTP fixture 的回环端口需要沙箱外执行，获工具批准后完成。npm 缓存默认路径不可写，改用根 .tmp 内隔离缓存，未修改用户 npm 目录权限。

[包体与校验摘要](../releases/0.2.5.json)记录 npm pack 的 integrity、shasum、SHA-256、大小与检查数量。已解包验证所有 export 目标存在，ESM／CJS 两种产物的缓存跨 run 读写通过，包内代码与当前构建一致。包体路径为根 .tmp/agent-core-releases/0.2.5/jangts-agent-core-0.2.5.tgz；已检查发布白名单，不含环境文件、凭据文件、运行库或 0.3.0 装饰器实现。

公开 npm 发布被自动审批拒绝：要求对具体 tarball 与公共目标 registry.npmjs.org 明确批准。用户随后明确批准相同包体及公开目标，重试 npm publish 返回成功；integrity 与 shasum 与封存包一致，npm 公共仓库已查询到 0.2.5，完整性值逐项一致（首次处理中返回 404，后续重新查询已可读）。未绕过审批。文档站静态构建与 check 均通过，双语成品 sourceSha256 为 `6ba289b857e92270e013fe7bfdf6e966998c91f7389e9f0e79e1d9ee7767a5be`；未部署文档站。首次在构建结束前读取了旧成品，校验失败结果作废；待构建结束后重新核对通过。

## 0.3.0

已在 0.2.5 发布后完成实现、自检与 0.3.0 发布；范围为类装饰自动实例化、实例方法装饰绑定原对象及显式定义池，不增加运行框架。

### 0.3.0 实现与自检

已实现独立 `/support/decorators`：node、tool、fragment 支持类与实例方法；workflow、agent、model 支持配置类。装饰器提供 id，类无参构造一次，保留原型、getter、私有字段与 this._xxx；不创建 Engine／Runner。底层转换函数不公开。原 defineTool、defineWorkflow、defineContextFragments 及模型快照继续拥有原检查。

方法通过标准初始化钩子自动绑定原对象；构造成功后 pool.registerFrom(instance) 批量登记，不接受方法 pool 参数，避免构造中途失败时共享池泄漏半初始化实例。DefinitionPool 复用 ProtocolRegistry，预检冲突后写入，提供读取、选择和封存；definitionOf 读真实 owner 自身记录，不依赖全局表／WeakMap。标准编译与 Nest 旧版编译边界明确；没有将 Nest 源码直接改为标准装饰语法。

最终 SDK 799 项通过，包含严格 ESM／CJS 正反类型、真实标准装饰语法运行、原对象私有状态与多实例绑定、构造失败及登记原子性、跨格式读取、打包 tree-shaking。Banker 原有 23 项、网站原有 24 项回归通过；额外装饰适配 fixture 调用了实际 SiteRun 与 Banker dispatchDecision。两端 TypeScript 复核通过。上述 App 使用离线合成依赖，不等于真实模型或生产部署验证。

0.3.0 的 619 个既有编译文件与已发布 0.2.5 逐字节一致，新增行为仅在可选装饰子路径。ESM／CJS 解包产物的所有 export 路径及装饰类私有字段／构造次数／互读通过。SDK API、Skill、四组双语网站配方已同步；四组示例严格类型检查及离线执行通过。文档站构建／check 通过，sourceSha256 为 `0d04db0a85ebcd5d72ea94f9e306a8fa2c58dd73e6f3a0c3763730a8e95eafa3`。未预览 UI 或部署网站。

workspace 与定向 Prettier 检查通过。打包测试显式声明 esbuild 0.28.2 为开发依赖，无新增运行时依赖；workspace 检查发现根锁缺少该版本 26 个平台可选元数据，在隔离目录生成官方锁后仅补缺失条目，保留既有条目并复查通过，没有放宽门禁。实际 App 依赖与根锁中的 agent-core 引用同步 0.3.0。

[0.3.0 包体与验证摘要](../releases/0.3.0.json)记录校验和与实际结果。包已封存于根 .tmp/agent-core-releases/0.3.0/jangts-agent-core-0.3.0.tgz，1133863 字节，SHA-256 为 `e210caacff039d50dd4d7971fc5ec2964f23e18e53387737ccbb1245860fa38c`。首次发布被自动审批拒绝，要求针对这份 0.3.0 包体与公共 npm 目标单独确认；用户随后明确批准，重试 npm publish 成功，回执 integrity／shasum 与封存包一致；没有绕过审批。维护记录不随 SDK 包发布。

仓库统一 `npm run build:packages` 已通过，包含安全依赖检查、生成一致性与全部公共包构建。此前各阶段 SDK 定向构建和回归分别留证；统一入口未触发应用服务、运行库或 UI 预览。

最终 npm 公共查询确认 `0.3.0` 已可读取，integrity／shasum 与获批封存包一致，`latest` 指向 `0.3.0`。0.2.5 与 0.3.0 两阶段均已完成发布，独立 JSON 回执保留各自包体哈希和检查摘要。

## 后续撤回与未发布修正

用户要求完全撤下 0.3.0 并恢复 latest 至 0.2.5。latest 已恢复且公共查询确认；npm unpublish 指定版本返回 E403，现有 granular bypass-2FA token 不允许撤包，0.3.0 目前仍存在，不标记撤包成功。随后完成官方临时网页登录及操作级认证，指定版本撤包成功；公共版本列表不再包含 0.3.0，latest 为 0.2.5，未撤其他版本。临时会话已注销并清除，不改原发布凭据。

本地新增 Node、Tool、Fragment、Workflow、Agent、Model 具名实现合同，替代使用者重复书写 Omit；底层去 id 类型变换保留 Agent 配置联合分支的约束。同步示例及 API 参考，补充 getter 路由说明。统一公共包构建通过，装饰器定向 6 项通过，包含正反类型及 getter 快照／最新 state／原实例私有辅助的回归。本地修正未重新发包，不改写已发布 tarball 的证据。

撤回最终核对：`versions` 保留 0.0.0-stage、0.1.0、0.1.1、0.2.0、0.2.1、0.2.5，不再含 0.3.0；`latest=0.2.5`。0.3.0 版本号不可复用，本地具名类型及 getter 回归修正未发布。

## 未发布：共享池与命名空间读取

按使用路径收敛为每类型一个共享读取池：nodePool、toolPool、fragmentPool、workflowPool、agentPool、modelPool。不再公开 DefinitionPool 创建／写入／封存、definitionOf owner 查询或 registerFrom。装饰器 ns 接受 string 或 readonly string[]，默认 default；同类型同空间 id 唯一，不同空间可同名，不重写原 id。get(id, ns?)、getAll(ns?)、pick(ids, ns?) 统一按单个命名空间读取；pick 保留数组参数与顺序。重复空间去重，多空间登记共享同一对象，先全部预检，冲突不留下部分写入。ESM／CJS 在同一 realm 内共享池，独立进程／Worker 不共享。

方法装饰改为标准实例初始化时自动绑定并登记，取消手动 registerFrom；这是对先前“构造成功后批量登记”合同的明确替换。初始化钩子先于字段／构造体执行，不调用 handler；App 在宿主构造成功后读取执行。构造失败不回滚已登记项，作为装配失败处理，不再声称具备先前显式登记模式的构造失败回滚保证。池持有长期服务实例，同类型同空间同 id 的第二实例拒绝，不覆盖原绑定。

专项复查覆盖接口缺省与分组（I01/I04/I05）、实例与接收者（I07）、公开面（I11/I13）、多空间冲突原子性与原执行边界。修正读取池 Agent 泛型过窄问题：异构存储仅擦除 App 参数，保留原配置联合分支，原装饰器仍要求具体 App 配置完整。未修改 Core 执行、预算、授权、取消及缓存代码。

根 npm run build:packages 通过；定向 node --test decorators.test.mjs decorators-consumers.test.mjs 共 8 项通过。包含严格 ESM／CJS 正反类型、命名空间隔离／默认值／多目标原子性／原对象共享、方法绑定、getter 路由、tree-shaking、实际网站 SiteRun 与 Banker dispatchDecision 离线调用，另含四组网站示例的严格类型检查和执行。首次定向检查发现 Agent 读取泛型误拒绝合法 App 配置，修正后上述检查通过。双语 API、Skill、网站配方、生成 API 参考及草案 v2.7 已同步。未运行全量 SDK／应用回归、启动应用、UI 预览、真实模型或生产操作；当前修正未发包，不修改已封存的发布证据。

## 0.3.1 发布

用户明确要求发布后，以 0.3.1 承接具名类型与命名空间池修正，不复用已撤销的 0.3.0。SDK 及 server、banker-api、cafe、文档站的依赖声明与根锁同步版本。统一公共包构建通过，SDK 全量 800 项通过；此前命名空间定向 8 项包含两端 handler 与四组文档示例。网站源稿重新生成，无未文档化运行符号；未重新构建静态网站或部署。

封存包为根 .tmp/agent-core-releases/0.3.1/jangts-agent-core-0.3.1.tgz，1137663 字节，SHA-256 为 8ebbfc4cf21d0eacf20aa9bfb7e965ccfb65a4092632986128c380d5ad380900。包内所有 exports 目标存在，无凭据、环境文件或运行数据库；解包 ESM／CJS 共享池、命名空间、私有字段接收者与单次构造验证通过。0.2.5 既有 619 个编译文件逐字节不变。

沙箱首次发布因 DNS ENOTFOUND 失败；获得工具联网批准后重试同一封存 tarball，npm publish 返回 0，integrity 与 shasum 均与包体一致。npm 提示后台处理中，初次公共查询 404，等待可用后核对 latest 与完整性。包体与验证摘要见 [0.3.1 回执](../releases/0.3.1.json)。未重发其他版本，未执行应用部署、UI 预览或真实模型调用。

最终公共 registry 核对：0.3.1 已可读取，latest=0.3.1，integrity 与 shasum 逐项匹配封存包；发布完成。

## 0.3.2：README 修订与替代发布

README 保持英文在前、中文在后及原语言锚点结构，扩充安装、可运行工作流、真实模型配置、工具调用／模型选工具、装饰器、知识读取和任务导航，移除仓库内部审计流程。7 组去重双语示例已验证：离线工作流、工具与资料执行，注入 MockGPT 的模型与选工具调用，标准装饰器严格类型检查及执行，手册链接源文件存在。无真实模型请求、UI 预览、应用启动或部署。

用户要求撤下一版再发布新版，0.3.1 指定版本已撤下；未改 0.2.5 等其他版本。常规 token 撤包 E403，临时官方网页登录及操作级认证后 npm unpublish 返回 0。0.3.2 原 token 发布 EOTP，改用同一官方临时会话及发布操作认证后 npm publish 返回 0。没有绕过 npm 认证。

0.3.2 包为 1140648 字节，SHA-256 c493c5fde11c1a4b69a1bafc9dfdc55eaa0114bf585064ec2e8f3b60844e3453；所有 631 个编译文件与 0.3.1 逐字节一致，全部 export 目标存在，英文／中文顺序与包内 README 一致。只有 README、变更说明及版本元数据修订，不重复构建或运行既有 800 项 SDK 回归。SDK 及消费方版本与根锁同步 0.3.2。包体与验证摘要见 [0.3.2 回执](../releases/0.3.2.json)。

最终公共 registry 核对：0.3.1 不再存在，0.3.2 可读且 latest=0.3.2，integrity／shasum 与封存包一致。npm 公共元数据 README 与本地发布正文一致，英文在前；README SHA-256 为 6fd6c422a7c96c2fcb1ec0c25fe0e0ef05d9d49193fa4f5881691e95b0fd24a2。临时网页登录会话已注销并删除，未改原发布凭据。

## 0.3.5：搜索词修订与替代发布

用户明确指定撤下 0.3.2 并以 0.3.5 替代。官方临时网页登录后单版本撤包及 0.3.5 发布均返回成功，631 个编译文件与 0.3.2 逐字节一致；仅补装饰器关键词、变更说明及版本元数据，README 保持英文在前。三个公开包的发布来源、包体、验证与公共元数据证据见根 docs/maintenance/public-package-publication-2026-11-08.md；本轮没有应用或文档站部署。

0.3.5 最终公共核对：latest=0.3.5，0.3.2 不在版本列表；README、keywords、integrity 与 shasum 均匹配实际包体，临时会话已注销清除。
