/**
 * Registration projections for App-provided definitions.
 *
 * A registered definition may carry executable helpers alongside its data contract.
 * Only public data survives registration, so the runtime contract cannot silently grow
 * when an implementation adds a helper.
 *
 * Exports: the `RegistrationData` and `RegistrationProjection` types plus
 * `registrationData`.
 */
type Handler = (...args: any[]) => unknown;

/**
 * Keys of `Value` whose type contains no callable member.
 *
 * Functions are excluded so a definition's implementation helpers never become part of
 * the public registration contract.
 */
export type RegistrationData<Value> = Pick<
  Value,
  {
    [Key in keyof Value]-?: [Extract<Value[Key], Handler>] extends [never] ? Key : never;
  }[keyof Value]
>;

/**
 * Data-only view of a registered value, intersected with the declared contract.
 *
 * The contract keys are kept even when the implementation narrows them, so consumers
 * type against the published interface rather than one implementation.
 */
export type RegistrationProjection<Value, Contract> = Readonly<
  Contract & RegistrationData<Value> & Pick<Value, Extract<keyof Value, keyof Contract>>
>;

/**
 * Copy the inherited, non-function data of a definition.
 *
 * The walk starts at the source and moves up the prototype chain while reading every
 * accessor with the source as receiver, so getters keep observing their own instance
 * without the snapshot retaining the mutable prototype. `constructor` is skipped for
 * inherited levels because it describes the class rather than the definition.
 *
 * @param source - Definition to snapshot.
 * @param excluded - Keys that must not appear in the result.
 * @returns A plain object containing enumerable, writable non-function data.
 */
export function registrationData<Value extends object, Key extends PropertyKey = never>(
  source: Value,
  excluded: readonly Key[] = [],
): Omit<RegistrationData<Value>, Key> {
  const result: Record<PropertyKey, unknown> = {};
  const seen = new Set<PropertyKey>(excluded);
  for (
    let owner: object | null = source;
    owner && owner !== Object.prototype;
    owner = Object.getPrototypeOf(owner)
  ) {
    for (const key of Reflect.ownKeys(owner)) {
      if (seen.has(key) || (key === 'constructor' && owner !== source)) continue;
      seen.add(key);
      const descriptor = Object.getOwnPropertyDescriptor(owner, key)!;
      const value: unknown = descriptor.get ? descriptor.get.call(source) : descriptor.value;
      if (typeof value !== 'function')
        Object.defineProperty(result, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
    }
  }
  return result as Omit<RegistrationData<Value>, Key>;
}
