# Checking a supplied reply snapshot

The checker consumes a local JSON projection, not an App module. Derive entries and outputs from the actual registrations you already execute; do not create a second capability list for this tool. Human notes may add task-specific criteria. The supplied-snapshot scope cannot establish whether every real App entry was exported.

~~~sh
node SKILL/scripts/check-replies.mjs --input snapshot.json
~~~

Use the entire installed Skill directory for SKILL. Exit 0 means no structural errors were found in the supplied data (warnings may remain), 1 means contradictory/unknown declared relationships or unsupported pass claims, and 2 means invalid input/usage. No receipt or reference target is opened or executed. Input is limited to 2 MiB and each record array to 10,000 items.

~~~json
{
  "version": 1,
  "subject": { "id": "reply-example", "revision": "r1" },
  "entries": [{ "id": "rewrite", "source": "catalog/rewrite", "outputs": [] }],
  "references": [{ "id": "tone", "source": "copy/tone", "revision": "s1", "purposes": ["style"] }],
  "cases": [{
    "id": "rewrite-novice",
    "entryId": "rewrite",
    "approach": "model",
    "referenceIds": ["tone"],
    "expected": { "kind": "criteria", "source": "cases/rewrite-novice/criteria" },
    "evidence": { "style": { "status": "not-run" } },
    "claims": []
  }]
}
~~~

This fully model-driven case is legitimate: it needs neither outputs nor a fixed answer. Entries need unique id, source and optional unique outputs. References need id, source, revision and one or more purposes: facts, expression, style, expected. A reference can have several purposes without being duplicated.

Cases need id, entryId, approach (model/program/hybrid), and expected.kind (fixed/conditional/example/extracted/criteria/none). Every kind except none needs an identifiable source or criteria location. Optional outputIds refer only to that entry's producer; referenceIds refer to supplied references. No template or preprocessing flag is required.

Evidence dimensions are source, semantic, style, offline, model and ui. Each can be not-run, passed, failed, unknown or not-applicable (with reason). Passed records should name proof and subjectRevision; offline passes need a positive assertions count to support a claim. Optional referenceRevisions map used reference ids to the revisions reviewed. A changed style reference need not invalidate unrelated numeric assertions: attach only references relevant to that receipt.

Claims explicitly name dimensions the caller wants to declare passed. A missing, failed, stale or empty-check receipt cannot support that declaration. Merely adding expected text does not change evidence. An extracted reference can later receive a real semantic review; its kind is not itself a verdict. Receipt locations are opaque pointers, not verified artifacts, and every evidence count in the report is reported evidence. A fabricated but consistent receipt is still unverified.

An explicit expected.kind none is valid for an appropriate no-answer outcome. The actual UI/effect still needs its own applicable behavioral assertions; none does not prove success. Unknown dynamic relationships remain open rather than being guessed from source regexes, labels or DOM names.

For a concrete exported projection, run the bundled exporter:

~~~sh
node SKILL/examples/export-snapshot.mjs > .tmp/reply-snapshot.json
node SKILL/scripts/check-replies.mjs --input .tmp/reply-snapshot.json
~~~

The exporter explicitly imports these trusted synthetic fixtures; unlike the JSON checker, a JS exporter executes its imports. Inspect a production exporter before running it. Never treat case selection, a timeout or an AbortSignal as isolation from top-level code.
