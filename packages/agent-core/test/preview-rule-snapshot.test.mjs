// Locks `Support.createReplyPreviewRules` snapshotting: path, capability and stage getters are read
// once, defaults derive from the real JSON schema, and generated rules are frozen copies.
// `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';

const stages = [{ id: 'reply', toolIds: ['answer'], preview: 'tools' }];
const schema = {
  type: 'object',
  properties: { text: { type: 'string' }, status: { type: 'string' } },
};

test('preview validation and emitted rule share the same snapshot of path getters', () => {
  let reads = 0;
  const path = [];
  // The first read returns 'text'; every later read would return 'secret'.
  Object.defineProperty(path, '0', {
    enumerable: true,
    get() {
      return ++reads === 1 ? 'text' : 'secret';
    },
  });
  path.length = 1;
  const rules = Support.createReplyPreviewRules({
    stages,
    tools: [{ id: 'answer', jsonSchema: schema, preview: { paths: [path] } }],
  });
  assert.deepEqual(rules[0].paths, [['text']]);
  assert.equal(reads, 1);
});

test('capability and stage getters are read once while unrelated service metadata is ignored', () => {
  const reads = { preview: 0, schema: 0, id: 0, mode: 0, ids: 0, path: 0, values: 0 };
  class Capability {
    get id() {
      return 'answer';
    }
    get preview() {
      reads.preview++;
      return {
        paths: [['text']],
        when: {
          get path() {
            reads.path++;
            return ['status'];
          },
          get values() {
            reads.values++;
            return ['done'];
          },
        },
        get metadata() {
          assert.fail('unrelated preview metadata must not execute');
        },
      };
    }
    get jsonSchema() {
      reads.schema++;
      return schema;
    }
    get metadata() {
      assert.fail('unrelated capability metadata must not execute');
    }
  }
  class Stage {
    get id() {
      reads.id++;
      return 'reply';
    }
    get preview() {
      reads.mode++;
      return 'tools';
    }
    get toolIds() {
      reads.ids++;
      return ['answer'];
    }
  }
  const rules = Support.createReplyPreviewRules({
    stages: [new Stage()],
    tools: [new Capability()],
  });
  assert.deepEqual(rules[0].when, { path: ['status'], values: ['done'] });
  // Per-field read counts show each canonical property is snapshotted exactly once.
  assert.deepEqual(reads, { preview: 1, schema: 1, id: 1, mode: 1, ids: 1, path: 1, values: 1 });
});

test('schema getters are snapshotted before repeated path eligibility checks', () => {
  let reads = 0;
  const properties = {};
  Object.defineProperty(properties, 'text', {
    enumerable: true,
    get() {
      reads++;
      return { type: 'string' };
    },
  });
  const capability = {
    id: 'answer',
    jsonSchema: { type: 'object', properties },
    preview: { paths: [['text'], ['text']] },
  };
  const rules = Support.createReplyPreviewRules({ stages, tools: [capability] });
  assert.deepEqual(rules[0].paths, [['text'], ['text']]);
  assert.equal(reads, 1);
});

test('default preview eligibility includes only common paths declared by the actual schema', () => {
  const variants = [
    { properties: { text: { type: 'string' } }, expected: [['text']] },
    // Array fields are previewed through a wildcard path.
    {
      properties: { bubbles: { type: 'array', items: { type: 'string' } } },
      expected: [['bubbles', '*']],
    },
    {
      properties: {
        text: { type: 'string' },
        bubbles: { type: 'array', items: { type: 'string' } },
      },
      expected: [['text'], ['bubbles', '*']],
    },
  ];
  for (const { properties, expected } of variants) {
    const capability = { id: 'answer', jsonSchema: { type: 'object', properties }, preview: true };
    const rules = Support.createReplyPreviewRules({ stages, tools: [capability] });
    assert.deepEqual(rules[0].paths, expected);
    assert.ok(Object.isFrozen(rules[0].paths));
    assert.ok(rules[0].paths.every(Object.isFrozen));
    assert.equal(Object.isFrozen(capability), false);
    assert.equal(Object.isFrozen(properties), false);
  }
  assert.throws(
    () =>
      Support.createReplyPreviewRules({
        stages,
        tools: [
          {
            id: 'answer',
            jsonSchema: { type: 'object', properties: { secret: { type: 'string' } } },
            preview: true,
          },
        ],
      }),
    /Invalid preview field/,
  );
});

test('explicit preview paths remain strict and generator output cannot mutate caller data', () => {
  const paths = [['text']];
  const when = { path: ['status'], values: ['done'] };
  const rules = Support.createReplyPreviewRules({
    stages,
    tools: [{ id: 'answer', jsonSchema: schema, preview: { paths, when } }],
  });
  assert.notEqual(rules[0].paths, paths);
  assert.notEqual(rules[0].when.path, when.path);
  assert.ok(Object.isFrozen(rules[0].when.values));
  // Generated rules are deep-frozen, so callers cannot widen the preview later.
  assert.throws(() => rules[0].paths[0].push('secret'), TypeError);
  paths[0][0] = 'secret';
  when.values[0] = 'changed';
  assert.deepEqual(rules[0].paths, [['text']]);
  assert.deepEqual(rules[0].when.values, ['done']);
  assert.throws(
    () =>
      Support.createReplyPreviewRules({
        stages,
        tools: [
          { id: 'answer', jsonSchema: schema, preview: { paths: [['text'], ['missing']] } },
        ],
      }),
    /Invalid preview field/,
  );
});
