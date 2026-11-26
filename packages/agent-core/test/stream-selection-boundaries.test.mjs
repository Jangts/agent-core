/**
 * Locks down event-rendezvous and context-selection boundaries: concurrent emits are
 * refused, emissions after close or a null-reason abort are rejected, preview schema
 * traversal is bounded, malformed preview JSON is retracted, and protected history is not
 * compressed when no older turn exists. Runs under node --test with fixture streams.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';
import { streamEvents } from '../dist/esm/support/stream-events.js';
import { createReplyPreviewRules } from '../dist/esm/support/model/preview-rules.js';
import { beginContextProcessing, chooseSteps } from '../dist/esm/support/context/processing.js';
import { createContextSelector } from '../dist/esm/support/context/selection.js';
test('event rendezvous rejects concurrent sends and rejects emissions after consumer close or null-reason abort', async () => {
  const live = new AbortController();
  let rejected;
  const stream = streamEvents(
    async (emit) => {
      const first = emit('one');
      // A second emit must wait for the first delivery acknowledgement.
      await assert.rejects(emit('two'), /await delivery/);
      await first;
    },
    { signal: live.signal },
  );
  assert.equal((await stream.next()).value, 'one');
  assert.equal((await stream.next()).done, true);
  for (const abort of [false, true]) {
    const controller = new AbortController();
    let emitAfter, producerError;
    const output = streamEvents(
      async (emit) => {
        emitAfter = emit;
        try {
          await emit('one');
        } catch (e) {
          producerError = e;
        }
      },
      { signal: controller.signal },
    );
    assert.equal((await output.next()).value, 'one');
    if (abort) {
      controller.abort(null);
      // A null abort reason is forwarded as-is, so the consumer rejects with null rather
      // than a synthesized AbortError.
      await output.next().then(
        () => assert.fail(),
        (e) => assert.equal(e, null),
      );
    } else await output.return();
    await assert.rejects(emitAfter('late'), /Stream closed/);
    await Promise.resolve();
    assert.match(producerError.message, /Stream closed/);
  }
});
test('preview schema references handle missing/primitive targets, recursion bounds and omitted path declarations', () => {
  const stage = { id: 's', preview: 'tools', toolIds: ['answer'] };
  // An unresolvable or non-object $ref falls back to the local properties, so only the
  // declared text path is previewable; the `when` path never becomes a visible field.
  for (const jsonSchema of [
    {
      $ref: '#/$defs/missing/deep',
      properties: { text: { type: 'string' }, allowed: { type: 'string' } },
    },
    {
      $ref: '#/$defs/value/deep',
      $defs: { value: 3 },
      properties: { text: { type: 'string' }, allowed: { type: 'string' } },
    },
  ]) {
    const rules = createReplyPreviewRules({
      stages: [stage],
      tools: [
        { id: 'answer', jsonSchema, preview: { when: { path: ['allowed'], values: ['yes'] } } },
      ],
    });
    assert.deepEqual(rules[0].paths, [['text']]);
  }
  assert.throws(
    () =>
      createReplyPreviewRules({
        stages: [stage],
        tools: [
          {
            id: 'answer',
            jsonSchema: {
              $ref: '#/$defs/recursive',
              $defs: { recursive: { $ref: '#/$defs/recursive' } },
            },
            preview: { paths: [['text']] },
          },
        ],
      }),
    /Invalid preview field/,
  );
});
test('preview retracts malformed unquoted object fields before exposing their values', async () => {
  const output = [],
    preview = Support.createReplyPreview({
      rules: [{ toolId: 'answer' }],
      sink: (value) => output.push(value),
    });
  await preview({ type: 'model.start', invocationId: 'i', payload: { stageId: 's' } });
  await preview({
    type: 'model.output',
    invocationId: 'i',
    payload: { part: { index: 0, name: 'answer', arguments: '{1}' } },
  });
  // `{1}` is not valid JSON, so the preview retracts rather than exposing any partial value.
  assert.deepEqual(output.at(-1), []);
});
test('protected-history selection skips compression when no older turn exists and includes raw string excerpts only by consent', async () => {
  const signal = new AbortController().signal,
    fragment = {
      id: 'history',
      sourceId: 'app',
      trust: 'user',
      role: 'user',
      lifetime: 'turn',
      maxChars: 1000,
      value: { messages: [{ role: 'user', content: 'recent' }] },
    },
    step = {
      id: 'compress',
      kind: 'compress',
      fragmentId: 'history',
      handlerId: 'c',
      targetChars: 1,
      preserve: { field: 'messages', keepGroups: 1, grouping: { kind: 'user-turn' } },
    };
  const work = beginContextProcessing(
    { fragments: [fragment], maxInputChars: 1000 },
    { mode: 'reduce', steps: [step] },
    {
      stageId: 's',
      signal,
      compressors: [
        {
          id: 'c',
          maxCalls: 0,
          compress() {
            assert.fail();
          },
        },
      ],
      callModel() {
        assert.fail();
      },
    },
  );
  work.report.decisions = [];
  // With keepGroups=1 and a single group there is no older turn to compress, so the step is
  // skipped and neither the compressor nor a model call may run.
  assert.deepEqual(await chooseSteps(work, [step], { mode: 'sequence' }), []);
  const selector = createContextSelector({
    id: 's',
    transport: 't',
    maxOutputTokens: 30,
    maxExcerptChars: 10,
  });
  // Passing the fragment into the selector is the consent boundary; its raw text is then
  // shared with the model unchanged.
  await selector.select({
    stageId: 's',
    fragments: [{ id: 'f', value: 'raw text' }],
    candidates: [],
    currentChars: 10,
    requiredReductionChars: 1,
    remainingCalls: 2,
    async callModel(input) {
      assert.equal(JSON.parse(input.input[1].content).excerpts[0].excerpt, 'raw text');
      return { value: { stepIds: [] } };
    },
  });
});
