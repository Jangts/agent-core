# App data format examples

The JSON below only explains field design for App-owned records; it does not participate in runtime loading, register tools, or create data tables. Core does not require this storage format.

Use null/empty arrays to indicate not yet provided, and do not fabricate facts from example default values. Field names, states, and versions are defined and validated by the App itself.

## Material record

Original, extraction status, ownership, lifecycle, and publication status.

```json
{
  "schemaVersion": 1,
  "id": null,
  "ownerId": null,
  "scope": "private",
  "original": { "reference": null, "mediaType": null, "contentSha256": null, "receivedAt": null },
  "extraction": { "status": "pending", "revision": null, "text": null, "caveats": [] },
  "lifetime": "turn",
  "expiresAt": null,
  "publication": { "status": "unpublished", "documentId": null }
}
```

## User preferences

Accumulated interaction preferences, source watermark, and version.

```json
{
  "schemaVersion": 1,
  "ownerId": null,
  "revision": null,
  "summary": null,
  "sourceWindow": { "after": null, "through": null, "references": [] },
  "updatedAt": null,
  "expiresAt": null,
  "status": "uninitialized"
}
```

## Experience candidate

Experience source, applicability, validation, and publication status.

```json
{
  "schemaVersion": 1,
  "id": null,
  "ownerId": null,
  "revision": null,
  "status": "candidate",
  "claim": null,
  "applicability": [],
  "sources": [],
  "counterexamples": [],
  "conflicts": [],
  "validation": { "status": "pending", "references": [] },
  "publication": { "approvedBy": null, "approvedAt": null, "documentId": null }
}
```

User preferences cannot carry identity and permissions; experience candidates are not published automatically; raw materials do not automatically enter shared knowledge. See [Knowledge maintenance](maintenance.md), [Materials](materials.md), and [Continuous accumulation](memory-and-learning.md).
