/**
 * Provider observation contract.
 *
 * Place in the package: optional, caller-owned logging around provider calls. Observations are
 * best effort and never change provider results, cancellation or retry behaviour; payloads are
 * built lazily and body capture happens only for explicitly accepted events.
 *
 * Exports: `ProviderEventPayloads`, `ProviderEventName`, `ProviderEventDescriptor`,
 * `ProviderObservation`, `ProviderObserver`, `ProviderErrorCapture`.
 */
import type { ModelProviderContext } from '../../model/chat-provider.js';

/** Payload of each provider event. Content-bearing events are accepted explicitly. */
export interface ProviderEventPayloads {
  /** Outbound request; contains prompt content. */
  'provider.request': { url: string; body: unknown };
  /** Response head; metadata only. */
  'provider.response': { status: number; requestId: string | null; contentType: string | null };
  /** One raw streamed frame; contains response content. */
  'provider.frame': { data: string };
  /** Upstream error body, captured only when accepted. */
  'provider.error-body': { status: number; body: string; truncated?: boolean };
  /** End of the call; `complete` is false when the stream ended without a payload. */
  'provider.end': { complete: boolean; error?: unknown };
}

/** Union of provider event names. */
export type ProviderEventName = keyof ProviderEventPayloads;
/** Provider event name plus its content class. */
export interface ProviderEventDescriptor {
  readonly event: ProviderEventName;
  readonly content: 'metadata' | 'content';
}
/** One observation: event name with its payload. */
export type ProviderObservation = {
  [K in ProviderEventName]: {
    readonly event: K;
    readonly payload: ProviderEventPayloads[K];
  };
}[ProviderEventName];

/** The caller can correlate each observation using the original, request-local model options. */
export interface ProviderObserver {
  /** Returns false to skip an event; absent means accept every event. */
  accepts?(descriptor: ProviderEventDescriptor, options: Readonly<ModelProviderContext>): boolean;
  /** Handles one observation. Throwing or rejecting never affects the provider call. */
  write(event: ProviderObservation, options: Readonly<ModelProviderContext>): void | Promise<void>;
}

/** Captured upstream error body and whether it had to be truncated. */
export interface ProviderErrorCapture {
  body: string;
  truncated: boolean;
}
