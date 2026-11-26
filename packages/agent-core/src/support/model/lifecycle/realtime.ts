/** Protocol frame adapters over an injected bounded duplex (WebSocket or WebRTC data channel). */
import type {
  ModelDuplex,
  ModelRealtimeProvider,
  ModelLifecycleContext,
} from '../../../structs/model/lifecycle.js';
export interface RealtimeProtocolConfig {
  readonly protocol: 'openai-realtime' | 'gemini-live';
  readonly setup: Readonly<Record<string, unknown>>;
  /** The connector owns ephemeral authentication and a bounded inbound queue. */
  connect(context: ModelLifecycleContext): Promise<ModelDuplex>;
}
/** Open a protocol session and send its initial setup. No automatic reconnect or side effect replay. */
export function createRealtimeProtocolProvider(
  config: RealtimeProtocolConfig,
): ModelRealtimeProvider {
  const protocol = config.protocol,
    setup = structuredClone(config.setup),
    connect = config.connect.bind(config);
  return {
    async connect(context) {
      const interaction = await connect(context);
      try {
        await interaction.send(
          protocol === 'openai-realtime' ? { type: 'session.update', session: setup } : { setup },
          context.signal,
        );
      } catch (error) {
        await interaction.close();
        throw error;
      }
      return interaction;
    },
  };
}
/** Build the portable input forms. Each invocation remains subject to current session authorization. */
export function realtimeInput(
  protocol: RealtimeProtocolConfig['protocol'],
  text: string,
): Readonly<Record<string, unknown>> {
  return protocol === 'openai-realtime'
    ? {
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
      }
    : { clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } };
}
/** Gemini FunctionResponse requires an object even when a business tool returns a scalar. */
export function realtimeFunctionResponse(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { result: value ?? null };
}
/** Tool results are associated with their provider call ID, never executed in the adapter. */
export function realtimeToolResult(
  protocol: RealtimeProtocolConfig['protocol'],
  id: string,
  name: string,
  result: unknown,
): Readonly<Record<string, unknown>> {
  if (!id || !name) throw new TypeError('Tool identity required');
  return protocol === 'openai-realtime'
    ? {
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: id, output: JSON.stringify(result) },
      }
    : {
        toolResponse: {
          functionResponses: [{ id, name, response: realtimeFunctionResponse(result) }],
        },
      };
}

/** Bound the socket's inbound queue and outbound buffered bytes; credentials stay in the host connector. */
export function createWebSocketDuplex(
  socket: WebSocket,
  options: { maxQueuedFrames: number; maxBufferedBytes: number; maxFrameChars: number },
): ModelDuplex {
  for (const value of [options.maxQueuedFrames, options.maxBufferedBytes, options.maxFrameChars])
    if (!Number.isSafeInteger(value) || value < 1)
      throw new TypeError('Invalid socket resource bounds');
  const queue: Readonly<Record<string, unknown>>[] = [];
  let ended = false,
    failure: unknown,
    wake: (() => void) | undefined;
  const notify = () => {
    const fn = wake;
    wake = undefined;
    fn?.();
  };
  const detach = () => {
    socket.removeEventListener('message', message);
    socket.removeEventListener('close', end);
    socket.removeEventListener('error', error);
  };
  const end = () => {
    ended = true;
    notify();
    detach();
  };
  const error = () => {
    failure = new Error('Realtime socket failed');
    end();
    socket.close();
  };
  const message = (event: MessageEvent) => {
    try {
      if (typeof event.data !== 'string' || event.data.length > options.maxFrameChars)
        throw new Error('Realtime socket frame limit exceeded');
      const value: unknown = JSON.parse(event.data);
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid realtime frame');
      if (queue.length >= options.maxQueuedFrames)
        throw new Error('Realtime inbound queue exceeded');
      queue.push(value as Record<string, unknown>);
      notify();
    } catch (cause) {
      failure = cause;
      end();
      socket.close();
    }
  };
  socket.addEventListener('message', message);
  socket.addEventListener('close', end);
  socket.addEventListener('error', error);
  return {
    async send(frame, signal) {
      signal.throwIfAborted();
      if (ended || socket.readyState !== 1) throw new Error('Realtime socket is not open');
      const body = JSON.stringify(frame);
      if (
        body.length > options.maxFrameChars ||
        socket.bufferedAmount + new TextEncoder().encode(body).length > options.maxBufferedBytes
      )
        throw new Error('Realtime outbound queue exceeded');
      socket.send(body);
    },
    frames: {
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            if (failure) throw failure;
            if (queue.length) {
              yield queue.shift()!;
              continue;
            }
            if (ended) return;
            await new Promise<void>((resolve) => {
              wake = resolve;
            });
          }
        } finally {
          end();
          socket.close();
        }
      },
    },
    close() {
      end();
      queue.length = 0;
      socket.close();
    },
  };
}

/** Connect an actual WebSocket with an injectable constructor and bounded opening lifetime. */
export async function connectModelWebSocket(
  url: string,
  context: ModelLifecycleContext,
  options: {
    create?: (url: string) => WebSocket;
    maxQueuedFrames: number;
    maxBufferedBytes: number;
    maxFrameChars: number;
  },
): Promise<ModelDuplex> {
  context.signal.throwIfAborted();
  const socket = (options.create ?? ((target) => new WebSocket(target)))(url);
  try {
    if (socket.readyState !== 1)
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          socket.removeEventListener('open', open);
          socket.removeEventListener('error', error);
          socket.removeEventListener('close', error);
          context.signal.removeEventListener('abort', abort);
        };
        const open = () => {
          cleanup();
          resolve();
        };
        const error = () => {
          cleanup();
          reject(new Error('Realtime socket opening failed'));
        };
        const abort = () => {
          cleanup();
          reject(context.signal.reason);
        };
        socket.addEventListener('open', open, { once: true });
        socket.addEventListener('error', error, { once: true });
        socket.addEventListener('close', error, { once: true });
        context.signal.addEventListener('abort', abort, { once: true });
        if (context.signal.aborted) abort();
      });
    context.signal.throwIfAborted();
    const lifetimeSignal = context.lifetimeSignal ?? context.signal;
    lifetimeSignal.throwIfAborted();
    const duplex = createWebSocketDuplex(socket, options);
    const abort = () => {
      void duplex.close();
    };
    lifetimeSignal.addEventListener('abort', abort, { once: true });
    return {
      ...duplex,
      close() {
        lifetimeSignal.removeEventListener('abort', abort);
        return duplex.close();
      },
    };
  } catch (error) {
    socket.close();
    throw error;
  }
}
/** Negotiate SDP and expose the actual WebRTC event channel. Audio tracks remain host-owned. */
export async function connectModelWebRTC(
  context: ModelLifecycleContext,
  options: {
    create?: () => RTCPeerConnection;
    exchange: (offer: string, signal: AbortSignal) => Promise<string>;
    maxQueuedFrames: number;
    maxBufferedBytes: number;
    maxFrameChars: number;
  },
): Promise<ModelDuplex> {
  const peer = (options.create ?? (() => new RTCPeerConnection()))();
  const channel = peer.createDataChannel('oai-events');
  const abort = () => {
    channel.close();
    peer.close();
  };
  context.signal.addEventListener('abort', abort, { once: true });
  try {
    context.signal.throwIfAborted();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const answer = await options.exchange(offer.sdp!, context.signal);
    context.signal.throwIfAborted();
    await peer.setRemoteDescription({ type: 'answer', sdp: answer });
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        channel.removeEventListener('open', open);
        channel.removeEventListener('error', error);
        channel.removeEventListener('close', error);
        context.signal.removeEventListener('abort', cancel);
      };
      const open = () => {
        cleanup();
        resolve();
      };
      const error = () => {
        cleanup();
        reject(
          context.signal.aborted
            ? context.signal.reason
            : new Error('Realtime data channel failed'),
        );
      };
      const cancel = () => {
        cleanup();
        reject(context.signal.reason);
      };
      if (channel.readyState === 'open') return resolve();
      channel.addEventListener('open', open, { once: true });
      channel.addEventListener('error', error, { once: true });
      channel.addEventListener('close', error, { once: true });
      context.signal.addEventListener('abort', cancel, { once: true });
      if (context.signal.aborted) cancel();
    });
    // RTCDataChannel and WebSocket share send/message/close primitives; adapt readyState explicitly.
    const socket = {
      get readyState() {
        return channel.readyState === 'open' ? 1 : 3;
      },
      get bufferedAmount() {
        return channel.bufferedAmount;
      },
      send: (value: string) => channel.send(value),
      close: () => channel.close(),
      addEventListener: channel.addEventListener.bind(channel),
      removeEventListener: channel.removeEventListener.bind(channel),
    } as unknown as WebSocket;
    const lifetimeSignal = context.lifetimeSignal ?? context.signal;
    lifetimeSignal.throwIfAborted();
    const duplex = createWebSocketDuplex(socket, options);
    context.signal.removeEventListener('abort', abort);
    lifetimeSignal.addEventListener('abort', abort, { once: true });
    return {
      ...duplex,
      close() {
        lifetimeSignal.removeEventListener('abort', abort);
        duplex.close();
        peer.close();
      },
    };
  } catch (error) {
    context.signal.removeEventListener('abort', abort);
    abort();
    throw error;
  }
}
