// Locks template-bound reply formats: only a resolved template imposes format checks; replies
// without one are normalized by the program instead of being rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defineReplyFormats,
  mergeReplyBubbles,
  replyFormatChecks,
} from '@jangts/agent-core/kits/presentation';

const checks = (bubbleLimit = 5, budget = 20) => [
  replyFormatChecks.bubbles(bubbleLimit),
  replyFormatChecks.textBudget(budget),
];

test('text budget measures only string entries', () => {
  const budget = replyFormatChecks.textBudget(4);
  assert.equal(budget.accepts(['text', null]), true);
  assert.equal(budget.accepts(['text', 'extra', null]), false);
});

test('只有命中模板的回复才执行声明的格式检查', () => {
  const formats = defineReplyFormats({
    checks: checks(),
    formats: [
      {
        id: 'listing',
        description: '清单模板',
        checks: ['bubbles'],
        when: ({ listing }) => listing,
      },
    ],
  });
  assert.equal(formats.resolve({ listing: false }), undefined);
  const format = formats.resolve({ listing: true });
  assert.deepEqual(
    format.inspect(['正文', '后续']).map(({ id }) => id),
    [],
  );
  assert.deepEqual(
    format.inspect(['正文', ' ']).map(({ id }) => id),
    ['bubbles'],
  );
});

test('共享检查按模板限额判断气泡数量与正文预算', () => {
  const format = defineReplyFormats({
    checks: checks(3, 6),
    formats: [
      {
        id: 'reply',
        description: '回复模板',
        checks: ['bubbles', 'text-budget'],
        when: () => true,
      },
    ],
  }).resolve({});
  assert.deepEqual(
    format.inspect(['1', '2', '3']).map(({ id }) => id),
    [],
  );
  assert.deepEqual(
    format.inspect(['1', '2', '3', '4']).map(({ id }) => id),
    ['bubbles'],
  );
  assert.deepEqual(
    format.inspect(['1234', '567']).map(({ id }) => id),
    ['text-budget'],
  );
});

test('没有模板时合并超出上限的气泡并丢弃空白气泡', () => {
  assert.deepEqual(mergeReplyBubbles(['第一', ' ', '二', '三', '四', '五'], 4), [
    '第一',
    '二',
    '三',
    '四\n\n五',
  ]);
  // 连续超出时按原顺序合并，不能倒序。
  assert.deepEqual(mergeReplyBubbles(['1', '2', '3', '4', '5', '6', '7'], 3), [
    '1',
    '2',
    '3\n\n4\n\n5\n\n6\n\n7',
  ]);
  assert.deepEqual(mergeReplyBubbles(['', '  '], 4), []);
});

test('格式清单在编译时拒绝未知检查与非正数限额', () => {
  assert.throws(() => defineReplyFormats({ checks: [], formats: [] }), /require formats/);
  assert.throws(
    () =>
      defineReplyFormats({
        checks: checks(),
        formats: [{ id: 'reply', description: '回复', checks: ['missing'], when: () => true }],
      }),
    /Invalid reply format/,
  );
  assert.throws(() => replyFormatChecks.bubbles(0), /Bubble limit/);
  assert.throws(() => replyFormatChecks.textBudget(0), /Text budget/);
});
