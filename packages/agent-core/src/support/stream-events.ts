/**
 * Bounded event plumbing for applications that must forward streamed output under cancellation.
 *
 * A producer pushes events one at a time and waits for each to be consumed; the consumer pulls
 * from an async iterable. There is no unbounded queue, so a slow consumer slows the producer
 * instead of growing memory, and aborting the signal closes both sides.
 *
 * Main export: `streamEvents`.
 */

/**
 * Bridge a push-style producer to a pull-style async iterable with a one-slot rendezvous.
 *
 * The producer must await every `emit` call before emitting again; concurrent emissions are
 * rejected rather than buffered. The slot is released only after the consumer receives the event,
 * so backpressure is exact.
 *
 * @param operation Producer that receives an `emit` callback and runs to completion.
 * @param context Execution context carrying the abort signal used to close the rendezvous.
 * @returns An async iterable yielding each event in production order.
 * @throws The producer's error, or the signal's abort reason when cancelled. Also rejects an
 *   `emit` that overlaps another, occurs after close, or is never consumed by the consumer.
 */
export async function* streamEvents<Event>(
  operation: (emit: (event: Event) => Promise<void>) => Promise<void>,
  { signal }: import('../structs/common.js').ExecutionContext,
): AsyncIterable<Event> {
  let slot: { event: Event; release(): void; cancel(): void } | undefined;
  let wake: (() => void) | undefined;
  let closed = false,
    done = false;
  let sending = false;
  let failure: { error: unknown } | undefined;
  let rejectSend: ((error: unknown) => void) | undefined;
  const notify = () => {
    wake?.();
    wake = undefined;
  };
  const abort = () => {
    closed = true;
    rejectSend?.(signal.reason ?? new Error('Stream closed'));
    notify();
  };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const producer = Promise.resolve()
    .then(() => {
      signal.throwIfAborted();
      // Before the producer starts, only abort can close this rendezvous; the
      // signal check above already rejects it with the original reason.
      return operation((event) => {
        if (closed || signal.aborted)
          return Promise.reject(signal.reason ?? new Error('Stream closed'));
        if (sending) return Promise.reject(new Error('Event producers must await delivery'));
        sending = true;
        return new Promise<void>((resolve, reject) => {
          rejectSend = reject;
          slot = {
            event,
            release: () => {
              sending = false;
              resolve();
            },
            cancel: () => {
              sending = false;
              reject(new Error('Stream closed before event consumption'));
            },
          };
          notify();
        });
      });
    })
    .catch((error) => {
      failure = { error };
    })
    .finally(() => {
      done = true;
      notify();
    });
  try {
    while (true) {
      signal.throwIfAborted();
      if (slot) {
        const current = slot;
        slot = undefined;
        let consumed = false;
        try {
          yield current.event;
          consumed = true;
        } finally {
          if (consumed) current.release();
          else current.cancel();
        }
      } else if (done) {
        if (failure) throw failure.error;
        return;
      } else
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
    }
  } finally {
    closed = true;
    rejectSend?.(new Error('Stream closed'));
    signal.removeEventListener('abort', abort);
    void producer;
  }
}
