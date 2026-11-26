// English prose for decorator recipes; executable examples share the Chinese source.
export default {
  'definition-decorators': {
    title: 'Decorators: complete handlers and existing host methods',
    summary:
      'Classes construct definitions automatically; methods bind the real host. Outputs still use original define, constructor and bind contracts.',
    details: `Import only from /support/decorators with standard decorator semantics; legacy NestJS experimentalDecorators units are unsupported. No new dependencies, reflection or automatic DI are introduced.

The decorator supplies id while the class owns configuration, its handler and private helper methods. Named Node/Tool/Fragment definition contracts omit id and require zero-argument construction. Agent/model classes extend AgentCoreEngine/ModelRunner and accept explicit constructor args; pools hold the actual runtime subclasses.

Each kind has one shared read-only pool. Decorator ns accepts a string or string array and defaults to default. Ids are unique within a kind and namespace; other namespaces may reuse them. Multi-namespace registration shares one object and preflights all conflicts. Read with get(id, ns?), getAll(ns?) or pick(ids, ns?); missing get returns undefined, while pick rejects missing or repeated ids. Arrays are frozen snapshots.

Methods bind and register during standard instance initialization. Read and execute after successful host construction. Failed construction does not roll back completed registration and is a wiring failure. Use long-lived hosts, not request-scoped instances; duplicate kind/namespace/id rejects. No registerFrom or manual bind is needed.

node adapts run, tool execute and fragment format, retaining original checks. agent/model construct actual Engine/Runner subclasses; read them and call run/invoke directly, isolating unbound Runner calls; bind(execution) shares a request budget and Engine binds per run. Shared host execution getters reject ambiguous reads; overrides use this.bind(request.execution) for counts, journal and signal. Custom fields remain shared; request data belongs in arguments/context. toolbox({id:options}) declares metadata; class inputSchemas holds JSON Schema only. compile/error reuse fromJsonSchema, compiling a shared schema object once per group before optional ParseInput conversion; without compile, ParseInput validates. ParseOutput attaches output parsing, Authorize() is shared, and Authorize(id) adds a tool-specific check. ns stays outside Core options and ids remain unchanged. Original graph and tool uniqueness checks still apply when combining namespaces. ESM/CJS copies share roots within one realm; processes and workers do not. Reading is neither execution nor authorization.`,
    examples: [
      {
        title: 'A class owns configuration and private helpers without manual construction',
        level: 'Beginner',
      },
      {
        title: 'Keep a service method name and bind its original host automatically',
        level: 'Configuration',
      },
      {
        title: 'Tool classes preserve original authorization and result checks',
        level: 'Extension',
      },
      {
        title: 'Fragments, workflows and actual runtime instances',
        level: 'Extension',
      },
      { title: 'Shared host with parser and authorization methods', level: 'Extension' },
    ],
  },
};
