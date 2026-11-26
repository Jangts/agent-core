// Agent Core 文档站的 Markdown 渲染：把抽取出的符号记录、配方与策略渲染为 VitePress 页面，
// 并负责 TS→JS 示例转写与配方/策略的关联。只生成文本，不读取或写入文件。
// 界面文案由 locale.text.render 提供，同一份记录可输出中文或英文页面。
import ts from 'typescript';
import { slug } from './paths.mjs';
import { localePath } from './locales.mjs';

/**
 * 生成围栏代码块；label 会作为语言后的方括号标记写入。
 * @param {string} code 代码原文，首尾空白会被裁掉。
 * @param {string} [language] 代码语言标识。
 * @param {string} [label] 代码块标签（如 TypeScript、JavaScript）。
 * @returns {string} 前后带空行的 Markdown 代码块。
 */
export const fence = (code, language = 'ts', label = '') =>
  `\n\`\`\`${language}${label ? ` [${label}]` : ''}\n${code.trim()}\n\`\`\`\n`;
const inline = (value) =>
  '`' + String(value).replaceAll('`', '\\`').replaceAll('|', '\\|').replace(/\r?\n/g, ' ') + '`';
const cell = (value) =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const frontmatter = (title) => `---\ntitle: ${JSON.stringify(title)}\noutline: [2, 3]\n---\n\n`;

/**
 * 把 TypeScript 示例转写为等价的 JavaScript，供页面同时展示两种写法。
 * @param {string} code TypeScript 源码。
 * @returns {string} 转写后的 JavaScript 源码，保留注释。
 */
export const asJavaScript = (code) =>
  ts
    .transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        verbatimModuleSyntax: true,
        experimentalDecorators: true,
        removeComments: false,
      },
    })
    .outputText.trim();

/**
 * 输出 TypeScript / JavaScript 双栏代码组；未提供 JS 版本时退化为单个 TS 代码块。
 * @param {string} tsCode TypeScript 示例。
 * @param {string} [jsCode] 对应的 JavaScript 示例，默认由 tsCode 转写。
 * @returns {string} VitePress 的 code-group 片段。
 */
export function codeGroup(tsCode, jsCode = asJavaScript(tsCode)) {
  return jsCode
    ? `\n::: code-group\n${fence(tsCode, 'ts', 'TypeScript')}${fence(jsCode, 'js', 'JavaScript')}\n:::\n`
    : fence(tsCode);
}

/**
 * 渲染单个示例小节：标题、难度/环境、可选说明与代码组。
 * @param {{ title: string, level?: string, environment?: string, note?: string, ts: string, js?: string }} example 配方中的示例对象。
 * @param {object} locale 语言配置，提供界面文案。
 * @returns {string} Markdown 片段。
 */
export function renderExample(example, locale) {
  const t = locale.text.render;
  return (
    `\n### ${example.title}\n\n${example.level ?? t.exampleLevelDefault} · ${example.environment ?? t.exampleEnvironmentDefault}\n` +
    (example.note ? `\n${example.note}\n` : '') +
    codeGroup(example.ts, example.js)
  );
}

/**
 * 渲染一份配方页：标题、摘要、详细说明、由简入繁示例与关联策略链接。
 * @param {object} recipe 配方对象，含 id、title、summary、details 与 examples。
 * @param {object[]} [policies] 当前语言的全部策略条目，用于筛选引用本配方的链接。
 * @param {object} locale 语言配置。
 * @returns {string} 完整页面 Markdown（含 frontmatter）。
 */
export function renderRecipe(recipe, policies = [], locale) {
  const t = locale.text.render;
  const links = policies.filter((item) => item.recipes.includes(recipe.id));
  return (
    frontmatter(recipe.title) +
    `# ${recipe.title}\n\n${recipe.summary}\n\n${recipe.details ?? ''}\n` +
    `\n## ${t.recipeExamples}\n${recipe.examples.map((example) => renderExample(example, locale)).join('\n')}` +
    (links.length
      ? `\n## ${t.recipePolicies}\n\n${links.map((item) => `- [${item.title}](${item.url})`).join('\n')}\n`
      : '')
  );
}

function fieldTable(fields, locale, fallback) {
  const t = locale.text.render;
  if (!fields?.length) return '';
  return (
    `\n| ${t.fieldHeaders.join(' | ')} |\n| --- | --- | --- | --- |\n` +
    fields
      .map(
        (field) =>
          `| ${inline(field.name)} | ${inline(field.type)} | ${field.optional ? t.optional : t.required} | ${field.readonly ? t.readonlyPrefix : ''}${cell(field.description) || fallback || t.fieldFallback} |`,
      )
      .join('\n') +
    '\n'
  );
}

function variantTables(variants, title, locale) {
  const t = locale.text.render;
  if (!variants?.some((variant) => variant.fields.length)) return '';
  return (
    `\n${t.variantHeading(title)}\n` +
    variants
      .map(
        (variant, index) =>
          `\n::: details ${t.variantBranch(index)}\n\n${
            variant.fields.length
              ? fieldTable(variant.fields, locale) +
                (/\bextends\b/.test(variant.type)
                  ? `\n${t.typeCondition} ${inline(variant.type)}\n`
                  : '')
              : inline(variant.type) + '\n'
          }\n:::\n`,
      )
      .join('\n')
  );
}

function genericTable(parameters, locale) {
  const t = locale.text.render;
  if (!parameters?.length) return '';
  return (
    `\n| ${t.genericHeaders.join(' | ')} |\n| --- | --- | --- |\n` +
    parameters
      .map(
        (parameter) =>
          `| ${inline(parameter.name)} | ${parameter.constraint ? inline(parameter.constraint) : '—'} | ${parameter.default ? inline(parameter.default) : '—'} |`,
      )
      .join('\n') +
    '\n'
  );
}

function definitionSummary(record, locale) {
  const t = locale.text.render;
  const parameters = record.typeParameters ?? [];
  const name =
    record.name +
    (parameters.length ? `<${parameters.map((parameter) => parameter.name).join(', ')}>` : '');
  const alias =
    record.name +
    (parameters.length
      ? `<${parameters
          .map(
            (parameter) =>
              parameter.name +
              (parameter.constraint ? ` extends ${parameter.constraint}` : '') +
              (parameter.default ? ` = ${parameter.default}` : ''),
          )
          .join(', ')}>`
      : '');
  let result = '';
  if (record.kind === 'class' || record.kind === 'interface')
    result += fence(`${record.kind} ${name}`);
  else if (record.kind === 'type') {
    // Object contracts are documented through their fields, not a second dump
    // of the same declaration. Scalar, tuple and conditional types keep their
    // exact type expression because a field table cannot represent them.
    const structured =
      record.fields.length || record.fieldVariants?.some((variant) => variant.fields.length);
    result += structured
      ? `\n${t.definitionType} ${inline(name)}\n`
      : fence(`type ${alias} = ${record.typeExpression};`);
    // Preserve relationships expressed by mapped/conditional/composite aliases
    // for readers who need the exact type, separate from the field reference.
    if (structured && !record.typeExpression.trim().startsWith('{'))
      result += `\n::: details ${t.typeExpression}\n${fence(`type ${alias} = ${record.typeExpression};`)}\n:::\n`;
  } else if (record.kind === 'constant' && !record.members.length)
    result += fence(`const ${name}: ${record.valueType}`);
  else if (record.kind === 'namespace') result += `\n${t.namespace} ${inline(record.name)}\n`;
  if (record.bases?.length)
    result += `\n${t.extends} ${record.bases.map(inline).join(t.joiner)}${t.period}\n`;
  if (parameters.length) result += `\n${t.genericTitle}\n` + genericTable(parameters, locale);
  return result;
}

function callSection(signature, name, locale) {
  const t = locale.text.render;
  const parameters = signature.parameters;
  const signatureText = signature.construct
    ? signature.text.replace(/^new\s*/, `new ${name}`)
    : `${name}${signature.text}`;
  let result = `\n${fence(signatureText)}\n`;
  if (signature.description) result += signature.description + '\n';
  if (!signature.construct) result += genericTable(signature.typeParameters, locale);
  if (parameters.length)
    result +=
      `\n| ${t.callHeaders.join(' | ')} |\n| --- | --- | --- | --- |\n` +
      parameters
        .map(
          (parameter) =>
            `| ${inline(parameter.name)} | ${inline(parameter.type)} | ${parameter.rest ? t.rest : parameter.optional ? t.optional : t.required} | ${cell(parameter.description) || '—'} |`,
        )
        .join('\n') +
      '\n';
  else result += `\n${t.noParameters}\n`;
  for (const parameter of parameters) {
    if (!parameter.fields.length) continue;
    result += `\n::: details ${t.parameterFields(parameter.name)}\n${fieldTable(parameter.fields, locale)}\n:::\n`;
  }
  for (const parameter of parameters)
    result += variantTables(parameter.variants, t.parameterBranch(inline(parameter.name)), locale);
  result += `\n${t.returns} ${inline(signature.returns)}${t.period}\n`;
  if (signature.awaited !== signature.returns)
    result += `\n${t.awaited} ${inline(signature.awaited)}${t.period}\n`;
  if (!signature.construct && signature.outputFields.length)
    result += `\n::: details ${t.outputStructure}\n${fieldTable(signature.outputFields, locale)}\n:::\n`;
  if (!signature.construct)
    result += variantTables(signature.outputVariants, t.outputTitle, locale);
  return result;
}

function importExample(record) {
  const item = record.preferredImport;
  const tsCode = `import ${item.typeOnly ? 'type ' : ''}{ ${item.exported} } from '${item.module}';`;
  const jsCode = item.typeOnly
    ? `/** @typedef {import('${item.module}').${item.exported}} ${item.exported} */`
    : tsCode;
  return codeGroup(tsCode, jsCode);
}

function typeExamples(record, locale) {
  // Type contracts have no runtime behavior. Show the same contract in TS and
  // checked JS instead of inventing configuration values or invoking a type.
  const t = locale.text.render;
  const item = record.preferredImport;
  if (record.typeParameters?.length) return `\n${t.genericUseNote}\n`;
  const property = record.fields.find((field) => /^[a-zA-Z_$][\w$]*$/.test(field.name));
  const expression = property ? `value.${property.name}` : 'value';
  const simple = `import type { ${item.exported} } from '${item.module}';\n\n// ${t.contractCodeComment}\nfunction inspect(value: ${item.exported}) {\n  return ${expression};\n}`;
  const js = `/** @param {import('${item.module}').${item.exported}} value */\nfunction inspect(value) {\n  return ${expression};\n}`;
  return `\n### ${t.contractUsage}\n` + codeGroup(simple, js);
}

/**
 * 渲染单个公开符号页：导入方式、定义、调用/重载、字段、成员详情、关联示例与相关定义。
 * @param {object} record 抽取得到的符号记录，含 kind、runtime、signatures、fields、members 等。
 * @param {object[]} records 当前语言的全部符号记录，用于解析命名空间与引用链接。
 * @param {object[]} recipes 当前语言的配方，用于挂载使用示例。
 * @param {object[]} policies 当前语言的策略条目，用于挂载相关源码链接。
 * @param {object} locale 语言配置。
 * @returns {string} 完整页面 Markdown（含 frontmatter）。
 */
export function renderRecord(record, records, recipes, policies, locale) {
  const t = locale.text.render;
  const related = recipes.filter((recipe) => record.recipeIds?.includes(recipe.id));
  const direct = related.filter((recipe) =>
    recipe.matches.some(
      (match) => record.aliases.includes(match.split('.')[0]) || match === record.name,
    ),
  );
  let result =
    frontmatter(record.name) +
    `# ${record.name}\n\n` +
    `<span class="api-kind">${record.layer.toUpperCase()} · ${record.kind} · ${record.runtime ? t.runtimeValue : t.typeContract}</span>\n\n` +
    (record.description ? `${record.description}\n\n` : '') +
    `${t.import}\n${importExample(record)}\n` +
    `${t.otherImports}${record.imports
      .map((item) => inline(item.module))
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(t.listSeparator)}${t.period}\n\n` +
    `${t.definition}\n${definitionSummary(record, locale)}`;
  if (record.signatures.length) {
    record.signatures.forEach((signature, index) => {
      const title = signature.construct
        ? t.constructor
        : record.signatures.length === 1
          ? t.call
          : t.overload(index);
      result +=
        `\n### ${title} {#call-${index + 1}}\n` + callSection(signature, record.name, locale);
    });
  }
  const fields = record.runtime
    ? record.fields.filter(
        (field) => !record.members.some((member) => !member.static && member.name === field.name),
      )
    : record.fields;
  if (record.staticFields?.length)
    result += `\n${t.staticProperties}\n` + fieldTable(record.staticFields, locale);
  if (fields.length)
    result +=
      `\n${record.kind === 'class' ? t.instanceProperties : t.fieldStructure}\n` +
      fieldTable(fields, locale);
  if (record.indexSignatures?.length)
    result += `\n${t.indexStructure}\n` + fieldTable(record.indexSignatures, locale, t.indexEntry);
  if (record.fieldVariants?.length)
    result += `\n${t.unionStructure}\n` + variantTables(record.fieldVariants, record.name, locale);
  if (record.members.length) {
    result +=
      `\n${t.memberIndex}\n\n| ${t.memberHeaders.join(' | ')} |\n| --- | --- |\n` +
      record.members
        .map(
          (member) =>
            `| [${inline(member.name)}](#member-${slug(member.name)}) | ${member.static ? t.staticPrefix : ''}${cell(member.description) || t.memberFallback} |`,
        )
        .join('\n') +
      '\n';
    result += `\n${t.memberDetails}\n`;
    for (const member of record.members) {
      result +=
        `\n### ${inline(member.name)} {#member-${slug(member.name)}}\n\n` +
        (record.kind === 'class'
          ? `${member.static ? t.staticMember : t.instanceMethod}${t.period}\n\n`
          : '') +
        `${member.description}\n`;
      const name =
        record.kind === 'class' && !member.static
          ? member.name
          : `${record.name}${member.name.startsWith('[') ? '' : '.'}${member.name}`;
      member.signatures.forEach((signature) => {
        result += callSection(signature, name, locale);
      });
    }
  }
  if (record.children.length) {
    result += `\n${t.namespaceIndex}\n\n`;
    result +=
      record.children
        .map((name) => {
          const child = records.find((value) => value.name === name && value.key !== record.key);
          return child
            ? `- [${inline(name)}](${child.url})`
            : record.members.some((member) => member.name === name)
              ? `- [${inline(name)}](#member-${slug(name)})`
              : `- ${inline(name)}${t.seeDefinition}`;
        })
        .join('\n') + '\n';
  }
  if (related.length) {
    result += `\n${t.examples}\n\n`;
    result +=
      related
        .map(
          (recipe) =>
            `- [${recipe.title}](${localePath(locale, '/recipes/' + recipe.id)})${t.recipeLinkSeparator}${recipe.summary}`,
        )
        .join('\n') + '\n';
    const examples = (direct.length ? direct : related).flatMap((recipe) =>
      recipe.examples.map((example) => ({ ...example, recipe: recipe.id })),
    );
    // Keep reference pages focused; all scenario variants remain on the linked recipe.
    for (const example of examples.slice(0, record.runtime ? 3 : 2))
      result += renderExample(example, locale);
    const policyList = policies.filter((policy) =>
      policy.recipes.some((id) => related.some((recipe) => recipe.id === id)),
    );
    if (policyList.length)
      result +=
        `\n${t.relatedPolicies}\n\n` +
        policyList.map((policy) => `- [${policy.title}](${policy.url})`).join('\n') +
        '\n';
  } else if (!record.runtime) result += `\n${t.typeUse}\n` + typeExamples(record, locale);
  else result += `\n${t.usage}\n\n${t.usageText(localePath(locale, '/api/modules'))}\n`;
  const links = records.filter(
    (value) => value.key !== record.key && record.references?.includes(value.key),
  );
  if (links.length)
    result +=
      `\n${t.relatedDefinitions}\n\n` +
      links.map((value) => `- [${inline(value.name)}](${value.url})`).join('\n') +
      '\n';
  return result;
}

/**
 * 为符号记录补充 recipeIds：先按 matches 精确匹配，再沿类型引用把示例传给被引用的类型合同。
 * 直接修改传入的 records（补充 recipeIds 字段），不生成新数组。
 * @param {object[]} records 需要标注示例关联的符号记录。
 * @param {object[]} recipes 全部配方对象。
 * @returns {void}
 */
export function linkRecipes(records, recipes) {
  for (const record of records) {
    record.recipeIds = recipes
      .filter((recipe) =>
        recipe.matches.some(
          (name) => record.aliases.includes(name.split('.')[0]) || record.name === name,
        ),
      )
      .map((recipe) => recipe.id);
  }
  // Input/output contracts inherit examples only from actual type references.
  // No module-wide fallback that could attach an unrelated business example.
  for (let iteration = 0; iteration < 3; iteration++) {
    const additions = new Map();
    for (const record of records) {
      if (!record.recipeIds.length) continue;
      for (const target of records) {
        if (target.runtime || target.recipeIds.length || !record.references?.includes(target.key))
          continue;
        additions.set(target.key, [
          ...new Set([...(additions.get(target.key) ?? []), ...record.recipeIds]),
        ]);
      }
    }
    for (const record of records)
      if (additions.has(record.key)) record.recipeIds = additions.get(record.key);
  }
}
