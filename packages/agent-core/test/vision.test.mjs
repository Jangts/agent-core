/*
 * Vision input contracts for the Support layer (支援层): how an image block travels
 * through the OpenAI-compatible provider and how the provider reports the request.
 *
 * The suite pins two boundary rules. The wire body must carry the real image block so
 * the upstream model can read it, while the observation event must not repeat the image
 * bytes, because observations are diagnostic records that can be persisted. Images on a
 * non-user message must be refused before any HTTP dispatch happens.
 *
 * Main exports: none. The file only registers `node:test` cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';

// A data URL image; the payload is not a real PNG, only a URL-shaped fixture.
const image = { url: 'data:image/png;base64,aGVsbG8=' };
test('compatible provider transmits real image blocks and omits bytes in request observation', async () => {
  let requestBody;
  let observed;
  const provider = new Support.CompatibleModelProvider({
    config: () => ({
      baseUrl: 'https://example.com',
      apiKey: 'test',
      model: 'vision',
      maxOutputTokens: 64,
    }),
    observe: {
      provider: {
        accepts: () => true,
        write: (event) => {
          if (event.event === 'provider.request') observed = event;
        },
      },
    },
    ports: {
      request: async (_url, init) => {
        // Capture the serialized body the provider actually sends.
        requestBody = JSON.parse(init.body);
        return new Response(
          'data: {"choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        );
      },
    },
  });
  const parts = [];
  for await (const part of provider.stream(
    [{ role: 'user', content: 'describe', images: [image] }],
    { signal: new AbortController().signal },
  ))
    parts.push(part);
  // A message with images becomes a content-block array: text first, then the image.
  assert.deepEqual(requestBody.messages[0].content, [
    { type: 'text', text: 'describe' },
    { type: 'image_url', image_url: image },
  ]);
  assert.deepEqual(parts, ['ok']);
  assert.ok(observed);
  // The observation replaced the image URL with a placeholder, so the raw bytes
  // must not appear anywhere in the recorded event.
  assert.equal(JSON.stringify(observed).includes('aGVsbG8='), false);
});

test('compatible provider rejects images outside user messages before making HTTP requests', async () => {
  let calls = 0;
  const provider = new Support.CompatibleModelProvider({
    config: () => ({
      baseUrl: 'https://example.com',
      apiKey: 'test',
      model: 'vision',
      maxOutputTokens: 64,
    }),
    ports: {
      request: async () => {
        calls++;
        throw new Error('unexpected');
      },
    },
  });
  await assert.rejects(async () => {
    for await (const _ of provider.stream([{ role: 'system', content: 'text', images: [image] }], {
      signal: new AbortController().signal,
    })) {
    }
  }, /user message/);
  // The message mapping fails during request preparation, before the transport runs.
  assert.equal(calls, 0);
});
