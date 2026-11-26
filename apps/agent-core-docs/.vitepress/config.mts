import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { createRequire } from 'node:module';
import path from 'node:path';
import { generateSite } from '../scripts/generate.mjs';
import { contentRoot, outputRoot, siteRoot, sdkRoot, siteOutputRoot } from '../scripts/paths.mjs';
import { locales as siteLocales } from '../scripts/locales.mjs';
import { alternateRoutes, routeFromRelative } from '../scripts/locale-routes.mjs';

const requireFromSite = createRequire(import.meta.url);

// The local search index is built once with this tokenizer; query-time options
// must match it exactly. Word segmentation also splits English on word boundaries.
const tokenize = (text: string) =>
  Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text), (part) =>
    part.segment.toLowerCase(),
  ).filter((term) => /[\p{L}\p{N}_]/u.test(term));

const base = process.env.AGENT_CORE_DOCS_BASE ?? '/';
const origin = process.env.AGENT_CORE_DOCS_ORIGIN ?? 'https://agent-core-docs.pages.jangts.cafe';
if (new URL(origin).origin !== origin || !/^https?:/.test(origin))
  throw new Error('AGENT_CORE_DOCS_ORIGIN must be an http(s) origin without a path.');
if (!/^\/(?:[a-zA-Z0-9._~-]+\/)*$/.test(base) || base.includes('/../'))
  throw new Error('AGENT_CORE_DOCS_BASE must be / or a trailing-slash URL path such as /jangts/.');

function themeFor(locale, generated) {
  const t = locale.theme;
  const p = (value) => locale.prefix + value;
  return {
    nav: [
      { text: locale.nav.start, link: p('/guide/design') },
      { text: locale.nav.api, link: p('/api/') },
      { text: locale.nav.scenarios, link: p('/recipes/') },
      { text: locale.nav.workflowTools, link: p('/manual/workflow-development') },
      { text: locale.nav.articles, link: p('/articles/') },
      { text: locale.nav.handbook, link: p('/manual/') },
    ],
    sidebar: generated.sidebars[locale.id],
    outline: { level: [2, 3], label: t.outlineLabel },
    returnToTopLabel: t.returnToTopLabel,
    sidebarMenuLabel: t.sidebarMenuLabel,
    darkModeSwitchLabel: t.darkModeSwitchLabel,
    lightModeSwitchTitle: t.lightModeSwitchTitle,
    darkModeSwitchTitle: t.darkModeSwitchTitle,
    docFooter: { prev: t.docFooterPrev, next: t.docFooterNext },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: t.searchButtonText, buttonAriaLabel: t.searchButtonAriaLabel },
          modal: {
            noResultsText: t.searchNoResultsText,
            resetButtonTitle: t.searchResetButtonTitle,
            displayDetails: t.searchDisplayDetails,
            footer: {
              selectText: t.searchSelectText,
              navigateText: t.searchNavigateText,
              closeText: t.searchCloseText,
            },
          },
        },
        miniSearch: {
          options: { tokenize },
          searchOptions: { prefix: true, fuzzy: 0.15 },
        },
      },
    },
    footer: { message: t.footerMessage, copyright: t.footerCopyright },
  };
}

export default async () => {
  const generated = await generateSite();
  const englishLocale = siteLocales.find((locale) => locale.id === 'en');
  const alternateHead = (pageData) => {
    const routes = alternateRoutes(pageData.relativePath);
    // 根路径是英文首页副本，规范地址仍指向 /en/，避免同一内容出现两个索引地址。
    const canonical =
      pageData.relativePath === 'index.md' ? routes.en : routeFromRelative(pageData.relativePath);
    return [
      ['link', { rel: 'canonical', href: origin + base + canonical.slice(1) }],
      ['link', { rel: 'alternate', hreflang: 'zh-CN', href: origin + base + routes.zh.slice(1) }],
      ['link', { rel: 'alternate', hreflang: 'en', href: origin + base + routes.en.slice(1) }],
      [
        'link',
        { rel: 'alternate', hreflang: 'x-default', href: origin + base + routes.en.slice(1) },
      ],
    ];
  };
  const config = withMermaid({
    ...defineConfig({
      title: englishLocale.title,
      description: englishLocale.description,
      lang: englishLocale.lang,
      base,
      head: [
        [
          'link',
          { rel: 'icon', type: 'image/svg+xml', href: base + 'branding/agent-core-icon.svg' },
        ],
        ['script', { src: base + 'auto-lang.js' }],
      ],
      srcDir: contentRoot,
      outDir: siteOutputRoot,
      cacheDir: path.join(outputRoot, 'cache'),
      cleanUrls: false,
      lastUpdated: false,
      sitemap: { hostname: origin + base },
      transformHead: ({ pageData }) => alternateHead(pageData),
      markdown: {
        lineNumbers: true,
        theme: { light: 'github-light', dark: 'github-dark' },
      },
      locales: Object.fromEntries(
        siteLocales.map((locale) => [
          locale.viteKey,
          {
            label: locale.label,
            lang: locale.lang,
            link: locale.prefix + '/',
            title: locale.title,
            description: locale.description,
            themeConfig: themeFor(locale, generated),
          },
        ]),
      ),
      themeConfig: {
        logo: { src: '/branding/agent-core-icon.svg', alt: 'Agent Core' },
        siteTitle: 'Agent Core',
        // 根路径的英文首页副本使用顶层配置；其余页面按 /en/、/zh/ 语言配置渲染。
        ...themeFor(englishLocale, generated),
      },
      vite: {
        plugins: [
          {
            name: 'agent-core-docs-snapshot',
            config(config) {
              // Set this directly: Vite's config merge skips null overrides. The
              // launcher owns source watching; generated pages must not trigger HMR.
              config.server ??= {};
              config.server.watch = null;
            },
          },
        ],
        resolve: {
          // Generated Markdown is outside this app. Resolve Mermaid from the app's
          // own dependencies, including pnpm's isolated dependency layout.
          alias: [{ find: /^mermaid$/, replacement: requireFromSite.resolve('mermaid') }],
        },
      },
    }),
    mermaid: {
      securityLevel: 'strict',
      startOnLoad: false,
      // SVG text is measured and drawn in the same coordinate system. HTML
      // foreignObject labels can be clipped by the documentation's typography.
      htmlLabels: false,
      fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      flowchart: { useMaxWidth: false, wrappingWidth: 280 },
      sequence: { useMaxWidth: false, wrap: true },
    },
  });
  // Prebundle Mermaid and its CommonJS dependencies together. The plugin's
  // individual includes resolve from the generated content root instead, which
  // can select a different package copy from the one Mermaid actually imports.
  config.vite!.optimizeDeps = { include: ['mermaid'] };
  return config;
};
