# Reply design and review card

Use the relevant questions, not a mandatory form for every reply.

| Decision | Concrete material |
| --- | --- |
| Request and entry | Actual use case/entry, current object and scope, expected result or legitimate no-text UI outcome |
| Processing choice | Model, program or hybrid; compare alternatives only when useful; absence of preprocessing is not a defect |
| Facts and conclusions | Actual producer, source, business projection, scope, units, known/unknown/failed dimensions, complete statistics versus limited details |
| Model input | Raw material or prepared facts/conclusions, boundaries and relevant detail references; avoid sending an entire database to save writing a projection |
| Model output | Complete text, structured fields, program-template values or a proposed constrained master; declare the real interface and failure path |
| Style | Audience, language, tone, length and organization; current explicit requirements versus defaults; completeness must survive concise style |
| References | Facts, expression examples, style examples or expected-answer criteria; identify applicable context and changes without imposing one metadata format |
| Effects and recovery | Prepared/executed/saved/unknown separately; current authorization; repair wording without repeating completed effects |
| Verification | Independent facts/criteria, actual assertions, semantic and style review, offline/model/UI evidence and their respective revisions |

Two legitimate references for the same synthetic comparison:

- Brief: “The selection is missing 18 official items and contains one extra item. Two shared titles differ. Order was not compared; price cannot be confirmed.”
- Explanation: “The difference between totals is 17, but that is not a missing count: 64 items overlap, leaving 18 official-only and one selection-only item. Two titles differ; order and price remain unconfirmed.”

Both require complete unique collections of 82 and 65 items with an overlap of 64. With only the totals, neither missing count follows. A Master collection is not an official source just because their counts happen to match. Different SKU identifiers do not establish variants of one product.

For style/reference review, use two contrasting requests, such as a novice explanation and an expert summary, over the same facts. An old example saying “99 items” is a writing example, not the current count. An open creative task can have no fixed answer and still be valid.

Check errors with meaningful counterexamples: a known zero versus a missing count; matching sets but untested order; a source-valid sentence contradicting its data; a well-written answer citing the wrong source; a prepared link described as already opened; and a formatting repair that repeats a write. For model-proposed masters, a slot allowlist checks references, not the semantic correctness of “Price: {{count}}”.

Record what was actually reviewed or run. Filling this card, extracting guide text, or checking that a reference exists cannot upgrade semantic or real-model evidence.
