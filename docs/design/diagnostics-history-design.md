# 日志回查与复盘

Core 产出同源执行事实，App 管理日志存储、保留和读取权限。调用合同见[日志与调用链](../../packages/agent-core/development/docs/api/observability.md)及[复盘、分支和资料发布](../../packages/agent-core/development/docs/api/advanced-agents.md)。

## 存储与读取

App 将 Core 事件平铺代记，使用 run、span、invocation 和分支身份关联实际调用。文件 reader 和 inspect CLI 属于 App 侧适配，不赋予 Core 扫描磁盘或数据库的权限。缺失记录不能证明没有执行。

## 模型复盘

Reflection Kit 在 App 提供的 source、authorize 和 ModelRunner 上组织有界复盘。每次查询检查真实账号与范围，只投影获准元数据。报告区分 observed、hypothesis 与 recommendation；observed 引用实际返回的证据 ID，报告保留覆盖缺口、到期和预算限制。

日志读取、交给模型处理和披露结论分别授权。日志正文及模型输出是低可信数据，不能成为新的系统指令。模型结论不自动修改能力、代码、资料或权限；保存和采用均由 App 的真实端口决定。

## 身份与生命周期

日志中的时间、span、父 span、调用身份与分支身份保持实际含义。动态报告的子步骤是节点上报信息，不证明内部真实调度。读取或交付时来源到期应拒绝，不能以先前授权替代当前有效性校验。日志与报告的存储、删除及源 reader 的关闭由 App 负责。
