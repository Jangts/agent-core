/**
 * Incremental reply preview: project partial model output into presentable bubbles.
 *
 * The projection is a lexical scan, deliberately separate from authoritative JSON or schema
 * validation, and it only reads explicitly registered prose fields. It is presentation only: it
 * must never authorize, persist or execute a proposal.
 *
 * Main export: `createReplyPreview` and its rule/settings types.
 */
import { synchronous } from '../../utils/synchronous.js';
import type { ModelOutputEvent } from '../../structs/model/runtime.js';

/**
 * One projection rule: which stage/capability it matches and which prose fields may be shown.
 *
 * A rule without `toolId` may only match a registered plain-text stage.
 */
export interface ReplyPreviewRule {
  /** Native function wire name. Omit only for a registered plain-text stage. */
  toolId?: string;
  /** Restrict the rule to one stage; omitted matches any stage producing this capability. */
  stageId?: string;
  /** JSON paths to project, where `*` matches any array index; defaults to text/bubble paths. */
  paths?: readonly (readonly string[])[];
  /** Presentation eligibility from a complete string field in the same proposal. */
  when?: { path: readonly string[]; values: readonly string[] };
}
/** Rules plus optional renderer and character budget; all values are snapshotted at creation. */
export interface ReplyPreviewSettings {
  rules: readonly ReplyPreviewRule[];
  /** Presentation only; must not authorize, persist or execute a proposal. */
  render?(text: string): string;
  /** Streamed characters tolerated before preview is disabled; default 16000. */
  maxChars?: number;
}

/** Settings for `createReplyPreview`; `sink` receives every bubble list and is required. */
export interface ReplyPreviewOptions extends ReplyPreviewSettings {
  /** Receives the current bubble list; rejection propagates to the event caller. */
  readonly sink: (bubbles: string[]) => void | Promise<void>;
}

type Frame = {
  path: string[];
  kind: '{' | '[';
  state: 'key' | 'colon' | 'value' | 'comma';
  key?: string;
  index: number;
  keys: Set<string>;
};
/** Incremental lexical projection, deliberately separate from authoritative JSON/schema validation. */
class StringProjection {
  private stack: Frame[] = [];
  private token?: {
    key: boolean;
    path: string[];
    text: string;
    projectionKey?: string;
    escape: boolean;
    unicode?: string;
  };
  private readonly completedStrings = new Set<string>();
  private primitive = false;
  private started = false;
  readonly values = new Map<string, { path: string[]; text: string }>();
  constructor(private readonly paths: readonly (readonly string[])[]) {}
  private path(): string[] {
    const frame = this.stack.at(-1);
    return frame ? [...frame.path, frame.kind === '[' ? String(frame.index) : frame.key!] : [];
  }
  private complete() {
    const parent = this.stack.at(-1);
    if (parent) {
      parent.state = 'comma';
      if (parent.kind === '[') parent.index++;
    }
  }
  push(input: string) {
    for (const ch of input) {
      const token = this.token;
      if (token) {
        if (token.unicode !== undefined) {
          if (!/[\da-f]/i.test(ch)) throw new Error('Invalid escape');
          token.unicode += ch;
          if (token.unicode.length === 4) {
            token.text += String.fromCharCode(parseInt(token.unicode, 16));
            token.unicode = undefined;
          }
        } else if (token.escape) {
          token.escape = false;
          if (ch === 'u') token.unicode = '';
          else {
            const escapes: Record<string, string> = {
              '"': '"',
              '\\': '\\',
              '/': '/',
              b: '\b',
              f: '\f',
              n: '\n',
              r: '\r',
              t: '\t',
            };
            if (!(ch in escapes)) throw new Error('Invalid escape');
            token.text += escapes[ch];
          }
        } else if (ch === '\\') token.escape = true;
        else if (ch === '"') {
          this.token = undefined;
          if (token.key) {
            const frame = this.stack.at(-1)!;
            if (frame.keys.has(token.text)) throw new Error('Duplicate key');
            frame.keys.add(token.text);
            frame.key = token.text;
            frame.state = 'colon';
          } else {
            if (token.projectionKey !== undefined) this.completedStrings.add(token.projectionKey);
            this.complete();
          }
        } else {
          if (ch < ' ') throw new Error('Invalid string');
          token.text += ch;
        }
        // Keep the token itself as the live value. Path matching/serialization
        // belongs to string creation, not to every character in its contents.
        if (token.projectionKey !== undefined) this.values.set(token.projectionKey, token);
        continue;
      }
      if (/\s/.test(ch)) continue;
      if (this.primitive) {
        if (!',]}'.includes(ch)) continue;
        this.primitive = false;
        this.complete();
      }
      const frame = this.stack.at(-1);
      if (ch === '}' || ch === ']') {
        if (
          !frame ||
          (ch === '}' ? frame.kind !== '{' : frame.kind !== '[') ||
          !['key', 'value', 'comma'].includes(frame.state)
        )
          throw new Error('Invalid close');
        this.stack.pop();
        this.complete();
        continue;
      }
      if (ch === ',') {
        if (frame?.state !== 'comma') throw new Error('Invalid comma');
        frame.state = frame.kind === '{' ? 'key' : 'value';
        continue;
      }
      if (ch === ':') {
        if (frame?.state !== 'colon') throw new Error('Invalid colon');
        frame.state = 'value';
        continue;
      }
      if (ch === '"') {
        if (!frame || !['key', 'value'].includes(frame.state))
          throw new Error('Invalid string position');
        const key = frame.state === 'key',
          path = this.path();
        const projected =
          !key &&
          this.paths.some(
            (pattern) =>
              path.length === pattern.length &&
              pattern.every((key, i) => (key === '*' ? /^\d+$/.test(path[i]!) : key === path[i])),
          );
        this.token = {
          key,
          path,
          text: '',
          projectionKey: projected ? JSON.stringify(path) : undefined,
          escape: false,
        };
        continue;
      }
      if (frame && frame.state !== 'value') throw new Error('Invalid value');
      if (!frame && this.started) throw new Error('Multiple roots');
      this.started = true;
      if (ch === '{' || ch === '[') {
        if (this.stack.length >= 32) throw new Error('Too deep');
        this.stack.push({
          path: this.path(),
          kind: ch,
          state: ch === '{' ? 'key' : 'value',
          index: 0,
          keys: new Set(),
        });
      } else this.primitive = true;
    }
  }
  string(path: readonly string[]): string | undefined {
    const key = JSON.stringify(path);
    return this.completedStrings.has(key) ? this.values.get(key)?.text : undefined;
  }
  texts(paths = this.paths): string[] {
    // Later bubbles can arrive first in JSON; keep their indices stable until the leading prose exists.
    const first = paths[0];
    if (first && !first.includes('*') && !this.values.has(JSON.stringify(first))) return [];
    return paths
      .flatMap((pattern) =>
        [...this.values.values()]
          .filter(
            ({ path }) =>
              path.length === pattern.length &&
              pattern.every((key, i) => (key === '*' ? /^\d+$/.test(path[i]!) : key === path[i])),
          )
          .sort((a, b) => Number(a.path.at(-1)) - Number(b.path.at(-1))),
      )
      .map((value) => value.text);
  }
}

/**
 * Create a model-output event handler that publishes preview bubbles.
 *
 * The handler resets on `model.start`, ignores other invocations, disables itself on unexpected
 * output, and clears the preview when a call ends unsuccessfully. Rules are snapshotted at
 * creation, and only explicitly registered prose fields are projected.
 *
 * @param options Rules, optional renderer, character budget and the bubble sink.
 * @returns An async handler for `ModelOutputEvent`.
 * @throws {TypeError} When the sink is missing or `maxChars` is not a positive integer.
 */
export function createReplyPreview(
  options: ReplyPreviewOptions,
): (event: ModelOutputEvent) => Promise<void> {
  if (typeof options.sink !== 'function') throw new TypeError('A reply preview sink is required');
  const sink = options.sink.bind(options),
    render = options.render?.bind(options);
  const maxChars = options.maxChars ?? 16000;
  if (!Number.isSafeInteger(maxChars) || maxChars < 1)
    throw new TypeError('Invalid reply preview budget');
  const rules = options.rules.map((rule) =>
    Object.freeze({
      toolId: rule.toolId,
      stageId: rule.stageId,
      paths: rule.paths === undefined ? undefined : structuredClone(rule.paths),
      when: rule.when === undefined ? undefined : structuredClone(rule.when),
    }),
  );
  let name = '',
    argumentsText = '',
    plain = '',
    disabled = false,
    last = '',
    chars = 0;
  let parser: StringProjection | undefined;
  let selected: ReplyPreviewRule | undefined;
  let activeCall: string | undefined;
  const publish = async (texts: string[]) => {
    // Hold incomplete surrogate pairs and never show internal control characters. The bubble cap
    // is independent of `maxChars`: at most five bubbles and 16000 characters reach the sink.
    let remaining = 16000;
    const bubbles = texts.slice(0, 5).map((text) => {
      const value = (
        render ? synchronous(render(text), 'Reply preview renderers must be synchronous') : text
      )
        .slice(0, remaining)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\ud800-\udbff]$/gu, '');
      remaining -= value.length;
      return value;
    });
    const serialized = JSON.stringify(bubbles);
    if (serialized !== last) {
      last = serialized;
      await sink(bubbles);
    }
  };
  return async (event) => {
    if (event.type === 'model.start') {
      activeCall = event.invocationId;
      name = '';
      argumentsText = '';
      plain = '';
      disabled = false;
      parser = undefined;
      selected = undefined;
      chars = 0;
      if (last && last !== '[]') await publish([]);
      return;
    }
    if (event.invocationId !== activeCall) return;
    if (event.type === 'model.end') {
      if (event.payload.state.status !== 'success') await publish([]);
      return;
    }
    if (event.type === 'model.parsed') return;
    if (disabled) return;
    const part = event.payload.part;
    chars +=
      typeof part === 'string'
        ? part.length
        : (part.name?.length ?? 0) + (part.arguments?.length ?? 0);
    if (chars > maxChars) {
      disabled = true;
      await publish([]);
      return;
    }
    if (typeof part === 'string') {
      const rule = rules.find((rule) => !rule.toolId && rule.stageId === event.payload.stageId);
      if (!rule) {
        if (part.trim()) {
          disabled = true;
          await publish([]);
        }
        return;
      }
      plain += part;
      await publish([plain]);
      return;
    }
    if (part.index !== 0) {
      disabled = true;
      await publish([]);
      return;
    }
    name += part.name ?? '';
    const rule = rules.find(
      (rule) => rule.toolId === name && (!rule.stageId || rule.stageId === event.payload.stageId),
    );
    if (!rule) {
      if (selected) {
        disabled = true;
        await publish([]);
      } else argumentsText += part.arguments ?? '';
      return;
    }
    try {
      if (!selected) {
        selected = rule;
        parser = new StringProjection([
          ...(rule.paths ?? [['text'], ['bubbles', '*']]),
          ...(rule.when ? [rule.when.path] : []),
        ]);
        parser.push(argumentsText);
        argumentsText = '';
      }
      parser!.push(part.arguments ?? '');
    } catch {
      disabled = true;
      await publish([]);
      return;
    }
    const eligible = !rule.when || rule.when.values.includes(parser!.string(rule.when.path) ?? '');
    await publish(eligible ? parser!.texts(rule.paths ?? [['text'], ['bubbles', '*']]) : []);
  };
}
