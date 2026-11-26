/**
 * Strict id-keyed registry for model output protocols.
 *
 * Registration is the only source of schema and terminal semantics: the core never
 * knows protocol names. Writes are checked eagerly so a duplicate or blank id fails at
 * wiring time instead of at dispatch time.
 *
 * Exports: `ProtocolRegistry`.
 */
/**
 * Append-only protocol registry.
 *
 * Extending `Map` keeps lookup semantics familiar while `set` rejects every invalid
 * registration, which makes the instance effectively immutable after wiring.
 */
export class ProtocolRegistry<Protocol> extends Map<string, Protocol> {
  /**
   * @param definitions - Initial id/protocol pairs, applied through the validating `set`.
   * @throws TypeError When any initial entry is invalid or duplicated.
   */
  constructor(definitions: Iterable<readonly [string, Protocol]> = []) {
    super();
    for (const [id, protocol] of definitions) this.set(id, protocol);
  }

  /**
   * @returns A frozen array of registered ids in insertion order.
   */
  ids(): readonly string[] {
    return Object.freeze([...this.keys()]);
  }

  /**
   * Look up a protocol that must exist.
   *
   * @param id - Protocol id.
   * @returns The registered protocol.
   * @throws TypeError When the id is unknown.
   */
  require(id: string): Protocol {
    const value = this.get(id);
    if (value === undefined) throw new TypeError(`Unknown protocol: ${id}`);
    return value;
  }

  /**
   * Register a protocol.
   *
   * @param id - Non-blank protocol id.
   * @param protocol - Protocol implementation.
   * @returns This registry, for chaining.
   * @throws TypeError When the id is blank or the protocol is nullish.
   * @throws Error When the id is already registered.
   */
  override set(id: string, protocol: Protocol): this {
    if (!id.trim() || protocol === null || protocol === undefined)
      throw new TypeError('Invalid protocol registration');
    if (this.has(id)) throw new Error(`Duplicate protocol: ${id}`);
    return super.set(id, protocol);
  }
}
