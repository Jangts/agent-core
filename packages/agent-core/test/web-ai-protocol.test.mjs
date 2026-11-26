import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defineCommand,
  defineCommandCatalog,
  defineInteractionProtocol,
  InteractionProtocol,
  CommandCatalog,
  commandSchema,
} from '../dist/esm/kits/interaction/index.js';
import { configureBreakWhile } from '../dist/esm/index.js';

test('InteractionProtocol contains its CommandCatalog and routes the existing flat envelope', () => {
  const transfer = defineInteractionProtocol({
    commandField: 'kind',
    fields: ['kind', 'requestId'],
    modeField: 'mode',
    version: 7,
    commands: {
      move: {
        fields: ['offset', 'mode'],
        ownedFields: ['offset'],
        modes: ['button'],
        checks: [{ occur: (value) => !Number.isInteger(value.offset), error: 'offset' }],
        format: (value) => ({ offset: value.offset }),
      },
      stop: { fields: ['mode'], modes: ['button'], format: () => ({ stopped: true }) },
    },
  });
  assert.equal(transfer instanceof InteractionProtocol, true);
  assert.equal(transfer.commands instanceof CommandCatalog, true);
  assert.deepEqual(transfer.commands.ids(), ['move', 'stop']);
  assert.equal(transfer.commands.require('move').version, 7);
  assert.deepEqual(transfer.parse({ kind: 'move', requestId: 'one', mode: 'button', offset: 2 }), {
    offset: 2,
  });
  assert.deepEqual(
    transfer.modelJsonSchema.anyOf.map((schema) => schema.properties.kind.enum[0]),
    ['move', 'stop'],
  );
  assert.throws(
    () => transfer.parse({ kind: 'stop', mode: 'button', offset: 2 }),
    /belongs to another command/,
  );
  assert.throws(() => transfer.parse({ kind: 'foreign', mode: 'button' }), /Unknown command/);
  assert.throws(
    () =>
      defineInteractionProtocol({
        commandField: 'kind',
        commands: { move: { fields: [], discriminator: { field: 'kind', value: 'stop' } } },
      }),
    /Conflicting transfer command discriminator/,
  );
});

test('one declaration derives exact runtime keys and a schema with distinct model requirements', () => {
  const protocol = defineCommand({
    discriminator: { field: 'type', value: 'finish' },
    optionalPresence: 'defined',
    fields: {
      text: { required: true, jsonSchema: { type: 'string' } },
      review: { required: true, modelRequired: false, jsonSchema: { type: 'boolean' } },
      notes: { jsonSchema: { type: 'array', items: { type: 'string' } } },
    },
  });
  assert.deepEqual(protocol.keys({}), ['type', 'text', 'review']);
  assert.deepEqual(protocol.keys({ notes: [] }), ['type', 'text', 'review', 'notes']);
  assert.deepEqual(protocol.modelJsonSchema.required, ['type', 'text']);
  assert.deepEqual(Object.keys(protocol.fieldSchemas), ['text', 'review', 'notes']);
  const valid = { type: 'finish', text: 'done', review: false };
  assert.equal(protocol.parse(valid), valid);
  for (const invalid of [
    null,
    [],
    { text: 'done', review: false },
    { ...valid, type: 'foreign' },
    { ...valid, extra: true },
    { ...valid, notes: undefined },
  ]) {
    assert.throws(() => protocol.parse(invalid));
  }
});

test('own presence accepts undefined optional fields while closed objects still reject foreign fields', () => {
  const protocol = defineCommand({ fields: ['optional'] });
  assert.deepEqual(protocol.keys({ optional: undefined }), ['optional']);
  assert.deepEqual(protocol.parse({ optional: undefined }), { optional: undefined });
  assert.throws(() => protocol.parse({ unknown: undefined }));
});

test('conditional check groups short circuit before dependent checks, refinement and formatting', () => {
  const calls = [],
    events = [];
  const expected = new Error('invalid payload');
  configureBreakWhile({
    onBreak: (event) => {
      events.push(event);
    },
  });
  try {
    const protocol = defineCommand({
      fields: ['values'],
      error: expected,
      tags: ['payload'],
      checks: [
        {
          when: (value) => value.values !== undefined,
          occur: [
            (value) => {
              calls.push('shape');
              return !Array.isArray(value.values);
            },
            (value) => {
              calls.push('length');
              return !value.values.length;
            },
          ],
          tags: ['values'],
        },
      ],
      refine() {
        calls.push('refine');
      },
      format(value) {
        calls.push('format');
        return value.values ?? [];
      },
    });
    assert.throws(
      () => protocol.parse({ values: null }),
      (error) => error === expected,
    );
    assert.deepEqual(calls, ['shape']);
    assert.deepEqual(
      events.map((event) => event.tags),
      [['payload', 'values']],
    );
    calls.length = 0;
    assert.deepEqual(protocol.parse({}), []);
    assert.deepEqual(calls, ['refine', 'format']);
  } finally {
    configureBreakWhile();
  }
});

test('checks and formatters receive explicit host context without executing any external handler', () => {
  let formats = 0;
  const protocol = defineCommand({
    fields: ['amount'],
    checks: [{ occur: (value, context) => value.amount > context.limit, error: 'over limit' }],
    format(value, context) {
      formats++;
      return { result: value.amount * context.rate };
    },
  });
  assert.throws(() => protocol.parse({ amount: 5 }, { limit: 4, rate: 2 }), /over limit/);
  assert.equal(formats, 0);
  assert.deepEqual(protocol.parse({ amount: 3 }, { limit: 4, rate: 2 }), { result: 6 });
  assert.equal(formats, 1);
});

test('catalogs share envelope fields, reject foreign ownership and unsupported modes before projection', () => {
  let formats = 0;
  const catalog = defineCommandCatalog(
    {
      first: {
        fields: [],
        ownedFields: ['firstId'],
        modes: ['button'],
        format: (value) => {
          formats++;
          return value.firstId;
        },
      },
      second: {
        fields: [],
        ownedFields: ['secondId'],
        modes: ['auto'],
        format: (value) => value.secondId,
      },
    },
    { fields: ['mode'], error: 'invalid shape' },
    {
      modeField: 'mode',
      unknownError: 'unknown',
      modeError: 'mode',
      ownershipError: 'owner',
    },
  );
  const protocols = catalog.toRecord();
  assert.equal(catalog.parse('first', { mode: 'button', firstId: 'one' }), 'one');
  assert.throws(() => catalog.parse('first', { mode: 'auto', firstId: 'one' }), /mode/);
  assert.throws(
    () => catalog.parse('first', { mode: 'button', firstId: 'one', secondId: 'two' }),
    /owner/,
  );
  assert.throws(
    () => catalog.parse('first', { mode: 'button', firstId: 'one', unknown: true }),
    /invalid shape/,
  );
  assert.throws(() => catalog.parse('missing', {}), /unknown/);
  assert.equal(formats, 1);
  assert.throws(
    () =>
      new CommandCatalog([
        ['first', protocols.first],
        ['first', protocols.second],
      ]),
    /Duplicate protocol/,
  );
});

test('definition snapshots prevent later mutation of fields, checks and modes', () => {
  const fields = { text: { required: true, jsonSchema: { type: 'string' } } };
  const modes = ['button'];
  const conditions = [(value) => value.text === 'reject'];
  const definition = { fields, modes, checks: [{ occur: conditions, error: 'rejected' }] };
  const protocol = defineCommand(definition);
  fields.text.required = false;
  fields.text.jsonSchema.type = 'number';
  modes.push('auto');
  conditions.length = 0;
  assert.deepEqual(protocol.modelJsonSchema.required, ['text']);
  assert.equal(protocol.modelJsonSchema.properties.text.type, 'string');
  assert.deepEqual(protocol.modes, ['button']);
  assert.throws(() => protocol.parse({ text: 'reject' }), /rejected/);
  assert.throws(() => protocol.parse({}));
});

test('dynamic custom protocols derive open schemas from the minimal keys interface without built-in business names', () => {
  assert.deepEqual(commandSchema('custom', { keys: () => ['type'] }), {
    type: 'object',
    properties: { type: { type: 'string', enum: ['custom'] } },
    required: ['type'],
    additionalProperties: true,
  });
  const compiled = defineCommand({ fields: [] });
  assert.equal(commandSchema('custom', compiled), compiled.modelJsonSchema);
  assert.throws(
    () => defineCommand({ discriminator: { field: 'kind', value: 'x' }, fields: ['kind'] }),
    /Duplicate protocol discriminator/,
  );
});

test('Interaction publishes one command contract without legacy output aliases', async () => {
  const entry = await import('../dist/esm/kits/interaction/index.js');
  assert.equal(entry.Interaction, InteractionProtocol);
  assert.equal(entry.Interaction.Commands, CommandCatalog);
  assert.equal(entry.Interaction.Commands.compile, entry.compileCommands);
  for (const name of [
    'WAITP',
    'WAIIC',
    'WebAITransferProtocol',
    'WebAIInvokeCommands',
    'defineWAITP',
    'defineWAIIC',
    'defineWebAIInvokeCommand',
    'webAICommandSchema',
    'bindWebAIInteraction',
  ]) {
    assert.equal(Object.hasOwn(entry, name), false, name);
  }
  const command = defineCommand({
    fields: { text: { required: true, jsonSchema: { type: 'string' } } },
  });
  for (const name of ['schema', 'parameters', 'validate'])
    assert.equal(Object.hasOwn(command, name), false);
  assert.deepEqual(command.inputJsonSchema.required, ['text']);
  assert.equal(command.fieldSchemas.text.type, 'string');
});

test('class definitions preserve field schemas, envelope callbacks and selection errors', () => {
  const failure = new Error('selection');
  class Field {
    get required() {
      return true;
    }
    get jsonSchema() {
      return { type: 'string' };
    }
  }
  class Definition {
    #prefix = 'accepted:';
    #failure = failure;
    get commandField() {
      return 'kind';
    }
    get commandAliases() {
      return ['type'];
    }
    get fields() {
      return { text: new Field() };
    }
    get commands() {
      return { reply: { fields: [] } };
    }
    selectionError() {
      return this.#failure;
    }
    format(value) {
      return this.#prefix + value.text;
    }
  }
  const protocol = defineInteractionProtocol(new Definition());
  assert.equal(protocol.parse({ kind: 'reply', text: 'hello' }), 'accepted:hello');
  assert.equal(protocol.parse({ type: 'reply', text: 'hello' }), 'accepted:hello');
  assert.equal(protocol.commands.require('reply').fieldSchemas.text.type, 'string');
  assert.throws(
    () => protocol.parse({ kind: 'reply', type: 'reply', text: 'hello' }),
    (error) => error === failure,
  );
  assert.throws(() => protocol.parse({ kind: 'reply' }));
});

test('handler binding accepts independent receivers and class methods while rejecting inherited Object handlers', async () => {
  const { bindInteraction } = await import('../dist/esm/kits/interaction/index.js');
  class Receiver {
    #protocol = defineInteractionProtocol({
      commandField: 'kind',
      commands: { reply: { fields: ['text'], format: (value) => value.text } },
    });
    get commands() {
      return this.#protocol.commands;
    }
    receive(value) {
      return this.#protocol.receive(value);
    }
  }
  class Handlers {
    #prefix = 'reply:';
    reply(text, context) {
      return this.#prefix + text + context.suffix;
    }
  }
  const runtime = bindInteraction(new Receiver(), new Handlers());
  assert.equal(runtime.dispatch({ kind: 'reply', text: 'hello' }, { suffix: '!' }), 'reply:hello!');
  const protocol = defineInteractionProtocol({
    commandField: 'kind',
    commands: { toString: { fields: [] } },
  });
  assert.throws(() => bindInteraction(protocol, {}), /Missing interaction handler/);
  const constructorProtocol = defineInteractionProtocol({
    commandField: 'kind',
    commands: { constructor: { fields: [] } },
  });
  assert.throws(
    () => bindInteraction(constructorProtocol, new Handlers()),
    /Missing interaction handler/,
  );
});

test('custom command instances retain ownership and mode metadata before private-state parsing', () => {
  const owned = ['text'];
  class CustomCommand {
    #command = defineCommand({
      fields: ['text'],
      ownedFields: owned,
      modes: ['manual'],
      category: 'action',
      format: (value) => 'custom:' + value.text,
    });
    get fieldSchemas() {
      return this.#command.fieldSchemas;
    }
    get modelJsonSchema() {
      return this.#command.modelJsonSchema;
    }
    get inputJsonSchema() {
      return this.#command.inputJsonSchema;
    }
    get modes() {
      return this.#command.modes;
    }
    get ownedFields() {
      return owned;
    }
    get category() {
      return this.#command.category;
    }
    keys(value) {
      return this.#command.keys(value);
    }
    assert(value) {
      this.#command.assert(value);
    }
    parse(value) {
      return this.#command.parse(value);
    }
  }
  const command = new CustomCommand();
  const catalog = new CommandCatalog(
    [
      ['custom', command],
      ['other', defineCommand({ fields: ['mode'], additionalProperties: true, modes: ['manual'] })],
    ],
    { modeField: 'mode' },
  );
  owned.push('later');
  assert.deepEqual(catalog.require('custom').ownedFields, ['text']);
  assert.equal(catalog.manifest('action')[0].id, 'custom');
  assert.throws(
    () => catalog.parse('other', { mode: 'manual', text: 'foreign' }),
    /belongs to another command/,
  );
  assert.throws(
    () => catalog.parse('custom', { mode: 'auto', text: 'wrong mode' }),
    /Unsupported command mode/,
  );
  // Direct parsing need not configure a mode field; private state survives registration.
  const direct = new CommandCatalog([['custom', command]]);
  assert.equal(direct.parse('custom', { text: 'hello' }), 'custom:hello');
});

test('command checks and discriminators may be supplied through prototype getters', () => {
  class Check {
    #message = 'blocked';
    get occur() {
      return (value) => value.text === 'blocked';
    }
    error() {
      return this.#message;
    }
  }
  class Discriminator {
    get field() {
      return 'kind';
    }
    get value() {
      return 'reply';
    }
  }
  const command = defineCommand({
    fields: ['text'],
    discriminator: new Discriminator(),
    checks: [new Check()],
  });
  assert.throws(() => command.parse({ kind: 'reply', text: 'blocked' }), /blocked/);
  assert.deepEqual(command.parse({ kind: 'reply', text: 'hello' }), {
    kind: 'reply',
    text: 'hello',
  });
  assert.throws(() => command.parse({ kind: 'other', text: 'hello' }));
});

test('bound interaction keeps the selected receiver and handler snapshot after external mutation', async () => {
  const { bindInteraction } = await import('../dist/esm/kits/interaction/index.js');
  const menu = [{ id: 'reply', description: 'Original' }];
  const protocol = {
    commands: { manifest: () => menu },
    receive: (value) => ({ id: 'reply', result: value.text }),
  };
  const handlers = { reply: (value) => 'accepted:' + value };
  const runtime = bindInteraction(protocol, handlers);
  protocol.receive = () => {
    assert.fail('binding must retain its original receiver');
  };
  handlers.reply = () => {
    assert.fail('binding must retain its original handler');
  };
  menu[0].description = 'Changed';
  menu.push({ id: 'foreign' });
  assert.deepEqual(
    runtime.catalog.map((item) => item.id),
    ['reply'],
  );
  assert.equal(runtime.catalog[0].description, 'Original');
  assert.equal(runtime.dispatch({ text: 'hello' }), 'accepted:hello');
});
