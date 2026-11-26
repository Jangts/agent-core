# User materials and data boundaries

[Back to development handbook](README.md) · [Continuous accumulation](memory-and-learning.md)

Receiving material, extracting body text, using it within a round, storing it in a personal profile, and publishing it as shared knowledge are different operations. Core does not automatically convert uploads into long-term memory, nor does it trust instructions in material just because the material contains section anchors.

## Minimal processing chain

```text
Server confirms identity and material ownership
  → App checks format/size, saves necessary source information
  → Controlled parser extracts body text, records extraction failures or gaps
  → Selects content according to this round's authorization
  → Support context fragment marks it as user data and sets a budget
  → Handler uses the material and binds output to actual evidence
```

Parsing and saving are provided by App adapters. The plain text example does not mean PDF, image OCR, audio transcription, web crawling, or archives are supported. When these formats are needed, register parsing tools and acceptable results explicitly; parsing failure must not be treated as empty content and then followed by a complete conclusion.

| Field to be made explicit | Purpose |
| --- | --- |
| Material ID, owning user/tenant, access scope | The server establishes permissions and does not trust client-claimed owners |
| Original reference, type, source time, content hash | Retrieve the original and determine versions; do not treat file names as stable identity |
| Extraction version, body text, gaps, and parsing status | Distinguish originals from model/parser output |
| Lifecycle, retention, and deletion method | Whether this round, the session, or persistent storage is decided by the product |
| Review/publication status | Candidate material cannot automatically become shared authoritative knowledge |

See [Material record](records.en.md#material-record) for a reference. It is an App-owned record sample with no corresponding Core persistence API.

## Context and tools

Use Support fragments to note the real source, `trust: 'user'`, and the corresponding lifecycle. The trust label is part of the assembly contract, not a sandbox; the App still needs to prevent material body text from being treated as higher-privilege instructions or executable code. Do not dynamically add one executable tool per uploaded file; usually keep a controlled `material.read` whose parameters reference IDs authorized for this round.

When continuing use across rounds, pass only references available to the session and re-confirm permissions and lifecycle. When persistent storage is needed, enter the application's own candidate and publication flow. After deleting an original, also clean up extracted text, summaries, indexes, and references according to the App policy—do not delete only the UI list.

## Delivery limits

Do not output the full material text by default in errors, logs, or receipts. Partial reads, insufficient budget, and incomplete parsing should become explicit check results; retries cannot widen the visible scope. Source references, file download URLs, and cross-end presentation are chosen by the App; the Interaction Kit is optional, and front and back ends are not forced to use InteractionProtocol/CommandCatalog uniformly.
