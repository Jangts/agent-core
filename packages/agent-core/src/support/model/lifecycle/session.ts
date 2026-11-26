/** Portable realtime turns and decoded media/tool events over the Core realtime boundary. */
import type { ModelRealtimeEvent } from '../../../structs/model/lifecycle.js';
import { openModelRealtime, type RealtimeSessionOptions } from '../../../model/realtime.js';
import {
  createRealtimeProtocolProvider,
  realtimeInput,
  realtimeToolResult,
  realtimeFunctionResponse,
  type RealtimeProtocolConfig,
} from './realtime.js';
/** Start explicit turns; correlate OpenAI response IDs and quarantine interrupted Gemini output. */
export async function openProtocolRealtime(
  config: RealtimeProtocolConfig,
  options: Omit<RealtimeSessionOptions, 'generationOf'>,
) {
  const setup = structuredClone(config.setup) as Record<string, any>;
  if (config.protocol === 'openai-realtime') {
    if (setup.audio?.input?.turn_detection != null)
      throw Error('Automatic generation cannot enforce the manual-turn budget');
    setup.audio = { ...setup.audio, input: { ...setup.audio?.input, turn_detection: null } };
  } else {
    if (setup.realtimeInputConfig?.automaticActivityDetection?.disabled === false)
      throw Error('Automatic generation cannot enforce the manual-turn budget');
    setup.realtimeInputConfig = {
      ...setup.realtimeInputConfig,
      automaticActivityDetection: { disabled: true },
    };
  }
  const definitions = (setup.tools ?? []).flatMap(
    (tool: Record<string, any>) =>
      tool.functionDeclarations ?? tool.function_declarations ?? [tool],
  );
  if (
    definitions.some(
      (tool: Record<string, any>) => tool.async === true || tool.behavior === 'NON_BLOCKING',
    )
  )
    throw Error('Nonblocking tools require a separate concurrent-turn lifecycle');
  const provider = createRealtimeProtocolProvider({ ...config, setup });
  const tools = new Map<
    string,
    { name: string; generation: number; ready?: boolean; value?: unknown; sent?: boolean }
  >();
  const closedGroups = new Set<number>();
  let flushing: Promise<void> | undefined;
  let generation = 0,
    geminiBarrier = false,
    geminiAcknowledgements = 0;
  const pending: number[] = [],
    responses = new Map<string, number>();
  const core = await openModelRealtime(
    {
      async connect(context) {
        const interaction = await provider.connect(context);
        return {
          ...interaction,
          frames: {
            async *[Symbol.asyncIterator]() {
              for await (const frame of interaction.frames) {
                const f = frame as Record<string, any>;
                if (f.type === 'error' || f.error) throw Error('Realtime upstream error');
                let origin: number | undefined;
                if (config.protocol === 'openai-realtime') {
                  if (f.type === 'response.created' && typeof f.response?.id === 'string') {
                    const g = pending.shift();
                    if (g !== undefined) responses.set(f.response.id, g);
                  }
                  const id = f.response_id ?? f.response?.id;
                  origin = typeof id === 'string' ? responses.get(id) : undefined;
                  if (f.type === 'response.done' && typeof id === 'string') {
                    responses.delete(id);
                  }
                } else {
                  if (f.serverContent?.interrupted) {
                    geminiAcknowledgements++;
                    geminiBarrier = false;
                    origin = generation;
                  } else if (!geminiBarrier) origin = generation;
                }
                yield { ...frame, _generation: origin };
              }
            },
          },
        };
      },
    },
    {
      ...options,
      generationOf: (frame) =>
        typeof frame._generation === 'number' ? frame._generation : undefined,
    },
  );
  const assertCurrentGeneration = (current: boolean) => {
    if (!current) throw Error('Stale realtime generation');
  };
  const flushTools = async (expected = generation): Promise<void> => {
    assertCurrentGeneration(expected === generation);
    if (flushing) return flushing;
    const group = [...tools.entries()].filter(([, call]) => call.generation === expected);
    if (!closedGroups.has(expected) || !group.length || group.some(([, call]) => !call.ready))
      return;
    flushing = (async () => {
      if (config.protocol === 'openai-realtime') {
        for (const [id, call] of group)
          if (!call.sent) {
            await core.send(
              realtimeToolResult(config.protocol, id, call.name, call.value),
              'tool',
              expected,
              0,
            );
            call.sent = true;
          }
        await core.generate({ type: 'response.create' }, 'input', expected, (next) => {
          generation = next;
          pending.push(next);
          for (const [id] of group) tools.delete(id);
          closedGroups.delete(expected);
        });
      } else {
        await core.generate(
          {
            toolResponse: {
              functionResponses: group.map(([id, call]) => ({
                id,
                name: call.name,
                response: realtimeFunctionResponse(call.value),
              })),
            },
          },
          'tool',
          expected,
          (next) => {
            generation = next;
            for (const [id] of group) tools.delete(id);
            closedGroups.delete(expected);
          },
        );
      }
    })();
    try {
      await flushing;
    } finally {
      flushing = undefined;
    }
  };
  const startTurn = async (
    frame: Readonly<Record<string, unknown>>,
    prefix?: Readonly<Record<string, unknown>>,
  ) => {
    if (geminiBarrier) throw Error('Interrupted turn has not been acknowledged');
    await core.generate(
      frame,
      'input',
      generation,
      (next) => {
        generation = next;
        if (config.protocol === 'openai-realtime') pending.push(next);
      },
      prefix,
    );
  };
  return {
    get generation() {
      return generation;
    },
    async text(text: string) {
      const frame = realtimeInput(config.protocol, text);
      if (config.protocol === 'openai-realtime')
        await startTurn({ type: 'response.create' }, frame);
      else await startTurn(frame);
    },
    async audio(data: string, mimeType = 'audio/pcm;rate=16000') {
      await core.send(
        config.protocol === 'openai-realtime'
          ? { type: 'input_audio_buffer.append', audio: data }
          : { realtimeInput: { audio: { mimeType, data } } },
        'input',
        generation,
        0,
      );
    },
    async commitAudio() {
      if (config.protocol === 'openai-realtime')
        await startTurn({ type: 'response.create' }, { type: 'input_audio_buffer.commit' });
      else await startTurn({ realtimeInput: { activityEnd: {} } });
    },
    async tool(id: string, name: string, value: unknown, expectedGeneration = generation) {
      const proposal = tools.get(id);
      if (
        !proposal ||
        proposal.name !== name ||
        proposal.generation !== expectedGeneration ||
        expectedGeneration !== generation
      )
        throw Error('Tool result does not match the current generation proposal');
      if (proposal.ready) throw Error('Tool result already provided');
      await options.run(
        async (signal) => {
          await options.authorize('tool', signal);
        },
        { signal: options.signal, calls: 0, action: 'authorize' },
      );
      assertCurrentGeneration(expectedGeneration === generation && tools.get(id) === proposal);
      if (proposal.ready) throw Error('Tool result already provided');
      proposal.value = structuredClone(value);
      proposal.ready = true;
      await flushTools(expectedGeneration);
    },
    /** Retry an already-admitted tool continuation after a local budget/policy adjustment. */
    async respond() {
      await flushTools(generation);
    },
    async interrupt() {
      const acknowledged = geminiAcknowledgements;
      await core.interrupt(
        config.protocol === 'openai-realtime'
          ? { type: 'response.cancel' }
          : { realtimeInput: { activityStart: {} } },
        (next) => {
          generation = next;
          if (config.protocol === 'gemini-live')
            geminiBarrier = geminiAcknowledgements === acknowledged;
        },
      );
    },
    async *events(): AsyncGenerator<ModelRealtimeEvent> {
      for await (const { generation, frame } of core.events()) {
        const f = frame as Record<string, any>;
        if (config.protocol === 'openai-realtime') {
          if (
            f.type === 'response.output_text.delta' ||
            f.type === 'response.audio_transcript.delta'
          )
            yield { generation, type: 'text', text: f.delta };
          else if (f.type === 'response.audio.delta' || f.type === 'response.output_audio.delta')
            yield { generation, type: 'audio', data: f.delta };
          else if (f.type === 'response.output_item.added') {
            if (f.item?.type === 'function_call')
              tools.set(f.item.call_id, { name: f.item.name, generation });
            else if (f.item?.type !== 'message') throw Error('Unsupported realtime output item');
          } else if (f.type === 'response.function_call_arguments.done') {
            const name = f.name ?? tools.get(f.call_id)?.name;
            if (!f.call_id || !name) throw Error('Realtime tool identity missing');
            tools.set(f.call_id, { name, generation });
            yield { generation, type: 'tool', id: f.call_id, name, arguments: f.arguments };
          } else if (f.type === 'response.done') {
            if (f.response?.status !== 'completed')
              throw Error('Realtime generation did not complete');
            const waiting = [...tools.values()].some((call) => call.generation === generation);
            if (waiting) {
              closedGroups.add(generation);
              await flushTools(generation);
              yield { generation, type: 'tool-wait', usage: f.response?.usage };
            } else yield { generation, type: 'completed', usage: f.response?.usage };
          } else if (
            ![
              'response.created',
              'response.output_item.done',
              'response.content_part.added',
              'response.content_part.done',
              'response.output_text.done',
              'response.audio.done',
              'response.output_audio.done',
              'response.audio_transcript.done',
              'response.output_audio_transcript.done',
              'response.function_call_arguments.delta',
              'session.created',
              'session.updated',
              'conversation.item.created',
              'input_audio_buffer.committed',
              'rate_limits.updated',
            ].includes(f.type)
          )
            throw Error('Unsupported realtime event');
        } else {
          for (const part of f.serverContent?.modelTurn?.parts ?? []) {
            if (part.text) yield { generation, type: 'text', text: part.text };
            if (part.inlineData) {
              if (
                typeof part.inlineData.data !== 'string' ||
                (part.inlineData.mimeType !== undefined &&
                  typeof part.inlineData.mimeType !== 'string')
              )
                throw Error('Invalid realtime media content');
              yield {
                generation,
                type: 'media',
                data: part.inlineData.data,
                ...(part.inlineData.mimeType === undefined
                  ? {}
                  : { mimeType: part.inlineData.mimeType }),
              };
            }
            if (part.text === undefined && !part.inlineData)
              throw Error('Unsupported realtime content part');
          }
          const toolCalls: Extract<ModelRealtimeEvent, { type: 'tool' }>[] = [];
          for (const { id, name, args } of f.toolCall?.functionCalls ?? []) {
            if (typeof id !== 'string' || !id || typeof name !== 'string' || !name)
              throw Error('Realtime tool identity missing');
            toolCalls.push({
              generation,
              type: 'tool',
              id,
              name,
              arguments: JSON.stringify(args ?? {}),
            });
          }
          if (toolCalls.length) {
            for (const { id, name } of toolCalls) tools.set(id, { name, generation });
            closedGroups.add(generation);
            yield { generation, type: 'tool-wait', usage: f.usageMetadata };
            yield* toolCalls;
          }
          if (f.serverContent?.turnComplete && !toolCalls.length) {
            if ([...tools.values()].some((call) => call.generation === generation))
              yield { generation, type: 'tool-wait', usage: f.usageMetadata };
            else yield { generation, type: 'completed', usage: f.usageMetadata };
          }
        }
      }
    },
    close: core.close,
  };
}
