/** Explicit endpoint constraints narrow protocol expressibility; they never claim live verification. */
import { modelProtocolCatalog, type ModelProtocol } from './requests.js';
export interface ModelEndpointCapabilities {
  readonly modalities?: readonly string[];
  readonly tools?: boolean;
  readonly jsonSchema?: boolean;
}
function rejectWidening(widens: boolean, message: string): void {
  if (widens) throw new TypeError(message);
}

/** Reject unknown markers and widening before a request can spend remote resources. */
export function resolveModelCapabilities(
  protocol: ModelProtocol,
  profile?: ModelEndpointCapabilities,
) {
  if (!Object.hasOwn(modelProtocolCatalog, protocol)) throw new TypeError('Unknown model protocol');
  const descriptor = modelProtocolCatalog[protocol];
  if (
    profile &&
    Object.keys(profile).some((key) => !['modalities', 'tools', 'jsonSchema'].includes(key))
  )
    throw new TypeError('Unknown endpoint capability or verification marker');
  if (
    (profile?.tools !== undefined && typeof profile.tools !== 'boolean') ||
    (profile?.jsonSchema !== undefined && typeof profile.jsonSchema !== 'boolean')
  )
    throw new TypeError('Invalid endpoint capability');
  const modalities = profile?.modalities ?? descriptor.modalities;
  rejectWidening(
    !Array.isArray(modalities) ||
      modalities.some(
        (value) => typeof value !== 'string' || !descriptor.modalities.includes(value),
      ) ||
      new Set(modalities).size !== modalities.length,
    'Endpoint modalities cannot widen protocol capabilities',
  );
  rejectWidening(
    profile?.jsonSchema === true && !descriptor.jsonSchema,
    'Endpoint schema capability cannot widen protocol',
  );
  return Object.freeze({
    completion: true,
    modalities: Object.freeze([...modalities]),
    tools: profile?.tools ?? true,
    jsonSchema: profile?.jsonSchema ?? descriptor.jsonSchema,
  });
}
