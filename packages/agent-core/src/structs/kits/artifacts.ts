/**
 * Artifact reference contract for the Artifacts Kit.
 *
 * Place in the package: an optional App-side library. A reference only names a resolver and an
 * artifact; the resolver, not Core, establishes access, provenance and whether the referenced
 * revision is still current. Nothing is cached or persisted by these types.
 *
 * Exports: `ArtifactReference`, `ArtifactResolver`.
 */
import type { MaybePromise, OperationContext } from '../common.js';
/** References locate artifacts; only the App resolver establishes access and current validity. */
export interface ArtifactReference {
  /** Resolver that owns the artifact namespace. */
  readonly resolverId: string;
  /** Artifact identity inside that namespace; never blank. */
  readonly artifactId: string;
  /** Optional pinned revision; omission asks the resolver for its current revision. */
  readonly revision?: string;
}
/** App-registered resolver that turns a reference into an App value. */
export interface ArtifactResolver<Value, App> {
  readonly id: string;
  /** Resolves the reference; throws when the artifact is unknown or not accessible. */
  resolve(reference: ArtifactReference, context: OperationContext<App>): MaybePromise<Value>;
}
