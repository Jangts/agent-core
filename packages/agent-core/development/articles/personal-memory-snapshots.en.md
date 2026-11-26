# Maintain evidence-linked personal memory

Today a user asks for brief replies. Last week they asked engineering reviews to include the evidence. A current request for a detailed explanation takes priority. Long-term preferences can inform defaults, and expiring goals can describe unfinished work. Both need a source and an applicable scope.

## Propose updates from authorized sources

The application admits sources by account, session, completion state, and retention policy. A background extraction model proposes updates. Parse them with `memoryUpdateSchema`, then check meaning, sensitive content, and actual attribution. The Kit matches a source ID and an exact user quote, stores an evidence reference, and discards the quote. The application still needs to distinguish a durable preference from role-play or quoted speech.

Use `applyMemoryUpdate` with the versioned snapshot to compute the next snapshot. `batchMemorySources` keeps same-timestamp groups intact. A stable App-provided `orderKey` orders corrections in the same millisecond. When order is unresolved, the prior entry stays. Publish with a revision check and advance the processed watermark in the same transaction. Recompute against the current snapshot after a conflict. A failed extraction or commit leaves the original watermark available for retry.

## Control reads, retractions, and review

`memoryContext` returns bounded preferences and related entries in the requested scope. Current user instructions take priority. Expired goals, retracted entries, and entries awaiting review leave automatic use. Legacy summary text is tracked separately as unverified, with a fixed migration expiry when configured. After source deletion, apply the App policy to retract or exclude affected entries. Feed source availability into review, and use `reviewMemorySources` and its companion APIs for bounded rechecks. Current business ports establish identity, authorization, and execution facts.

Run `node node_modules/@jangts/agent-core/development/docs/examples/personal-memory.mjs` to see how a same-timestamp correction, session scope, and retraction affect output. Integration tests should also cover concurrent commits, account isolation, source deletion, and malformed extraction. [Example source](../docs/examples/personal-memory.mjs) · [Memory contract](../docs/memory-and-learning.en.md) · [Resilience review Skill](../skills/agent-core-resilience-review/SKILL.md)

[Technical articles](README.en.md)
