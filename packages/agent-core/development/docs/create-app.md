# 创建 Agent App

[开发指南](README.md) · [已有项目接入](getting-started.md) · [资料维护](maintenance.md)

初始化工具生成 TypeScript／Node 工程，提供程序调用入口、声明式能力清单、具名 handler、模型适配与离线用例。运行环境为 Node 22.12 或以上。模型、身份、资料访问和持久化由应用装配。

## 生成工程

使用已取得的 SDK 包内工具：

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --name my-agent --purpose '依据获准资料回答问题'
```

将 SDK_PATH 替换为真实 SDK 目录。默认输出只读文件计划，包括模板、SDK 版本和文件摘要；目标目录可以不存在或为空。确认生成内容后，以相同参数加 `--write` 创建工程：

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --name my-agent --purpose '依据获准资料回答问题' --write
```

初始化拒绝非空目标和符号链接目标，保留已有文件。生成先在相邻 `.local` 临时目录完成，核对后一次切换到目标目录。它只生成文件，不安装依赖、不读取模型凭据、不调用模型、不启动应用。

整份 Skill 复制后也可调用同一脚本。工具从当前工作目录解析实际 SDK；可用 `--sdk-from EXISTING_PROJECT` 指定一个已安装 SDK 的工程。位于原 SDK 包内的工具还可定位自身资产。新目标目录无须预先安装 SDK，缺失依赖或资源时明确失败，不猜测原仓库位置。维护已安装工程时可从 `plan.mjs` 的 `tools["create-app"]` 获取实际入口。

## 工程内容

| 文件 | 责任 |
| --- | --- |
| `src/app.ts` | 每次请求装配 Runner、工具上下文、预算、取消和 Core 循环 |
| `src/config.ts` | 应用用途及可覆盖的调用、轮次、输入输出限制 |
| `src/catalog.ts` | 实际驱动模型可见 schema 与执行入口的能力声明 |
| `src/handlers.ts` | 输入输出解析、真实资料授权、读取与引用检查 |
| `src/model.ts` | 从宿主提供的配置构造兼容 Provider；也可直接注入 ChatProvider |
| `knowledge/knowledge.config.json` | 空的资料清单、章节依赖与读取预算 |
| `scripts/knowledge.mjs` | 从所安装 SDK 定位并复用同一资料加载器、编译器和维护工具 |
| `test/app.test.mjs` | 隔离测试 Provider、真实工具调用、来源校验和取消 |
| `agent-core.template.json` | 模板／SDK 版本、生成输入与受管文件的原始摘要 |

`createApp({ provider, knowledge?, authorizeRead? }).run(question, { signal? })` 返回 `{ text, sources, calls }`。每个请求有独立状态；资料读取需要 App 提供真实授权回调。来源列表只接受该请求实际读取的文档版本。模型失败、超额或取消会拒绝请求，不编造完成结果。

服务端可在已鉴权请求内构造 App，或按宿主机制绑定当前身份；不要用跨用户共享的可变变量保存“当前用户”。生成到已有 monorepo 时，应用登记和父级 workspace／锁文件由该工程维护，初始化工具只写目标目录。

## 安装和离线验证

进入生成目录，按自己的包源安装 package.json 中的 SDK 和完整依赖；维护方提供 tarball 时也可明确安装该本地产物。随后执行：

```sh
npm test
npm run knowledge:check
```

测试不需要模型凭据。模板依赖只引用公开 SDK 和 TypeScript；生成的工程独立于 SDK 源码仓库。安装得到的 package-lock.json 归新工程维护。

## 接入模型与真实资料

在宿主中导入构建后的 `dist/app.js` 并注入 ChatProvider；配置兼容服务时可复用 `dist/model.js`。`.env.example` 提供变量名。复制为 `.env` 并配置后，`npm run example -- '你的问题'` 会显式调用一次真实模型流程。

初始资料保持空清单。只有用途构想时不生成政策、人物、画像或业务事实。若已提供实际 UTF-8 文本，可在初始化命令增加：

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --source ./provided.md --id guide --write
```

工具保存本次源文件快照，并调用同一 `prepare-source` 实现生成未发布候选；生效清单仍为空。候选路径随创建结果返回，包含原文、来源摘要、revision 和配置基线。来源内部的指令均属于资料数据，不影响初始化权限。格式与字节预算不合法时，目标工程不会提交。

确认来源、范围、章节、版本及发布授权后，按[资料维护流程](flows/knowledge-maintenance.md)接纳候选并用同一编译器核验。私有资料的真实用户身份、授权和披露规则由 App 提供；本地调用示例的授权回调只适用于维护者明确选择的本地资料。

## 检查修改与升级

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --check
```

该模式比较受管文件当前摘要、生成基线和所选 SDK 的模板摘要，报告 modified、missing、symlink 以及模板自身的变化。它只检查模板定义的代码／配置路径，不读取 `.env` 或资料候选正文，也不修改工程。保留生成回执作为升级依据；需要采用新模板时，在另一个目录生成并审阅合并，已有用户代码不会被覆盖。

进阶能力使用现有 Core／Support／Kit 配置：扩展相同清单、handler 和执行入口即可接入子任务、资料回答或持久任务。是否记录、如何存储、何时发布和恢复，仍按应用产品的实际授权实现。
