# 构建与静态部署

本文供文档站维护者使用，不属于公开 SDK 使用文档。

默认构建地址为 `https://agent-core-docs.pages.jangts.cafe`，使用域名根路径；换域名可设置 `AGENT_CORE_DOCS_ORIGIN=https://your-domain.example`。

## 本站 Pages

公开入口为 <https://agent-core-docs.pages.jangts.cafe/>，使用现有 NPM Pages 通配入口和证书。服务器目录为 `/opt/stacks/nginx-proxy-manager/data/pages/agent-core-docs/`。

从仓库根目录运行 `npm run build:docs:agent-core`，将本应用 `dist/` 的全部成品打包，经 SCP 上传并通过 SSH 校验压缩包及逐文件 SHA-256 后替换该站点目录。更新静态成品无需修改 NPM、DNS、证书或重启服务；保留其他站点和 `.shared/404.html`。

Pages 使用真实静态文件路径，本文档站保留 `cleanUrls: false`，正文路径带 `.html`；不存在的页面使用共享错误页并返回 HTTP 404，不回退到首页。发布后核对 HTTPS 首页、正文、实际 JS/CSS、站点地图和缺失路径；浏览器交互与视觉验收由用户负责。

统一发布入口为 `npm run deploy --workspace @jangts/agent-core-docs`。脚本在构建后执行完整站点检查，检查失败不上传；通过后对上传包与全部成品文件执行 SHA-256 校验；公网核对首页、协议文档、API 目录、实际引用的 JS/CSS、API 清单与站点地图，内容应与本地成品一致。缺失路径必须返回 HTTP 404。构建、内容校验与浏览器交互／视觉验收分别记录，不能相互替代。

文档站使用 VitePress 1.6。正文、公开 API 页面、代码高亮和全文搜索索引都在构建时生成；托管端只需分发静态文件。没有后端、数据库、在线模型或远程搜索服务。阅读文档不会执行示例。

## 在仓库中使用

从本仓库的 Agent Core 源码生成文档。MockGPT 与 Streaming 的转导出来自根锁文件固定的发布包类型。更新依赖后重新安装并重启文档开发服务。

从仓库根目录执行，使用根 `package-lock.json`，不在文档目录重复安装：

```sh
npm ci
npm run docs:agent-core
```

开发命令只启动 VitePress 文档服务器。它不启动六个应用，也不运行 SDK 的模型或工具。文档编辑、SDK 源码与现有手册变动后会刷新生成快照。

开发服务的生成快照和缓存位于 `.tmp/agent-core-docs/development/`，静态构建使用其上级目录中的独立快照和缓存；开发期间可以执行静态构建，两者不会重建对方的内容目录。

生成可部署的静态站：

```sh
npm run build:docs:agent-core
```

输出目录为：

```text
apps/agent-core-docs/dist/
├── index.html       # 语言入口：按浏览器语言进入 /en/ 或 /zh/
├── en/              # 英文页面
├── zh/              # 中文页面
├── assets/          # 页面脚本、样式、本地搜索索引
├── branding/
├── api-catalog.json
├── sitemap.xml
└── 404.html
```

英文与中文位于同级目录 `/en/`、`/zh/`，内页地址不随入口变化。`/` 只承担语言入口：中文浏览器进入 `/zh/`，其他语言进入 `/en/`，由 head 内联脚本立即完成，不渲染可见的等待或选择页面。缺失路径返回 HTTP 404。

这个目录可整体复制到任意静态托管平台。源码目录和生成中的 Markdown 不作为托管根目录。该应用的 `dist/` 和临时 `.tmp/` 已由 Git 忽略，不提交生成物；SDK 不分发网站。

构建产物的本地服务器命令：

```sh
npm run preview:docs:agent-core
```

## 其他静态托管

选择静态站点／静态产物部署，配置以下信息：

| 配置 | 值 |
| --- | --- |
| 工作目录 | 本仓库根目录 |
| 安装 | `npm ci --ignore-scripts` |
| 构建 | `npm run build:docs:agent-core` |
| 发布目录 | `apps/agent-core-docs/dist` |
| 域名根路径 | `AGENT_CORE_DOCS_BASE=/` |
| 子目录路径 | 如 `AGENT_CORE_DOCS_BASE=/agent-core/` |
| 后端、环境密钥 | 无 |

托管平台若只接受上传静态目录，可先在本地构建再上传发布目录。无需为此迁入运行数据库、`.env`、日志或 App 服务。具体平台项目的创建与发布按该平台操作，不由构建脚本自动进行。

VitePress 的[静态部署和基础路径说明](https://vuejs.github.io/vitepress/v1/guide/deploy)、[浏览器本地搜索说明](https://vuejs.github.io/vitepress/v1/reference/default-theme-search)可供维护时查阅。

当前线上成品与验证范围见 [2026-11-26 发布记录](releases/2026-11-26.md)。

## 发布到 Jangts Pages

将 [配置样例](../scripts/deploy.config.example.json) 复制到仓库根目录的 `.local/pages/agent-core-docs.json`，填写本机 SSH 连接和密钥路径。
发布入口为 `npm run deploy --workspace @jangts/agent-core-docs`。
