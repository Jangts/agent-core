/**
 * Artifacts Kit: resolve opaque artifact references through App-registered resolvers.
 *
 * Place in the package: an optional App-side library. A reference only names a resolver and
 * an artifact; the resolver, not this module, establishes access, provenance and whether the
 * referenced revision is still current. Nothing is cached or persisted here.
 *
 * Exports: `defineArtifactCatalog`, `Artifacts`, and the artifact reference/resolver types.
 */
import { awaitWithSignal } from '../utils/cancellation.js';
import { readonlyCatalog } from '../utils/catalog.js';
import type { OperationContext } from '../structs/common.js';
import type { ArtifactReference, ArtifactResolver } from '../structs/kits/artifacts.js';

function snapshotArtifactReference(reference: ArtifactReference): ArtifactReference {
  if (!reference || typeof reference !== 'object')
    throw new TypeError('Invalid artifact reference');
  const { resolverId, artifactId, revision } = reference;
  if (
    typeof resolverId !== 'string' ||
    !resolverId.trim() ||
    typeof artifactId !== 'string' ||
    !artifactId.trim() ||
    (revision !== undefined && (typeof revision !== 'string' || !revision.trim()))
  )
    throw new TypeError('Invalid artifact reference');
  return Object.freeze({ resolverId, artifactId, ...(revision === undefined ? {} : { revision }) });
}

/**
 * Compile a catalog of artifact resolvers plus a checked `resolve` entry point.
 *
 * @param definitions - Resolvers keyed by their own non-empty `id`; duplicate ids are rejected
 *   by the underlying catalog.
 * @returns A frozen catalog (`ids`/`has`/`get`/`require`/`values`/`entries`) extended with
 *   `resolve(reference, context)`.
 * @throws TypeError At construction for malformed resolver definitions, and from `resolve`
 *   for an unknown resolver, an invalid reference snapshot, or a missing `OperationContext`.
 */
export function defineArtifactCatalog<Value, App>(
  definitions: readonly ArtifactResolver<Value, App>[],
) {
  const compiled = definitions.map((definition) => {
    if (!definition || typeof definition !== 'object')
      throw new TypeError('Use an artifact resolver id and OperationContext');
    const { id, resolve } = definition;
    if (typeof id !== 'string' || !id.trim() || typeof resolve !== 'function')
      throw new TypeError('Invalid artifact resolver');
    return Object.freeze({ id, resolve: resolve.bind(definition) });
  });
  const catalog = readonlyCatalog(
    compiled,
    (id) => new TypeError(`Unregistered artifact resolver: ${id}`),
  );
  /**
   * Resolve one reference through its registered resolver.
   *
   * @param reference - Resolver id, artifact id and optional revision; snapshotted and frozen
   *   before the call so a handler cannot observe later mutation.
   * @param context - Operation context supplying the abort signal.
   * @returns The resolver's value.
   * @throws TypeError For a malformed reference or context, or an unknown resolver id.
   */
  async function resolve(
    reference: ArtifactReference,
    context: OperationContext<App>,
  ): Promise<Value> {
    if (!context?.signal) throw new TypeError('Artifact resolution requires OperationContext');
    context.signal.throwIfAborted();
    const snapshot = snapshotArtifactReference(reference);
    context.signal.throwIfAborted();
    const result = await awaitWithSignal(
      catalog.require(snapshot.resolverId).resolve(snapshot, context),
      context.signal,
    );
    context.signal.throwIfAborted();
    return result;
  }
  return Object.freeze({ ...catalog, resolve });
}

export type * from '../structs/kits/artifacts.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Artifacts = Object.freeze({ defineArtifactCatalog });
