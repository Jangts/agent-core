---
title: A soft checklist before production
description: Confirm evidence for corpus, configuration, budgets, retrieval, failure paths and observability before a release instead of relying on an impression that it works.
---

# A soft checklist before production

This checklist asks whether you are ready. It does not replace the hard review in [Acceptance](/manual/acceptance). Hard acceptance proves that interfaces and boundaries work under their contracts; this checklist confirms that you placed them inside a real business and can explain where results come from and where failures fall back.

Every item needs evidence: a log, an evaluation result, a configuration diff or a real call. Do not mark an item complete without it.

## Corpus and permissions

| Check | Evidence | If it fails |
| --- | --- | --- |
| The corpus loads and an empty corpus has an explicit state | Startup log or self-check output | Fix the load path; do not treat empty data as normal |
| Document, section and chunk ids are unique; `revision` is non-empty | Validation output | Fix the data; do not skip validation |
| Permission filters use trusted identity | Code path plus one unauthorized test | Add filtering before reading or fusion |
| Deletion and rewrites clear indexes and citations | One deletion or rewrite drill | Add cleanup; editing the list is not enough |

## Configuration and versions

| Check | Evidence | If it fails |
| --- | --- | --- |
| The effective configuration has a version recorded in logs | One request log | Add the identifier instead of saying "current configuration" |
| Source and runtime copies match; no hand-edited runtime files | Generated diff or comparison | Edit the source and regenerate |
| Secrets come from the environment or a secret store | Configuration review | Move them out of the repository and corpus |
| Model, embedding and index space identifiers agree | Startup self-check | Rebuild the index or fix the configuration |

## Budgets and capabilities

| Check | Evidence | If it fails |
| --- | --- | --- |
| Normal requests do not hit budget rejections intermittently | Character counts from real samples | Leave headroom or read in passes |
| Over-limit requests reject or deliver the confirmed scope under their contract | One over-limit request and its delivery | Preserve required sources and explain the actual limit |
| Dynamic allocation preserves spending, ceilings, and ancestor reserves | A request's before and after ledger plus a rejected increase beyond the ceiling | Adjust allocation on the bound request |
| Retries have attempt and deadline bounds | Failure-injection result | Add bounds and backoff |
| Cancellation stops later calls | One cancellation test | Check and propagate `signal` at every layer |

## Retrieval and citations

| Check | Evidence | If it fails |
| --- | --- | --- |
| Source recall on real questions meets the target | Small-sample evaluation | Fix chunking, vocabulary or sections first |
| The system says "unknown" when no material exists | No-answer sample result | Fix the decision and prompt boundary |
| Citations point at real sources with matching text | Spot-check answers against sources | Read back and verify revision and visibility |
| Retrieval failure and "no material" are distinct | Degradation log | Separate the two states |
| Index updates never return deleted content | One query after deletion | Clear indexes and caches; re-check visibility |

## Failure paths

| Check | Evidence | If it fails |
| --- | --- | --- |
| Rate limits, timeouts and authentication failures have explicit behavior | Failure-injection record | Add classification and handling |
| Lost write acknowledgements are reconciled read-only under the stable operation identity | Inject a lost response after a business write, then check real write count and receipts | Preserve uncertainty and connect authoritative receipt lookup |
| Confirmed results remain queryable after reply repair fails or a client reconnects | Save before injecting delivery failure, then check result lookup and current authorization | Record business receipts and message delivery separately |
| For approval or durable work, further execution uses current authorization and the original deadline | Reconstruct a process and check expiry, revoked permission, and repeated submission | Recheck binding, sources, and persistent accounting |
| Unavailable dependencies degrade or fail explicitly | One degradation drill | Remove fallbacks that pretend success |
| Degradation never widens permissions | Unauthorized-path test | Remove branches that bypass validation |

If personal memory is enabled, verify recall across accounts and sessions, after expiry, and after deletion. Exclude entries according to App policy when sources or permissions are withdrawn, then use the normal reply path. [Memory snapshots](/manual/memory-and-learning) · [Runnable request recovery cases](/manual/examples/resilience/)

## Observability

| Check | Evidence | If it fails |
| --- | --- | --- |
| A failure can be traced to its stage, tool or retriever | One failure log | Add fields |
| Success, degradation, failure and cancellation are distinguishable | One sample of each | Unify result classification |
| Logs contain no secrets, full prompts or unmasked data | Log spot-check | Redact or remove fields |
| Degradation and failure have separate counters | Metrics or report | Count them instead of watching success rate only |

## Release and rollback

| Check | Evidence | If it fails |
| --- | --- | --- |
| A release pins matching corpus, configuration and index versions | Version and build record | Fix versions; do not mix them |
| The rollback path is explicit and drilled | One rollback walkthrough | Document it and retain the old version |
| A new version never reads an incompatible old index | Startup self-check | Validate identity and `indexRevision` |
| The reason for the change and what was observed are recorded | Change record | Record them before releasing |

## Regression

Use the [resilience review](/manual/workflow-development#review-agent-resilience) to find paths most likely to interrupt delivery. Capture key outcomes, node routes, and tool authorization in repeatable [layered Agent tests](/manual/workflow-development#test-agent-features-nodes-and-tools).

| Check | Evidence | If it fails |
| --- | --- | --- |
| Key protocols and tool selection have offline cases | Test results | Add cases with MockGPT |
| Failures, cancellation and budget overflow are covered | Test results | Add boundary cases |
| Real model quality is verified separately | Manual or online evaluation record | Do not substitute offline cases for semantic acceptance |

## How to write the conclusion

State the version, the samples covered, the observed results, what was not verified and the remaining risk. Do not turn "we found no problems" into "there is no risk", and never present passing offline cases as proof of semantic quality.

## Next

- Hard acceptance scope: [Acceptance](/manual/acceptance).
- Failure-injection techniques: [Offline verification with MockGPT](./mockgpt.md).
- Retrieval evaluation methods: [Evaluating retrieval quality](./retrieval-evaluation.md).
