# C：可运行参考整改记录

## 接手基线与边界

2026-11-24，在 `main/` 实施。已读根 AGENTS.md、总整改计划、workflow-design / resilience-review / budget-optimization 开发 Skill，以及公开 workflow、模型额度合同和既有服务示例。packages 下未发现额外 AGENTS.md。既有全仓存在大量暂存与未暂存变更（包括 Banker、Cafe、Core 运行时、文章等），全部保留；接手时本次涉及的 examples 索引、examples README 和专属新增路径没有既有修改。总计划不改；不 reset/clean/commit/push，不构建、部署、发布、改数据库或启动 UI。

## 实际修改

- `development/docs/examples/organization-comparison.mjs`：沿用既有服务状态案例主题，提供两个真实 defineWorkflow（用例节点、受约束调查循环），共享事实、handler、工具目录、脚本化模型和结果合同。无额外依赖，无平行 scheduler。
- 同目录双语说明：说明为何选择责任边界、何时合并/升为节点、状态交接、模型不可替代判断、生命周期与恢复边界；不按节点数评分。明确循环是有限调查参考，并非开放式研究 Agent。
- 双语 examples 索引和 `development/examples/README.md`：补可达入口。
- `test/reference-organizations.test.mjs`：专属最小离线回归，每种组织覆盖十个行为案例。

## 最小验证与证据

具体执行疑问是公开 0.9 API 的 request-local 额度调整、Core 自循环提交及取消是否与示例预期一致，未知写入是否实际只执行一次。因此执行专属离线回归与示例，而不跑全仓检查。

命令均在 `main/`，用 `/Users/ivan/.nvmd/bin/node`（v24.9.0）。shell 默认 `/usr/local/bin/node` 过旧，首次执行在依赖的 `??=` 语法处退出；没有因此修改依赖或源码兼容目标。

```sh
/Users/ivan/.nvmd/bin/node --test packages/agent-core/test/reference-organizations.test.mjs
/Users/ivan/.nvmd/bin/node packages/agent-core/development/docs/examples/organization-comparison.mjs
PATH=/Users/ivan/.nvmd/bin:$PATH npm pack --workspace @jangts/agent-core --dry-run --ignore-scripts --json
```

- 离线行为：20/20 通过。断言实际节点访问、model 调用、工具顺序与写入次数，而非仅验证静态声明。
- 正常路径两种组织均两次模型调用（理解、事实解释）、一次写入；实际工具顺序 read/save/optional。初始额度 1，在已使用 1 后扩到 2；保留已计费次数。
- 可选检查失败保留答案与确认回执；同范围证据/已确认回执不重复读取或保存；未知写入只执行一次，随后查询权威回执，仍未知则明确 pending。
- 长记录投影从 10096 字符到 85，实际第二次模型输入包含来源而不含冗余；这不是 token、账单或性能测量。
- 缺前提、读取失败不虚构结果；模型失败或硬边界保留带来源事实；取消拒绝运行且不发出后续可选调用，之前提交的答案与回执保留在 App state。
- 静态分发：pack dry-run 确认双语说明与可执行 mjs 都在包内。利用现有 `development/docs` 白名单，无需改 package.json。未生成或发布 tarball。
- 新源码已按根 Prettier 格式化；索引与 README 的 `git diff --check` 通过。

## 未验证与交接

真实模型、真实存储、跨进程恢复、交付后的持久化/连接失败、生产性能均未验证；脚本 Provider 不证明语义理解。示例回执表为内存 fixture，恢复时仍须宿主持久化状态、核对授权与请求键，Core checkpoint 不是外部写入事务。

本次没有发现阻止两种组织运行的公共 API 缺口，无新增公共运行时、跨 App 契约、package.json 或生成脚本需求。总线程需将新增双语来源纳入其现有文档站同步流程；本线程不手改站点生成副本。总计划更广的格式修复失败、交付连接失败覆盖仍由相应真实 App/宿主负责，不以本例通过替代它们。

## 最终审校与修正（同日，以下取代前述组织结构描述）

审校确认初稿的固定 `phase+1` 循环只重排技术阶段，没有展示证据驱动探索；初稿部分 catch 也未显式检查取消。这两项不是已通过 20 项测试可以掩盖的质量结论，已实际修正。

- 用例式 `explain-status` 现在拥有从读取、补齐证据到解释成果的一整个业务用例，返回时提交证据、缺口与答案。边界以可消费解释成果为依据。
- 探索式不再有 phase 数字或固定执行数组，`nextWork` 从当前证据与未解决问题选动作：online 直接解释，degraded 补 incident，changing 补 deployment。补读无新证据只尝试一次，留下缺口后交付已知状态。Core 自循环继续拥有调度。
- 两种组织仍共享同一事实、工具和输出合同。脚本 Provider 的解释输出读取实际传入事实，不再无视事实始终返回 online；它仍不是语义能力证据。
- 公开 `Support.assessModelBudget` 评估剩余一次解释工作，再按 expand 建议调整额度；测试断言 assessment 和已使用次数。
- 长记录处理正式称字段投影；没有语义压缩、摘要调用或压缩质量证明。
- save/receipt 均传相同 scope/request key，授权由同一目录逐次核对，确认回执复用同时校验 scope 和 key。新增回执读取失败、授权拒绝后保留答案及 pending 的测试。
- 新增局部格式修复函数，仅传入 answer，不持有工具/模型上下文。格式修复失败保留答案与回执，模型次数仍为 2，写入次数仍为 1。未声称实现了模型式格式修复。
- read/draft/save/detail/receipt catch 均先检查取消；新增理解、读取、生成、保存处中途取消断言，拒绝运行且不进入回执恢复或可选检查。

最终专项验证：`/Users/ivan/.nvmd/bin/node --test packages/agent-core/test/reference-organizations.test.mjs`，42/42 通过。因组织与错误分支有实质变化，复验同一专属文件；没有运行无关全套。新增断言记录实际探索动作、工具顺序、事实进入模型、成果进入交付、回执授权输入与效果次数，而不只核对图声明。源码仍走公开 AgentCoreEngine / defineWorkflow / 工具目录 / 模型运行时及观测事件；fixture 只提供外部工具和模型的可控响应，不驱动 Core 路由或伪造事件。

边界仍为静态与离线行为。跨进程恢复、真实存储、语义压缩、真实模型判断、真实生产故障与性能未验证。无跨范围公共 API 需求；双语来源及 npm 可达路径保持原入口，A 可继续关联，无需改 A 文件或总计划。
