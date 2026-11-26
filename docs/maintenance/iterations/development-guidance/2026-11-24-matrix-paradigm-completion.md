# Agent Core 矩阵范式补齐与验收记录

## 范围与实现

本记录衔接 development-remediation-plan 的 A/B/C 本地交付，并补齐后续确认的矩阵范式要求。保留已有暂存和未暂存修改，不替换应用流程，不修改 Core 运行合同或发布版本，不发布或部署。

- 检查快照新增可选 lifecycleMatrix：意图参与工具、阶段/工具/钩子/handler、all/selected 范围与适用意图。引用校验覆盖重复 ID、工具与节点引用、非法或空意图范围。未提供矩阵的旧输入继续接受。
- evidence 明确矩阵声明与运行证据边界。HTML 按节点及稳定 binding ID 关联 reported subflow；保留 span 身份，缺失观察不推断未执行。矩阵单元可查看阶段、工具及关联记录；工具反查包括生命周期节点。
- diff 比较 matrixIntents/matrixBindings，跟踪绑定、意图或工具变化直接影响的节点；任一侧缺少可选声明时保持未比较，不改变既有 hasChanges 和退出码语义。
- 可运行 lifecycle-matrix.mjs 使用真实 Tools Kit inspect/authorize/complete/visibleText 钩子、Core Engine、绑定工具授权及公开 subflow 日志。执行和检查说明读取同一份工具/阶段声明。一次模型响应提交 intent/next；呈现贡献工具不自动成为模型可调用工具。
- 双语案例、开发手册、检查器合同、示例索引、节点文章、README 与三个相关 Skills 均已补充矩阵选型与证据要求。文章源在 shared，包内副本由既有脚本生成。版本仍为 0.9.0。

## 已执行验证

- 新增矩阵专项最终13项通过：合并决策、普通交流短路径、全工具与选中钩子范围、仅钩子工具不可调用、非法配对、授权拒绝、模型/工具/呈现失败、取消、快照校验、diff 影响、HTML 运行关联及工具反查。
- 既有 evidence、inspector、viewport、development-tools 四文件14项通过。最终 viewer 反查修正后重跑矩阵13项及 viewport 1项，均通过。脚本直接执行验证成功。
- 三个修改的 Skills 均通过 quick_validate；九篇双语文章生成与 --check 通过。
- 实际 npm pack（ignore-scripts）核对新双语文档、脚本和检查器均在包内；解包示例用已有工作区依赖离线运行成功，不声称全新环境安装已验证。临时包验证后删除。
- Pages 使用现有 generateSite 从 main 当前源重新生成双语手册、检查器链接和案例源码附件；逐项断言矩阵字段、运行关联和入口。没有启动服务或浏览器，没有执行整站静态构建。

## 证据边界

完成的是 Core 开发资产的本地落地与针对性验证。固定 Provider 不证明真实模型语义、首次选择率或生产表现；本只读案例不冒充未知写入、持久化、跨进程恢复或动态扩额的验证，这些合同及原有两种组织对照仍沿其现有入口。HTML 脚本验证使用 JSDOM，不是视觉验收。

矩阵声明是 App 提供的可选解释信息，不是 Core 新增的强制意图系统、钩子调度器或权限凭证。其他应用可保留用例、探索或混合结构。未发布 npm、部署文档站或应用、访问真实模型或生产用户数据。
