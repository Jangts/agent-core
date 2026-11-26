/**
 * Optional Mock Kit entry: a configurable mock response SDK with optional API adapters.
 *
 * This file is a pass-through to `@jangts/mock-gpt`; Core execution never imports it, and it
 * carries no production defaults. Platform-specific adapters live in `./mock/node.js` and
 * `./mock/web.js`, which are separate subpath entries (`/mock/node`, `/mock/web`).
 */
export * from '@jangts/mock-gpt';
