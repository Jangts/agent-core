/**
 * Example helper: adapt an offline MockGPT instance into a normal ChatProvider.
 *
 * Used by the other examples so Core never sees MockGPT-specific types.
 */
import { Support } from '@jangts/agent-core';
import { MockGPT } from '@jangts/agent-core/mock';

/**
 * Build a Core-compatible provider backed by MockGPT rules.
 *
 * @param rules MockGPT rule list, matched against the incoming prompt.
 * @returns The provider for `ModelRunner` plus the underlying MockGPT instance for inspection.
 */
export function createMockProvider(rules) {
  const mock = new MockGPT({ rules });
  const provider = new Support.CompatibleModelProvider({
    config: { baseUrl: 'https://mock.local/v1', apiKey: 'offline-example', model: 'demo' },
    ports: { request: mock.fetch },
  });
  return { provider, mock };
}
