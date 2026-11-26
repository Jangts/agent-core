# Controlled parallel branches and explicit result acceptance

`harness-parallel.mjs` uses an offline deterministic Provider, two native child Runners and an ordinary Workflow node. It does not introduce a queue, graph scheduler or cross-process recovery.

The parent binds one request Runner and derives both children with `createChild`. Actual ancestor accounting and concurrency limits are shared. The example checks Provider entries against cumulative consumption. Each branch receives a separately cloned input; branches never share mutable parent state.

`aggregateBranchResults({ branches, results })` is a pure, optional Aggregation Kit function. `branches` declares stable identities and inspection order. Each identity requires exactly one settled outcome: `{ id, status: 'succeeded', patch }` or `{ id, status: 'failed', error }`. Outcomes must be structured-cloneable; patches must be plain data objects.

All-successful, disjoint top-level writes produce `status: 'accepted'` and a proposed patch. Any shared written key produces `conflict`, even when values are equal. Failures produce `incomplete`; conflicts take precedence while failures remain visible in the outcomes. Rejected aggregations have no commit patch. Successful artifacts remain in declaration-ordered `results`. These are detached data snapshots; the App owns inspection, storage, access control and final acceptance.

The reusable value is validating complete identity sets, rejecting duplicate or missing results, producing consistent conflict diagnostics and retaining partial artifacts. The function does not launch work, invoke models, retry, or authorize operations. A plain handler is sufficient when these constraints are unnecessary. Existing synchronous query aggregation APIs remain unchanged.

Explicit completion gates exercise both completion orders without sleeps:

- Disjoint writes are accepted by the parent.
- Both branches write the parent's `answer`; reversing completion order preserves the same conflict and rejection.
- A failed right branch retains the left artifact without partially committing parent state.
- Deliberately uncooperative branches can return success after cancellation. The parent checks cancellation before returning a patch, and Core checks again before committing. Retention is separate from acceptance; cancellation does not undo external effects.
- A shared allowance of one permits only one Provider entry. The second branch fails while the first artifact survives. Identical configuration values alone are not treated as proof of shared accounting.

After running `npm run build`, run `node development/examples/harness-parallel.mjs` from the Agent Core project root. Focused regression: `node --test test/aggregation.test.mjs`. Use Node 22.12 or newer as required by the project.

Limits: single-App request concurrency, top-level conflicts, no automatic deep merge, idempotency or recovery. Accepting only selected artifacts requires an explicit App policy. Storage, retention and subsequent read authorization remain App-owned.
