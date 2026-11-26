// English prose for kit-catalogs.mjs; code samples stay in the Chinese source module.
export default {
  'kit-intents': {
    title: 'Domain Tools: tool declarations and scope relationships',
    summary:
      'One list provides the available tools, allowed delegates, scope aliases, sources, and tool relationships.',
    details: `DomainToolRegistry.create(definitions,policy?) and createDomainToolRegistry create and seal a complete catalog; new DomainToolRegistry(policy) instead allows register/registerAll followed by seal. A definition contains at least id and description; optional delegates must be non-empty and unique, while asIntent only describes how that tool participates in demand discovery and creates no independent Intent entity.

A ScopeRegistry definition additionally needs category; domainToolIds, queryScopeIds, knowledgeTopicIds, toolIds, and aliases default to empty arrays. It does not infer relationships on behalf of the App. normalize uses registered aliases, acceptsDomainTool/acceptsQuery check relationships, and topics/evidence return declarations. create also seals, while the constructor allows later centralized registration. The same data forms a read-only snapshot at registration time, callbacks keep their original receiver, and App services are still accessed through their original implementations.

Descriptions and relationships are not permissions themselves. A model seeing a tool or knowledge scope does not mean the server has authorized a tool.`,
    examples: [
      { title: 'Register one tool that explains an interface', level: 'Beginner' },
      {
        title: 'Add constraints and scope relationships while keeping the same query entry',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Tool validation and sealing', 'Scope relationships and aliases'],
  },

  'kit-agent-catalog': {
    title: 'Agent Catalog: generate the tool menu from real registrations',
    summary:
      'Tool, scope, and host tool menus are projected from the real catalogs instead of maintaining a separate tool list for prompts.',
    details: `defineAgentCatalog accepts structured ports. domainToolDelegates(goals, tools, protocols, context?) reuses the same relationship projection at standalone protocol boundaries. domainToolIds/goals/scopes read from real registrations; tools provides values, has, supportsDomainTool, and describe; currentTask returns the task already accepted for this run as { domainToolId, scopeId }, or undefined.

modelCatalog(app) returns availableGoalIds, availableGoals, availableScopes, and availableTools. restrictToTask defaults to true, limiting the menu to that tool and its scopes once a task is accepted; set it to false to keep the full menu. domainToolDelegates derives choices from tool domainToolIds and terminal protocols; explicit DomainTool.delegates constraints stay closed, and every call uses the owning tool id. Runtime availability is still determined by the App ports, and the menu does not replace execution authorization.`,
    examples: [
      { title: 'Project existing tools and scopes into a model menu', level: 'Beginner' },
      {
        title: 'Connect the same menu to actual tool declarations and the current task',
        level: 'Configuration',
        note: 'The tools here are a structured projection port; a real application should connect directly to the corresponding methods of the real tool registry to avoid parallel maintenance.',
      },
    ],
    policyTitles: ['Generate a task-scoped menu from real catalogs'],
  },

  'kit-interaction': {
    title: 'Interaction: declare commands and bind local handlers',
    summary:
      'The fields, purpose, selector, checks, and handler of a command come from one declaration; the model cannot add executable handlers.',
    details: `defineCommand compiles a single command; compileCommands/CommandCatalog compile a set; Interaction.define (that is, defineInteractionProtocol) additionally supplies commandField and command selection. receive returns {id,result}, parse returns only result, and dispatch calls the bound handler for the validated command ID instead of redistributing on a format return value.

Field declarations generate the model Schema and check field presence, unknown fields, selectors, ownedFields, checks, and refine. A field's jsonSchema does not mean the full JSON Schema type validation runs automatically; types and business constraints should be implemented in checks/refine or in your own SchemaAdapter. The defaults are additionalProperties=false and optionalPresence='own'. occur rejects as soon as it is met; when only decides whether the check is enabled.

category can only be query/action/presentation/input/receipt; it states a command's purpose, not a permission level or a claim of successful execution. HTTP, SSE, actual tool execution, and server-side authorization are not part of this protocol compiler.`,
    examples: [
      { title: 'First define one explanatory command and validate it', level: 'Beginner' },
      {
        title: 'Keep the same protocol and add complete handler binding',
        level: 'Configuration',
      },
      {
        title: 'Reuse the single-command and batch compilation entries directly',
        level: 'Extension',
        note: 'When you use Interaction the selector is generated for you; when you use defineCommand yourself you may also supply discriminator explicitly. This example does not execute any tool.',
      },
    ],
    policyTitles: [
      'Fields, checks, and the model Schema',
      'Selectors and command receiving',
      'Bind local handlers by validated command',
    ],
  },

  'kit-tool-lifecycle': {
    title: 'Tools: App tool lifecycle and content contribution',
    summary:
      'Register tool invocations, output rules, context contribution, and delivery handling for existing complex App tools in one place.',
    details: `Tools is an alias of ToolLifecycleRegistry, aimed at Apps that have invocations, goals, presentation, and delivery stages. When you only need ordinary tool execution, use the Core ToolRegistry directly; this Kit does not require every Agent to configure the whole lifecycle.

The constructor configures registration, invocationId, outputs, domainToolIds, contextFragment, and optional invocation ports; registerAll then seals. invoke returns a unified ToolResult; call(next,context) executes synchronously through a registered invocation. The optional contribution provides local behaviors such as inspect, rules, modelFields, visibleText, reviewDraft, recoveryContext, composition, and finalize. Invocation and final submission should still pass through the real authorization in App orchestration.

rules are sorted by order, and in composition at most one contributor owns the template for the current run. normalizer/finalizer can each be registered only once. copyTo copies compiled declarations and cannot bypass the target registration policy; runtime service dependencies remain owned by the original implementation. This Kit's stages, goals, and context fields are not required Core contracts.`,
    examples: [
      { title: 'Register one read-only tool for an existing App', level: 'Beginner' },
      {
        title: 'Add App rules and presentation contribution to the same registration',
        level: 'Configuration',
        note: 'active affects real tool availability and description; business authorization must still verify server-side identity at the actual invocation boundary.',
      },
    ],
    policyTitles: ['Registration policy, lifecycle binding, and content projection'],
  },
};
