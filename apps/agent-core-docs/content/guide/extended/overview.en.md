---
title: Further reading overview
description: Separate hard SDK contracts from usage advice, with a reading order for MockGPT, RAG, retrieval evaluation, configuration, degradation, workflow observation and release checks.
---

# Further reading overview

The earlier guides cover how to build an App. This section covers how to judge and maintain it afterwards. These articles are not API references and add no new contracts; they place existing interfaces inside real trade-offs and offer practices you can verify and adjust.

## Hard contracts and soft conventions

| Kind | Examples | Where |
| --- | --- | --- |
| Contract | Budget rejection, no execution without authorization, cancellation propagation, non-forgeable sources, errors on failed validation | [API handbook](/manual/api/) and each Kit page |
| Advice | Budget values, chunk size, candidate counts, log fields, fallback order, release checks | This section |

Soft conventions never change permissions, budgets, cancellation or input and output contracts. They are not SDK-enforced validation, and they must not be presented as "follow this and you are guaranteed correct". Before adopting one, confirm it addresses a problem you actually have.

## Reading paths

| Article | What it solves | When to read it |
| --- | --- | --- |
| [Resilience and recovery](./resilience.en.md) | Decide whether to repair, reconcile, or stop using the failure and confirmed work | When defining the first workflow and its acceptance criteria |
| [Offline verification with MockGPT](./mockgpt.md) | Verify protocols, tool selection, streaming and failures without a real model | Writing tests, tuning a tool loop, reproducing failures |
| [Building a RAG corpus](./rag.md) | Decide between whole reads, sections and chunks, then build a verifiable retrieval chain | The corpus no longer fits in context |
| [Evaluating retrieval quality](./retrieval-evaluation.md) | Use real questions to decide whether retrieval actually helps | Before adding or changing retrieval |
| [Configuration and soft conventions](./configuration.md) | Manage settings that types do not protect, defaults and startup checks | Starting a project, preparing a release |
| [Workflow graphs and run traces](./workflow-views.md) | Review definitions and captured runs, separating developer observability from business capabilities | Debugging, workflow reviews, observability clients or demonstrations |
| [A soft checklist before production](./production-checklist.md) | Confirm evidence item by item instead of relying on impressions | Before every release |

## One shared principle

Use real data and real calls before adding machinery. Every recommendation should answer three questions: what problem it solves, how you will observe that it works, and where it falls back when it fails. If you cannot answer them, do not add it yet.

Use the [API handbook](/manual/api/) for exact signatures, parameters, and errors. Use [Examples and references](/recipes/) to select runnable cases by the behavior you need to preserve.
