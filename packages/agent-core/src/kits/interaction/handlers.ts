/**
 * Interaction Kit: bind every registered command to a local handler.
 *
 * Place in the package: part of the `interaction` Kit. The handler table is App code; this
 * module checks it is exhaustive, rejects unknown keys and dispatches on the validated wire
 * value rather than on any formatter output.
 *
 * Exports: `bindInteraction`, and the interaction category/descriptor/handler types.
 */
import type { InteractionHandlers } from '../../structs/kits/interaction.js';
import { breakWhile } from '../../utils/rules.js';
import type { InteractionProtocol } from './transfer.js';

/**
 * Bind every registered transfer command to a local handler. Models cannot add handlers.
 *
 * @param protocol - Object exposing the command manifest and a `receive` entry point.
 * @param handlers - One handler per command id, bound to this handlers object.
 * @returns A frozen `{ catalog, dispatch }`; `dispatch` selects by the validated command id.
 * @throws A configured error when a handler is missing (including prototype members such as
 *   `constructor` that were never assigned) or when the table contains an unregistered id.
 */
export function bindInteraction<
  Value extends object,
  Parsed,
  Args extends unknown[],
  Id extends string,
  Context,
  Output,
>(
  protocol: {
    readonly commands: Pick<InteractionProtocol<Value, Parsed, Args, Id>['commands'], 'manifest'>;
    receive(value: Value, ...args: Args): { id: Id; result: Parsed };
  },
  handlers: InteractionHandlers<Id, Parsed, Context, Output>,
) {
  const catalog = Object.freeze(
    protocol.commands.manifest().map((command) =>
      Object.freeze({
        id: command.id,
        category: command.category,
        description: command.description,
        terminal: command.terminal,
        modes: command.modes && Object.freeze([...command.modes]),
      }),
    ),
  );
  const receive = protocol.receive.bind(protocol);
  const ids = new Set(catalog.map((command) => command.id));
  breakWhile(
    [
      {
        occur: () =>
          catalog.some(
            (command) =>
              typeof handlers[command.id as Id] !== 'function' ||
              (!Object.hasOwn(handlers, command.id) &&
                (command.id === 'constructor' ||
                  handlers[command.id as Id] === Reflect.get(Object.prototype, command.id))),
          ),
        error: 'Missing interaction handler',
        tags: ['missing-handler'],
      },
      {
        occur: () => Object.keys(handlers).some((id) => !ids.has(id)),
        error: 'Unregistered interaction handler',
        tags: ['unknown-handler'],
      },
    ],
    ['agent-core', 'interaction-registration'],
  );
  const registered = Object.freeze(
    Object.fromEntries(catalog.map(({ id }) => [id, handlers[id as Id].bind(handlers)])) as Record<
      Id,
      (value: Parsed, context: Context) => Output
    >,
  );
  return Object.freeze({
    catalog,
    dispatch(value: Value, context: Context, ...args: Args): Output {
      // Select from the validated wire value, never from a formatter's unconstrained output.
      const { id, result } = receive(value, ...args);
      return registered[id](result, context);
    },
  });
}

export type {
  InteractionCategory,
  InteractionDescriptor,
  InteractionHandlers,
} from '../../structs/kits/interaction.js';
export { INTERACTION_CATEGORIES } from '../../structs/kits/interaction.js';
