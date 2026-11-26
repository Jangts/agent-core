# Agent App

This Node/TypeScript project uses the SDK's public Core, Support and Knowledge interfaces. The application purpose and request limits are in [src/config.ts](src/config.ts).

## Install and verify

Install the SDK version declared in package.json and its complete dependencies from your chosen package source. You can also explicitly install a supplied SDK tarball. Keep the resulting package-lock.json with your application.

```sh
npm install
npm test
npm run knowledge:check
```

The tests use an injected offline Provider. They do not require credentials, call a real model, start a server or publish data.

## Use the application

After building, import createApp from dist/app.js in your host and inject a ChatProvider. Each run gets its own runner, tool context, history and cancellation signal. Knowledge reads additionally require your actual authorizeRead callback. The capability catalog is in [src/catalog.ts](src/catalog.ts); named parsing, authorization and execution handlers are in [src/handlers.ts](src/handlers.ts).

For an explicit one-request model example, copy .env.example to .env and set your compatible endpoint, key and model name, then run:

```sh
npm run build
npm run example -- '你的问题'
```

This command calls the configured model. Provider configuration is optional when your host injects another ChatProvider. The example's local read grant applies only to the catalog maintained by this local developer; a server must supply its authenticated identity and access checks.

## Prepare real sources

The initial [knowledge catalog](knowledge/knowledge.config.json) is empty. A product idea is not a factual source. Real text supplied during generation is kept as an unpublished candidate; review its source, baseline and applicable scope before publishing.

Run npm run knowledge:check to locate the installed SDK's prepare-source, validate-knowledge and documentation paths. Call prepare-source with the knowledge directory, --source and --id. Publication follows that SDK's shared maintenance guide: review the candidate, save the selected source, register its document, recheck the baseline and validate before an authorized version switch. scripts/knowledge.mjs loads the same shared loader/compiler rather than maintaining another parser.

## Maintain and upgrade

agent-core.template.json records the template revision, SDK version and original managed-file hashes. Run the installed SDK's create-app.mjs with this project path and --check to compare your current files, their generated baseline and the selected SDK template. Review changes in a separate directory and merge intentionally; initialization refuses non-empty targets and never replaces your work.

Persistence, recording, user profiles, publication and background recovery are App-owned tools selected explicitly for your product. No database or background process is initialized by this project.
