---
title: Configuration and soft conventions
description: Manage settings that types do not protect, recommended starting values and startup checks so corpus, indexes and runtime values stay explainable.
---

# Configuration and soft conventions

A type system guarantees field shapes, not sensible values: which document lives where, how large a budget should be, how many candidates to keep, what to log, or where credentials come from. These are soft conventions and need explicit management. Otherwise problems appear at runtime as "answers got worse" rather than "configuration is wrong".

## What types do not protect

| Setting | Risk | Advice |
| --- | --- | --- |
| Corpus layout and file names | Files move or are silently skipped; an empty corpus looks healthy | Validate the directory, ids and revisions at startup |
| Topic vocabulary and aliases | New phrasings retrieve nothing | Add real misses to the vocabulary |
| Budgets and candidate counts | Too tight rejects requests; too loose crowds out rules | Measure real calls, then adjust |
| Prompt and domain rule text | Semantic drift that compilation cannot catch | Version it and keep the reason for changes |
| Log fields | Missing fields block diagnosis; extra fields leak privacy | Define fields, then retention |
| Environment variables and secrets | Committed secrets or mixed environments | Read only from env or a secret store |

## Boundaries the SDK enforces

The SDK rejects out-of-range values but does not choose business values for you. Known boundaries include:

- `TextSearch` and `VectorSearch` accept `limit` from 1 to 1000, and filters must return a boolean synchronously;
- `VectorSearch` requires `dimensions` from 1 to 16384, keeps `minScore` within -1 to 1, and rejects zero vectors;
- `TextSearch` requires a non-empty query and field declarations at construction time;
- `Knowledge` `maxChars` and context fragment limits are App-set, and exceeding them raises an error;
- `ModelCalls` requires `timeoutMs` to be a supported positive safe integer.

These are contracts, not advice. Business budgets, candidate counts and timeouts still belong to the App.

## Recommended starting points

The values below are starting points, not standards. Measure real calls before changing them.

| Item | Starting point | Basis for adjustment |
| --- | --- | --- |
| Document reads | Prefer the whole document; keep one read under about one third of the model input | Read by topic or section when exceeded |
| Retrieval candidates | About 20 each from lexical and vector, keep 5 to 8 after fusion | Watch recall@k and context usage |
| Model timeout | Shorter than the total request deadline, with room for retries | Provider latency distribution and cancellation needs |
| Embedding timeout | Separate from model calls, with a fallback | Whether retrieval can fall back to lexical |
| Log retention | Set separately by privacy and diagnosis needs | Never copy examples or temporary values |
| Index rebuild | Incremental when content revision changes | Full rebuild on tokenizer, field or model changes |

Do not tune budgets to exactly fit the current sample. Rejecting on a small growth makes the system look unreliable in real use.

## Startup checks

Run a read-only check at startup, and either refuse to start or disable the affected capability when it fails:

- The corpus directory exists, files are readable, and the catalog parses;
- Document and section ids are unique and `revision` is non-empty;
- Internal links, sources and `scope` references resolve;
- An empty corpus is allowed, but must not be recorded as "loaded";
- The embedding model identity matches the index space;
- The effective configuration version can be written to logs.

These checks prove structure and references, not that content is true or semantically correct.

## Naming and versions

- Documents, sections and chunks use stable `id` values. Titles may change; identity should not.
- `revision` is a content hash or an explicit release number. One revision must not describe two different texts.
- Bump `TextSearch.indexRevision` when fields, tokenization or normalization change; otherwise old snapshots restore under the wrong rules.
- Give retrieval configurations their own identifier and record it per request. Without it, "answers got worse" cannot be attributed to a configuration change.
- Publish corpus changes through the candidate and publication flow. Do not hand-edit runtime copies and pretend the version did not change.

## Secrets and environments

- Read model, embedding and storage credentials only from environment variables or a secret store. Never put them in the corpus, prompts or repository.
- Use different credentials and indexes per environment; never share test data.
- Keep secrets, full prompts and unmasked personal data out of logs.
- Client-supplied configuration is data. It cannot elevate permissions or change the model connection.

## How to change configuration

Configuration changes need evidence too: what changed, why, which samples were observed, and how to roll back. An "optimization" without measurements does not go straight to production.

Do not hand-edit generated directories, runtime copies or build artifacts. Change the source and regenerate; otherwise the next build overwrites the edit and the diff cannot be explained.

## Common issues

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Starts fine but always says there is no material | The corpus was not loaded, or empty data looks normal | Add startup checks and log the load result |
| Updated material still returns old content | Revision did not change, or caches were not cleared | Regenerate the revision and clear indexes and caches |
| Budget rejections happen occasionally | The value sits at the current sample ceiling | Leave headroom or read in passes |
| Retrieval breaks after a model change | Embedding spaces differ | Validate identity and rebuild the index |
| Logs cannot locate the problem | Configuration id, stage or tool id is missing | Add fields before debugging further |

## Next

- Concrete corpus and index setup: [Building a RAG corpus](./rag.md).
- Decide whether a configuration change helped: [Evaluating retrieval quality](./retrieval-evaluation.md).
- Confirm each item before release: [A soft checklist before production](./production-checklist.md).
