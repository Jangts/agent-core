/** Generate the npm article collection from grouped sources while preserving public filenames. */
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const source = fileURLToPath(new URL('../development/article-sources/', import.meta.url));
const destination = path.join(root, 'development/articles');
const check = process.argv.includes('--check');
const sections = JSON.parse(await readFile(path.join(source, 'catalog.json'), 'utf8'));
const sources = new Map(['catalog.json', 'README.md', 'README.en.md'].map((name) => [name, name]));
const isSlug = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]+$/.test(value);
const sectionIds = new Set();
for (const { id, title, articles } of sections) {
  if (!isSlug(id) || sectionIds.has(id) || !title.zh || !title.en || !articles.length)
    throw new Error(`Invalid article section: ${id}`);
  sectionIds.add(id);
  for (const article of articles) {
    if (!isSlug(article.id) || !article.title.zh || !article.title.en || !isSlug(article.skill))
      throw new Error(`Invalid article declaration: ${article.id}`);
    for (const name of [`${article.id}.md`, `${article.id}.en.md`]) {
      if (sources.has(name)) throw new Error(`Duplicate article filename: ${name}`);
      sources.set(name, path.join(id, name));
    }
  }
}
const outputs = new Map(
  [...sources].map(([name, file]) => [path.join(source, file), path.join(destination, name)]),
);
await mkdir(destination, { recursive: true });
for (const [originalFile, filename] of outputs) {
  const raw = await readFile(originalFile, 'utf8');
  const dependencies = new Set();
  const output = raw.replace(/\]\(([^)\n]+)\)/g, (match, link) => {
    if (/^(?:[a-z]+:|#)/i.test(link)) return match;
    const [relativeFile, anchor] = link.split('#');
    const original = path.resolve(path.dirname(originalFile), relativeFile);
    const target = outputs.get(original) ?? original;
    if (target !== root && !target.startsWith(root + path.sep))
      throw new Error(`Article link escapes npm package: ${link}`);
    dependencies.add(original);
    const relative = path.relative(destination, target).split(path.sep).join('/');
    return `](${relative}${anchor ? '#' + anchor : ''})`;
  });
  await Promise.all([...dependencies].map((dependency) => access(dependency)));
  if (check) {
    if ((await readFile(filename, 'utf8').catch(() => '')) !== output)
      throw new Error(`Stale article: ${path.basename(filename)}`);
  } else await writeFile(filename, output);
}
const extras = (await readdir(destination)).filter((name) => !sources.has(name));
if (extras.length) throw new Error(`Unexpected generated article files: ${extras.join(', ')}`);
const count = sections.reduce((total, section) => total + section.articles.length, 0);
console.log(`Validated ${count} bilingual articles${check ? ' (unchanged)' : ''}.`);
