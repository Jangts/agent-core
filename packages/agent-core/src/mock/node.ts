/**
 * Node adapter of the optional Mock Kit (`@jangts/agent-core/mock/node`).
 *
 * Re-exports the mock-gpt Node surface only: server and request-handler creators plus their
 * option types. It starts real HTTP servers and therefore requires a Node runtime. Core
 * execution does not import it.
 */
export * from '@jangts/mock-gpt/node';
