// English prose for kit-state-and-mock.mjs; code samples stay in the Chinese source module.
export default {
  'kit-artifacts': {
    title: 'Artifacts: resolve real artifacts by reference',
    summary:
      'A reference contains only resolverId, artifactId, and an optional revision; the App resolver provides the real content.',
    details: `defineArtifactCatalog(resolvers) returns a read-only catalog and an asynchronous resolve(reference,context). Empty identities, unknown resolverId values, and non-function resolvers are rejected. The reference is snapshotted first, and the resolver receives the same reference plus App/cancellation/diagnostics context; cancellation during the wait or after resolution is not returned as success.

An artifact ID or revision is not a file path, access permission, proof of content authenticity, or publication receipt. The resolver must check the current caller, the real saved state, version, and expiry, and return an App-defined Value. The Kit does not store files, create download endpoints, or guarantee that delivery to a user is possible from the reference alone.`,
    examples: [
      { title: 'First resolve one explicit in-memory artifact', level: 'Beginner' },
      {
        title: 'Add real permission and revision verification to the same resolve',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Reference snapshot, resolver registration, and cancellation'],
  },

  'kit-durable': {
    title: 'Durable: explicit checkpoints and controlled recovery',
    summary:
      'The App provides real checkpoint storage and an exclusive lock; a task runs or resumes explicitly along the same definition and accumulated budget.',
    details: `defineDurableTask({id,revision,isState,steps}, options?) returns run({taskId,store},context). store must provide exclusive, load, and save that are valid across all writers. A checkpoint has version=2 and contains definitionId/revision, nextStepIndex, attemptCount/maxAttempts, deadlineAtMs, status, and state; it must be created by the App, and the task never seeds or looks up business data automatically.

ready starts the next step, running means that step was interrupted, completed returns the result after validation, and cancelled is rejected. safe means the step may be redone; reconcile means recovery must go through reconcile, and it is rejected when missing. The attempt count is incremented and saved before the handler, and the new state and next step are saved on success; resuming does not reset the accumulated count or the deadline. Every save waits inside the lock, but cancellation cannot undo an external commit that has already happened.

The App starts or resumes tasks through explicit calls and provides durable storage, idempotency keys, side-effect reconciliation, re-authorization, and storage transactions.`,
    examples: [
      {
        title: 'First understand one execution with an isolated in-memory checkpoint',
        level: 'Beginner',
        note: 'This is an isolated demonstration of the minimal storage contract; real cross-process or cross-request recovery must use an App store with exclusivity and durability guarantees.',
      },
      {
        title: 'Add a real reconciliation policy for interruptions to the same run',
        level: 'Configuration',
        note: 'The example does not presume to interpret "cannot confirm whether it committed" as failure or re-execution; production reconciliation must query the real business system.',
      },
    ],
    policyTitles: [
      'State, accumulated budget, deadline, and reconciliation order',
      'Current status and replay policy enumerations',
    ],
  },

  'kit-mock-generation': {
    title: 'MockGPT: direct generation and Provider injection',
    summary:
      'Get a string or JSON directly; inject the same instance into a Provider when you need to exercise model communication.',
    details: `Import from @jangts/agent-core/mock; no separate simulator installation is needed. new MockGPT({rules,fallback?,seed?,clock?,recordLimit?,maxBodyBytes?,maxOutputChars?,stream?,selectPrompt?}) fixes the configuration. Rules match in order on prompt, model, and the synchronous when, while times limits the hit count; strings match exactly, and RegExp can capture groups. Function generators receive a frozen request, prompt, match, signal, callIndex, ruleIndex, random, clock, and report.

await mock.generate({model,messages,...fields},{signal?}) returns an independent frozen snapshot of a string, native JSON, or an explicit ResponseDescription. A direct call creates no HTTP objects and does not execute the description's delay, SSE, or HTTP failure; the caller interprets the description. Optional object fields with undefined are omitted on input, while empty array slots, undefined array entries, circular references, and non-JSON data are rejected; an output undefined is not omitted. JSON snapshots are limited to 64 levels and 100000 value nodes; exceeding request limits yields MOCK_REQUEST (400), and exceeding generation limits yields MOCK_GENERATION. Fields are read once, hidden toJSON is not executed, and prototype names are kept as ordinary own data fields. Failure or cancellation does not return the allocated rule hit count.

mock.fetch is a bound standard fetch adapter that can be injected into Support.CompatibleModelProvider. routes declares /v1/chat/completions and /chat/completions; it accepts POST only and supports JSON and stream=true SSE with one choice. It does not intercept requests globally and does not forward to a real model.

records is a bounded in-memory snapshot of metadata, 100 by default and disabled with recordLimit=0; counts is rule hit counts, and activeRequests includes unconsumed SSE. reset is rejected while active requests exist; when idle it clears records, counts, and seed without resetting custom closures. A fixed seed and clock suit deterministic tests and do not represent real model quality, latency, or capacity. Errors are distinguished by MockGPTError.code and details: configuration, request, no match, output, cancellation, and transport boundaries.`,
    examples: [
      { title: 'Generate native JSON directly', level: 'Beginner' },
      {
        title: 'Inject the same instance into the real Core model boundary',
        level: 'Configuration',
      },
    ],
  },

  'kit-mock-responses': {
    title: 'MockGPT: response descriptions and scenario generators',
    summary:
      'Fixed results serve strict regression, input-dependent generators explore wiring, and explicit response descriptions cover failure and streaming scenarios.',
    details: `responses.text(text,options?), toolCalls([{name,arguments,id?}],options?), httpError(status,body), and reject(message) return a ResponseDescription. Ordinary JSON does not become a transport instruction just because its fields look similar. HTTP failure statuses must be 400–599 and carry a body, and tool proposals must provide arguments; constructing a ResponseDescription directly applies the same rule validation.

OutputOptions provides delayMs, chunkSize, intervalMs, wireChunkSize, interruptAfter, finishReason, and usage. Content chunking is by code point and wireChunkSize is by encoded byte; an interruption does not append a successful termination frame. generate returns the description itself; fetch interprets the description and emits SSE when stream=true. usage can only be supplied explicitly and never estimates real tokens.

generatorNames and generators come from the same list. integer, float, boolean, pick, id, date, sentence, and imageUrl return value generators that evaluate with the same context inside a custom generator. sequence selects by rule instance hit order and is rejected once exhausted; toolCall generates proposals and does not execute tools.

summary, bullets, keywords, title, extract, and reply accept an optional source (a string or a context function) and default to the prompt. Summaries use representative-sentence ranking and repetition control without LLM rewriting; summary defaults to 240 code points, bullets/reply to 500, and title to 24, while summary/bullets default to 3 items. Summaries analyze at most 30000 code points and 180 distributed candidate sentences, sampling long text from the head, middle, and tail; keywords return an array, and a missing extracted value is null. Source, template, and options are snapshotted at construction, while callback closures remain managed by the App.`,
    examples: [
      {
        title: 'Encode a validated model result',
        level: 'Extension',
        note: 'The adapter handles request validation, pre-first-byte delay, and lifecycle; the encoder does not execute rules or modify MockGPT call records.',
      },
      {
        title: 'Generate an inspectable summary from the input',
        level: 'Beginner',
      },
      {
        title: 'Reuse the same random source across field generators',
        level: 'Configuration',
      },
      {
        title: 'Simulate an error and recovery with the same request order',
        level: 'Extension',
      },
    ],
  },

  'kit-mock-node': {
    title: 'MockGPT Node: a minimal model service and HTTP mounting',
    summary:
      'Use the same MockGPT configuration as a standalone model API or mount it into an existing Node HTTP service.',
    details: `@jangts/agent-core/mock/node is a Node-only entry. createMockServer({mock,maxBodyBytes?,requestTimeoutMs?,allowedOrigins?,allowedHosts?,closeTimeoutMs?}) returns listen({host?,port?}) and close. createMockHandler uses the same request policy and returns a Node IncomingMessage/ServerResponse handler, with the host owning listening and shutdown.

By default it only accepts loopback, local addresses reached through this connection, and explicitly bound hostnames. Host is checked before Origin, allowedHosts holds exact hostnames/IPs and does not accept wildcards; allowedOrigins separately allows cross-origin and cannot let an invalid Host through. Request body, timeout, and shutdown wait are bounded. Calling listen repeatedly during startup, listening, or shutdown is rejected with MOCK_ACTIVE; close waits for startup and for the same shutdown, and listening is allowed again afterwards.

The HTTP shell converts generation errors into error responses that carry a code; responses.reject closes the connection, unlike an explicit HTTP error. It fails when nothing matches and there is no fallback, and it never connects to a real model. The mock service provides no business authentication; the host configures the access boundary when exposing it.`,
    examples: [
      { title: 'Start a minimal model API and close it when done', level: 'Beginner' },
      {
        title: 'Mount into an existing Node HTTP lifecycle',
        level: 'Configuration',
      },
    ],
  },

  'kit-mock-web': {
    title: 'MockGPT Web: trusted sources and local summaries',
    summary:
      'Get body text from a real web page or a trusted load, then hand it to input-dependent generators.',
    details: `@jangts/agent-core/mock/web is a Node-only entry. sources.web({url?,profile?,headers?,timeoutMs?,maxBytes?,maxChars?,maxRedirects?,fallback?,load?}) returns a source for text generators. By default it takes the single URL from the prompt; ordinary generators do not go online. The defaults are a 20000 ms total deadline, 2 MiB, 30000 code points, and 3 redirects. Scripts and templates are stripped first and Readability then extracts the body; it does not execute page JS, log in, or read PDFs.

The default fetch validates protocol, DNS address, and redirects hop by hop, pins the actual connection address, and rejects local/private/reserved targets; isPublicAddress checks only a single address and is not a complete URL authorizer. Size is limited both before and after decompression. headers cannot override Host, Cookie, or Authorization, and model credentials are not forwarded.

load(url,signal,maxBytes) is a trusted configuration port returning {bytes,url,contentType}; whoever injects it owns the target address and transport security, and it must not accept a function supplied arbitrarily by a remote request. Read failures throw by default, and an explicit fallback only catches web-read failures that are allowed to degrade and then passes the text to the generator as source text; cancellation, invalid URLs, and target-address rejections are not turned into fallback success. Logged fields such as sourceError, sourceFallback, webStage, and receivedBytes distinguish failures, replacement text, and the actual body text, so a verification or login page is not reported as a successful read. Live web changes are not fixed by seed.`,
    examples: [
      { title: 'A trusted load supplies offline body text', level: 'Beginner' },
      {
        title: 'Explicitly enable a web source and a failure replacement text',
        level: 'Configuration',
      },
    ],
  },
};
