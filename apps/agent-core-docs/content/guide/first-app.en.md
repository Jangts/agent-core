---
title: Build and verify your first Agent App
description: Run a service helpdesk, inspect its graph, compare a route change, and test permissions, call counts, and reply fallback.
---

# Build and verify your first Agent App

Run the helpdesk from the [design guide](./design.en.md). The same code reads service status from a monitoring port, optionally asks the model to explain it, and delivers the verified fields. If explanation fails, a recovery path returns the confirmed status. The sample uses an in-memory monitor and scripted replies, with no credentials, database, or network service.

## Install and run the helpdesk

Use Node.js 22.12.0 or newer. This walkthrough uses Agent Core 1.0.0.

```sh
mkdir helpdesk-lab
cd helpdesk-lab
npm init -y
npm install @jangts/agent-core@1.0.0
```

For a local archive supplied by the maintainer, replace the last command with `npm install /path/to/jangts-agent-core-1.0.0.tgz`. Run the remaining commands from `helpdesk-lab`. Copy the bundled sample so you have a version you can edit.

```sh
SDK=./node_modules/@jangts/agent-core
cp -R "$SDK/development/docs/examples/service-helpdesk" ./service-helpdesk
node ./service-helpdesk/app.mjs
node ./service-helpdesk/app.mjs --explain
```

Both runs return the same confirmed fields. A plain lookup gives `Service status: online.` as its `answer`. The explanation says `The latest monitor reading shows the service online.`.

```json
{
  "status": "online",
  "observedAt": "2026-01-03T10:00:00.000Z",
  "source": "monitor:7",
  "answer": "Service status: online."
}
```

The sample uses `--explain` to make route selection repeatable. Your application can derive the scope from a validated UI choice or a semantic decision. For a standalone TypeScript project, inspect the read-only `create-app` plan and use the same command with `--write` to generate a project. It includes tool wiring, an empty knowledge catalog, and isolated offline tests. [Create an App](/manual/create-app)

## Follow one request through the code

`service-helpdesk/app.mjs` contains the request factory and workflow registrations. Its `inspection` export points the tools at the same Workflow and tool catalog. `cases.mjs` contains the scenarios and layered tests.

1. **Read.** The `lookup` node invokes `read_status`. The tool parses the service name and checks current access through the App's `mayRead` function. Only an authorized call reaches `readStatus`, and validated output becomes the `receipt`. Denied access and monitoring failures reach `unavailable`, which returns an unconfirmed status without protected fields.
2. **Decide whether to explain.** The `lookup` node tries `explain-requested` before the default route. A plain lookup uses `deliver-status` to bind verified fields and uses zero model calls.
3. **Compose the explanation.** The `explain` node uses `Support.defineContextFragments` to assemble the rule, question, and `receipt`. The system message carries trusted policy. The question and tool receipt are data. `Support.resolveReplyGuidance` supplies a brief default, and the model is invoked with the prepared handle.
4. **Preserve confirmed work.** The workflow allows one model call per run. The explanation also has an output bound. Missing or unacceptable wording routes to `deliver-status`, where the validated `receipt` is still available. The request signal propagates cancellation and prevents late results from being delivered.

The App decides which fields can be disclosed. In this example, the result takes status, source, and observation time from the receipt. The tests cover scripted responses and recovery. With a real model, also check whether the explanation misreads the status or invents a cause. [Prompts and context](/articles/prompts-and-context) · [Call budgets](/articles/reasonable-dynamic-budgets) · [Reply organization](/articles/reply-organization)

## Inspect the graph and review a route change

Generate a standalone HTML report from the actual registrations and save a baseline. The inspector imports the entry, so keep it trusted and free of service startup or request execution on import.

```sh
SDK=./node_modules/@jangts/agent-core
INSPECTOR="$SDK/development/scripts/workflow-inspector/cli.mjs"
mkdir -p .tmp
node "$INSPECTOR" inspect --entry ./service-helpdesk/app.mjs --output .tmp/helpdesk.html
node "$INSPECTOR" export --entry ./service-helpdesk/app.mjs > .tmp/helpdesk-before.json
```

In `.tmp/helpdesk.html`, find the conditional and default edges from `lookup`, the recovery edge to `unavailable`, and the `read_status` reference. The graph describes possible paths. To explain a specific request, compare it with a run record exported under App authorization. [Workflow inspector](/manual/workflow-inspector)

In the copied `app.mjs`, move `lookup`'s unconditional `route.to('deliver-status')` above `explain-requested` and run `export` again. The inspector reports an import failure. Running `node ./service-helpdesk/app.mjs` directly shows the registration error `Invalid or unreachable workflow route: lookup` because an unconditional route would shadow all later routes.

Replace the unconditional route with the condition below and leave it above `explain-requested`. Both rules can match a confirmed status when explanation is requested. The graph registers, and the ordering changes the actual path.

```js
{
  id: 'to-deliver-status',
  when: ({ receipt }) => receipt !== undefined,
  targetNodeId: 'deliver-status',
},
```

Export this registered candidate, compare it, and run the affected scenario.

```sh
node "$INSPECTOR" export --entry ./service-helpdesk/app.mjs > .tmp/helpdesk-after.json
node "$SDK/development/scripts/workflow-diff/cli.mjs" \
  --before .tmp/helpdesk-before.json --after .tmp/helpdesk-after.json
node "$SDK/development/scripts/workflow-scenarios/cli.mjs" \
  --fixture ./service-helpdesk/cases.mjs --case explained
```

The diff reports route changes at `lookup`. The last command should fail with one model call expected and zero observed. Direct delivery matched first, so explanation never ran. Restore `explain-requested` to first place and put the original `route.to('deliver-status')` after it. In a real review, give the change review Skill the snapshots and failing case to identify changed contracts, direct consumers, and scenarios to rerun. [Change review Skill](/development/skills/agent-core-workflow-change-review)

## Verify Engine behavior and individual contracts

With the route order restored, use both test entry points with the same fixture.

```sh
SDK=./node_modules/@jangts/agent-core
CASES=./service-helpdesk/cases.mjs
node "$SDK/development/scripts/workflow-scenarios/cli.mjs" --fixture "$CASES"
node "$SDK/development/skills/agent-core-app-testing/scripts/test-agent.mjs" --fixture "$CASES"
```

| Scenario | Monitoring reads | Model calls | Result |
| --- | ---: | ---: | --- |
| `status-only` | 1 | 0 | Confirmed status |
| `explained` | 1 | 1 | Confirmed status and explanation |
| `denied` | 0 | 0 | Unconfirmed status |
| `read-failed` | 1 | 0 | Unconfirmed status |
| `bad-explanation` | 1 | 1 | Confirmed status using the retained receipt |

The scenarios also assert the sequence of actual node visits. The four layered tests should pass. The feature tests cover explanation failure and cancellation during the lookup, which rejects delivery and makes no model call. The node test exercises `deliver-status` in a minimal Workflow and checks its fields. The tool test checks that denial makes no read and allowed execution returns the expected receipt. Filter with `--layer tool` or `--case bad-explanation`. Your App can share a fixture file while giving each case fresh ports and state. [Workflow development and verification](/manual/workflow-development) · [Layered testing Skill](/development/skills/agent-core-app-testing)

## Connect your application

Reuse the definitions. Inside an authenticated request, pass the current identity, monitoring port, and cancellation signal to `createHelpdesk({ app, provider, execution: { signal } })` and call `agent.run(state)`. Keep a scripted Provider during development. For integration, supply a real Provider using server configuration. At the call site in `app.mjs`, for example, use the existing `Support` import:

```js
const provider = Support.createModelProvider({
  protocol: 'responses',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.MODEL_API_KEY,
  model: process.env.MODEL_NAME,
});
```

Pass this Provider to the request factory. Supply credentials and a model name on the server. Test the real port and semantic behavior with allowed and denied requests, expired sources, cancellation, and follow-up questions. Use [MockGPT](/manual/api/mock) when a repeatable protocol fixture is useful, then check semantic behavior on the target model. [Model protocols and lifecycles](/manual/api/model-protocols) · [Production checklist](/guide/extended/production-checklist)

### Wire the handler in a Node.js host

Place this function in the host's `status-handler.mjs`. The monitor adapter receives the authenticated server-side `principal` and validates current access for the lookup. The HTTP boundary validates `state` and converts disconnect, user stop, or the application deadline into `signal`.

```js
import { createHelpdesk } from './service-helpdesk/app.mjs';

export function createStatusHandler({ monitor, provider }) {
  return ({ state, principal, signal }) => {
    const agent = createHelpdesk({
      app: {
        mayRead: (service, signal) => monitor.mayRead(principal, service, signal),
        readStatus: (service, signal) => monitor.readStatus(service, signal),
      },
      provider,
      execution: { signal },
    });
    return agent.run(state);
  };
}
```

### Reuse the same handler in NestJS

Register `STATUS_HANDLER` in an existing NestJS module with `createStatusHandler({ monitor, provider })` as its value. The controller passes the authenticated identity, validated query, and request signal to the service. The singleton reuses the handler and creates an Engine and Tool Runtime for each request.

```ts [NestJS · status.service.ts]
import { Inject, Injectable } from '@nestjs/common';

type StatusRequest = {
  state: { service: string; question: string; explain: boolean };
  principal: Readonly<{ accountId: string }>;
  signal: AbortSignal;
};

@Injectable()
export class StatusService {
  constructor(
    @Inject('STATUS_HANDLER')
    private readonly runStatus: (request: StatusRequest) => Promise<unknown>,
  ) {}

  ask(request: StatusRequest) {
    return this.runStatus(request);
  }
}
```

[Choose the next resilience case](/recipes/) · [Return to the design guide](./design.en.md) · [Read the mechanics guide](./mechanism.en.md) · [API reading path](./api-path.en.md)
