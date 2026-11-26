// Text Blocks Kit contract: structural boundaries, exact reassembly, source offsets,
// over-long lines and option validation. Runs under node --test against the built package.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { TextBlocks, splitTextBlocks } from '@jangts/agent-core/kits/text-blocks';
import * as Kit from '@jangts/agent-core/kits';

const require = createRequire(import.meta.url);
const line = '- 日志条目 ' + 'x'.repeat(60) + '\n';
const longText = `# 标题\n\n${line.repeat(120)}\n## 第二节\n\n${line.repeat(30)}\n最后一行`;

function assertExactPartition(text, blocks) {
  assert.equal(blocks.map((block) => block.text).join(''), text);
  blocks.forEach((block, index) => {
    assert.equal(block.number, index + 1);
    assert.equal(block.text, text.slice(block.start, block.end));
    assert.equal(block.end - block.start, block.text.length);
    if (index) assert.equal(block.start, blocks[index - 1].end);
  });
}

test('individual and bulk Kit entries expose the same splitter', () => {
  const cjs = require('@jangts/agent-core/kits/text-blocks');
  const cjsKit = require('@jangts/agent-core/kits');
  assert.equal(TextBlocks.split, splitTextBlocks);
  assert.equal(cjs.TextBlocks.split, cjs.splitTextBlocks);
  assert.equal(Kit.TextBlocks, TextBlocks);
  assert.equal(cjsKit.TextBlocks, cjs.TextBlocks);
});

test('headings start blocks, blank lines end them, and blocks reassemble exactly', () => {
  const targetChars = 6000;
  const blocks = splitTextBlocks(longText, { targetChars });
  assert.ok(blocks.length > 1);
  assertExactPartition(longText, blocks);
  // Only an over-long line may exceed the target size.
  assert.ok(blocks.every((block) => block.text.length <= targetChars));
  assert.ok(blocks.some((block) => block.text.startsWith('## 第二节')));
  // Every block except the open-ended last line ends on a line boundary.
  assert.ok(blocks.slice(0, -1).every((block) => block.text.endsWith('\n')));
});

test('keeps CRLF line endings and a missing trailing newline intact', () => {
  const text = '第一行\r\n第二行\r\n\r\n第三行';
  const blocks = splitTextBlocks(text, { targetChars: 8 });
  assertExactPartition(text, blocks);
  assert.ok(blocks.length > 1);
  assert.ok(blocks.every((block) => !block.text.includes('\n') || block.text.includes('\r\n')));
  assert.ok(blocks.at(-1).text.endsWith('第三行'));
});

test('an over-long single line stays one block so paging can fragment it later', () => {
  const text = 'a'.repeat(50) + '\n' + 'b'.repeat(40) + '\n';
  const blocks = splitTextBlocks(text, { targetChars: 10 });
  assertExactPartition(text, blocks);
  assert.equal(blocks[0].text, 'a'.repeat(50) + '\n');
  assert.ok(blocks[0].text.length > 10);
  assert.equal(blocks[1].text, 'b'.repeat(40) + '\n');
});

test('empty and whitespace-only input stay exact', () => {
  assert.deepEqual(splitTextBlocks('', { targetChars: 10 }), []);
  for (const text of ['\n\n\n', '\n\ncontent\n', '   ']) {
    const blocks = splitTextBlocks(text, { targetChars: 10 });
    assertExactPartition(text, blocks);
  }
});

test('trailing whitespace after an over-target line stays with that line', () => {
  const text = 'long heading\r\n\n\t';
  const blocks = splitTextBlocks(text, { targetChars: 5 });
  assertExactPartition(text, blocks);
  assert.deepEqual(blocks.map(block => block.text), [text]);
});

test('rejects a missing target size or non-text input', () => {
  assert.throws(() => splitTextBlocks('text', {}), /positive integer target size/);
  assert.throws(() => splitTextBlocks('text', { targetChars: 0 }), /positive integer/);
  assert.throws(() => splitTextBlocks('text', { targetChars: 1.5 }), /positive integer/);
  assert.throws(() => splitTextBlocks(undefined, { targetChars: 10 }), /positive integer/);
});
