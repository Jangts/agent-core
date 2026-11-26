# Agent Core 文档站

基于 VitePress 的纯静态多语言文档。浏览器本地全文搜索，不依赖后端。站点内容来自当前公开导出、TypeScript 声明、现有手册、场景示例和 `content/guide` 下的入门与延伸阅读文章。

线上文档：<https://agent-core-docs.pages.jangts.cafe/>。

网站面向使用 Agent Core 开发 App 的人，使用手册以 SDK 的 `development/docs/` 为源；Agent Core 自身 `docs/` 中的工程规划、改造历史和维护记录不自动作为开发者文档发布。公开的设计原理、策略源码和接入说明仍按 SDK 使用者的学习需要组织。

## 语言与路径

中文与英文位于同级目录：`/zh/` 与 `/en/`，内页地址始终位于各自语言目录下。根路径 `/` 只是语言入口：按浏览器语言进入 `/zh/` 或 `/en/`，中文区进入中文，其他地区进入英文；入口在 head 内联脚本中立即完成，不渲染可见的等待或选择页面。点击导航栏语言切换会记住选择，后续不再自动跳转。所有页面、导航、侧边栏、搜索索引和 `canonical`／`hreflang` 都按语言分别生成。

- 中文页面：`content/guide/**/*.md`、SDK `development/docs/*.md` 与生成的 API、示例、策略页面。
- 英文页面：同目录的 `*.en.md`，以及 `content/recipes/en/*.en.mjs` 中的示例说明覆盖表。
- 生成页的界面文案、层与分组名称集中在 `scripts/locales.mjs`；新增页面时必须同时提供两种语言的源文件，生成器会拒绝缺页、示例数量不一致或策略标题缺失。

对外文档与 SDK 作为同一成品交付，正文直接说明正式能力、接口、行为、使用条件、配置和示例。研发计划、实施进度、迁移过程、旧方案及会话讨论留在维护资料中；接口限制直接说明支持的字段、版本和执行边界，不通过讨论历史解释。域名、托管、站点构建和仓库组织说明仅供维护者阅读，不进入公开页面。

根目录命令：

```sh
npm run docs:agent-core
npm run build:docs:agent-core
npm run preview:docs:agent-core
```

网站源码位于 `apps/agent-core-docs/`，构建产物位于该应用自己的 `dist/`；二者均不随 SDK 发布。域名和基础路径通过站点配置管理。部署说明见 [deployment.md](docs/deployment.md)。`docs/` 仅保存站点维护资料，公开内容放在 `content/`。

构建入口为 `scripts/build.mjs`：两套语言的全部页面在服务端打包时需要超过默认 4GB 的 Node 堆，因此以 8GB 上限调用 VitePress CLI；`npm run build:docs:agent-core` 仍为统一命令。

生成器仅替换被忽略的文档输出目录，不执行 SDK/App 代码、不改 SDK dist、不重写现行 MD、不发布任何站点。Agent Core 的定义从源码生成，MockGPT 与 Streaming 的转导出读取 Agent Core 已安装的锁定版本声明。源码工作区无需先运行公共包全量构建。

维护时可从 `.tmp/agent-core-docs/coverage.json` 查看符号覆盖和源码指纹。公开页面从 SDK 导出、使用手册及 `content/` 生成，策略实现按声明名提取；这些生成与核验信息保留在维护资料中。

开发模式依赖检查：在根目录运行 `node apps/agent-core-docs/scripts/check-dev.mjs`。该检查使用当前安装的 VitePress 和应用依赖，验证开发模块的实际导入转换及 Mermaid 加载；使用独立缓存，不监听端口、不打开浏览器，也不占用正在运行的文档站缓存。

开发命令由 `scripts/dev.mjs` 监听内容、SDK 接口和生成器源码，合并连续变更，先关闭旧文档进程，再由新进程生成与加载完整页面。生成目录不参与监听，搜索索引与高亮器不跨进程复用。启动失败后等待下一次源码变更，不自动循环重试。

整站重载检查：生成文档后运行 `node apps/agent-core-docs/scripts/check-reload.mjs --full`（或工作区的 `check:reload`）。它复制完整生成内容到临时目录，连续触发真实文件变更，检查 VitePress 搜索更新、页面删除、实际 Markdown 模块编译和 Shiki 高亮；所有检查进程都不监听端口。省略 `--full` 可运行小型隔离用例。

构建后运行 `node apps/agent-core-docs/scripts/check.mjs` 核对公开符号页、两套语言索引、页面集合一致性与静态链接。生成器在缺页、英文示例或策略标题不完整时直接失败，不以中文内容填充英文页面。
