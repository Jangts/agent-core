/** App-side associations between registered owners and model tools; no separate intent entity. */
import type { ModelToolRegistration } from '../capabilities/model.js';

/** Explicit tool references or inline overrides of the owner's default model interface. */
export type ToolAssociation = string | Partial<ModelToolRegistration>;
/** Owners retain their business fields; Support only reads model interface associations. */
export interface AssociatedRegistration {
  readonly id: string;
  readonly description: string;
  readonly modelTools?: readonly ToolAssociation[];
}
/** Shared independent tools and a default projection from existing contracts. */
export interface AssociationOptions<Entry extends AssociatedRegistration> {
  readonly tools?: readonly ModelToolRegistration[];
  readonly toolDefaults?: (entry: Readonly<Entry>) => ModelToolRegistration | undefined;
}
/** Local provenance, never an extra model input requirement. */
export interface AssociationSource {
  readonly kind: 'standalone' | 'registration';
  readonly id: string;
  readonly description: string;
  readonly toolIds: readonly string[];
}
