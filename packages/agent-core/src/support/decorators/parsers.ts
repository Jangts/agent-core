/** Parser method metadata is instance-local; toolbox assembly consumes it only after construction. */
type Parser = (...args: any[]) => unknown;
type ParserKind = 'input' | 'output' | 'authorize';
const commonAuthorize = Symbol.for('@jangts/agent-core/toolbox-common-authorize/v1');
type ParserMap = Map<string | symbol, Partial<Record<ParserKind, Parser>>>;
const key = Symbol.for('@jangts/agent-core/toolbox-parsers/v1');
const realm = globalThis as unknown as Record<symbol, WeakMap<object, ParserMap> | undefined>;
const parsers = realm[key] ?? new WeakMap<object, ParserMap>();
if (!realm[key]) Object.defineProperty(globalThis, key, { value: parsers });

/** Attach a public synchronous parser method to one tool id, preserving the original host. */
function parser(kind: ParserKind, id?: string) {
  if (
    (id === undefined && kind !== 'authorize') ||
    (id !== undefined && (typeof id !== 'string' || !id.trim()))
  )
    throw new TypeError('Parser tool id must be nonempty');
  return <This, Args extends any[], Result>(
    method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ): void => {
    if (context?.kind !== 'method' || context.static || context.private)
      throw new TypeError('Tool parsers require a standard public instance method');
    context.addInitializer(function () {
      const host = this as object;
      let map = parsers.get(host);
      if (!map) parsers.set(host, (map = new Map()));
      const identity = id ?? commonAuthorize;
      const entry = map.get(identity) ?? {};
      if (entry[kind]) throw new TypeError(`Duplicate ${kind} parser: ${id}`);
      entry[kind] = method.bind(this);
      map.set(identity, entry);
    });
  };
}

/** Input validation/conversion for the named tool; JSON Schema alone does not validate input. */
export function ParseInput(id: string) {
  return parser('input', id);
}
/** Output validation/conversion for the named tool, including cached or otherwise untrusted results. */
export function ParseOutput(id: string) {
  return parser('output', id);
}

/** Internal read only: no public parser registry or independent execution path. */
export function toolboxParsers(
  host: object,
): ReadonlyMap<string | symbol, Readonly<Partial<Record<ParserKind, Parser>>>> {
  return parsers.get(host) ?? new Map();
}

/** Shared authorization without an id, or an additional check for a specific tool id. */
export function Authorize(id?: string) {
  return parser('authorize', id);
}

/** Internal access to the group check; callers cannot write parser metadata. */
export function toolboxAuthorization(host: object) {
  return parsers.get(host)?.get(commonAuthorize)?.authorize;
}
