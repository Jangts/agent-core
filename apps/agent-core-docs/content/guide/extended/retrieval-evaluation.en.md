---
title: Evaluating retrieval quality
description: Use real questions and a small sample set to decide whether retrieval actually helps, including metrics, log fields, comparisons and stop conditions.
---

# Evaluating retrieval quality

Whether retrieval is worth adding should not be decided by "we used vectors", but by whether correct sources reach the model on real questions. The goal is not to prove a technique is modern; it is to answer whether it brings the right material to the model at an acceptable cost.

## Define what "better" means

Write down the specific symptom you want to fix, for example:

- Users paraphrase and can no longer find existing material;
- The correct source is in the candidate set but ranked far down;
- The system invents an answer when no material exists;
- Citations do not match the text they claim to support.

Different symptoms need different metrics. Lower average latency, more candidates, or an impression of being "smarter" are not goals by themselves.

## Build a small sample set

Sample real questions and cover three kinds:

| Kind | Example | Expectation |
| --- | --- | --- |
| Clear source | "How do I pause the player" | The matching topic or section appears in the top k |
| Paraphrase or colloquial | "How do I turn off that music thing" | The same source as the previous kind |
| No material | "Which payment methods do you support" | The system says it has no material and does not invent one |

Each case records `question`, `expectedSourceIds` and optionally `mustNotSourceIds`. The set does not need to be large, but it must come from real usage rather than being tailored to the retrieval algorithm.

## Metrics

| Metric | Definition | Purpose |
| --- | --- | --- |
| recall@k | Whether an expected source appears in the top k | Whether recall is sufficient |
| no-answer accuracy | Whether the system says "unknown" when no material exists | Prevent fabrication |
| citation accuracy | Whether citations point at real sources with matching content | Prevent misattribution |
| extra latency | Time added by retrieval and embedding | Understand the experience cost |
| cost per query | Embedding calls and index maintenance | Understand long-term sustainability |

`recall@k` only says the source was brought forward, not that the model used it. Citation accuracy requires checking the answer text against the source.

## What to record

Log fields are a soft convention, not an SDK-enforced schema. Record at least:

- Configuration identifier and index revision;
- Retrieval mode (whole document, section, lexical, vector, fused);
- Hit source IDs, ranks and scores;
- Whether a fallback happened and why;
- Latency, embedding model identity and call status;
- The no-answer decision.

Never record full prompts, secrets or unmasked personal data. Whether question text may be stored depends on your privacy policy; a hash and length are often enough.

## A minimal evaluation script

```ts
type Case = { question: string; expectedSourceIds: string[] };

async function evaluate(
  cases: Case[],
  retrieve: (question: string) => Promise<{ sourceIds: string[] }>,
  k: number,
) {
  const rows = [];
  for (const item of cases) {
    const { sourceIds } = await retrieve(item.question);
    const top = sourceIds.slice(0, k);
    rows.push({
      question: item.question,
      hit: item.expectedSourceIds.some((id) => top.includes(id)),
      top,
    });
  }
  const answered = rows.filter((row) => row.hit).length;
  return { recall: answered / rows.length, rows };
}
```

Track no-answer cases separately; do not fold them into `recall@k`. Citation accuracy requires checking the answer against its sources and cannot be inferred from a vector score.

## Compare configurations

Change one variable at a time and hold everything else fixed:

- The same corpus snapshot and revision;
- The same question set;
- The same model and prompt;
- The same k and budget;
- The same permission scope.

Compare at least three configurations: whole-document reads, section reads and hybrid retrieval. Comparing hybrid retrieval only against lexical search cannot tell you whether chunking or vectors caused the difference.

## Decision rules

- Expected sources never enter the top k: fix chunking, vocabulary or section structure first, not the model.
- Sources enter the top k but answers are still wrong: check whether evidence reaches the context, whether budgets truncate it, and whether the model ignores it.
- The system fabricates when no material exists: fix the no-answer decision and prompt boundary rather than hiding it behind a similarity threshold.
- Cost rises without a recall gain: stop vectorizing and spend the effort on corpus structure.

Write conclusions as "on this sample, with this configuration, we observed this", not "it works better". Old conclusions do not carry over when the sample or configuration changes.

## Common mistakes

| Mistake | Problem | Alternative |
| --- | --- | --- |
| Validate on the same questions used for tuning | Results are overfitted | Hold out questions that were not used for tuning |
| Only look at top1 | Correct sources often sit lower | Use recall@k and check citations |
| Treat a fused score as confidence | The score only expresses rank | Judge by source hits and answer text |
| Ignore no-answer cases | Fabrication goes unnoticed | Measure no-answer accuracy separately |
| Substitute latency or cost for quality | The metric points the wrong way | Record quality and cost separately |

## Next

- Build the retrieval chain: [Building a RAG corpus](./rag.md).
- Inject failures and delays for comparison: [Offline verification with MockGPT](./mockgpt.md).
- Confirm the evidence expected before release: [A soft checklist before production](./production-checklist.md).
