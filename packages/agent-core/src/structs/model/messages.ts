/**
 * Model message primitives shared by every provider adapter.
 *
 * These shapes are deliberately provider-neutral: they describe text, optional images, streamed
 * parts and the options a call may carry. Provider-specific wire formats stay in `support/model`.
 *
 * Exports: `ModelImage`, `ModelMessage`, `ModelToolCall`, `ModelAssistantToolMessage`,
 * `ModelToolResultMessage`, `ModelUsage`, `ModelFunction`, `FunctionCallDelta`,
 * `ModelPart`, `ModelOptions`.
 */
export interface ModelImage {
  /** Absolute or data URL the provider can fetch; never a local file path. */
  url: string;
  /** Provider resolution hint; `original` asks for no downscaling where supported. */
  detail?: 'auto' | 'low' | 'high' | 'original';
}

/** One tool call the assistant declared, in provider order. */
export interface ModelToolCall {
  /** Provider call id, echoed by the matching tool result. */
  readonly id: string;
  /** Declared function name. */
  readonly name: string;
  /** Raw JSON arguments exactly as the provider produced them. */
  readonly arguments: string;
}

/** One provider-neutral turn; `images` are user visual input and are not part of the text budget. */
/** Ordered content supported by an explicitly capable provider. */
export type ModelContentPart =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'image' | 'audio' | 'video' | 'file';
      readonly url: string;
      readonly mimeType?: string;
    };

/** Opaque protocol state; never part of the visible result or context journal. */
export interface ModelContinuation {
  readonly version: 1;
  readonly protocol: string;
  readonly model: string;
  readonly scope: string;
  readonly data: unknown;
}

/** Optional provider facts; absence never implies support. */
export interface ModelCapabilities {
  readonly completion?: boolean;
  readonly modalities?: readonly string[];
  readonly tools?: boolean;
  readonly jsonSchema?: boolean;
}

/** Full events are routed by Runner before legacy collectors see content. */
export type ModelStreamEvent =
  | ModelPart
  | { readonly type: 'usage'; readonly usage: ModelUsage }
  | {
      readonly type: 'completion';
      readonly status: 'completed' | 'tool-calls' | 'refused' | 'incomplete';
      readonly reason?: string;
    }
  | { readonly type: 'continuation'; readonly continuation: ModelContinuation }
  | { readonly type: 'content'; readonly content: ModelContentPart };

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Rendered text content sent to the model. */
  content: string;
  /** Ordered content, replacing the legacy content/images projection when supplied. */
  parts?: readonly ModelContentPart[];
  /** User-supplied visual input. Binary payload is separate from the text character budget. */
  images?: readonly ModelImage[];
  /** Tool declarations made by an assistant turn; rejected on every other role at runtime. */
  toolCalls?: readonly ModelToolCall[];
  /** Call id answered by a tool result; rejected on every other role at runtime. */
  toolCallId?: string;
}

/** Assistant turn that may declare tool calls and may carry an empty text body. */
export type ModelAssistantToolMessage = ModelMessage & {
  readonly role: 'assistant';
  readonly toolCalls?: readonly ModelToolCall[];
  readonly toolCallId?: never;
  readonly images?: never;
};

/** Tool result turn; `toolCallId` is required and images/tool declarations are rejected. */
export type ModelToolResultMessage = ModelMessage & {
  readonly role: 'tool';
  readonly toolCallId: string;
  readonly toolCalls?: never;
  readonly images?: never;
};

/** Provider-reported token counts for one call; used for accounting, never for admission. */
export interface ModelUsage {
  /** Input tokens billed for the call. */
  promptTokens: number;
  /** Output tokens billed for the call. */
  completionTokens: number;
  /** Provider-reported total; may include tokens not covered by the two fields above. */
  totalTokens: number;
}

/** Provider-neutral function definition. Execution and authorization stay with the host. */
export interface ModelFunction {
  /** Function name the model must use when selecting the capability. */
  name: string;
  /** Model-visible description of when the function applies. */
  description: string;
  /** JSON Schema of the arguments; must be an object schema. */
  parameters: Record<string, unknown>;
  /** Request strict argument validation from providers that support it. */
  strict?: boolean;
}

/** One streamed fragment of a function call; fragments with the same `index` must be joined. */
export interface FunctionCallDelta {
  type: 'function-call-delta';
  /** Index of the call within the response; deltas with the same index belong together. */
  index: number;
  /** Provider call id, usually delivered once with the first delta. */
  id?: string;
  /** Function name, usually delivered once with the first delta. */
  name?: string;
  /** Raw JSON argument fragment; concatenating all fragments yields the full arguments. */
  arguments?: string;
}

/** One streamed response part: assistant text or a function-call fragment. */
export type ModelPart = string | FunctionCallDelta;

/** Per-call provider options; Core passes them through and does not normalize provider ranges. */
export interface ModelOptions {
  /** Require an explicit successful upstream terminal event. */
  requireCompletion?: boolean;
  /** Native schema requirement; unsupported providers must reject before I/O. */
  outputSchema?: Readonly<Record<string, unknown>>;
  /** Protocol state supplied by the host for this scoped turn. */
  continuation?: ModelContinuation;
  /** Receives opaque state without exposing it to journal or diagnostics. */
  onContinuation?: (continuation: ModelContinuation) => void;
  /** Explicit media output sink; media never enters a text collector or journal. */
  onContent?: (content: ModelContentPart) => void;
  /** Request a JSON-object response from providers that support it. */
  json?: boolean;
  /** Sampling temperature; provider range is not normalized by Core. */
  temperature?: number;
  /** Output ceiling for the call; the effective value is the smaller of this and the budget. */
  maxOutputTokens?: number;
  /** Ask the provider to report usage for streamed responses. */
  includeUsage?: boolean;
  /** Receives usage the provider reports; may be called once per call. */
  onUsage?: (usage: ModelUsage) => void;
  /** Functions offered to the model for this call. */
  functions?: readonly ModelFunction[];
  /** Tool-selection strategy; omitted keeps the provider's default. */
  toolChoice?: 'auto' | 'required' | 'none';
  /** Request parallel tool calls; `'omit'` leaves the wire field out entirely. */
  parallelToolCalls?: boolean | 'omit';
}

/** Shared optional per-turn settings for text, selection and tool-session interactions. */
export type ModelInteractionOptions = Pick<
  ModelOptions,
  | 'temperature'
  | 'requireCompletion'
  | 'outputSchema'
  | 'continuation'
  | 'onContinuation'
  | 'onContent'
>;
