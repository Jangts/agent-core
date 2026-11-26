# Create an Agent App

[Development handbook](README.md) · [Integrating an existing project](getting-started.md) · [Knowledge maintenance](maintenance.md)

The initialization tool generates a TypeScript/Node project that provides a program entry, a declarative capability manifest, named handlers, model adaptation, and offline cases. The runtime requirement is Node 22.12 or later. Models, identity, knowledge access, and persistence are assembled by the application.

## Generate a project

Use the tool inside the SDK package you already have:

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --name my-agent --purpose '依据获准资料回答问题'
```

Replace SDK_PATH with the real SDK directory. By default it outputs a read-only file plan, including templates, the SDK version, and file digests; the target directory may not exist or may be empty. After confirming the generated content, create the project with the same parameters plus `--write`:

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --name my-agent --purpose '依据获准资料回答问题' --write
```

Initialization rejects non-empty targets and symlinked targets, and preserves existing files. Generation first completes in an adjacent `.local` temporary directory, then switches to the target directory in one step after verification. It only generates files, does not install dependencies, does not read model credentials, does not call models, and does not start the application.

After copying the whole Skill, the same script can be called too. The tool resolves the actual SDK from the current working directory; `--sdk-from EXISTING_PROJECT` can specify a project that already has an SDK installed. A tool located inside the original SDK package can also locate its own assets. The new target directory does not need the SDK preinstalled; a missing dependency or asset fails explicitly instead of guessing at the original repository location. When maintaining an installed project, the actual entry can be obtained from `tools["create-app"]` in the `plan.mjs` output.

## Project contents

| File | Responsibility |
| --- | --- |
| `src/app.ts` | Assembles the Runner, tool context, budget, cancellation, and the Core loop per request |
| `src/config.ts` | App purpose and overridable call, round, and input/output limits |
| `src/catalog.ts` | Capability declarations that actually drive the model-visible schema and the execution entry |
| `src/handlers.ts` | Input/output parsing, real knowledge authorization, reading, and reference checks |
| `src/model.ts` | Builds a compatible Provider from host-provided configuration; a ChatProvider can also be injected directly |
| `knowledge/knowledge.config.json` | Empty knowledge manifest, section dependencies, and read budget |
| `scripts/knowledge.mjs` | Locates and reuses the same knowledge loader, compiler, and maintenance tools from the installed SDK |
| `test/app.test.mjs` | Isolated test Provider, real tool calls, source validation, and cancellation |
| `agent-core.template.json` | Template/SDK versions, generation inputs, and original digests of managed files |

`createApp({ provider, knowledge?, authorizeRead? }).run(question, { signal? })` returns `{ text, sources, calls }`. Each request has independent state; knowledge reading requires the App to provide a real authorization callback. The source list accepts only document versions actually read in that request. Model failure, exceeding limits, or cancellation rejects the request and does not fabricate a completed result.

The server can construct the App within an already-authenticated request, or bind the current identity according to the host mechanism; do not store "the current user" in a mutable variable shared across users. When generating into an existing monorepo, application registration and the parent workspace/lock files are maintained by that project, and the initialization tool writes only the target directory.

## Installation and offline verification

Enter the generated directory and install the SDK and full dependencies from package.json using your own package registry; when the maintainer provides a tarball, that local artifact can also be installed explicitly. Then run:

```sh
npm test
npm run knowledge:check
```

Tests do not need model credentials. Template dependencies reference only the public SDK and TypeScript; the generated project is independent of the SDK source repository. The package-lock.json produced by installation is maintained by the new project.

## Integrate a model and real knowledge

Import the built `dist/app.js` in the host and inject a ChatProvider; when configuring a compatible service, `dist/model.js` can be reused. `.env.example` provides the variable names. After copying it to `.env` and configuring it, `npm run example -- '你的问题'` explicitly runs one real model flow.

Initial knowledge stays an empty manifest. When there is only an idea of purpose, no policies, people, profiles, or business facts are generated. If actual UTF-8 text has been provided, add to the initialization command:

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --source ./provided.md --id guide --write
```

The tool saves a snapshot of this source file and calls the same `prepare-source` implementation to produce unpublished candidates; the effective manifest remains empty. The candidate path is returned with the creation result and contains the original text, source digest, revision, and configuration baseline. Instructions inside the source are knowledge data and do not affect initialization permissions. If the format or byte budget is invalid, the target project is not committed.

After confirming the source, scope, sections, version, and publication authorization, accept the candidate and verify it with the same compiler following the [Knowledge maintenance flow](flows/knowledge-maintenance.md). The real user identity, authorization, and disclosure rules for private knowledge are provided by the App; the authorization callback in the local call example applies only to local knowledge explicitly chosen by the maintainer.

## Check modifications and upgrades

```sh
node SDK_PATH/development/skills/agent-core-app/scripts/create-app.mjs ./my-agent --check
```

This mode compares the current digests of managed files, the generation baseline, and the template digests of the selected SDK, and reports modified, missing, symlink, and changes to the template itself. It checks only the code/configuration paths defined by the template, does not read `.env` or candidate knowledge body text, and does not modify the project. Keep the generation receipt as the basis for upgrades; when a new template must be adopted, generate in another directory and review the merge, and existing user code is never overwritten.

Advanced tools use the existing Core/Support/Kit configuration: extend the same manifests, handlers, and execution entries to integrate subtasks, knowledge answering, or persistent tasks. Whether to record, how to store, and when to publish and restore are still implemented according to the application's actual product authorization.
