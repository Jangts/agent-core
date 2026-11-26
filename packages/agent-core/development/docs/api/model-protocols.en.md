# Model protocols and lifecycles

`ModelRunner` owns admission, cancellation, budgets, terminal validation and business results. `Support.createModelProvider` adapts five conversation protocols to the same contract. Switching protocols within the same task keeps tools, authorization, orchestration and result access unchanged when the target model supports the required capabilities.

## Text generation

```ts
import { ModelRunner, Support } from '@jangts/agent-core';
const provider = Support.createModelProvider({
  protocol: 'responses',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.MODEL_API_KEY!,
  model: process.env.MODEL_NAME!,
});
const result = await new ModelRunner({ provider }).invoke('Explain tool calling in one sentence.');
console.log(result.value); // string
```

The host supplies credentials and model configuration. `baseUrl` is the API root, without the path appended by the adapter. `stream: false` selects complete HTTP responses; SSE is the default. Both produce the same business result.

| protocol | Appended path |
| --- | --- |
| chat-completions | /chat/completions |
| responses | /responses |
| messages | /messages |
| generate-content | /models/{model}:streamGenerateContent or generateContent |
| interactions | /interactions |

Use the vendor's /v1 root for OpenAI-style or Messages endpoints, and the Gemini /v1beta root for Google protocols. `request` injects fetch, `headers` supplies explicit extensions, and protected authentication fields are set by the adapter. `maxOutputTokens` supplies a default output request within Core limits. `modelProtocolCatalog` describes protocol expressiveness, not verified support or permission for every model.

The adapter counts actual bytes read from full JSON responses. The default limit is 16 MiB and `maxResponseBytes` overrides it. Crossing the limit releases the response stream and reports `MODEL_RESPONSE_LIMIT`. Runner accounts for generated content separately.

## One authorized tool loop

The [complete runnable example](../../examples/model-protocols.mjs) shares one read-only tool catalog, authorization, history and stopping condition across all five protocols. Running it directly uses deterministic wire fixtures without network access. `runModelProtocolExample(protocol, connection)` also accepts an explicit real connection. Tools are executed by Core and their actual results are returned with the original call ID.

```ts
const interaction = Support.createModelInteraction({
  id: 'conversation', response: 'tools', tools: runtime.tools,
});
const model = new ModelRunner({ provider, interactions: [interaction] }).bind(execution);
let continuation;
const result = await model.invoke({ input: history, interaction,
  modelOptions: { continuation, onContinuation(value) { continuation = value; } },
});
for (const call of result.value.calls) {
  const receipt = await runtime.invoke(call);
  // Append receipt.value as a tool message associated with call.id.
}
```

`runtime` is produced by `Support.defineToolCatalog(definitions).bind({ app, execution })`. Per-turn `modelOptions` avoids rebuilding interactions to update continuation state. Plain text remains a string, selection interactions retain their exact generic result, and tool responses return prose and calls. JSON operation selection requires an explicit `jsonObjectInteraction`; model names never trigger a hidden fallback.

The portable function schema subset includes object and scalar types, properties, required, items, enum, additionalProperties, description and title. Unsupported keywords fail before generation with their schema path. Native strict schemas, JSON object mode and local parsing are different guarantees. Local tools still require Core validation and current authorization.

## Ordered content and resources

`ModelMessage.parts` replaces the legacy content/images shorthand when present. Keep the content string, using an empty string for typed-only input. Ordered text, image, audio, video and file parts preserve semantic order. Unsupported modalities fail before generation.

`Support.prepareModelResources({ runner, inputs, ports, maxBytes, maxItems?, signal? })` accepts ordered text or media whose source is a URL, bytes with a MIME type, or a host resource reference. Supply a request-bound Runner and host authorize/resolve ports. Preparation uses a bounded zero-generation Core operation; failures do not generate a model response. Byte sources become bounded data URLs. The library does not fetch remote URLs; an unknown transfer size is not reported as zero measured bytes. Hosts own resource storage, upload policy and retention.

Media output goes to the explicit `modelOptions.onContent` sink, never a text collector or journal. Missing media sinks fail explicitly. Private reasoning and continuation do not enter this visible media channel.

## Scoped continuation

Set Provider `scope` to an account/conversation identity to receive continuation envelopes. Replay requires matching protocol, model, scope and endpoint. `onContinuation` is a separate state channel; do not paste state into plain-text history or content logs. Adapters retain required signed blocks without asking business code to understand their native shape.

`serializeModelContinuation` and `parseModelContinuation` enforce JSON, size and identity boundaries. `createMemoryContinuationStore` is an optional single-process reference store. Hosts provide persistent storage, retention and current authorization during recovery. Opaque state is not portable between protocols.

Exact token accounting cannot cover hidden remote history. Calls requesting exact accounting cannot also use opaque continuation. Reported usage is not a hard real-time cost limit; refusals, failures and cancellation can still consume remote resources.

## Background, batch and realtime

These lifecycles have separate consistent entries rather than pretending to be text calls:

- `runModelOperation(provider, request, ports, signal?)` performs one bounded submit/query/read/cancel action. `waitModelOperation` adds bounded polling. Bind ports.run to the same request Runner's runOperation. Hosts supply current authorization, atomic exclusive reservation and persistence; recovery must retain submitted reservations.
- `Support.createOperationHttpProvider` supports Responses/Interactions background actions and native batch control. `Support.createBatchModelProvider` compiles portable messages to OpenAI, Anthropic or Gemini batch requests and correlates outputs by stable item IDs. Batch generation attempts are charged per item; queries do not create generation charges.
- `openModelRealtime` owns bounded connections and current per-action authorization. `Support.openProtocolRealtime` adapts Realtime/Live turns and events. `connectModelWebSocket` and `connectModelWebRTC` accept injected connection ports. Hosts provide capture, playback, ephemeral authentication and server-side SDP exchange. Bound frames, queues, buffers and generation attempts.

An uncertain dispatched submission remains unknown and is not automatically resubmitted. Local cancellation, a remote cancel request and confirmed remote cancellation are different facts. Read-only final queries and cancellation use independent bounded cleanup without new generation. Interrupting realtime output invalidates unadmitted proposals from older generations; it cannot undo an executed side effect. Tool execution and result submission require current authorization and matching call identities.

If the provider result is confirmed and `save` throws, `MODEL_OPERATION_SAVE_UNCONFIRMED` carries the original `cause` and the confirmed `result`. The host can reconcile storage by operation identity or query the confirmed remote ID. When both the remote operation and persistence of its failure state throw, `AggregateError.errors` preserves both errors in that order.

Background and batch HTTP requests also support `maxResponseBytes` and default to 16 MiB per response. Batch JSONL additionally accepts `maxJsonlLineBytes`, which defaults to the smaller of 1 MiB and the response limit. The reserved IDs bound the number of results. Each completed batch item requires a recognized generation terminal event. An item with no terminal event reports `BATCH_ITEM_TERMINAL_MISSING`.

Realtime text turns and audio commits obtain authorization and generation budget before advancing the generation and sending protocol frames. The session closes if an admitted turn encounters a transport failure after sending has started.

[Core API](core.en.md) · [Support API](support.en.md) · [Public reference](reference.en.md)

[Complete background example](../../examples/model-lifecycles.mjs)

## Explicit supplier profiles and hosted search

`requestBody` supplies protocol-specific reasoning settings, such as `thinking: {type: 'disabled'}` for a compatible Chat endpoint. It cannot replace Core input, tools, identities, output limits, response mode or lifecycle. The adapter snapshots the profile and preserves Core output formats when merging supported effort settings. Use actual supplier documentation for the chosen model.

Native search is opt-in through `hostedTools`, `authorizeHostedTools` and `onHostedToolEvent`. Supported definitions are Responses `web_search`, Messages basic `web_search_20250305` named `web_search`, and Interactions `google_search`. Authorization runs before every generation. Events identify `source: 'provider'` and are delivered through an awaited private callback, not a local tool receipt. Callback failures stop consumption without resubmission or undoing remote execution. Search queries, sources and encrypted/native data can be private; do not forward them to general content logs. Other hosted tool definitions fail explicitly.

`capabilities` can explicitly narrow the selected endpoint’s modalities, local function tools or native JSON schema support. It cannot widen protocol expressibility or mark an endpoint as verified. For example, `{ capabilities: { jsonSchema: false } }` rejects native schema requests locally; Messages/Interactions JSON mode also rejects when it needs that native schema facility. Chat JSON object mode remains distinct. Continuation binds the full visible history and every native assistant turn; rewriting or trimming an anchored history requires starting without that state. The private envelope is limited to 1,048,576 JSON string code units.

A Runner can receive an operation-only or realtime-only Provider directly; no unused stream method is required. Its generation methods reject before charging when that capability is absent. `session.tool` buffers a blocking tool group and continues without a synthetic user turn: OpenAI waits for the original response to finish before one new response.create; Gemini sends one grouped toolResponse. Continuation is authorized and charged before dispatch and enters a new generation. `tool-wait` is an intermediate stage, while `completed` denotes the final response with no pending tools. `respond()` retries an untriggered continuation after a local policy or budget adjustment; it does not replay dispatched results.
