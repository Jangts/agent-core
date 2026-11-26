/**
 * Provider-level message shapes for direct compatible-provider use.
 *
 * Place in the package: Support-side input for hosts that keep their own tool thread. Core
 * `ModelMessage` also supports the tool thread; these stricter shapes remain for hosts that want
 * role and field association enforced by the union and re-checked at runtime.
 *
 * Exports: `ProviderToolCall`, `ProviderSystemMessage`, `ProviderUserMessage`,
 * `ProviderAssistantMessage`, `ProviderToolMessage`, `ProviderMessage`.
 */
import type { ModelImage, ModelToolCall } from '../../model/messages.js';

/** One tool call the assistant declared, in wire order; aliases the Core shape. */
export type ProviderToolCall = ModelToolCall;

/** System instruction turn; text only, so the union rejects images and tool fields here. */
export interface ProviderSystemMessage {
  readonly role: 'system';
  readonly content: string;
  readonly images?: never;
  readonly toolCallId?: never;
  readonly toolCalls?: never;
}

/** User turn; the only message type that may carry images, and never tool calls. */
export interface ProviderUserMessage {
  readonly role: 'user';
  readonly content: string;
  readonly images?: readonly ModelImage[];
  readonly toolCallId?: never;
  readonly toolCalls?: never;
}

/** Assistant turn; `content` may be empty when the turn is only a tool declaration. */
export interface ProviderAssistantMessage {
  readonly role: 'assistant';
  readonly content: string;
  readonly images?: never;
  readonly toolCallId?: never;
  readonly toolCalls?: readonly ProviderToolCall[];
}

/** Tool result answering one declared call. */
export interface ProviderToolMessage {
  readonly role: 'tool';
  readonly content: string;
  readonly toolCallId: string;
  readonly images?: never;
  readonly toolCalls?: never;
}

/** Message list a host may pass to the compatible provider directly. */
export type ProviderMessage =
  ProviderSystemMessage | ProviderUserMessage | ProviderAssistantMessage | ProviderToolMessage;
