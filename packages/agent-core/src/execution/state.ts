/**
 * Workflow state access and the declarative route catalog.
 *
 * Handlers read and write a plain state object; the helpers here keep missing-value
 * failures explicit and let a workflow declare its routes as data. Every route produced
 * here is inert until `AgentWorkflow` validates and freezes it.
 *
 * Exports: `requireWorkflowValue` and the `route` namespace.
 */
import type { StepOutcome } from '../structs/execution/engine.js';
import { WorkflowContractError } from '../structs/errors.js';

/**
 * Read a state field that must already be present.
 *
 * Used by `requires` declarations and terminal deliveries, so a node cannot observe a
 * field as undefined and silently produce a wrong result.
 *
 * @param state - Current workflow state.
 * @param key - Field to read.
 * @returns The field value, narrowed to exclude undefined.
 * @throws WorkflowContractError When the field is undefined.
 */
export function requireWorkflowValue<State, Key extends keyof State>(
  state: State,
  key: Key,
): Exclude<State[Key], undefined> {
  const value = state[key];
  if (value === undefined)
    throw new WorkflowContractError(`Missing workflow state: ${String(key)}`);
  return value as Exclude<State[Key], undefined>;
}

/** Optional route metadata shared by the route helpers. */
type RouteOptions = {
  /** Explicit route id; otherwise derived from the target so it stays stable. */
  readonly id?: string;
  /** Condition identity template; `{nid}` and `{rid}` are replaced when the node registers. */
  readonly conditionId?: string;
  /** Human-readable description surfaced by `describe()`. */
  readonly description?: string;
};

/** Root key of a dotted path such as `session.user`; a symbol path is its own root. */
type PathRoot<Path extends PropertyKey> = Path extends `${infer Root}.${string}` ? Root : Path;

/**
 * Build a reader for one state path.
 *
 * Dotted string paths traverse nested objects and stop safely at undefined; any other key
 * is read directly from the state. Both forms share the returned reader so route
 * conditions stay uniform.
 *
 * @param path - Dotted path or direct key.
 * @returns A function reading the value from a state object.
 */
function readPath<Path extends PropertyKey>(path: Path) {
  const keys = typeof path === 'string' ? path.split('.') : [path];
  return (state: Partial<Record<PathRoot<Path>, unknown>>): unknown =>
    keys.reduce<unknown>(
      (value, key) => (value as Partial<Record<PropertyKey, unknown>> | null | undefined)?.[key],
      state,
    );
}

/**
 * Unconditional jump with a stable, target-derived route ID.
 *
 * @param target - Destination node id.
 * @param id - Optional explicit route id.
 * @returns A terminal-free route that always matches.
 */
const routeTo = function route(target: string, id?: string) {
  return { id: id ?? `to-${target}`, targetNodeId: target };
};

/**
 * One conditional jump, using the same strict equality as a handwritten route.
 *
 * A derived route id is only produced for symbol-free paths and primitive values,
 * because those are the cases where `String(value)` is stable and unique enough to name
 * the condition.
 *
 * @param target - Destination node id.
 * @param path - State path to compare.
 * @param value - Expected value, compared with `===`.
 * @param options - Optional id, condition id and description.
 * @returns A route that matches when the path equals `value`.
 */
function toIfEqual<Key extends PropertyKey, Value>(
  target: string,
  path: Key,
  value: Value,
  options?: RouteOptions,
) {
  const stableValue =
    value === null || ['undefined', 'string', 'boolean', 'number', 'bigint'].includes(typeof value);
  const condition =
    typeof path !== 'symbol' && stableValue
      ? JSON.stringify([String(path), typeof value, String(value)])
      : undefined;
  const id =
    options?.id ??
    (condition === undefined ? undefined : `route:${JSON.stringify([condition, target])}`);
  const conditionId = options?.conditionId ?? (id === undefined ? undefined : '{nid}.{rid}');
  const read = readPath(path);
  return {
    ...options,
    id,
    conditionId,
    when: (state: Partial<Record<PathRoot<Key>, unknown>>) => read(state) === value,
    targetNodeId: target,
  };
}

/**
 * Jump when two state paths resolve to strictly equal values.
 *
 * No derived route id is produced for symbol paths, because a symbol cannot be embedded
 * in a stable name.
 *
 * @param target - Destination node id.
 * @param leftPath - First state path.
 * @param rightPath - Second state path.
 * @param options - Optional id, condition id and description.
 * @returns A route that matches when both paths are strictly equal.
 */
function toIfEqualWith<Left extends PropertyKey, Right extends PropertyKey>(
  target: string,
  leftPath: Left,
  rightPath: Right,
  options?: RouteOptions,
) {
  const left = readPath(leftPath);
  const right = readPath(rightPath);
  const id =
    options?.id ??
    (typeof leftPath === 'symbol' || typeof rightPath === 'symbol'
      ? undefined
      : `route:with:${JSON.stringify([String(leftPath), String(rightPath), target])}`);
  return {
    ...options,
    id,
    conditionId: options?.conditionId ?? (id === undefined ? undefined : '{nid}.{rid}'),
    when: (state: Partial<Record<PathRoot<Left> | PathRoot<Right>, unknown>>) =>
      left(state) === right(state),
    targetNodeId: target,
  };
}

/**
 * Jump when a state array contains at least one entry.
 *
 * A non-array value never matches, so a mistyped field cannot be treated as populated.
 *
 * @param target - Destination node id.
 * @param key - State path expected to hold an array.
 * @param options - Optional id, condition id and description.
 * @returns A route that matches for a non-empty array.
 */
function toIfNotEmpty<Key extends PropertyKey>(target: string, key: Key, options?: RouteOptions) {
  const read = readPath(key);
  return {
    ...options,
    ...routeTo(target, options?.id),
    conditionId: options?.conditionId ?? '{nid}.{rid}',
    when: (state: Partial<Record<PathRoot<Key>, unknown>>) => {
      const value = read(state);
      return Array.isArray(value) && value.length > 0;
    },
  };
}

/**
 * Jump once a state field has a value.
 *
 * `null` counts as present: only `undefined` means the field is still unset.
 *
 * @param target - Destination node id.
 * @param field - State path to inspect.
 * @param options - Optional id, condition id and description.
 * @returns A route that matches when the field is not undefined.
 */
function toIfDefined<Key extends PropertyKey>(target: string, field: Key, options?: RouteOptions) {
  const read = readPath(field);
  return {
    ...options,
    ...routeTo(target, options?.id),
    conditionId: options?.conditionId ?? '{nid}.{rid}',
    when: (state: Partial<Record<PathRoot<Key>, unknown>>) => read(state) !== undefined,
  };
}

/**
 * Jump to the node named by a truthy state field.
 *
 * The same field is used as the condition and as the destination, which is the usual
 * shape of a dispatcher that stored its own next node.
 *
 * @param target - Field holding the destination node id.
 * @param options - Optional id, condition id and description.
 * @returns A route that matches when the field is truthy.
 */
function toIf<Key extends string>(target: Key, options?: RouteOptions) {
  return {
    ...toIfDefined(target, target, options),
    when: (state: Partial<Record<Key, unknown>>) => Boolean(state[target]),
  };
}

/**
 * Route a recorded state error to its recovery node.
 *
 * Defaults to the `error` field because that is the convention the engine relies on when
 * reporting recoverable failures.
 *
 * @param target - Recovery node id.
 * @param options - Optional route metadata plus the field holding the recorded error.
 * @returns A route that matches once the error field is set.
 */
function toIfError<Key extends PropertyKey>(
  target: string,
  options: RouteOptions & { readonly errorKey: Key },
): ReturnType<typeof toIfDefined<Key>>;
function toIfError(
  target: string,
  options?: RouteOptions & { readonly errorKey?: undefined },
): ReturnType<typeof toIfDefined<'error'>>;
function toIfError(
  target: string,
  { errorKey = 'error', ...options }: RouteOptions & { readonly errorKey?: PropertyKey } = {},
) {
  return toIfDefined(target, errorKey, options);
}

/**
 * At a terminal node, the result must already exist.
 *
 * Completing reads the field with `requireWorkflowValue`, so a node that forgot to
 * produce its result fails instead of returning undefined.
 *
 * @param field - State field holding the final result.
 * @param options - Optional id and description; a condition id is meaningless here.
 * @returns A completion route with the default id `complete`.
 */
function deliver<Key extends PropertyKey>(field: Key, options?: Omit<RouteOptions, 'conditionId'>) {
  const id = options?.id ?? 'complete';
  return {
    ...options,
    id,
    complete: <State extends Partial<Record<Key, unknown>>>(state: State) =>
      requireWorkflowValue(state, field),
  };
}

/**
 * Deliver an available result, or let the next route decide.
 *
 * Unlike `deliver`, this route carries a condition so a following route still has a
 * chance to match when the field is still unset.
 *
 * @param field - State field holding the result.
 * @param options - Optional route metadata.
 * @returns A conditional completion route.
 */
function deliverIfReady<Key extends PropertyKey>(field: Key, options?: RouteOptions) {
  return {
    ...deliver(field, options),
    conditionId: options?.conditionId ?? '{nid}.{rid}',
    when: (state: Partial<Record<Key, unknown>>) => state[field] !== undefined,
  };
}

/**
 * Apply the shared continue/complete outcome contract.
 *
 * The field holds a `StepOutcome`; only the `complete` variant ends the workflow, and the
 * completion asserts the variant instead of trusting the condition.
 *
 * @param field - State field holding the outcome.
 * @param options - Optional route metadata.
 * @returns A conditional completion route that unwraps the outcome value.
 */
function deliverWhenComplete<Key extends PropertyKey>(field: Key, options?: RouteOptions) {
  return {
    ...options,
    id: options?.id ?? 'complete',
    conditionId: options?.conditionId ?? '{nid}.{rid}',
    when: (state: Partial<Record<Key, StepOutcome<unknown>>>) => state[field]?.type === 'complete',
    complete<Value>(state: Partial<Record<Key, StepOutcome<Value>>>): Value {
      const outcome = requireWorkflowValue(state, field);
      if (outcome.type !== 'complete')
        throw new WorkflowContractError('Expected a complete workflow outcome');
      return outcome.value;
    },
  };
}

/**
 * Callable route catalog; aliases share the same function without namespace initialization.
 *
 * `route(...)` and `route.to(...)` are the same function, so both call styles stay
 * interchangeable and no module-level setup is required to use either.
 */
export const route = Object.assign(routeTo, {
  to: routeTo,
  toIfEqual,
  toIfEqualWith,
  toIfNotEmpty,
  toIfDefined,
  toIf,
  toIfError,
  deliver,
  deliverIfReady,
  deliverWhenComplete,
});
