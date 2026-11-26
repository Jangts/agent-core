// English prose for core-execution.mjs; code samples stay in the Chinese source module.
export default {
  'engine-run': {
    title: 'Agent: run first, then bind tools and dependencies step by step',
    summary:
      'The Engine executes a bounded loop; after a Workflow is bound, each run only receives the data that changed in state.',
    details: `Without a Workflow, run accepts a CoreStep, and the step returns an explicit continue or complete. After a Workflow is bound, run accepts that Workflow's State and returns the business Result; it is not a new result envelope. Model and tool calls separately return unified results carrying an invocation.

The Workflow can be omitted at construction and bound later with a single bindWorkflow; both assembly styles use the same run. One Engine binds exactly one Workflow, and there is no runtime Workflow switching. Stable dependencies belong to the instance, while the current input and cancellation signal belong to the request. By default there are at most 8 rounds; maxRounds is the round budget, not the node count, and multiple stages in the same round do not consume an extra round.

A node's run returns only the changed fields. Core commits after cancellation and field checks; requires/provides are runtime contracts, and data that has not been obtained must not be faked as complete. Both self-orchestrated CoreStep and explicit Workflow remain supported.`,
    examples: [
      { title: 'A single ordinary step is enough to run', level: 'Beginner' },
      { title: 'Add an explicit Workflow and still call run', level: 'Configuration' },
      {
        title: 'Bind once when dependencies become ready later',
        level: 'Extension',
        note: 'No Workflow was passed again. The supplied signal is merged with the instance signal; cancellation does not let a late result become a successful commit.',
      },
    ],
    policyTitles: ['Execution implementation of the bounded loop, commit, and cancellation'],
  },

  'workflow-definition': {
    title: 'Workflow: nodes, routes, and partial state updates',
    summary:
      'Use a single node definition that actually participates in execution to show order, branches, error destinations, and end conditions together.',
    details: `When entryNodeId is omitted, the first node is used; the entry must set startsRound. Every node needs a description and at least one route. Conditions are evaluated in array order, and routes without when are normally placed last; jumping to a target and ending with complete are mutually exclusive.

Core checks for duplicate nodes, invalid references, unreachable nodes, and loops that bypass round boundaries at construction time. A node can be a plain object or a class implementing the WorkflowNode structure; Core fixes the callback and its original receiver. describe returns a projection of the definition without the current state or handler implementations.`,
    examples: [
      { title: 'A single node completes the greeting', level: 'Beginner' },
      {
        title: 'Add a validation stage without changing state or the run call',
        level: 'Configuration',
      },
      { title: 'The same node contract can be implemented by a class', level: 'Extension' },
    ],
    policyTitles: ['Reference, reachability, and bounded-loop validation'],
  },

  'workflow-extension': {
    title: 'Reusing a base Workflow and Agent branches',
    summary:
      'add preserves the old Workflow and produces a new combined Workflow; fork inherits existing bindings and the branch origin.',
    details: `add accepts node configurations or another Workflow and explicitly rewires existing nodes through routes. It does not modify the old instance; duplicate nodes, unreachable nodes, and unbounded cycles are still rejected. Merely adding an unreachable node is not a valid extension.

fork must use a checkpoint created by the current branch. When workflow is omitted it is inherited; when supplied, add is called internally to combine rather than replace. When App dependencies are involved, resume must restore the App dependencies, and tool runtimes must also be supplied explicitly by resume, so request resources are not treated as freely copyable pure configuration. checkpoints store Data with structured clone; they are not persisted, do not automatically restore business authorization, and are not a cross-request task system.`,
    examples: [
      { title: 'A base Workflow produces a new version', level: 'Beginner' },
      { title: 'Inherit the base Agent bindings and branch origin', level: 'Configuration' },
      {
        title: 'A branch adds a stage instead of replacing the Workflow',
        level: 'Extension',
        note: 'When the base Agent has no business bindings of its own, baseWorkflow.add(...) can also be used directly to construct a new Agent.',
      },
    ],
    policyTitles: ['Practical limits of branches and checkpoints'],
  },

  routes: {
    title: 'route: generating complete configuration and capturing common checks',
    summary:
      'The route function group generates ordinary WorkflowRoute configuration; hand-written objects and generated configuration follow the same contract.',
    details: `The first argument of every to* generator is the target node. route(target, id?) is an alias of route.to, and only its second argument and that of to is directly an optional route ID. Condition generators accept id, conditionId, and description in options; these can usually be omitted.

| Generator | Check and result |
| --- | --- |
| to(target, id?) | No when; jumps directly |
| toIf(target, options?) | Reads the same-named state field as a Boolean: Boolean(state[target]) |
| toIfDefined(target, field, options?) | The field is not undefined; null, false and 0 also count as defined |
| toIfError(target, options?) | By default checks whether error is defined; errorKey selects another field |
| toIfNotEmpty(target, key, options?) | The length of a known array is greater than 0; it is not a general empty-value check for arbitrary values |
| toIfEqual(target, path, value, options?) | The value read from path is strictly equal to the fixed value |
| toIfEqualWith(target, leftPath, rightPath, options?) | The values read from two state paths are strictly equal |
| deliver(field, options?) | Ends and reads the required field; undefined is rejected |
| deliverIfReady(field, options?) | Ends only when the field is defined, otherwise continues matching the next route |
| deliverWhenComplete(field, options?) | Ends only when StepOutcome.type is complete and takes its value |

The two Equal generators support dot paths such as profile.items.0.id; the current parameters of toIfDefined and toIfNotEmpty are field keys, and they must not be assumed to support paths. Strict equality does not deep-compare objects; when two missing paths both yield undefined they compare equal, so a preceding check should be configured when the business does not accept that.

Existing to* generators generally generate to-target from the target; toIfEqual generates an ID from the path, value, and target combination it can express stably, and toIfEqualWith generates one from the left and right paths and the target; symbol paths or non-scalar equal values cannot produce the same stable default ID. The deliver family conventionally uses complete. These are conventions of the specialized functions, not a uniform naming constraint imposed by Workflow.

Generators commonly use conditionId: {nid}.{rid}. Plain hand-written objects support the same two placeholders; Workflow only expands node values and the final local route ID, appends suffixes such as ~2 for duplicate route IDs, and does not guess IDs or specialized-function rules that were not provided.`,
    examples: [
      { title: 'Minimal jump and end', level: 'Beginner' },
      { title: 'Common branches for the same business', level: 'Configuration' },
      {
        title:
          'Override identity as the business requires; hand-written objects also support placeholders',
        level: 'Extension',
        note: 'conditionId carries no authorization. It helps logs explain which condition matched.',
      },
    ],
    policyTitles: ['Default rules and check process of each route generator'],
  },

  'execution-observation': {
    title: 'Process observation and node reports',
    summary:
      'The App subscribes to Core execution facts; nodes report their own usedModel and use an instance sub-logger to record intent first and then results, while the Loop owns identity and logging.',
    details: `execution.observe.event is side-channel observation: observer failures do not change task results and do not create delivery backpressure. The model body sink.output is a different port; Core awaits it in order and propagates delivery failures. Do not treat a side-channel log observer as a reliable terminal output queue.

A Workflow node calls context.report({usedModel, payload}) during execution, or provides report(update, context) to describe completion details. usedModel indicates the model usage reported by the node itself; when not reported it is unknown, and child nodes are not aggregated. Sub-logs must be created as instances via context.createStepRecorder(); write returns an ID on success or -1 on failure, fix returns true on success or false on failure, and readAll reads the full immutable ledger; hand-written arrays or plain objects are not accepted. write records into the existing node.progress immediately, and a short circuit still keeps the plan; fix appends a revision without rewriting historical events. Nodes do not create run identity and do not repeatedly pass diagnostics; Core automatically records node entry, transitions, errors, and model and tool facts. The App decides which statuses to show users; not every Provider has or allows exposure of the model's internal reasoning text.

write requires name and kind, status defaults to planned; the ID, initial order, createdAtMs, and revision are generated by the instance. running means execution actually started, while success, error, cancelled, and skipped are terminal states. fix cannot reopen terminal states or overwrite established facts, but it can fill in missing results while the current execution is still active. payload accepts JSON data, and parent steps and successor IDs must belong to the same node visit ledger; readAll is a persistent readonly query, and records are not submitted through report.

After node completion or cancellation, write returns -1 and fix returns false; retained instances remain readable. fork(subnodeId) creates an independent ScopedReportedStepRecorder delegate without storage of its own. It binds writes to the group and only fixes that group's original writes; it cannot fork or be passed to invoke. readAll exposes the full shared ledger. subnodeId and business type are caller-defined; operation separately identifies write or fix.

The simple agent.run(step) and tool execution contexts also provide report and createStepRecorder. The tool's debugSteps(result, context) records directly through its context logger without returning or submitting it; the Workflow completion callback report(update, context) returns the report object. Both completion callbacks are evaluated only when content collection is permitted, and metadata marks should be submitted during execution via context.report. subSteps in logs is a normalized array, and payload.subStep is the progress metadata of write/fix; consumers without content authorization receive only approved metadata.

createDiagnostics configures optional log consumption of the same fact source; it is not another persistent journal. Body text remains governed by the content recording policy. The run/span/invocation associations in events are Core execution identities, not App message IDs; the App correlates its own message records.`,
    examples: [
      { title: 'Observe the nodes and model events a task passes through', level: 'Beginner' },
      {
        title: 'Report a business stage while the node executes',
        level: 'Configuration',
        note: 'The node only reports facts it knows; Core owns node identity and execution association.',
      },
      {
        title: 'Record an async plan first, then fill in the result',
        level: 'Configuration',
        note: 'A scoped logger binds the group and only fixes its own writes; readAll exposes the full ledger. Every fix appends an independent record linked to its original write, without logger submission.',
      },
      {
        title: 'Self-orchestrated execution uses the same report context',
        level: 'Configuration',
        note: 'write/fix emit progress events directly, so report does not need to be called again for each revision. The default observer receives only metadata.',
      },
    ],
    policyTitles: [
      'Shared execution fact source and consumption isolation',
      'Sub-step statuses and their progression',
    ],
  },

  'attempts-errors': {
    title: 'Attempt budgets and error ownership',
    summary:
      'Express used attempts, invalid data, and workflow contract errors separately instead of turning every failure into successful prose.',
    details: `AttemptBudget.take consumes an attempt only when it succeeds; when the quota is exhausted it returns false and issues no further attempts. It is a counter for local retry policy and does not automatically control model call counts or the global deadline. Engine rounds, ModelRunner call quotas, and App business attempts are different measurements.

BudgetError represents a budget rejection, ValidationError carries issues, and WorkflowContractError represents a node, route, or result violating the runtime contract. getErrorInfo extracts the code and retry information uniformly, but that does not mean every error should be retried. Model parse errors, tool authorization errors, and persistence failures each return to the App handler that owns that boundary.`,
    examples: [
      { title: 'Allow only two business attempts', level: 'Beginner' },
      { title: 'Distinguish an exhausted quota from invalid data', level: 'Configuration' },
    ],
  },

  'journal-projection': {
    title: 'ContextJournal: the in-request projection of receipts',
    summary:
      'Turn real call receipts into in-request records usable in later context, without starting another persistent logging system.',
    details: `ModelRunner already maintains its own journal. result.invocation links the actual call to the context record; text generated by the model cannot forge a call identity. snapshot returns an isolated copy, and modifying the copy does not rewrite the journal.

Manually using beginTool/finishTool applies only to call adapters owned by the App itself. An invocation can only begin and finish once. They record facts; they do not execute tools, authorize anything, or automatically write to a relational database. When persistent diagnostics are needed, the App hands Core facts to its own logging adapter.`,
    examples: [
      { title: 'Read the model receipt already recorded by the Runner', level: 'Beginner' },
      {
        title: 'An App adapter records the local tool it actually executes',
        level: 'Configuration',
      },
    ],
  },
};
