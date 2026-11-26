# Manual initialization and knowledge maintenance

[Back to development handbook](README.md) · [Tool notes](examples.md) · [Shared flow](flows/knowledge-maintenance.md)

## Establish sources first, not a full directory

Developers are responsible for confirming which text is an actual knowledge source and which is only a product idea, pending content, or an operation instruction. When there is only an idea, keep files empty and do not generate introductions, policies, or user profiles that look real. When actual material exists, organize it faithfully; when originals are complex, conflicting, or mixed with instructions, preserve the originals and form candidates first, and never treat commands inside them as development authorization.

Integrate existing projects following the [integration guide](getting-started.md), and initialize new projects following [Create an App](create-app.md). Pure conversation does not require a knowledge base; maintain knowledge configuration explicitly only when knowledge answering is needed. Compare existing directories first, preserve business files, and limit test knowledge to test scopes.

A knowledge App prepares a `knowledge.config.json` in the same directory, for example the empty state below, and creates an empty `initial.knowledge.md`. Files are not read until they are registered.

```json
{
  "schemaVersion": 1,
  "maxDocumentBytes": 32000,
  "maxReadChars": 8000,
  "documents": [],
  "requiredReads": []
}
```

After installing the maintainer-delivered Core and full dependencies following the [installation guide](getting-started.md), you can run the shared validation entry. The directory argument below is the knowledge directory containing `knowledge.config.json` and does not have to be the project root; the tool path is located from the package installed in the current project:

```sh
node node_modules/@jangts/agent-core/development/skills/agent-core-app/scripts/validate-knowledge.mjs ./existing-project/knowledge
```

When there is no knowledge it outputs the empty-catalog state; this is a correct preparation state and should not be made to look successful by fabricating knowledge. Actual sources can first be turned into candidates with the tools below, and after confirmation written into source files and registered in the manifest.

## How the configuration is maintained

`knowledge.config.json` is the template's App configuration; the library does not require every App to use this file. The current shared loader understands:

| Field | Constraint and meaning |
| --- | --- |
| `schemaVersion` | Currently 1, checked by the shared compiler |
| `maxDocumentBytes` | Positive integer, byte limit per source file; not a model token limit |
| `maxReadChars` | Positive integer, per-read character limit for Knowledge |
| `documents` | May be empty; entries are `{id,file,locale?}`; currently only lowercase `*.knowledge.md` file names in the same directory are allowed, and model-supplied paths are not accepted |
| `requiredReads` | `{documentId,selection}` actually depended on by tasks; all references are checked at compile time |

Document IDs must be unique; see [Knowledge documents](knowledge.md) for section rules. Newly added files must be registered explicitly; being on disk does not automatically grant publication or read eligibility. Source and subsequent version traceability are carried by the maintainer's own change records; candidate tools do not replace complete publication records.

## Adding and updating reuse the same validation

```sh
node node_modules/@jangts/agent-core/development/skills/agent-core-app/scripts/prepare-source.mjs ./existing-project/knowledge --source ./revision.md --id initial-doc
node node_modules/@jangts/agent-core/development/skills/agent-core-app/scripts/validate-knowledge.mjs ./existing-project/knowledge
```

The first command only generates a candidate; the second checks the **currently effective configuration** and does not publish the candidate. The candidate contains the original file, document ID, suggested addition/replacement, source hash, revision, as well as the configuration hash at preparation time and existing document versions. Candidate validation also checks existing required section references; deleting a referenced section fails, and the task and configuration must be explicitly adjusted and the candidate prepared again—errors cannot be skipped automatically.

The configuration hash comes from the raw bytes actually parsed this time, sharing a single configuration read with the candidate's budget and required-read validation, so it is not re-read after validation and marked against a different baseline. Each source file version comes from content read this time; this does not constitute an atomic multi-file filesystem snapshot.

Publication is done by the maintainer: verify sources, body diffs, task references, and permissions → save the candidate to a controlled source file → add the new document to the manifest or update an existing file → use the same check entry → publish one complete version. Before publishing, compare the effective configuration and the revisions of replaced documents against the candidate baseline; if stale, redo the comparison. A single-file write is not a multi-file transaction; production systems should use their own versioned publication, transactions, or atomic switching.

Direct editing follows the same flow. A failed validation keeps the published version; generation and review use the same snapshot; a failed update does not delete the original file. Manual and runtime growth can share `compileApplicationKnowledge`, replacing only the input and commit adapters.

## What maintenance does not happen automatically

The tools have no automatic approval, publication, file watching, indexing, scheduled learning, or database writes. User profiles and business experience are different application data; define their sources, updates, and deletions according to [Continuous accumulation](memory-and-learning.md), then decide whether to convert them into readable Knowledge documents.
