/** Realtime frame lifecycle with bounded consumption and current authorization for every send. */
import type {
  ModelLifecycleRun,
  ModelDuplex,
  ModelRealtimeProvider,
} from '../structs/model/lifecycle.js';
type RealtimeFrame = Readonly<Record<string, unknown>>;
export interface RealtimeSessionOptions {
  readonly run: ModelLifecycleRun;
  readonly signal?: AbortSignal;
  readonly maxFrames: number;
  readonly maxFrameChars: number;
  /** Resolve provider response identities after interruption; unknown generations are not admitted. */
  generationOf?(frame: Readonly<Record<string, unknown>>): number | undefined;
  authorize(
    action: 'connect' | 'input' | 'tool' | 'interrupt',
    signal?: AbortSignal,
  ): void | Promise<void>;
}
/** Live connection wrapper. The owner must close it; no reconnection or tool replay occurs. */
export async function openModelRealtime(
  provider: ModelRealtimeProvider,
  options: RealtimeSessionOptions,
) {
  if (
    !Number.isSafeInteger(options.maxFrames) ||
    options.maxFrames < 1 ||
    !Number.isSafeInteger(options.maxFrameChars) ||
    options.maxFrameChars < 1
  )
    throw new TypeError('Invalid realtime resource bounds');
  await options.run(
    async (signal) => {
      await options.authorize('connect', signal);
    },
    { signal: options.signal, calls: 0, action: 'authorize' },
  );
  const lifetime = new AbortController();
  const interaction = await options.run(
    (signal) => provider.connect({ signal, lifetimeSignal: lifetime.signal }),
    {
      signal: options.signal,
      calls: 0,
      action: 'connect',
    },
  );
  let generation = 0,
    closed = false,
    sendingTurn = false,
    frames = 0;
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (closing) return closing;
    closed = true;
    options.signal?.removeEventListener('abort', abort);
    // Pin the shared promise before invoking host code or abort listeners, which may reenter.
    closing = Promise.resolve().then(() =>
      options.run(
        async () => {
          await interaction.close();
        },
        {
          calls: 0,
          cleanup: true,
          action: 'close',
        },
      ),
    );
    lifetime.abort();
    return closing;
  };
  const abort = () => {
    void close().catch(() => {});
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) {
    await close();
    options.signal.throwIfAborted();
  }
  const send = async (
    frame: RealtimeFrame,
    action: 'input' | 'tool' | 'interrupt',
    expectedGeneration = generation,
    calls = action === 'input' ? 1 : 0,
  ) => {
    if (closed) throw new Error('Realtime session closed');
    if (expectedGeneration !== generation) throw new Error('Stale realtime generation');
    if (sendingTurn && action !== 'interrupt') throw Error('Realtime turn send in progress');
    await options.run(
      async (signal) => {
        await options.authorize(action, signal);
      },
      { signal: options.signal, calls: 0, action: 'authorize' },
    );
    if (closed || expectedGeneration !== generation) throw new Error('Stale realtime generation');
    const snapshot = structuredClone(frame);
    if (JSON.stringify(snapshot).length > options.maxFrameChars)
      throw new Error('Realtime frame limit exceeded');
    await options.run(
      (signal) => {
        if (closed || expectedGeneration !== generation)
          throw new Error('Stale realtime generation');
        return interaction.send(snapshot, signal);
      },
      {
        signal: options.signal,
        calls,
        action: action === 'interrupt' ? 'interrupt' : calls ? 'generate' : 'send',
      },
    );
  };
  return {
    /** Admit one generation before advancing identity and sending an optional prefix and its frame. */
    async generate(
      frame: RealtimeFrame,
      action: 'input' | 'tool',
      expectedGeneration = generation,
      admitted?: (generation: number) => void,
      prefix?: RealtimeFrame,
    ) {
      if (closed || expectedGeneration !== generation) throw Error('Stale realtime generation');
      if (sendingTurn) throw Error('Realtime turn send in progress');
      await options.run(
        async (signal) => {
          await options.authorize(action, signal);
        },
        { signal: options.signal, calls: 0, action: 'authorize' },
      );
      const frames = structuredClone(prefix === undefined ? [frame] : [prefix, frame]);
      if (frames.some((item) => JSON.stringify(item).length > options.maxFrameChars))
        throw Error('Realtime frame limit exceeded');
      let started = false;
      try {
        const next = await options.run(
          async (signal) => {
            signal.throwIfAborted();
            if (closed || expectedGeneration !== generation)
              throw Error('Stale realtime generation');
            started = sendingTurn = true;
            const next = ++generation;
            admitted?.(next);
            for (const item of frames) {
              signal.throwIfAborted();
              if (closed || next !== generation) throw Error('Stale realtime generation');
              await interaction.send(item, signal);
            }
            return next;
          },
          { signal: options.signal, calls: 1, action: 'generate' },
        );
        if (started) sendingTurn = false;
        return next;
      } catch (error) {
        // A partially sent turn has unknown remote state. Close before accepting any new turn.
        if (started) void close().catch(() => {});
        throw error;
      }
    },
    advanceGeneration() {
      if (closed) throw new Error('Realtime session closed');
      return ++generation;
    },
    get generation() {
      return generation;
    },
    send,
    async interrupt(frame: RealtimeFrame, interrupted?: (generation: number) => void) {
      const expected = generation;
      await send(frame, 'interrupt', expected);
      if (closed || expected !== generation) return;
      generation++;
      interrupted?.(generation);
    },
    async *events() {
      try {
        for await (const frame of interaction.frames) {
          if (closed) break;
          if (++frames > options.maxFrames || JSON.stringify(frame).length > options.maxFrameChars)
            throw new Error('Realtime input limit exceeded');
          const origin = options.generationOf?.(frame) ?? (generation === 0 ? 0 : undefined);
          if (origin === undefined || origin !== generation) continue;
          yield { generation: origin, frame };
        }
      } finally {
        await close();
      }
    },
    close,
  };
}
