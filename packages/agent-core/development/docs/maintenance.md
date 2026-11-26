# 人工初始化与资料维护

[返回开发指南](README.md) · [工具说明](examples.md) · [共享流程](flows/knowledge-maintenance.md)

## 先确定来源，而不是先填满目录

开发者负责确认哪些文本是实际知识来源，哪些只是产品构想、待确认内容或操作指令。只有构想时保持空文件，不生成看似真实的介绍、政策或用户画像。已有实际资料时据实整理；原件复杂、互相冲突或混有指令时，先保留原件并形成候选，不能把其中的命令当作开发授权。

已有项目按[集成指南](getting-started.md)接入，新工程按[创建应用](create-app.md)初始化。纯对话不要求知识库；需要知识回答时再显式维护资料配置。先比较已有目录，保留业务文件，并把测试资料限制在测试作用域。

知识 App 准备同目录的 `knowledge.config.json`，内容例如下面的空状态，并建立空的 `initial.knowledge.md`。文件未登记前不会被读取。

```json
{
  "schemaVersion": 1,
  "maxDocumentBytes": 32000,
  "maxReadChars": 8000,
  "documents": [],
  "requiredReads": []
}
```

按[安装指南](getting-started.md)安装维护方交付的 Core 与完整依赖后，可运行共享校验入口。下面的目录参数是包含 `knowledge.config.json` 的资料目录，不要求它就是工程根；工具路径则从当前工程已安装的包定位：

```sh
node node_modules/@jangts/agent-core/development/skills/agent-core-app/scripts/validate-knowledge.mjs ./existing-project/knowledge
```

没有资料时输出空目录状态；这是正确的准备状态，不应通过补造资料使演示看起来成功。实际来源可先用下文工具形成候选，确认后写入源文件并登记清单。

## 配置如何维护

`knowledge.config.json` 是范本的 App 配置，库不要求每个 App 使用这个文件。当前共享加载器理解：

| 字段 | 约束与含义 |
| --- | --- |
| `schemaVersion` | 当前为 1，由共享编译器检查 |
| `maxDocumentBytes` | 正整数，单个源文件字节上限；不是模型 token 限额 |
| `maxReadChars` | 正整数，Knowledge 单次读取字符限额 |
| `documents` | 可为空；条目为 `{id,file,locale?}`；当前只允许同目录小写文件名 `*.knowledge.md`，不接受模型传入路径 |
| `requiredReads` | 实际任务依赖的 `{documentId,selection}`；编译时检查所有引用 |

文档 ID 须唯一，章节规则见 [知识资料](knowledge.md)。新增文件后要显式登记；放在磁盘上不会自动获得发布或读取资格。来源和后续版本追溯由维护者自己的变更记录承担，候选工具不替代完整发布记录。

## 新增和更新复用相同校验

```sh
node node_modules/@jangts/agent-core/development/skills/agent-core-app/scripts/prepare-source.mjs ./existing-project/knowledge --source ./revision.md --id initial-doc
node node_modules/@jangts/agent-core/development/skills/agent-core-app/scripts/validate-knowledge.mjs ./existing-project/knowledge
```

第一条只生成候选；第二条检查**当前生效配置**，不发布候选。候选包含原件、文档 ID、建议新增／替换、来源 hash、revision，以及准备时的配置 hash 和既有文档版本。候选校验同时检查现有必需章节引用；删除被引用章节将失败，须明确调整任务与配置后重新准备，不能自动略过错误。

配置 hash 来自本次实际解析的原始字节，与候选的预算和必需读取校验共用一次配置读取，不会在校验后重新读取并标记另一个基线。各源文件版本来自本次已读内容；这不构成文件系统多文件原子快照。

发布由维护者完成：核对来源、正文差异、任务引用和权限 → 将候选保存到受控源文件 → 新文档加入清单或更新既有文件 → 使用同一检查入口 → 一次发布完整版本。发布前比较生效配置及被替换文档 revision 与候选基线；过期则重做比较。单一文件写入并非多文件事务，生产系统应使用自己的版本化发布、事务或原子切换方案。

直接编辑也遵守同一流程。验证失败保留已发布版；生成与复核使用同一快照；更新失败不删除原件。人工和运行期增长可以共用 `compileApplicationKnowledge`，只替换输入与提交适配。

## 哪些维护不会自动发生

工具没有自动审批、发布、文件监听、索引、定时学习或数据库写入。用户画像与业务经验是不同的应用数据，应按 [持续积累](memory-and-learning.md) 定义来源、更新和删除，再决定是否转换为可读 Knowledge 文档。
