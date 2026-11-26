# Adjust call budgets around remaining work

A monthly reconciliation has finished reading the records. It needs two calls to explain the discrepancies, one review, and one possible delivery repair. With an initial allowance of two, reassess the remaining work. Continue if the work is feasible, the ceiling permits it, and the previous step demonstrated progress.

## Track allocation, ceiling, and consumption separately

`maxCalls` is the initial allocation. `maxTotalCalls` is the host ceiling and defaults to that allocation. A request-bound Runner exposes usage, effective remaining capacity, and adjustments through `callBudget`. Children are also subject to ancestor capacity and reserves. A spent call stays on the ledger after failure or replanning.

Give `Support.assessModelBudget` estimates for execution, review, delivery, and recovery. Update the estimate from observed results and blockers. Assessment is a pure recommendation. If the application accepts an `expand` result, use `adjustCallBudget` with an allocation within the ceiling and a host-authored reason. Reuse the bound Runner so the before and after views belong to the same request.

Suppose one call is spent, the allocation is two, and the ceiling is eight. Two calls to explain the discrepancies, one check, and up to one delivery repair require four remaining calls. An allocation of five includes the call already spent. If an ancestor only has three calls available, the local allocation of five cannot grant the fourth call. Replan around work the program can complete deterministically or ask for a condition still needed.

## Tie additional calls to an outcome

Ask for clarification when user permission is missing. Change course when repeated reads produce no evidence. Project or compress input if capacity is the blocker, then reassess. Preserve evidence and confirmed receipts through retries, and reserve room for delivery. Apply the application's deadline and cost policy to the decision.

Run `node node_modules/@jangts/agent-core/development/examples/harness-composition.mjs` to observe parent and child accounting and a delivery-only repair. In your own regression cases, exercise successful expansion, rejection above the ceiling, ancestor reserves, and sustained lack of progress. [Budget and adjustment contracts](../docs/api/reliability.en.md) · [Budget optimization Skill](../skills/agent-core-budget-optimization/SKILL.md)

[Technical articles](README.en.md)
