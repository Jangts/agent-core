/**
 * Text Blocks Kit integration: one large multi-section document is split through the
 * published ESM and CJS entries and paged the way a consumer reads it. The test checks that
 * pages cover the source exactly once, that block offsets map back to the source, and that a
 * known region can be re-read without scanning the whole text.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { TextBlocks as EsmTextBlocks } from '@jangts/agent-core/kits/text-blocks';

const require = createRequire(import.meta.url);
const { TextBlocks: CjsTextBlocks } = require('@jangts/agent-core/kits/text-blocks');
const sections = Array.from(
  { length: 8 },
  (_, index) => `## 第${index + 1}节\n\n` + `- 记录 ${index + 1}-条 状态正常\n`.repeat(400) + '\n',
);
const source = `# 运行报告\n\n${sections.join('')}`;

test('published entries page one large document into blocks that cover it exactly once', () => {
  for (const TextBlocks of [EsmTextBlocks, CjsTextBlocks]) {
    const blocks = TextBlocks.split(source, { targetChars: 4000 });
    assert.equal(blocks.map((block) => block.text).join(''), source);
    // 每个章节标题都必须是某个块的起点，模型不会拿到没有标题的孤立片段。
    for (let index = 1; index <= sections.length; index++) {
      assert.ok(
        blocks.some((block) => block.text.startsWith(`## 第${index}节`)),
        `section ${index} must start a block`,
      );
    }
    // 消费端按块索引分页：页与页首尾相接，不重不漏。
    let offset = 0;
    let restored = '';
    let pages = 0;
    while (offset !== undefined) {
      const page = blocks.slice(offset, offset + 3);
      assert.ok(page.length > 0);
      for (const block of page) assert.equal(source.slice(block.start, block.end), block.text);
      restored += page.map((block) => block.text).join('');
      offset = offset + page.length < blocks.length ? offset + page.length : undefined;
      pages++;
    }
    assert.equal(restored, source);
    assert.equal(pages, Math.ceil(blocks.length / 3));
    // 已知关键词可定位到单个块并单独回读，不需要重新扫描全文。
    const target = blocks.find((block) => block.text.includes('记录 6-条'));
    assert.ok(target && target.start > 0);
    assert.equal(source.slice(target.start, target.end), target.text);
  }
});
