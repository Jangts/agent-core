import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  connectModelWebSocket, connectModelWebRTC, createWebSocketDuplex,
  createRealtimeProtocolProvider, realtimeToolResult,
} from '../dist/esm/support/model/lifecycle/realtime.js';
import { openModelRealtime } from '../dist/esm/model/realtime.js';

const options = { maxQueuedFrames: 2, maxBufferedBytes: 40, maxFrameChars: 24 };
const signal = new AbortController().signal;
const frames = (...values) => (async function* () { yield* values; })();

class Channel extends EventTarget {
  readyState;
  bufferedAmount = 0;
  sent = [];
  closes = 0;
  constructor(state) { super(); this.readyState = state; }
  send(body) { this.sent.push(body); }
  close() { this.closes++; this.dispatchEvent(new Event('close')); }
  receive(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
}

test('WebSocket bounds stop bad inbound frames and close the connection', async () => {
  const invalid = [
    [s => s.receive('x'.repeat(25)), /frame limit/],
    [s => s.receive('[]'), /Invalid realtime frame/],
    [s => s.receive('invalid json'), SyntaxError],
    [s => { for (let i = 0; i < 3; i++) s.receive('{}'); }, /inbound queue/],
    [s => s.dispatchEvent(new Event('error')), /socket failed/],
  ];
  for (const [emit, error] of invalid) {
    const socket = new Channel(1);
    const duplex = createWebSocketDuplex(socket, options);
    emit(socket);
    await assert.rejects(duplex.frames[Symbol.asyncIterator]().next(), error);
    assert.ok(socket.closes);
  }
  assert.throws(() => createWebSocketDuplex(new Channel(1), { ...options, maxQueuedFrames: 0 }), /Invalid socket resource bounds/);
});

test('WebSocket dequeue wakes a blocked consumer and outbound bounds prevent partial sends', async () => {
  const socket = new Channel(1);
  const duplex = createWebSocketDuplex(socket, options);
  const received = duplex.frames[Symbol.asyncIterator]();
  const next = received.next();
  socket.receive('{"field":"value"}');
  assert.deepEqual((await next).value, { field: 'value' });
  await duplex.send({ message: 'ok' }, signal);
  await assert.rejects(duplex.send({ message: 'x'.repeat(30) }, signal), /outbound queue/);
  socket.bufferedAmount = 32;
  await assert.rejects(duplex.send({ a: '你好' }, signal), /outbound queue/);
  assert.deepEqual(socket.sent, ['{"message":"ok"}']);
  const eof = received.next();
  await duplex.close();
  assert.equal((await eof).done, true);
  await assert.rejects(duplex.send({}, signal), /not open/);
});

test('WebSocket opening failures and cancellation detach the pending connection', async () => {
  const defaultSignal = new AbortController().signal;
  for (const failure of ['error', 'close', 'abort']) {
    const controller = new AbortController();
    const socket = new Channel(0);
    const pending = connectModelWebSocket('wss://example.test', { signal: controller.signal },
      { ...options, create: () => socket });
    const reason = Error('stop opening');
    if (failure === 'abort') controller.abort(reason);
    else socket.dispatchEvent(new Event(failure));
    await assert.rejects(pending, failure === 'abort' ? error => error === reason : /opening failed/);
    assert.equal(socket.closes, 1);
  }
  const previous = globalThis.WebSocket;
  const socket = new Channel(1);
  globalThis.WebSocket = class {
    constructor(url) { assert.equal(url, 'wss://example.test'); return socket; }
  };
  try {
    const duplex = await connectModelWebSocket('wss://example.test', { signal: defaultSignal }, options);
    await duplex.send({ ok: true }, defaultSignal);
    assert.deepEqual(socket.sent, ['{"ok":true}']);
    await duplex.close();
  } finally { globalThis.WebSocket = previous; }
});

function peerFixture(state) {
  const channel = new Channel(state);
  const ready = Promise.withResolvers();
  let closed = 0;
  return { channel, ready, create: () => ({
    createDataChannel(label) { assert.equal(label, 'oai-events'); return channel; },
    async createOffer() { return { sdp: 'offer' }; },
    async setLocalDescription(offer) { assert.deepEqual(offer, { sdp: 'offer' }); },
    async setRemoteDescription(answer) {
      assert.deepEqual(answer, { type: 'answer', sdp: 'answer' });
      queueMicrotask(ready.resolve);
    },
    close() { closed++; },
  }), get closed() { return closed; } };
}

test('WebRTC opening waits for the channel and closes the peer on error or abort', async () => {
  for (const event of ['open', 'error', 'abort']) {
    const peer = peerFixture('connecting');
    const controller = new AbortController();
    const pending = connectModelWebRTC({ signal: controller.signal }, {
      ...options, create: peer.create, async exchange(offer, received) {
        assert.equal(offer, 'offer');
        assert.equal(received, controller.signal);
        return 'answer';
      },
    });
    await peer.ready.promise;
    if (event === 'abort') controller.abort(Error('stop RTC'));
    else {
      if (event === 'open') peer.channel.readyState = 'open';
      peer.channel.dispatchEvent(new Event(event));
    }
    if (event === 'open') {
      const duplex = await pending;
      await duplex.send({ status: 'open' }, signal);
      assert.deepEqual(peer.channel.sent, ['{"status":"open"}']);
      peer.channel.readyState = 'closed';
      await assert.rejects(duplex.send({}, signal), /not open/);
      await duplex.close();
      assert.equal(peer.closed, 1);
    } else {
      await assert.rejects(pending, event === 'error' ? /data channel failed/ : /stop RTC/);
      assert.ok(peer.closed);
      assert.ok(peer.channel.closes);
    }
  }
});

test('WebRTC default peer and SDP failure both respect peer ownership', async () => {
  const prior = globalThis.RTCPeerConnection;
  const peer = peerFixture('open');
  globalThis.RTCPeerConnection = class { constructor() { return peer.create(); } };
  try {
    await assert.rejects(connectModelWebRTC({ signal }, {
      ...options, async exchange() { throw Error('SDP refused'); },
    }), /SDP refused/);
    assert.equal(peer.closed, 1);
    assert.equal(peer.channel.closes, 1);
  } finally {
    if (prior === undefined) delete globalThis.RTCPeerConnection;
    else globalThis.RTCPeerConnection = prior;
  }
});

test('protocol setup failure closes transport and tool results require identity', async () => {
  let closes = 0;
  const provider = createRealtimeProtocolProvider({
    protocol: 'openai-realtime', setup: {},
    async connect() { return {
      async send() { throw Error('setup failed'); }, frames: frames(), close() { closes++; },
    }; },
  });
  await assert.rejects(provider.connect({ signal }), /setup failed/);
  assert.equal(closes, 1);
  assert.throws(() => realtimeToolResult('gemini-live', '', 'lookup', null), /Tool identity required/);
  assert.deepEqual(realtimeToolResult('gemini-live', 'id', 'lookup', undefined).toolResponse.functionResponses[0],
    { id: 'id', name: 'lookup', response: { result: null } });
});

function coreFixture(changes = {}, opt = {}) {
  const calls = [], sent = [];
  let closed = 0;
  const provider = { async connect() { return {
    frames: frames(), async send(frame) { sent.push(frame); }, close() { closed++; }, ...changes,
  }; } };
  const config = {
    maxFrames: 1, maxFrameChars: 20, authorize() {},
    async run(work, options) { calls.push(options); return work(options.signal ?? signal); },
    ...opt,
  };
  return { open: () => openModelRealtime(provider, config), calls, sent, get closed() { return closed; } };
}

test('core realtime validates resource bounds and preserves default zero-generation metadata', async () => {
  await assert.rejects(coreFixture({}, { maxFrames: 0 }).open(), /Invalid realtime resource bounds/);
  const f = coreFixture({ frames: frames({ text: 'first' }, { text: 'second' }) });
  const live = await f.open();
  assert.equal(live.generation, 0);
  const events = live.events();
  assert.deepEqual((await events.next()).value, { generation: 0, frame: { text: 'first' } });
  await assert.rejects(events.next(), /Realtime input limit exceeded/);
  assert.equal(f.closed, 1);
  await assert.rejects(live.send({}, 'input'), /session closed/);
  assert.throws(() => live.advanceGeneration(), /session closed/);
});

test('core realtime checks each outgoing frame before generation and does not leak a late input', async () => {
  const waiting = Promise.withResolvers(), entered = Promise.withResolvers();
  const f = coreFixture({}, { async authorize(action) {
    if (action === 'tool') { entered.resolve(); await waiting.promise; }
  } });
  const live = await f.open();
  const tooLarge = { long: 'x'.repeat(40) };
  await assert.rejects(live.send(tooLarge, 'input'), /frame limit exceeded/);
  await assert.rejects(live.generate({}, 'input', 0, undefined, tooLarge), /frame limit exceeded/);
  assert.equal(live.generation, 0);
  await live.send({ text: 'ok' }, 'input');
  assert.deepEqual(f.calls.filter(call => call.calls > 0).map(call => [call.action, call.calls]), [['generate', 1]]);
  const old = live.send({}, 'tool');
  await entered.promise;
  assert.equal(live.advanceGeneration(), 1);
  waiting.resolve();
  await assert.rejects(old, /Stale realtime generation/);
  assert.deepEqual(f.sent, [{ text: 'ok' }]);
  await live.close();
});

test('core realtime closes an abandoned connection that completes after cancellation', async () => {
  const controller = new AbortController();
  const opened = Promise.withResolvers(), connecting = Promise.withResolvers();
  let closed = 0;
  const pending = openModelRealtime({ async connect() {
    connecting.resolve();
    await opened.promise;
    return { frames: frames(), async send() {}, close() { closed++; } };
  } }, { signal: controller.signal, maxFrames: 1, maxFrameChars: 100,
    async run(work) { return work(controller.signal); }, authorize() {} });
  await connecting.promise;
  controller.abort(Error('cancel during open'));
  opened.resolve();
  await assert.rejects(pending, /cancel during open/);
  assert.equal(closed, 1);
});

test('core interrupt during a partial turn drops its stale suffix and prevents other input from interleaving', async () => {
  const entered = Promise.withResolvers(), release = Promise.withResolvers();
  const sent = [];
  const f = coreFixture({ async send(frame) {
    sent.push(frame.kind);
    if (frame.kind === 'prefix') { entered.resolve(); await release.promise; }
  } }, { maxFrameChars: 100 });
  const live = await f.open();
  const turning = live.generate({ kind: 'suffix' }, 'input', 0, undefined, { kind: 'prefix' });
  await entered.promise;
  await assert.rejects(live.send({ kind: 'input' }, 'input'), /send in progress/);
  await live.interrupt({ kind: 'cancel' });
  release.resolve();
  await assert.rejects(turning, /Stale realtime generation/);
  assert.deepEqual(sent, ['prefix', 'cancel']);
  await live.close();
  assert.equal(f.closed, 1);
});

test('closing core while awaiting the next inbound frame discards that frame', async () => {
  const entered = Promise.withResolvers(), resume = Promise.withResolvers();
  const f = coreFixture({ frames: (async function* () {
    entered.resolve();
    await resume.promise;
    yield { message: 'too late' };
  })() });
  const live = await f.open();
  const next = live.events().next();
  await entered.promise;
  await live.close();
  resume.resolve();
  assert.equal((await next).done, true);
  assert.equal(f.closed, 1);
});

test('an independently cancelled lifetime never yields an open transport', async () => {
  const controller = new AbortController();
  const reason = Error('session lifetime ended while opening');
  const socket = new Channel(0);
  const openingSocket = connectModelWebSocket('wss://example.test', { signal, lifetimeSignal: controller.signal },
    { ...options, create: () => socket });
  controller.abort(reason);
  socket.readyState = 1;
  socket.dispatchEvent(new Event('open'));
  await assert.rejects(openingSocket, error => error === reason);
  assert.equal(socket.closes, 1);

  const peer = peerFixture('open');
  await assert.rejects(connectModelWebRTC({ signal, lifetimeSignal: controller.signal }, {
    ...options, create: peer.create, async exchange() { return 'answer'; },
  }), error => error === reason);
  assert.equal(peer.closed, 1);
  assert.equal(peer.channel.closes, 1);
});

test('a WebRTC handshake preserves its abort reason when the channel close event is deferred', async () => {
  const peer = peerFixture('connecting');
  const originalClose = peer.channel.close.bind(peer.channel);
  peer.channel.close = () => { queueMicrotask(originalClose); };
  const controller = new AbortController();
  const reason = Error('cancel handshake before channel open');
  const pending = connectModelWebRTC({ signal: controller.signal }, {
    ...options, create: peer.create, async exchange() { return 'answer'; },
  });
  await peer.ready.promise;
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assert.ok(peer.closed);
});

test('queued core realtime actions recheck generation after a custom execution gate yields', async () => {
  for (const mode of ['send', 'generate']) {
    const deferred = Promise.withResolvers(), admitted = Promise.withResolvers();
    const f = coreFixture({}, { async run(work, options) {
      if (options.action === mode) { admitted.resolve(); await deferred.promise; }
      return work(signal);
    } });
    const live = await f.open();
    const pending = mode === 'send' ? live.send({ ok: true }, 'tool') : live.generate({ ok: true }, 'input');
    await admitted.promise;
    live.advanceGeneration();
    deferred.resolve();
    await assert.rejects(pending, /Stale realtime generation/);
    assert.deepEqual(f.sent, []);
    await live.close();
  }
});

test('transport handshake cancellation is honored even during adapter listener registration', async () => {
  const reason = Error('cancel before installing the abort listener');
  const controller = new AbortController();
  const socket = new Channel(0);
  const listenSocket = socket.addEventListener.bind(socket);
  socket.addEventListener = (type, ...args) => {
    listenSocket(type, ...args);
    if (type === 'close') controller.abort(reason);
  };
  await assert.rejects(connectModelWebSocket('wss://example.test', { signal: controller.signal },
    { ...options, create: () => socket }), error => error === reason);
  assert.equal(socket.closes, 1);
  const peer = peerFixture('connecting');
  const iceController = new AbortController();
  const listenPeer = peer.channel.addEventListener.bind(peer.channel);
  peer.channel.addEventListener = (type, ...args) => {
    listenPeer(type, ...args);
    if (type === 'close') iceController.abort(reason);
  };
  const close = peer.channel.close.bind(peer.channel);
  peer.channel.close = () => { queueMicrotask(close); };
  await assert.rejects(connectModelWebRTC({ signal: iceController.signal }, {
    ...options, create: peer.create, async exchange() { return 'answer'; },
  }), error => error === reason);
  assert.ok(peer.closed);
});
