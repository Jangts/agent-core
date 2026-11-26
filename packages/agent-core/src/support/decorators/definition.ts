/**
 * Internal decoration: construct definition classes or bind methods to their real host,
 * compile through existing entry points and automatically register in the kind's root.
 */
import { registerDefinition, type DefinitionKind, type IdentifiedDefinition } from './pool.js';

type Handler = (this: any, ...args: any[]) => any;
/** Preserve union branches when removing the decorator-owned id. */
export type DefinitionBody<Definition> = Definition extends unknown
  ? Omit<Definition, 'id'>
  : never;
/** Namespaces group external registration without changing Core options. */
export interface DecorationOptions {
  readonly ns?: string | readonly string[];
}
export type ClassDecoration<Definition extends IdentifiedDefinition> = <
  Constructor extends new () => DefinitionBody<Definition>,
>(
  target: Constructor,
  context: ClassDecoratorContext<Constructor>,
) => void;
export type MethodDecoration<Method extends Handler> = <This>(
  method: (this: This, ...args: Parameters<Method>) => ReturnType<Method>,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Parameters<Method>) => ReturnType<Method>
  >,
) => void;

/** Restore only the decorator-owned id, preserving instance identity, getters and private state. */
function withId<Definition extends IdentifiedDefinition>(
  id: string,
  instance: DefinitionBody<Definition>,
): Definition {
  if ('id' in instance)
    throw new TypeError('Decoration supplies id; do not also define it on the class');
  Object.defineProperty(instance, 'id', { value: id, enumerable: true });
  return instance as unknown as Definition;
}

/** Class definitions register once after static initialization and successful construction. */
export function classDecoration<Definition extends IdentifiedDefinition>(
  kind: DefinitionKind,
  id: string,
  options: DecorationOptions,
  compile: (value: Definition) => Definition,
): ClassDecoration<Definition> {
  return (_target, context) => {
    if (context?.kind !== 'class') throw new TypeError('Use standard class decorator semantics');
    context.addInitializer(function () {
      registerDefinition(kind, compile(withId<Definition>(id, new this())), options.ns);
    });
  };
}

/** Method initializers bind and register automatically; no scanning or caller-side bind is needed. */
export function methodDecoration<Definition extends IdentifiedDefinition, Method extends Handler>(
  kind: DefinitionKind,
  id: string,
  metadata: DefinitionBody<Definition>,
  handlerKey: keyof Definition,
  options: DecorationOptions,
  compile: (value: Definition) => Definition,
): MethodDecoration<Method> {
  return (method, context) => {
    if (context?.kind !== 'method' || context.static || context.private)
      throw new TypeError('Use a standard public instance method decorator');
    context.addInitializer(function () {
      const value = { ...metadata, [handlerKey]: method.bind(this) } as DefinitionBody<Definition>;
      for (const key of Reflect.ownKeys(value)) {
        const member = (value as Record<PropertyKey, unknown>)[key];
        if (typeof member === 'function')
          (value as Record<PropertyKey, unknown>)[key] = member.bind(this);
      }
      registerDefinition(kind, compile(withId<Definition>(id, value)), options.ns);
    });
  };
}
