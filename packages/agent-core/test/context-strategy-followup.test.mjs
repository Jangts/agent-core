/*
 * Follow-up contract for `Support.createContextStrategy` and `Support.processContext`:
 * how explicitly declared operations relate to the generated defaults, and what the
 * processing plan is allowed to observe or mutate.
 *
 * Three invariants are pinned. A strategy built from explicit steps must not read
 * the generated inputs it does not need (proved with throwing getters). Processing
 * reads each plan field exactly once, so an asynchronous compressor cannot rewrite
 * the budget or the fragment list mid-run. And structural class-based fragments,
 * messages and images are snapshotted, with cancellation inside a getter keeping
 * its own reason.
 *
 * Runs on `dist/esm` with fake ports whose model call always fails, so any
 * unexpected call is visible.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';

const trim = {
  id: 'custom',
  kind: 'trim',
  fragmentId: 'history',
  targetChars: 100,
  field: 'messages',
  keepGroups: 1,
  grouping: { kind: 'user-turn' },
};
const compressor = {
  id: 'custom-compressor',
  maxCalls: 0,
  async compress() {
    return { messages: [] };
  },
};
test('explicit operations replace generated algorithms and their otherwise required dependencies', () => {
  const definition = { kind: 'continuity', steps: [trim] };
  // Explicit steps make the generated `fragment` and `compressor` inputs unused, so
  // reading either of them would be a regression.
  Object.defineProperty(definition, 'fragment', {
    get() {
      throw Error('unused history must not be read');
    },
  });
  Object.defineProperty(definition, 'compressor', {
    get() {
      throw Error('unused compressor must not be read');
    },
  });
  const strategy = Support.createContextStrategy(definition);
  assert.deepEqual(strategy.policy.steps, [trim]);
  assert.deepEqual(strategy.policy.selection, { mode: 'fixed', kind: 'trim' });
  assert.deepEqual(strategy.compressors, []);
  const compress = {
    id: 'summary',
    kind: 'compress',
    fragmentId: 'history',
    targetChars: 100,
    handlerId: compressor.id,
  };
  const combined = Support.createContextStrategy({
    steps: [trim, compress],
    compressors: [compressor],
  });
  assert.deepEqual(combined.policy.selection, { mode: 'sequence' });
  assert.deepEqual(combined.compressors, [compressor]);
});

class Fragment {
  get id() {
    return 'history';
  }
  get sourceId() {
    return 'chat';
  }
  get role() {
    return 'user';
  }
  get trust() {
    return 'user';
  }
  get lifetime() {
    return 'turn';
  }
  get maxChars() {
    return 1000;
  }
  get value() {
    return { messages: [{ role: 'user', content: 'original' }] };
  }
}
class Image {
  get url() {
    return 'fixture';
  }
  get detail() {
    return 'high';
  }
}
class Message {
  get role() {
    return 'user';
  }
  get content() {
    return 'attachment';
  }
  get images() {
    return [new Image()];
  }
}
const ports = () => ({
  stageId: 'check',
  signal: new AbortController().signal,
  compressors: [],
  callModel: async () => {
    throw Error('No model call expected');
  },
});

test('processing accepts structural fragment, message and image metadata before data snapshotting', async () => {
  const fragment = new Fragment();
  const result = await Support.processContext(
    {
      fragments: [fragment],
      originalFragments: [fragment],
      mutableFragmentIds: [],
      additionalMessages: [new Message()],
      maxInputChars: 1000,
    },
    { mode: 'validate' },
    ports(),
  );
  assert.deepEqual(result.context.messages.at(-1), {
    role: 'user',
    content: 'attachment',
    images: [{ url: 'fixture', detail: 'high' }],
  });
  assert.equal(result.context.fragmentUsage[0].sourceId, 'chat');
});

test('processing keeps the Core character-budget domain and does not bypass a zero budget', async () => {
  const result = await Support.processContext(
    { fragments: [new Fragment()], maxInputChars: Infinity },
    { mode: 'validate' },
    ports(),
  );
  assert.equal(result.context.maxInputChars, Infinity);
  await assert.rejects(
    Support.processContext(
      { fragments: [new Fragment()], maxInputChars: 0 },
      { mode: 'validate' },
      ports(),
    ),
  );
  for (const maxInputChars of [NaN, -1, 0.5])
    await assert.rejects(
      Support.processContext(
        { fragments: [new Fragment()], maxInputChars },
        { mode: 'validate' },
        ports(),
      ),
    );
});

test('a class fragment still cannot change protected original data through Support', async () => {
  class Changed extends Fragment {
    get value() {
      return { messages: [] };
    }
  }
  await assert.rejects(
    Support.processContext(
      {
        fragments: [new Changed()],
        originalFragments: [new Fragment()],
        mutableFragmentIds: [],
        maxInputChars: Infinity,
      },
      { mode: 'validate' },
      ports(),
    ),
  );
});

test('the original plan is read once and cannot alter final budget during asynchronous compression', async () => {
  const input = {
    fragments: [
      {
        id: 'history',
        sourceId: 's',
        role: 'user',
        trust: 'user',
        lifetime: 'turn',
        maxChars: 1000,
        value: { text: 'x'.repeat(300) },
      },
    ],
    maxInputChars: 1000,
  };
  // The compressor mutates its own input while awaiting; the committed result must
  // keep the original budget and still account for the original fragment.
  const result = await Support.processContext(
    input,
    {
      mode: 'reduce',
      triggerChars: 100,
      steps: [
        {
          id: 'summary',
          kind: 'compress',
          fragmentId: 'history',
          targetChars: 50,
          handlerId: 'summary',
        },
      ],
    },
    {
      ...ports(),
      compressors: [
        {
          id: 'summary',
          maxCalls: 0,
          async compress() {
            await Promise.resolve();
            input.maxInputChars = 1;
            input.fragments.length = 0;
            return { text: 'ok' };
          },
        },
      ],
    },
  );
  assert.equal(result.context.maxInputChars, 1000);
  assert.equal(result.context.fragmentUsage.length, 1);
  const reads = {};
  const plan = {};
  for (const [key, value] of Object.entries({
    fragments: [new Fragment()],
    maxInputChars: 1000,
    originalFragments: [new Fragment()],
    additionalMessages: [],
    mutableFragmentIds: [],
  })) {
    Object.defineProperty(plan, key, {
      get() {
        reads[key] = (reads[key] ?? 0) + 1;
        return value;
      },
    });
  }
  await Support.processContext(plan, { mode: 'validate' }, ports());
  // Every plan field is read exactly once: no re-read after an await, which is what
  // keeps the budget from changing mid-processing.
  assert.deepEqual(Object.values(reads), [1, 1, 1, 1, 1]);
});

test('cancellation inside plan or fragment getters keeps its exact reason and stops later work', async () => {
  for (const at of ['plan', 'fragment']) {
    const control = new AbortController(),
      reason = Error('getter cancelled');
    let later = 0;
    const input = { maxInputChars: 1000, fragments: [new Fragment()] };
    if (at === 'plan')
      Object.defineProperty(input, 'maxInputChars', {
        get() {
          control.abort(reason);
          return NaN;
        },
      });
    else
      input.fragments = [
        {
          get id() {
            control.abort(reason);
            throw Error('getter failed');
          },
        },
      ];
    await assert.rejects(
      Support.processContext(
        input,
        {
          mode: 'reduce',
          steps: [
            { id: 's', kind: 'compress', fragmentId: 'history', targetChars: 10, handlerId: 's' },
          ],
        },
        {
          ...ports(),
          signal: control.signal,
          compressors: [
            {
              id: 's',
              maxCalls: 0,
              async compress() {
                later++;
                return {};
              },
            },
          ],
        },
      ),
      (error) => error === reason,
    );
    assert.equal(later, 0);
  }
});
