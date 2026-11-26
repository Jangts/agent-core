# The MockGPT simulated model Kit

MockGPT simulates model replies with fixed data, functions and lightweight text algorithms, and is suited to debugging protocols, tool selection, streaming output, failure and cancellation. It does not perform real LLM inference. Ordinary rules do not use the network; the web source is an explicit optional network capability.

Install `@jangts/mock-gpt` before using the `/mock`, `/mock/node` or `/mock/web` entries; it is an optional peer dependency and is not installed with this package.

## Entry points and public exports

| Entry | Runtime exports | Type exports |
| --- | --- | --- |
| `@jangts/agent-core/mock` | `MockGPT`, `generators`, `generatorNames`, `responses`, `ResponseDescription`, `MockGPTError`, `routes`, `encodeModelResponse` | `JsonValue`, `Message`, `ModelRequest`, `GenerationInput`, `GenerationOptions`, `GenerationContext`, `Generator`, `Generated`, `Rule`, `MockGPTOptions`, `CallRecord`, `ToolCall`, `OutputOptions`, `ModelOutput`, `HttpFault`, `Usage`, `TextSource`, `TextOptions` |
| `@jangts/agent-core/mock/node` | `createMockServer`, `createMockHandler` | `ServerOptions`, `HandlerOptions` |
| `@jangts/agent-core/mock/web` | `sources`, `isPublicAddress` | `WebOptions`, `LoadedPage`, `WebProfile` |

Node HTTP and web extraction are imported from separate sub-entries; the root entry can generate data directly on the frontend or server. The three entries forward the same implementation and do not define a separate rule protocol.

## Starting from a fixed reply

### TypeScript

```ts
import { MockGPT, type MockGPTOptions } from '@jangts/agent-core/mock';

const options: MockGPTOptions = {
  rules: [{ id: 'greeting', prompt: '你好', generator: '你好，有什么可以帮你？' }],
};
const mock = new MockGPT(options);
const value = await mock.generate({
  model: 'demo', messages: [{ role: 'user', content: '你好' }],
});
console.log(value);
```

### JavaScript

```js
import { MockGPT } from '@jangts/agent-core/mock';
const mock = new MockGPT({
  rules: [{ prompt: '你好', generator: '你好，有什么可以帮你？' }],
});
console.log(await mock.generate({
  model: 'demo', messages: [{ role: 'user', content: '你好' }],
}));
```

`generate(input, options?) → Promise<Generated>`: input contains `model: string` and `messages: readonly Message[]` and may carry additional JSON condition fields; options accepts `signal`. Message has a required role, plus content, tool_calls, tool_call_id and extension fields.

The return value is a standalone frozen snapshot of a string, native JSON or an explicit ResponseDescription. generate does not create an HTTP response and does not perform the delays, chunking or faults in the description; the caller interprets the description itself. Optional undefined fields of the input object are omitted; array holes, undefined array elements, circular references and non-JSON data are rejected. Output must likewise be complete valid JSON and cannot contain undefined.

JSON snapshots are limited to 64 levels and 100,000 value nodes; an over-limit request is `MOCK_REQUEST` (400), and an over-limit generation result is `MOCK_GENERATION`. Fields are read once and no hidden `toJSON` is executed; names such as `__proto__` are kept as ordinary own data fields.

`encodeModelResponse(request, output, id, created, signal, finish)` encodes a validated model result as a Chat Completions JSON／SSE Response. `created` uses Unix seconds; `finish(error?, cancelled?)` is called when the response completes, fails or is cancelled. The adapter owns request validation, first-packet delay, ID and lifecycle; the encoder owns content chunking, backpressure, tools, usage and the terminal frame, and does not execute rules or modify MockGPT records.

## Instance configuration and rules

| MockGPTOptions | Semantics／default |
| --- | --- |
| rules | Required, ordered Rule array |
| fallback | Optional Generator; fails when nothing matches and there is no fallback, and does not forward to a real model |
| selectPrompt(request) | Synchronously returns the matching text; by default takes the text blocks of the last user message and joins them with newlines in their original order |
| stream | Instance defaults chunkSize=24, intervalMs=0, optional wireChunkSize |
| seed | Random initial value, default 1; 0 to 4294967295 |
| clock | Function returning milliseconds, default current time |
| recordLimit | Maximum number of retained records, default 100; 0 to 10000 |
| maxBodyBytes | Byte limit for fetch request bodies, default 1048576, positive safe integer |
| maxOutputChars | Output character limit, default 1000000, positive safe integer |

Rule requires `generator`; `id` may be omitted and is generated from position, and explicit IDs must be unique. `prompt` accepts an exact string or a regular expression, `model` restricts the model name, `when(request)` is a synchronous boolean predicate, and `times` is a positive integer hit limit. Declaration order determines priority: the first rule that satisfies all conditions and is not exhausted runs.

A Generator is JSON／string／ResponseDescription, or `(context) => Generated | Promise<Generated>`. context contains the frozen request, the projected prompt, the regex match, the global callIndex, the hit ruleIndex of the current rule, signal, random, clock and report(metadata). request is a standard request containing model, messages, stream and optional tools／stream_options.

On a hit, the hit count and sequence number are allocated and are not refunded on failure or cancellation. A fixed seed reproduces output verbatim only when the call order, clock, callbacks and external environment are also fixed. Configuration is stored as a snapshot; external state captured by callback closures remains the caller's responsibility.

## Input-dependent generators

All generators come from `generators`; `generatorNames` gives the names in that same registry.

| Method | Parameters and result |
| --- | --- |
| summary(options?) | Extracts representative sentences; default at most 240 code points and 3 sentences |
| bullets(options?) | Bullet text; default at most 500 code points and 3 items |
| keywords(options?) | JSON string array sorted by word frequency; count defaults to 3 |
| title(options?) | Title from the first sentence; default at most 24 code points |
| reply(options?) | Simulated reply; default at most 500 code points; may provide template({ text, previous }) |
| extract(options?) | Returns a field object; fields is a dictionary from name to regular expression, taking the first capture group or the full match, and null when there is no match; defaults to email/date/amount |
| integer(min?, max?)／float(min?, max?) | Returns a number generator function; integers default 0 to 100, floats default 0 to 1 |
| boolean()／pick(items) | Returns a boolean／option generator function; items must be non-empty |
| id(prefix?)／date()／sentence() | Returns an ID／ISO date／built-in sentence generator function; the ID prefix defaults to mock |
| imageUrl({ width?, height? }?) | Returns a local SVG data URL generator function; default 320×180, side lengths 1 to 4096 |
| sequence(items) | Selects a Generator from a non-empty list by rule hit sequence number, and fails when exhausted |
| toolCall(name, arguments, options?) | Generates an explicit tool proposal and does not execute the tool |

TextOptions supports `source: string | (context => string | Promise<string>)`, `maxChars` (1 to 30000) and `count` (1 to 100); source defaults to prompt. summary／bullets use sentence ranking and repetition control, analyze at most 30000 code points and 180 distribution candidate sentences, and sample over-long sources from the beginning／middle／end; the other text generators analyze at most the first 30000 code points. JSON arrays and objects are not truncated into invalid JSON for character limits. These algorithms provide no guarantee of semantic reasoning accuracy.

```ts
import { MockGPT, generators } from '@jangts/agent-core/mock';
const age = generators.integer(18, 60);
const mock = new MockGPT({
  seed: 42,
  rules: [
    { prompt: /总结/, generator: generators.summary({ maxChars: 120 }) },
    { prompt: '用户资料', generator: context => ({ age: age(context) }) },
  ],
});
```

The example above also works directly as JavaScript. Field generator functions should be evaluated with the current context inside the generator callback and cannot be returned directly as JSON fields.

## Explicit responses and faults

`ResponseDescription` distinguishes model, http and reject by kind and value; ordinary JSON does not become transport control because of a field with the same name.

| helper | Input／product |
| --- | --- |
| responses.text(content, options?) | Text ModelOutput description |
| responses.toolCalls(tools, options?) | Tool array description with content=null; each item contains name, JSON arguments and an optional id |
| responses.httpError(status, body?) | HTTP 400 to 599; the default error.message is a simulated error description |
| responses.reject(message?) | Network failure description |

OutputOptions: `finishReason` is stop／length／tool_calls／content_filter; `usage` contains prompt_tokens, completion_tokens and total_tokens, all non-negative safe integers whose total is consistent. `delayMs` is the first-response delay and `intervalMs` the frame interval, both default 0; `chunkSize` controls the code points of content／tool deltas, and `wireChunkSize` splits SSE further by bytes; `interruptAfter` interrupts after the specified data frame without sending a successful end marker. Chunk sizes are 1 to 1000000, delays／intervals 0 to 60000 milliseconds, and the interrupt frame count 0 to 60000.

```js
import { MockGPT, responses } from '@jangts/agent-core/mock';
const mock = new MockGPT({ rules: [
  { prompt: '限流', generator: responses.httpError(429, { error: { message: 'limited' } }) },
  { prompt: '中断', generator: responses.text('逐步输出', { chunkSize: 1, interruptAfter: 2 }) },
  { generator: responses.toolCalls([{ name: 'lookup', arguments: { id: 'demo' } }]) },
] });
```

## fetch and the streaming protocol

`mock.fetch(input, init?) → Promise<Response>` is a bound standard fetch callback that can be injected directly into clients that accept a custom fetch. `routes` lists the supported routes: POST `/v1/chat/completions` and `/chat/completions`. Plain JSON returns a single choice, and a plain JSON product is encoded as JSON text in message.content; stream=true returns SSE. Only n=1 is supported, and explicit usage enters the SSE usage chunk only when the request sets stream_options.include_usage; real tokens are not estimated.

```js
const response = await mock.fetch('https://mock.local/v1/chat/completions', {
  method: 'POST',
  body: JSON.stringify({ model: 'demo', messages: [{ role: 'user', content: '你好' }] }),
});
console.log(await response.json());
```

It does not intercept the network globally and does not forward to a real model. HTTP errors return the corresponding Response; network faults reject fetch; a stream interruption is expressed by a failed read of response.body. Request cancellation prevents generators that have not started and aborts delays, streams and waits; external side effects already emitted are not rolled back automatically, and custom generators should cooperate with signal.

## Node HTTP server

```ts
import { MockGPT } from '@jangts/agent-core/mock';
import { createMockServer } from '@jangts/agent-core/mock/node';
const mock = new MockGPT({ rules: [{ generator: '调试回复' }] });
const server = createMockServer({ mock });
const address = await server.listen({ port: 4317 });
console.log(address);
// 调试结束：await server.close();
```

JavaScript uses the same form. HandlerOptions contains the required mock, maxBodyBytes (default 1048576), requestTimeoutMs (default 30000), allowedHosts and allowedOrigins; ServerOptions additionally has closeTimeoutMs (default 1000 milliseconds). `createMockHandler(options)` returns a Node IncomingMessage／ServerResponse handler that can be mounted on an existing HTTP server.

`listen({ host?, port? }?)` defaults to the loopback host and port 4317, and port=0 is for temporary tests; it returns `{ host: string, port: number, url: string }`. Closing cancels in-flight requests and is bounded by the close deadline; repeated listen while starting, listening or closing is rejected with MOCK_ACTIVE; concurrent close waits for the same shutdown, and the server can listen again after it closes.

Host is validated before Origin. By default only localhost, loopback addresses and the local address the connection arrived on are accepted; an explicitly bound host name is also usable. allowedHosts explicitly lists proxy host names and does not support wildcards; allowedOrigins authorizes cross-origin sources separately and does not relax Host. A proxy cannot bypass target validation by forging Origin.

## Web source

```js
import { MockGPT, generators } from '@jangts/agent-core/mock';
import { sources } from '@jangts/agent-core/mock/web';
const mock = new MockGPT({ rules: [{
  generator: generators.summary({ source: sources.web({
    url: 'https://example.com/', timeoutMs: 20000,
    fallback: '无法取得网页正文，请提供文字材料。',
  }) }),
}] });
```

`sources.web(options?) → TextSource` fetches HTML or plain text and extracts the body; it is not a browser and does not log in, carry cookies or carry model credentials. WebOptions: url is a fixed HTTP(S) URL or a synchronous context selector function; when omitted, the prompt must contain exactly one URL. profile uses browser; the type also accepts crawler (identical request headers); headers are used only for restricted content negotiation. timeoutMs defaults to 20000 and covers the full download; maxBytes defaults to 2097152, maxChars to 30000 and maxRedirects to 3.

Only public addresses are allowed, and DNS and redirects are checked hop by hop; `isPublicAddress(address)` returns a boolean for whether the address is usable. Local, private, special-purpose addresses and URLs carrying credentials are rejected. fallback is the alternative source text used when reading fails; it still passes through the text generators and records sourceFallback; cancellation, invalid URL and target address rejection are not turned into a successful fallback. Verification pages, login redirects, firewalls and upstream HTTP failures keep their real cause.

A trusted `load(url: URL, signal, maxBytes) → Promise<LoadedPage>` can be injected for offline or custom reads; LoadedPage is `{ bytes: Uint8Array, url: string, contentType: string, status?: number }`, and an omitted status is treated as 200. A custom load owns its own target access policy and cannot be injected by a remote request.

## Records, cancellation and errors

`mock.records` returns a CallRecord snapshot: id, index, model, optional path／ruleId, fallback, status (pending/completed/error/cancelled), optional errorCode, metadata. Requests and generated bodies are not stored by default, and report accepts only bounded JSON metadata. `mock.counts` returns rule hit counts, and `activeRequests` contains streams that have not completed. `reset()` clears records, counts and random state; it is rejected with MOCK_ACTIVE while requests or streams are active.

MockGPTError carries code, status and optional details. Common codes: MOCK_CONFIG invalid configuration, MOCK_REQUEST invalid request, MOCK_BODY_LIMIT／MOCK_OUTPUT_LIMIT budget exceeded, MOCK_RULE_NOT_FOUND no match, MOCK_SEQUENCE_EXHAUSTED sequence exhausted, MOCK_NETWORK network fault, MOCK_HTTP simulated HTTP fault, MOCK_ACTIVE active lifecycle conflict. Cancellation preserves the caller's signal reason; fetch may encode a respondable error as an error response, and custom generator exceptions are recorded as failures without fabricating successful content.

These budgets limit simulated execution and do not replace the Agent's real model／tool budgets and permissions. Tool proposals are always authorized and executed by the caller; low-level negative cases such as hand-written broken SSE and invalid bytes are still expressed by dedicated fixtures.
