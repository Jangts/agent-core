/** Canonical/0.9 field readers used only at the Domain Tools and lifecycle declaration boundaries. */
export function domainAlias<Value>(
  source: object,
  canonical: string,
  legacy: string,
): Value | undefined {
  const current = Reflect.get(source, canonical) as Value | undefined;
  const previous = Reflect.get(source, legacy) as Value | undefined;
  const equivalent =
    Object.is(current, previous) ||
    (Array.isArray(current) &&
      Array.isArray(previous) &&
      current.length === previous.length &&
      current.every((value, index) => Object.is(value, previous[index])));
  if (current !== undefined && previous !== undefined && !equivalent)
    throw new TypeError(`Conflicting ${canonical} and legacy ${legacy}`);
  return current === undefined ? previous : current;
}

/** Copy presentation metadata using canonical relation names, without changing App protocol payloads. */
export function domainProjection<Value extends object>(value: Value) {
  const { goalIds, goalId, scopePolicy, targetPolicy, planIntent, ...data } = value as Value & {
    goalIds?: readonly string[];
    goalId?: string;
    scopePolicy?: string;
    targetPolicy?: string;
    planIntent?: string;
  };
  return {
    ...data,
    ...(goalIds === undefined ? {} : { domainToolIds: goalIds }),
    ...(goalId === undefined ? {} : { domainToolId: goalId }),
    ...(scopePolicy === undefined ? {} : { scopeMode: scopePolicy }),
    ...(targetPolicy === undefined ? {} : { targetMode: targetPolicy }),
    ...(planIntent === undefined ? {} : { planningAction: planIntent }),
  };
}
