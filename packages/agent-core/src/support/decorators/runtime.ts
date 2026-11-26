/** Runtime class registration preserves the actual subclass instance and its existing lifetime. */
import { registerDefinition } from './pool.js';
import type { DecorationOptions } from './definition.js';

/** Explicit constructor arguments; no reflection or dependency injection is installed. */
export interface InstanceDecorationOptions<
  Args extends readonly unknown[] = readonly [],
> extends DecorationOptions {
  readonly args?: Args;
}

/** A standard decorator accepting only a constructor of the required runtime base. */
export type RuntimeDecoration<Instance, Args extends readonly unknown[]> = <
  Constructor extends new (...args: Args) => Instance,
>(
  target: Constructor,
  context: ClassDecoratorContext<Constructor>,
) => void;

/** Construct once after static initialization; reject the wrong base before construction. */
export function runtimeDecoration<Instance extends object, Args extends readonly unknown[]>(
  kind: 'agent' | 'model',
  base: abstract new (...args: any[]) => Instance,
  id: string,
  options: InstanceDecorationOptions<Args>,
): RuntimeDecoration<Instance, Args> {
  return (target, context) => {
    if (context?.kind !== 'class') throw new TypeError('Use standard class decorator semantics');
    if (!(target.prototype instanceof base) && target !== base)
      throw new TypeError(`@${kind} requires extending ${base.name}`);
    if (options.args !== undefined && !Array.isArray(options.args))
      throw new TypeError('Decorator args must be an array');
    const args = [...(options.args ?? [])] as unknown as Args;
    context.addInitializer(function () {
      const instance = new this(...args);
      if ('id' in instance)
        throw new TypeError('Decoration supplies id; do not also define it on the class');
      Object.defineProperty(instance, 'id', { value: id, enumerable: true });
      registerDefinition(kind, instance as Instance & { readonly id: string }, options.ns);
    });
  };
}
