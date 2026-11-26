/**
 * Interaction Kit entry: command protocols, their catalog and local handler binding.
 *
 * Place in the package: an optional App-side library for the payload family exchanged between
 * a web or AI client and the App. Framing, transport and the actual command execution stay
 * outside; this directory validates shapes, routes on a discriminator and binds handlers.
 *
 * Exports: everything from `./command.js`, `./commands.js`, `./transfer.js` and
 * `./handlers.js`, plus `InteractionProtocol` re-exported as `Interaction`.
 */
export * from './command.js';
export * from './commands.js';
export * from './transfer.js';
export * from './handlers.js';

export { InteractionProtocol as Interaction } from './transfer.js';
