/**
 * Agent Core 文档站生成入口。
 *
 * 读取 SDK 源码与食谱定义，抽取公开 API、政策片段与侧边栏，再按语言输出页面、
 * 检索索引与 API 目录；生成结果只写入生成目录，不改动手写源稿。
 * 主要导出：generateSite。
 */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { extractApi, readRecipeModules } from './extract-api.mjs';
import { renderRecord, renderRecipe, linkRecipes, fence } from './render-api.mjs';
import { readRecipeTranslations } from './recipe-translations.mjs';
import { groupRecipes } from './recipe-groups.mjs';
import { locales, defaultLocale, localeById, localePath } from './locales.mjs';
import {
  contentRoot,
  outputRoot,
  siteRoot,
  sdkRoot,
  articleSourceRoot,
  workspaceRoot,
  posix,
  slug,
} from './paths.mjs';

const compare = (a, b) => a.name.localeCompare(b.name);
const code = (value) => '`' + value + '`';

async function filesIn(root, suffix) {
  const result = [];
  for (const item of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    const filename = path.join(root, item.name);
    if (item.isDirectory()) result.push(...(await filesIn(filename, suffix)));
    else if (item.name.endsWith(suffix)) result.push(filename);
  }
  return result;
}

async function save(route, text) {
  const destination = path.join(contentRoot, route.replace(/^\//, '') + '.md');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, text);
}

function localizedRecords(records, locale) {
  return records.map((record) => ({ ...record, url: localePath(locale, record.url) }));
}

/**
 * 合并英文配方说明。示例与策略必须与中文源逐项对应，缺失或数量不一致时阻止生成，
 * 避免英文站静默退化或混入中文正文。
 */
function localizeRecipes(recipes, translations, locale) {
  if (locale.id === defaultLocale.id) return recipes;
  return recipes.map((recipe) => {
    const entry = translations.get(recipe.id);
    if (!entry) throw new Error(`Missing English recipe translation: ${recipe.id}`);
    if (!Array.isArray(entry.examples) || entry.examples.length !== recipe.examples.length)
      throw new Error(
        `English example count differs for ${recipe.id}: expected ${recipe.examples.length}, got ${entry.examples?.length ?? 0}`,
      );
    const examples = recipe.examples.map((example, index) => {
      const value = entry.examples[index] ?? {};
      if (!value.title || !value.level)
        throw new Error(`English example ${index + 1} of ${recipe.id} lacks title or level`);
      if (!!example.note !== !!value.note)
        throw new Error(`English note mismatch for ${recipe.id} example ${index + 1}`);
      return {
        ...example,
        title: value.title,
        level: value.level,
        ...(example.note ? { note: value.note } : {}),
      };
    });
    const policies = recipe.policies ?? [];
    const titles = entry.policyTitles ?? [];
    if (titles.length !== policies.length)
      throw new Error(
        `English policy title count differs for ${recipe.id}: expected ${policies.length}, got ${titles.length}`,
      );
    if (!entry.title || !entry.summary || !entry.details)
      throw new Error(`English recipe translation is incomplete: ${recipe.id}`);
    return {
      ...recipe,
      title: entry.title,
      summary: entry.summary,
      details: entry.details,
      examples,
      policies: policies.map((policy, index) => ({ ...policy, title: titles[index] })),
    };
  });
}

/**
 * 页面路由：同一份源文件在两种语言中分别对应 /zh/...（中文）与根路径 /...（英文）。
 * 键统一使用中文源文件路径，使英文文件里的相对链接也能解析到同一页面的英文版本。
 */
function registerPage(pageRoutes, filename, route) {
  const base = filename.replace(/\.en\.md$/, '.md');
  const isEnglish = filename.endsWith('.en.md');
  const entry = pageRoutes.get(base) ?? {};
  if (entry[isEnglish ? 'en' : 'zh'])
    throw new Error(`Duplicate ${isEnglish ? 'English' : 'Chinese'} page: ${filename}`);
  entry[isEnglish ? 'en' : 'zh'] = localePath(localeById[isEnglish ? 'en' : 'zh'], route);
  pageRoutes.set(base, entry);
}

function manualRoute(filename) {
  const relative = posix(path.relative(path.join(sdkRoot, 'development/docs'), filename))
    .replace(/\.en\.md$/, '.md')
    .replace(/\.md$/, '')
    .replace(/(^|\/)README$/, '$1index');
  // 英文在根、中文在 /zh/manual/。
  return '/manual/' + relative;
}

function articleRoute(filename) {
  const relative = posix(path.relative(path.join(siteRoot, 'content'), filename))
    .replace(/\.en\.md$/, '.md')
    .replace(/\.md$/, '');
  return '/' + relative;
}

function apiSidebar(records, common, locale) {
  const t = locale.text.sidebar;
  const sidebar = {};
  const layers = locale.text.layers;
  const layersOverview = {
    text: t.apiLayers,
    items: Object.entries(layers).map(([layer, text]) => ({
      text,
      link: localePath(locale, `/api/${layer}/`),
    })),
  };
  const apiRoot = localePath(locale, '/api/');
  sidebar[apiRoot] = [...common, layersOverview];
  for (const layer of Object.keys(layers)) {
    const domains = new Map();
    for (const record of records.filter((item) => item.layer === layer)) {
      const name = record.domain.titles[locale.id];
      if (!domains.has(name)) domains.set(name, []);
      domains.get(name).push(record);
    }
    const domainLinks = [...domains].map(([text, values]) => ({
      text,
      link: localePath(locale, `/api/${layer}/${values[0].domain.id}/`),
    }));
    const layerRoot = localePath(locale, `/api/${layer}/`);
    sidebar[layerRoot] = [...common, layersOverview, { text: layers[layer], items: domainLinks }];
    for (const [text, values] of domains) {
      const domainRoot = localePath(locale, `/api/${layer}/${values[0].domain.id}/`);
      sidebar[domainRoot] = [
        ...common,
        layersOverview,
        { text: layers[layer], collapsed: true, items: domainLinks },
        {
          text,
          items: [
            {
              text: t.runtime,
              collapsed: false,
              items: values
                .filter((item) => item.runtime)
                .sort(compare)
                .map(symbolItem),
            },
            {
              text: t.types,
              collapsed: true,
              items: values
                .filter((item) => !item.runtime)
                .sort(compare)
                .map(symbolItem),
            },
          ].filter((item) => item.items.length),
        },
      ];
    }
  }
  return sidebar;
}

function symbolItem(record) {
  const members = record.members.filter(
    (member, index, all) => all.findIndex((item) => item.name === member.name) === index,
  );
  return {
    text: record.name,
    link: record.url,
    ...(members.length
      ? {
          collapsed: true,
          items: members.map((member) => ({
            text: member.name,
            link: `${record.url}#member-${slug(member.name)}`,
          })),
        }
      : {}),
  };
}

function selectPolicy(text, filename, symbols = []) {
  if (!symbols.length) return text;
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const pieces = [];
  for (const name of symbols) {
    const parts = name.split('.');
    let found;
    const visit = (node) => {
      if (node.name?.getText(source) === parts.at(-1)) {
        const parents = [];
        for (let parent = node.parent; parent; parent = parent.parent)
          if (parent.name) parents.unshift(parent.name.getText(source));
        if (parts.length === 1 || parents.join('.').endsWith(parts.slice(0, -1).join('.')))
          found ??= node;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (!found) throw new Error(`Policy symbol not found: ${filename}: ${name}`);
    pieces.push(found.getText(source));
  }
  return pieces.join('\n\n');
}

function normalizeMarkdown(markdown) {
  // Existing handbooks include bare Type<T> in prose. Preserve code and supported
  // HTML while preventing Vue from treating type parameters as components.
  let fenced = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line
        .split(/(`+[^`]*`+)/g)
        .map((part, index) =>
          index % 2
            ? part.includes('{{')
              ? `<span v-pre>${part}</span>`
              : part
            : part
                .replace(/<\/?[A-Za-z][^>\n]*>/g, (value) =>
                  /<\/?(?:Badge|VP\w*|ClientOnly|span|div|details|summary|kbd|br|strong|em|small|sub|sup|table|thead|tbody|tr|th|td|p|a|img|ul|ol|li)\b/.test(
                    value,
                  )
                    ? value
                    : value.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
                )
                .replace(/\{\{/g, '&#123;&#123;'),
        )
        .join('');
    })
    .join('\n');
}

function homeMarkdown(locale) {
  const home = locale.text.home;
  const link = (item) => `[${item.text}](${localePath(locale, item.path)})`;
  const actions = home.actions
    .map(
      (action) =>
        `    - theme: ${action.theme}\n      text: ${JSON.stringify(action.text)}\n      link: ${localePath(locale, action.path)}`,
    )
    .join('\n');
  const features = home.features
    .map(
      (feature) =>
        `  - title: ${JSON.stringify(feature.title)}\n    details: ${JSON.stringify(feature.details)}\n    link: ${localePath(locale, feature.path)}`,
    )
    .join('\n');
  const rows = home.readingRows
    .map((row) => `| ${row.question} | ${row.links.map(link).join(' / ')} |`)
    .join('\n');
  return `---\nlayout: home\nhero:\n  name: Jangts Agent Core\n  image:\n    src: /branding/agent-core-logo.svg\n    alt: ${JSON.stringify(home.heroAlt)}\n  text: ${JSON.stringify(home.heroText)}\n  tagline: ${JSON.stringify(home.heroTagline)}\n  actions:\n${actions}\nfeatures:\n${features}\n---\n\n## ${home.readingTitle}\n\n| ${home.readingColumns.join(' | ')} |\n| --- | --- |\n${rows}\n`;
}

/**
 * 生成全站页面、侧边栏与 API 目录，并写入生成目录。
 *
 * 任一语言缺少对应页面、政策片段越界引用源码或英文翻译缺项时直接抛错，
 * 避免产出内容不完整的站点。
 *
 * @returns 覆盖率报告与按语言划分的侧边栏
 */
export async function generateSite() {
  const api = await extractApi();
  const zhRecipes = await readRecipeModules();
  const translations = await readRecipeTranslations();
  linkRecipes(api.records, zhRecipes);
  const snapshot = createHash('sha256');
  for (const source of api.sourceFiles.sort((a, b) => a.origin.localeCompare(b.origin)))
    snapshot.update(source.origin).update('\0').update(source.text).update('\0');
  snapshot.update(JSON.stringify(api.modules));
  for (const filename of (await filesIn(articleSourceRoot, '.md')).sort())
    snapshot.update(posix(path.relative(articleSourceRoot, filename))).update(await readFile(filename, 'utf8'));
  snapshot.update(await readFile(path.join(articleSourceRoot, 'catalog.json'), 'utf8'));
  const sourceSha256 = snapshot.digest('hex');
  // Only generated documentation is replaced, never the canonical MD or SDK dist.
  await rm(contentRoot, { recursive: true, force: true });
  await mkdir(contentRoot, { recursive: true });

  // Source pages exist once per language, either as foo.md or foo.en.md.
  const manualRoot = path.join(sdkRoot, 'development/docs');
  const articleRoot = path.join(siteRoot, 'content');
  const manualFiles = await filesIn(manualRoot, '.md');
  const articleFiles = await filesIn(articleRoot, '.md');
  const technicalRoot = articleSourceRoot;
  const technicalSections = JSON.parse(
    await readFile(path.join(technicalRoot, 'catalog.json'), 'utf8'),
  );
  const technicalCatalog = technicalSections.flatMap(({ articles }) => articles);
  const technicalSources = new Map([
    ['README.md', path.join(technicalRoot, 'README.md')],
    ...technicalSections.flatMap(({ id, articles }) =>
      articles.map((article) => [
        article.id + '.md',
        path.join(technicalRoot, id, article.id + '.md'),
      ]),
    ),
  ]);
  const bundledArticles = path.join(sdkRoot, 'development/articles');
  const skillSources = new Set();
  const pageRoutes = new Map();
  for (const filename of manualFiles) registerPage(pageRoutes, filename, manualRoute(filename));
  for (const filename of articleFiles) registerPage(pageRoutes, filename, articleRoute(filename));
  for (const [name, filename] of technicalSources) {
    const id = path.basename(name, '.md');
    const route = id === 'README' ? '/articles/index' : '/articles/' + id;
    registerPage(pageRoutes, filename, route);
    registerPage(pageRoutes, filename.replace(/\.md$/, '.en.md'), route);
  }
  for (const skill of new Set(technicalCatalog.map((article) => article.skill))) {
    const filename = path.join(sdkRoot, 'development/skills', skill, 'SKILL.md');
    skillSources.add(filename);
    pageRoutes.set(
      filename,
      Object.fromEntries(
        locales.map((locale) => [locale.id, localePath(locale, '/development/skills/' + skill)]),
      ),
    );
  }

  const missing = [...pageRoutes].flatMap(([filename, routes]) =>
    locales
      .filter((locale) => !routes[locale.id])
      .map((locale) => `${posix(path.relative(workspaceRoot, filename))} (${locale.id})`),
  );
  if (missing.length)
    throw new Error(
      `Missing translated page(s):\n${missing.map((item) => '  ' + item).join('\n')}`,
    );

  // Policy pages are code excerpts; only the title and surrounding label are localized.
  const policies = [];
  const policyKeys = new Map();
  for (const recipe of zhRecipes) {
    for (const policy of recipe.policies ?? []) {
      const filename = path.resolve(sdkRoot, policy.file);
      if (!filename.startsWith(path.join(sdkRoot, 'src') + path.sep))
        throw new Error(`Policy must reference SDK source: ${policy.file}`);
      const key = JSON.stringify([policy.file, policy.symbols ?? []]);
      let entry = policyKeys.get(key);
      if (!entry) {
        const text = selectPolicy(await readFile(filename, 'utf8'), filename, policy.symbols);
        const id = slug(policy.file + '-' + (policy.symbols ?? []).join('-'));
        entry = {
          id,
          titles: { zh: policy.title },
          title: policy.title,
          file: policy.file,
          symbols: policy.symbols ?? [],
          url: `/policies/${id}`,
          recipes: [],
          text,
        };
        policyKeys.set(key, entry);
        policies.push(entry);
      }
      entry.recipes.push(recipe.id);
    }
  }
  // Match English policy titles to the same entry order as the Chinese recipe definitions.
  for (const recipe of zhRecipes)
    for (const [index, policy] of (recipe.policies ?? []).entries()) {
      const entry = policyKeys.get(JSON.stringify([policy.file, policy.symbols ?? []]));
      const english = translations.get(recipe.id)?.policyTitles?.[index];
      if (english) entry.titles.en ??= english;
    }
  const missingPolicyTitles = policies
    .filter((policy) => !policy.titles.en)
    .map((policy) => policy.file);
  if (missingPolicyTitles.length)
    throw new Error(
      `Missing English policy title(s):\n${missingPolicyTitles.map((item) => '  ' + item).join('\n')}`,
    );

  const report = {
    version: api.version,
    articles: technicalCatalog.map((article) => ({ id: article.id, title: article.title })),
    sourceSha256,
    exportedModules: api.modules.length,
    publicSymbols: api.records.length,
    runtimeSymbols: api.records.filter((record) => record.runtime).length,
    typeSymbols: api.records.filter((record) => !record.runtime).length,
    publicMembers: api.records.reduce((sum, record) => sum + record.members.length, 0),
    recipes: zhRecipes.length,
    policies: policies.length,
    locales: locales.map((locale) => locale.id),
    undocumentedRuntime: api.records
      .filter((record) => record.runtime && !record.recipeIds.length)
      .map((record) => ({
        name: record.name,
        origin: record.origin,
        url: localePath(defaultLocale, record.url),
      })),
    symbolPages: api.records.map(({ name, url, imports, recipeIds, members }) => ({
      name,
      url: localePath(defaultLocale, url),
      imports,
      recipeIds,
      members: members.map((member) => member.name),
    })),
  };

  const declarations = new Map();
  for (const emitted of api.emitted) {
    const { origin, declarationPath } = emitted;
    const filename = declarationPath ?? path.join(workspaceRoot, origin);
    const source = ts.createSourceFile(filename, emitted.text, ts.ScriptTarget.Latest, true);
    const records = api.records
      .filter((record) => record.origin === origin)
      .map((record) => {
        const statement = source.statements.find(
          (statement) =>
            statement.name?.text === record.name ||
            (ts.isVariableStatement(statement) &&
              statement.declarationList.declarations.some(
                (value) => value.name.getText(source) === record.name,
              )),
        );
        return {
          record,
          declarationLine: statement
            ? source.getLineAndCharacterOfPosition(statement.getStart()).line + 1
            : 0,
        };
      });
    const entry = { records };
    if (!declarationPath) declarations.set(filename, { ...entry, compiled: false });
    // Existing generated MD references shipped dist declarations.
    declarations.set(
      declarationPath ?? path.join(workspaceRoot, origin.replace('/src/', '/dist/esm/').replace(/\.ts$/, '.d.ts')),
      { ...entry, compiled: true },
    );
  }

  const sidebars = {};
  for (const locale of locales) {
    const records = localizedRecords(api.records, locale);
    const recipes = localizeRecipes(zhRecipes, translations, locale);
    const localePolicies = policies.map((policy) => ({
      ...policy,
      title: locale.id === defaultLocale.id ? policy.title : policy.titles.en,
      url: localePath(locale, policy.url),
    }));
    const text = locale.text;

    for (const policy of localePolicies)
      await save(
        policy.url,
        `---\ntitle: ${JSON.stringify(policy.title)}\n---\n\n# ${policy.title}\n\n${text.policyBody}\n${fence(policy.text)}\n`,
      );
    for (const record of records)
      await save(
        record.url,
        normalizeMarkdown(renderRecord(record, records, recipes, localePolicies, locale)),
      );
    for (const recipe of recipes)
      await save(
        localePath(locale, '/recipes/' + recipe.id),
        normalizeMarkdown(renderRecipe(recipe, localePolicies, locale)),
      );

    const attachments = new Map();
    const rootPaths = [
      '/guide',
      '/manual',
      '/api',
      '/recipes',
      '/policies',
      '/examples',
      '/articles',
      '/development',
    ];
    async function rewrite(markdown, source) {
      const matches = [...markdown.matchAll(/(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)/g)];
      let result = markdown;
      for (const match of matches) {
        const [full, label, raw] = match;
        const target = raw.replace(/^<|>$/g, '');
        if (/^(?:[a-z]+:|#)/i.test(target)) continue;
        if (target.startsWith('/')) {
          // Absolute internal links are language-specific; assets and explicit
          // locale prefixes stay untouched.
          const pathname = target.split('#')[0];
          const suffix = target.slice(pathname.length);
          const localized =
            pathname !== '/' &&
            !/^\/(?:zh|en)(?:\/|$)/.test(pathname) &&
            rootPaths.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
          const rootHome = pathname === '/';
          if (localized || rootHome)
            result = result.replace(
              full,
              `[${label}](${localePath(locale, rootHome ? '/' : pathname)}${suffix})`,
            );
          continue;
        }
        const [relative, anchor] = target.split('#');
        const absolute = path.resolve(path.dirname(source), relative);
        const pageKey = absolute.replace(/\.en\.md$/, '.md');
        const routes = pageRoutes.get(pageKey) ?? (pageKey.startsWith(bundledArticles + path.sep)
          ? pageRoutes.get(technicalSources.get(path.relative(bundledArticles, pageKey)))
          : undefined);
        // A link to this page's translated source switches language. Links to
        // other page pairs follow the reader's current language.
        const sourcePageKey = source.replace(/\.en\.md$/, '.md');
        const switchesLanguage = pageKey === sourcePageKey && absolute !== source;
        const targetLocale = switchesLanguage
          ? (absolute.endsWith('.en.md') ? 'en' : 'zh')
          : locale.id;
        let route = routes?.[targetLocale];
        let suffix = anchor ? '#' + anchor : '';
        if (!route && declarations.has(absolute)) {
          const declaration = declarations.get(absolute);
          const line = Number(anchor?.match(/^L(\d+)/)?.[1] ?? 1);
          const candidates = declaration.records.sort((a, b) =>
            declaration.compiled
              ? b.declarationLine - a.declarationLine
              : b.record.line - a.record.line,
          );
          const candidate =
            candidates.find(
              (item) => (declaration.compiled ? item.declarationLine : item.record.line) <= line,
            ) ?? candidates.at(-1);
          if (candidate) route = localePath(locale, candidate.record.url);
          // Barrel-file links lead to the public module directory. Do not turn
          // internal declaration files into additional developer-facing pages.
          else route = localePath(locale, '/api/modules');
          suffix = '';
        }
        if (
          !route &&
          absolute.startsWith(sdkRoot + path.sep) &&
          /\.(?:mjs|ts|json)$/.test(absolute)
        ) {
          const key = locale.id + ':' + absolute;
          if (!attachments.has(key)) {
            try {
              const content = await readFile(absolute, 'utf8');
              const relativeFile = posix(path.relative(sdkRoot, absolute));
              // Dependency paths contain excluded node_modules/dist directories; use a flat page slug.
              const url = localePath(
                locale,
                '/examples/' +
                  (relativeFile.includes('node_modules/')
                    ? 'dependencies/' + slug(relativeFile)
                    : relativeFile.replace(/\.[^.]+$/, '')),
              );
              await save(
                url,
                `---\ntitle: ${JSON.stringify(relativeFile)}\n---\n\n# ${relativeFile}\n\n${fence(content, path.extname(absolute) === '.json' ? 'json' : path.extname(absolute) === '.ts' ? 'ts' : 'js')}\n`,
              );
              attachments.set(key, url);
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
              attachments.set(key, null);
            }
          }
          route = attachments.get(key);
          suffix = '';
        }
        // A repository-only consumer file remains an explicit source location;
        // don't turn it into a fake hosted link or silently ignore broken links.
        result = result.replace(
          full,
          route
            ? `[${label}](${route}${suffix})`
            : label + text.render.repoFile(posix(path.relative(workspaceRoot, absolute))),
        );
      }
      return normalizeMarkdown(result);
    }

    for (const [filename, routes] of pageRoutes) {
      const source =
        locale.id === defaultLocale.id || skillSources.has(filename)
          ? filename
          : filename.replace(/\.md$/, '.en.md');
      await save(routes[locale.id], await rewrite(await readFile(source, 'utf8'), source));
    }

    const layers = text.layers;
    const byLayer = Object.entries(layers).map(([layer, title]) => {
      const values = records.filter((record) => record.layer === layer);
      const domains = [...new Set(values.map((record) => record.domain.id))];
      const textSections = domains.map((id) => {
        const domainRecords = values.filter((record) => record.domain.id === id);
        const table = `| ${text.apiTableHeaders.join(' | ')} |\n| --- | --- | --- |\n${domainRecords.map((record) => `| [${code(record.name)}](${record.url}) | ${record.kind} | ${(record.description || '').replaceAll('|', '\\|').replace(/\n/g, ' ')} |`).join('\n')}\n`;
        // API summaries contain type syntax and template markers just like full symbol pages.
        return {
          title: domainRecords[0].domain.titles[locale.id],
          id,
          table: normalizeMarkdown(table),
        };
      });
      return { layer, title, sections: textSections };
    });
    for (const { layer, title, sections } of byLayer) {
      await save(
        localePath(locale, `/api/${layer}/index`),
        `# ${title}\n\n${sections.map((section) => `## ${section.title}\n\n[${text.openGroup}](${localePath(locale, `/api/${layer}/${section.id}/`)})\n\n${section.table}`).join('\n')}`,
      );
      for (const section of sections)
        await save(
          localePath(locale, `/api/${layer}/${section.id}/index`),
          `# ${section.title}\n\n${title} · [${text.backToLayer}](${localePath(locale, `/api/${layer}/`)})\n\n${section.table}`,
        );
    }
    await save(
      localePath(locale, '/api/index'),
      `# ${text.apiIndexTitle}\n\n${text.apiIndexIntro({
        modules: api.modules.length,
        symbols: api.records.length,
        members: report.publicMembers,
      })}\n\n${text.apiIndexLinks.map((item) => `[${item.text}](${localePath(locale, item.path)})`).join(' · ')}\n${byLayer.map(({ layer, title, sections }) => `## ${title}\n\n${sections.map((section) => `### ${section.title}\n\n[${text.openGroup}](${localePath(locale, `/api/${layer}/${section.id}/`)})\n\n${section.table}`).join('\n')}`).join('\n')}`,
    );
    const recordMap = new Map(records.map((record) => [record.key, record]));
    await save(
      localePath(locale, '/api/modules'),
      `# ${text.modulesTitle}\n\n${text.modulesIntro}\n\n` +
        api.modules
          .map(
            (module) =>
              `## ${module.name}\n\n${module.symbols
                .map((key) => {
                  const record = recordMap.get(key);
                  return `- [${code(record.name)}](${record.url}) · ${record.kind}`;
                })
                .join('\n')}`,
          )
          .join('\n\n'),
    );
    const recipeGroups = groupRecipes(recipes, layers, locale.id);
    const exampleReferences = text.exampleReferences.map(({ title, path }) => ({
      text: title,
      link: localePath(locale, path),
    }));
    const referenceItems = exampleReferences.map(({ text, link }) => `- [${text}](${link})`);
    await save(
      localePath(locale, '/recipes/index'),
      `# ${text.recipesIndexTitle}\n\n${text.recipesIndexIntro}\n\n` +
        `## ${text.exampleReferencesTitle}\n\n${referenceItems.join('\n')}\n\n` +
        recipeGroups
          .map(
            ({ title, recipes }) =>
              `## ${title}\n\n${recipes
                .map(
                  (recipe) =>
                    `- [${recipe.title}](${localePath(locale, '/recipes/' + recipe.id)})${text.render.recipeLinkSeparator}${recipe.summary}`,
                )
                .join('\n')}`,
          )
          .join('\n\n'),
    );
    await save(
      localePath(locale, '/policies/index'),
      `# ${text.policiesTitle}\n\n${text.policiesIntro}\n\n` +
        localePolicies.map((policy) => `- [${policy.title}](${policy.url})`).join('\n'),
    );
    await save(localePath(locale, '/index'), homeMarkdown(locale));

    const sidebarText = text.sidebar;
    const link = (value) => localePath(locale, value);
    const workflowPages = [
      { text: sidebarText.workflowDevelopment, path: '/manual/workflow-development' },
      { text: sidebarText.workflowInspector, path: '/manual/workflow-inspector' },
      { text: sidebarText.developmentSkills, path: '/manual/agent-development' },
    ];
    const workflowTools = {
      text: locale.nav.workflowTools,
      items: workflowPages.map(({ text, path }) => ({ text, link: link(path) })),
    };
    const learning = {
      text: sidebarText.start,
      items: [
        { text: sidebarText.design, link: link('/guide/design') },
        { text: sidebarText.firstApp, link: link('/guide/first-app') },
        { text: sidebarText.mechanics, link: link('/guide/mechanism') },
        { text: sidebarText.apiPath, link: link('/guide/api-path') },
      ],
    };
    const extended = {
      text: sidebarText.extended,
      items: [
        { text: sidebarText.extendedOverview, link: link('/guide/extended/overview') },
        { text: sidebarText.extendedResilience, link: link('/guide/extended/resilience') },
        { text: sidebarText.extendedMock, link: link('/guide/extended/mockgpt') },
        { text: sidebarText.extendedRag, link: link('/guide/extended/rag') },
        {
          text: sidebarText.extendedEvaluation,
          link: link('/guide/extended/retrieval-evaluation'),
        },
        { text: sidebarText.extendedConfig, link: link('/guide/extended/configuration') },
        { text: sidebarText.extendedWorkflowViews, link: link('/guide/extended/workflow-views') },
        { text: sidebarText.extendedChecklist, link: link('/guide/extended/production-checklist') },
      ],
    };
    const common = [
      {
        text: sidebarText.apiOverview,
        items: [
          { text: sidebarText.symbolIndex, link: link('/api/') },
          { text: sidebarText.modules, link: link('/api/modules') },
          { text: sidebarText.scenarios, link: link('/recipes/') },
          { text: sidebarText.policySource, link: link('/policies/') },
        ],
      },
    ];
    const manualTitles = new Map(
      await Promise.all(
        manualFiles.map(async (filename) => [
          filename,
          (await readFile(filename, 'utf8')).match(/^# (.+)$/m)?.[1],
        ]),
      ),
    );
    const manualItems = manualFiles
      .filter((file) => !file.endsWith('.en.md') && !file.includes('/api/'))
      .filter((file) => !workflowPages.some(({ path }) => path === manualRoute(file)))
      .map((filename) => ({
        text:
          manualTitles.get(filename.replace(/\.md$/, locale.id === 'en' ? '.en.md' : '.md')) ??
          path.basename(filename, '.md'),
        link: pageRoutes.get(filename)?.[locale.id],
      }));
    const manual = {
      text: sidebarText.handbook,
      items: [
        { text: sidebarText.apiPath, link: link('/guide/api-path') },
        {
          text: sidebarText.apiHandbook,
          items: [
            { text: locale.id === 'zh' ? '概念与命名' : 'Concepts & naming', link: link('/manual/concepts') },
            { text: locale.id === 'zh' ? '兼容与维护' : 'Compatibility', link: link('/manual/compatibility') },
            { text: locale.id === 'zh' ? '升级指南' : 'Upgrading', link: link('/manual/upgrading') },
            { text: 'ModelRunner / Core', link: link('/manual/api/core') },
            {
              text: locale.id === 'zh' ? '模型协议与生命周期' : 'Model protocols & lifecycles',
              link: link('/manual/api/model-protocols'),
            },
            { text: 'Workflow', link: link('/manual/api/workflow') },
            { text: 'Support', link: link('/manual/api/support') },
            {
              text: locale.id === 'zh' ? '上下文处理' : 'Context processing',
              link: link('/manual/api/context-processing'),
            },
            {
              text: locale.id === 'zh' ? '预算、完成检查与恢复' : 'Budgets, completion & recovery',
              link: link('/manual/api/reliability'),
            },
            {
              text: locale.id === 'zh' ? '类注册与装饰器' : 'Classes & decorators',
              link: link('/manual/api/decorators'),
            },
            {
              text: locale.id === 'zh' ? '请求与调用记录' : 'Requests & invocation records',
              link: link('/manual/api/observability'),
            },
            { text: 'Kit', link: link('/manual/api/kits') },
            {
              text: locale.id === 'zh' ? '结果评审与裁决' : 'Result review & decisions',
              link: link('/manual/api/result-review'),
            },
            { text: 'SKILLs', link: link('/manual/api/skills') },
            { text: sidebarText.symbolIndex, link: link('/manual/api/') },
          ],
        },
        ...manualItems,
      ],
    };
    const recipeNavigation = recipeGroups.map(({ title, recipes, collapsed }) => ({
      text: title,
      ...(collapsed ? { collapsed } : {}),
      items: recipes.map((recipe) => ({
        text: recipe.title,
        link: link('/recipes/' + recipe.id),
      })),
    }));
    sidebars[locale.id] = {
      [link('/')]: [learning, workflowTools, extended, ...common],
      [link('/articles/')]: [
        { text: locale.nav.articles, link: link('/articles/') },
        ...technicalSections.map(({ title, articles }) => ({
          text: title[locale.id],
          items: articles.map((article) => ({
            text: article.title[locale.id],
            link: link('/articles/' + article.id),
          })),
        })),
      ],
      [link('/development/')]: [workflowTools],
      [link('/guide/')]: [learning, workflowTools, extended, ...common],
      ...apiSidebar(records, common, locale),
      [link('/recipes/')]: [
        { text: locale.nav.scenarios, link: link('/recipes/') },
        { text: text.exampleReferencesTitle, items: exampleReferences },
        ...recipeNavigation,
      ],
      [link('/policies/')]: [
        ...common,
        {
          text: sidebarText.policySource,
          items: localePolicies.map((policy) => ({
            text: policy.title,
            link: policy.url,
          })),
        },
      ],
      [link('/manual/')]: [workflowTools, ...common, manual],
    };
  }

  // 根路径只是语言入口：不渲染首页内容，由 head 内联脚本按浏览器语言进入 /en/ 或 /zh/。
  await save('/index', '---\nlayout: false\n---\n');
  await mkdir(path.join(contentRoot, 'public'), { recursive: true });
  await cp(
    path.join(sdkRoot, 'development/docs/assets'),
    path.join(contentRoot, 'public/branding'),
    { recursive: true },
  );
  await cp(
    path.join(siteRoot, 'content/public/auto-lang.js'),
    path.join(contentRoot, 'public/auto-lang.js'),
  );
  await writeFile(path.join(contentRoot, 'public/.nojekyll'), '');
  await writeFile(path.join(outputRoot, 'coverage.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(contentRoot, 'public/api-catalog.json'), JSON.stringify(report));
  return { report, sidebars };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const { report } = await generateSite();
  console.log(JSON.stringify({ ...report, symbolPages: undefined }, null, 2));
}
