/**
 * Capability module catalog contract.
 *
 * Place in the package: Support-side composition only. Applications declare modules and the tools
 * they contribute; the catalog validates those declarations once so Core can receive a stable
 * description. It creates no Core execution entity and owns no domain lifecycle.
 *
 * Exports: `CapabilityToolReferences`, `CapabilityModule`, `CapabilityCatalogOptions`.
 */
/** Tool references declared by one owner module. */
export interface CapabilityToolReferences {
  /** Owner id; must be non-blank and is used in rejection messages. */
  readonly id: string;
  /** Tools the module cannot work without; every id must be registered somewhere. */
  readonly requiredToolIds: readonly string[];
  /** Tools the module uses when available; every id must be registered somewhere. */
  readonly optionalToolIds?: readonly string[];
}

/** Minimal composition contract; lifecycle and domain fields remain application-owned. */
export interface CapabilityModule {
  /** Unique module id; also the catalog key. */
  readonly id: string;
  /** Non-blank description of what the module contributes. */
  readonly description: string;
  /** Tools contributed by this module; ids must be unique across all modules. */
  readonly tools: readonly { readonly id: string }[];
}

/** Catalog construction options. */
export interface CapabilityCatalogOptions<Module extends CapabilityModule> {
  /** Projects a module's tool references; must be synchronous and is checked at construction. */
  readonly toolReferences?: (module: Readonly<Module>) => readonly CapabilityToolReferences[];
}
