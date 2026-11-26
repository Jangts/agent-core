import { Support } from '@jangts/agent-core';

/** The host supplies configuration. This function does not read files, environment or start requests. */
export function createProvider(environment: Readonly<Record<string, string | undefined>>) {
  const baseUrl = environment.MODEL_BASE_URL?.trim(), apiKey = environment.MODEL_API_KEY?.trim(), model = environment.MODEL_NAME?.trim();
  if (!baseUrl || !apiKey || !model) throw new Error('Configure MODEL_BASE_URL, MODEL_API_KEY and MODEL_NAME');
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new TypeError('Invalid model endpoint'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new TypeError('Invalid model endpoint');
  return new Support.CompatibleModelProvider({ config: { baseUrl, apiKey, model } });
}
