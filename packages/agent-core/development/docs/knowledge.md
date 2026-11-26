# 知识资料、章节与版本

[返回开发指南](README.md) · [Knowledge API](api/knowledge-answering.md#knowledge) · [完整回答链](api/knowledge-answering.md)

## 库如何知道你的资料结构

Core 不扫描资料目录、不根据文件名推断知识库，也不从 Markdown 标题自动生成章节。App 显式执行以下链路：

```text
App 读取受控来源
  → 提供 id、revision、locale 和正文／结构
  → Knowledge.parseKnowledgeDocument（仅在使用文本锚点时）
  → Knowledge.defineKnowledgeCatalog
  → App 检查任务的 document／section 引用
  → 按本轮允许的读取请求 catalog.read
  → 将 KnowledgeSnapshot 作为证据交给后续 handler
```

这套结构是选用 Knowledge Kit 后的局部规范，不是所有 Agent 必须存储的文档格式。App 可以直接生成 `KnowledgeDocument.parts`，不经过 Markdown 解析。

## 开发期准备工具与运行期装配函数

| 入口／资产 | 作用 | 不会做什么 |
| --- | --- | --- |
| [维护指南](maintenance.md) | 在项目中准备资料；有来源则据实整理，无来源则空资料 | 资料须有真实来源，想法不作为事实 |
| `Knowledge.parseKnowledgeDocument({id, revision, text, locale?})` | 将配对章节锚点解析成文档树 | 不读取文件，不计算 revision，不完成所有目录校验 |
| `Knowledge.defineKnowledgeCatalog(documents, options?)` | 编译／冻结内存文档目录，提供ids、sectionIds、assertSelection、read | 不创建数据库，不监听文件，不导入上传，不自动学习或写回 |
| [章节标记说明](#文本章节锚点) | 说明配对锚点及嵌套规则的局部代码片段 | 不是初始资料，不会自动加载 |
| [knowledge.mjs](../skills/agent-core-app/scripts/lib/knowledge.mjs) | Skill 随附的 App 侧显式读文件、计算版本、编译目录范本 | 不是库内置的持久化初始化器 |

文档 JSON 最小结构：

```json
{
  "id": "service-guide",
  "revision": "content-version-1",
  "locale": "zh-CN",
  "parts": [
    "全局引言。",
    { "id": "delivery", "parts": [
      "本章节自身正文。",
      { "id": "delivery.timing", "parts": ["时机说明。"] }
    ] }
  ]
}
```

`parts` 中可混合原文字符串和子章节。结构化章节 ID 须为非空字符串且在**同一文档内全局唯一**，不是仅在相邻兄弟节点中唯一。文档 ID 在目录中唯一；目录编译拒绝重复章节和环。不要只运行文本 parser 而跳过目录编译。

## 文本章节锚点

源稿采用独立行、无缩进的配对标记：

```md
<!-- agent-section:delivery -->
本章节自身正文。
<!-- agent-section:delivery.timing -->
子章节正文。
<!-- /agent-section:delivery.timing -->
<!-- /agent-section:delivery -->
```

文本适配器接受的 ID 字符为英文字母、数字、`_`、`.`、`:`、`-`。标记必须按示例保留空格并独占一行；开闭 ID 要匹配并正确嵌套。Markdown 的 `#` 标题仅是正文。parser 按原始文本识别锚点，不是完整 Markdown 解释器；不要在源稿的代码围栏中放独立行的示范锚点，以免也被识别为真实章节。

稳定 ID 代表内容身份。修改标题不用改 ID；拆分／删除章节时同时迁移任务映射和历史引用策略。`.` 等字符只是 ID 的一部分，父子关系由 `parts` 的实际嵌套决定，不能靠名字猜。

## 三种读取方式

| 请求 | 返回范围 |
| --- | --- |
| `{documentId:'service-guide', selection:{mode:'document'}}` | 整篇正文与所有后代，按源稿顺序 |
| `{documentId:'service-guide', selection:{mode:'self', sectionIds:['delivery']}}` | 所选章节自己的字符串正文，排除子章节 |
| `{documentId:'service-guide', selection:{mode:'subtree', sectionIds:['delivery']}}` | 所选章节及其所有后代 |

明确选择的章节按请求数组顺序用两个换行拼接；重复 ID 会拒绝。父章节与其子章节作为两个不同 ID 同时选入 subtree，仍可能重复包含子章节文本，库不会自动消除这种祖先覆盖。App 应选择适当的最小完整范围。

`maxChars` 限制本次选出且 trim 后的正文，超限抛错，不静默裁掉后半段。文档大小、存储容量、模型上下文预算是不同限制。客户端传来的未知字段、身份和文件路径也不因 catalog.assertSelection 通过就可信；跨边界输入仍由 App 按自己的 schema 解析和授权。

## 版本和快照

App 提供 `revision`。可用内容与相关元数据的 hash、数据库版本号或发布版本；库不替你计算。相同 id／revision 下偷偷修改正文，会让版本语义失效。

`KnowledgeSnapshot` 包含 documentId、selection、revision、locale、content、id。id 来自上述身份和选择的序列化，**不是正文 hash、签名、持久化 ID 或授权凭据**。同一文档不同章节选择有不同引用，选择顺序也影响身份。生成和复核应传递同一份快照，不重新读取“当前最新正文”替换旧证据。

## 更新和资料增长

当前 catalog 没有 register、upsert、delete、save、watch 或自动检索全部存储的接口。需要变化时由 App 创建新 catalog 并切换自身引用，模式见 [持续积累](memory-and-learning.md)。发布前重新校验 task → document → sections、reader、checks 和 output 引用。

静态源稿和审批通过的增长资料都可以转换为 KnowledgeDocument。用户上传原件、未核实自述、经验候选不应直接混入公开权威目录；权限、来源和审核状态由 App 的存储／加载适配控制。
