# 检查工具整改实施记录

日期：2026-11-24。范围：计划 B。未修改总计划、Skills、文章、示例、公共运行时或 package.json。

## 接手基线与审计

接手时仓库有大量既有暂存与未暂存改动，涉及 Banker、Cafe、Core 运行时、文章与 Skills。B 所属 development/scripts、四份 workflow-development / workflow-inspector 手册、workflow-inspector 与 workflow-development-tools 测试均无既有改动；未 reset、clean、提交或推送。读取根 AGENTS.md、总计划、workflow-inspection Skill、双语手册和视图合同，Core 下未发现额外 AGENTS.md。

- Inspector 已经验证静态引用，保留未知注册状态警告；链保持历史节点、span、覆盖问题，并限制正文投影。这些机制保留。
- Scenarios 已要求且仅允许 verify / verifyError 之一，检查脚本回复全部消费、取消和期限。通过仅指 App 回调接受执行，不能推断回调涵盖所有业务要求。没有证据支持改写调度或验收机制。
- Diff 已将未提供清单标为 compared:false，忽略来源和版本标签，追踪声明的直接使用者。这些机制保留；它不比较函数体、条件语义或端口实现。
- 实际缺口：无警告时报告隐藏引用检查区，未集中呈现声明可用性与证据限制；check 只打印 Checked，diff JSON 没有证据层级，容易把静态通过解释成设计或行为验收。

## 实际修改

- 新增工具内 evidence.mjs，集中描述 inspector 证据：可选清单是否提供、handler / completion / 工具绑定 / 注册状态未知数量、运行链来源覆盖及独立未验证项。显式空列表和未提供保持区分；不引入必填业务元数据或评分。
- Inspector check 保留原 Checked 行，追加静态范围和 JSON 摘要；HTML 单独显示证据范围，与 warnings 分开。export 的旧快照输入输出合同保持不变。
- Diff JSON 新增 evidence，终端明确只比较声明；hasChanges 和退出码规则不变。未知扩展字段继续省略，不输出其值，摘要明确投影边界；未知字段本身不构成工具通过的事实。
- 同步中英文 workflow-development、workflow-inspector 手册，明确注册图、观察链、离线回调、真实模型及生产证据的区别。
- 新增三项最小 fixture 回归；原 inspector HTML 测试增加 evidence 断言。

## 验证证据

具体执行疑问是新增摘要是否保留旧输入、是否区分未提供与空声明、是否诚实保留未知覆盖，以及 CLI / HTML 合同是否仍可运行。仅运行对应工具测试，没有全量构建或全套测试。

默认 PATH Node 不支持 --test；改用本机现有 /Users/ivan/.nvmd/bin/node（v24.9.0），未安装依赖。

首轮命令：`/Users/ivan/.nvmd/bin/node --test packages/agent-core/test/workflow-evidence.test.mjs packages/agent-core/test/workflow-development-tools.test.mjs packages/agent-core/test/workflow-inspector.test.mjs`，13/13 通过。覆盖合法旧输入、未知元数据、未知扩展过滤、非法入口拒绝、精确 runId、来源覆盖未知、diff 缺失清单、scenario 回复计数/恢复/取消，以及 watch 更新与失败保留。格式化后添加 HTML evidence 断言，再复查 evidence 与 inspector 两份测试；7/7 通过，git diff --check 无错误。

静态结构：完成工具范围审计及 git diff --check。离线行为：工具 fixture 与既有 Engine 脚本回复回归。真实模型：未验证。生产：未验证。UI：未启动预览，HTML 仅做生成、投影和脚本语法检查，不声称视觉验收。

## 未覆盖项与跨范围交接

请求图之外的恢复、持久化、未知写入核实与副作用重放必须由 App 端口和断言提供证据；本工具不能从图或 source coverage 自动推断。节点工具声明只是显式声明，不证明动态授权。可选字段提供也不证明内容正确或完整。

无公共运行时元数据扩展需求，无 package.json 变更需求。总线程按现有生成流程同步文档站副本，并交叉核对 A / C / D / E 不将零警告或 hasChanges:false 当成行为验收。本线程不修改生成脚本，也不据此引入新的统一业务合同。
