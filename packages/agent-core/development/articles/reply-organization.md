# 组织答复的事实、格式和参考

比较两个完整商品集合时，一边有 82 个唯一商品，另一边有 65 个，共有 64 个。应用可以准确算出缺少 18 个、多 1 个，再让模型解释差异。排序未比较、价格源不可用，应和已计算的数字一起进入答复材料。引文、语气示例和业务事实各有用途。

## 决定哪些内容由程序确定

- 已发布且适用的说明可原样使用，动态数量与权限由源数据和程序计算。
- 自由文本可以交给模型组织，随后核对关键事实、限制和语义。
- 输出需要被界面或服务解析时，用 `Presentation.defineOutputCatalog` 区分生成字段、绑定字段、常量和受控语义选择。先完成异步读取，再绑定当前请求的值。模板占位和引用是否适用、渲染是否安全，由应用验证。

有事实参考时检查当前数据范围和版本。表达参考只提供组织或语气。旧数字和对象不得混入当前材料。可用的答复格式通过 `Presentation.defineReplyFormats` 从已声明候选中选择，未命中也可以正常交付自由文本。

在商品对照中，模型输入可以将来源范围、计算结果和未比较项目分别编码。若发现任一集合只是分页片段，就撤回缺少与多出的数量，保留该页观察到的项目。对使用动态模板的界面，`Presentation.defineTextTemplate` 只做一次替换，`Presentation.defineSemanticSlots` 检查声明的命名空间、选项和出现次数。应用仍需检查名称含义，例如合法的数量槽不能配上“价格”标签。

## 为本次答复设置详略

`Support.resolveReplyGuidance` 按应用默认、当前节点、适用工具、本次调用的顺序解析可信配置，由 App 把结果传给 `ModelRunner.invoke` 或在 `prepare` 时传入 `replyGuidance`。多个工具默认值冲突时，须在调用处明确选择。允许 `brief`、`normal`、`detailed`。它给模型增加简短指令，仍保留用户明确要求、必要限制及输出协议。准备句柄包含这一选择，调用时不再重复传入。

指令随已准备的交互进入实际发送及输入计量，输出长度仍由相应的调用约束和应用检查控制。面向新手的解释、专家摘要与品牌语气可用可信指令或少量表达参考组织，并保留相同的已确认事实。

## 验证答复和写入分别成立

让保存工具先返回实际回执，再注入正文格式错误。修复可以重新组织正文，写入计数应仍为一。用来源检查数字和资格条件，以真实模型样本评估语气和详略。

```sh
sdk=./node_modules/@jangts/agent-core
runner="$sdk/development/skills/agent-core-app-testing/scripts/test-agent.mjs"
node "$runner" --fixture "$sdk/development/skills/agent-core-reply-development/examples/facts-and-reference.mjs"
node "$runner" --fixture "$sdk/development/skills/agent-core-reply-development/examples/presentation-and-style.mjs"
```

[答复开发 Skill](../skills/agent-core-reply-development/SKILL.md)提供示例和答复快照检查。该检查能发现声明关系问题，业务回执仍需在实际执行用例中验证。[Support 答复指导](../docs/api/support.md)

[技术分享目录](README.md)
