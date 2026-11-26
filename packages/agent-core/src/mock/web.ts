/**
 * Web adapter of the optional Mock Kit (`@jangts/agent-core/mock/web`).
 *
 * Re-exports the mock-gpt web-content surface only: page sources, the public-address check and
 * their option types. Fetching external pages needs a Node runtime with network access; Core
 * execution does not import it.
 */
export * from '@jangts/mock-gpt/web';
