/**
 * Provider observation support: optional, caller-owned logging around provider calls.
 *
 * Observations are best effort and silent: an absent or throwing observer never changes provider
 * results, cancellation or retry behavior. Payloads are built lazily, so disabled events cost
 * nothing, and body capture only happens when explicitly accepted.
 *
 * Main exports: `providerObservation` and `createProviderObservationScope`.
 */
import type { ModelProviderContext } from '../../structs/model/chat-provider.js';
import type {
  ProviderEventName,
  ProviderEventPayloads,
  ProviderObservation,
  ProviderObserver,
} from '../../structs/support/model/provider-observer.js';

/**
 * Classify each provider event.
 *
 * `content` events may contain prompt or response data and need explicit acceptance; `metadata`
 * events only describe the call.
 */
const events = {
  'provider.request': 'content',
  'provider.response': 'metadata',
  'provider.frame': 'content',
  'provider.error-body': 'content',
  'provider.end': 'metadata',
} as const;

/**
 * Create the emit/enabled pair used inside the provider.
 *
 * @param observer Caller-owned observer; when absent, every event is disabled.
 * @param options Provider context passed to the observer's acceptance check.
 * @returns `enabled(event)` and `emit(event, payload)`; both never throw.
 */
export function providerObservation(
  observer: ProviderObserver | undefined,
  options: ModelProviderContext,
) {
  const enabled = (event: ProviderEventName): boolean => {
    if (!observer || !Object.hasOwn(events, event)) return false;
    try {
      return observer.accepts?.({ event, content: events[event] }, options) !== false;
    } catch {
      return false;
    }
  };
  return {
    enabled,
    emit<K extends ProviderEventName>(event: K, payload: () => ProviderEventPayloads[K]): void {
      if (!enabled(event)) return;
      try {
        const pending = observer!.write(
          { event, payload: payload() } as ProviderObservation,
          options,
        );
        if (pending) void Promise.resolve(pending).catch(() => {});
      } catch {
        /* Observation cannot change provider results, cancellation or retry behavior. */
      }
    },
  };
}

/**
 * Bind provider observations to a caller-owned destination across diagnostic child spans.
 *
 * `attach` returns a scoped diagnostic context; contexts that were not attached through this scope
 * produce no observations. Child contexts inherit the owner and a `parent/child` span path.
 *
 * @param sink Destination implementing optional `accepts` and required `write`.
 * @returns A frozen `{ attach, observer }` pair to install on a provider.
 */
export function createProviderObservationScope<Owner>(sink: {
  accepts?(
    owner: Owner,
    descriptor: import('../../structs/support/model/provider-observer.js').ProviderEventDescriptor,
  ): boolean;
  write(
    owner: Owner,
    observation: ProviderObservation,
    spanId: string,
    content: 'metadata' | 'content',
  ): void | Promise<void>;
}) {
  type Context = import('../../structs/diagnostics.js').DiagnosticContext;
  const owners = new WeakMap<Context, { owner: Owner; spanId: string }>();
  const accepts = sink.accepts?.bind(sink);
  const write = sink.write.bind(sink);
  function attach(context: Context, owner: Owner, spanId = 'run'): Context {
    const scoped: Context = {
      identity: context.identity,
      enabled: context.enabled.bind(context),
      emit: context.emit.bind(context),
      deliver: context.deliver.bind(context),
      child: (id, fields) => attach(context.child(id, fields), owner, `${spanId}/${id}`),
      withObserver: (observer) => attach(context.withObserver(observer), owner, spanId),
    };
    // Prefer the real span identity so the log matches diagnostics rather than the local label.
    owners.set(scoped, { owner, spanId: context.identity?.spanId ?? spanId });
    return scoped;
  }
  const observer: ProviderObserver = {
    accepts(descriptor, { diagnostics }) {
      const scope = diagnostics && owners.get(diagnostics);
      return scope !== undefined && accepts?.(scope.owner, descriptor) !== false;
    },
    write(observation, { diagnostics }) {
      const scope = diagnostics && owners.get(diagnostics);
      if (scope) return write(scope.owner, observation, scope.spanId, events[observation.event]);
    },
  };
  return Object.freeze({ attach, observer: Object.freeze(observer) });
}
