# Knowledge Preparation, Maintenance, and Publication Flow

This flow is referenced by the development-time knowledge preparation tools, the manual maintenance process, and the App's runtime knowledge growth implementation. It is not a prompt or state machine that Core executes automatically, and it grants no read or write permission. In an existing project, development-time verification and runtime loading reuse the same knowledge.config.json and compileApplicationKnowledge. When there is only an idea and no source, keep an empty file and an empty document list, and do not generate initial facts.

## Shared Process

| Stage | What must be obtained | Execution responsibility |
| --- | --- | --- |
| Obtain sources | Originals or references, source entity, time, usage/access scope | Organized by developers, or received by the App under authorization |
| Form candidates | Locatable body text/fields; unknowns and conflicts retained | Human or App extractor; model output is only a candidate |
| Assign identity | Stable document/section IDs, explicit revision and locale | The App's maintenance policy; not the model inventing new program handlers at will |
| Check structure and references | Documents, sections, task reads, and budgets all usable | The same application compile entry and local validators such as Knowledge/Task |
| Approve for publication | Human/business verification decided from sources and risk; authorization scope not widened | The App's own publication policy; the library does not build in generic approval |
| Publish the version | Persistent records and the concurrent version commit succeed, then the new catalog becomes available | Controlled publication during development, or a transactional/CAS implementation at runtime |
| Use and trace | Requests bind the catalog and source snapshot; corrections can find the old version | App handler and storage; Core maintains execution budget and cancellation |

## Shared Rules

1. Document IDs are unique within the catalog; section IDs are globally unique within a document. A title or file path does not replace identity.
2. Changing body text or metadata that affects interpretation requires changing the revision. A snapshot does not replace source material, approval records, or a content hash.
3. Validate references to tasks, readers, sections, outputs, and checks. A knowledge file passing syntax parsing does not mean the whole Agent integration is correct.
4. Source material, user preferences, experience candidates, published knowledge, and tool receipts are handled separately; a user statement does not automatically become a public fact.
5. Use the smallest complete read scope; when the budget is insufficient, report an error explicitly or read in batches, and do not silently truncate rules or necessary evidence.
6. A failed check or publication does not overwrite the old version. Existing requests keep using their own old snapshot, and knowledge is not swapped out behind the scenes between generation and review.
7. A data update does not automatically add execution permission. Dynamic knowledge references and program capability registration are two different flows.

## Where the Shared Rules Are Enforced

The example knowledge.config.json is an **App-owned configuration template**, not a new protocol in the library. It declares source files, read budgets, and read references that must be valid. compileApplicationKnowledge in development/skills/agent-core-app/scripts/lib/knowledge.mjs is used by both the validation tool and runtime loading; when the App copies or rewrites the template, it keeps the same entry:

```text
开发者／开发期脚本 → 源稿和配置 → 共享编译校验 → 发布应用资料
运行期增长适配器 → 经审定的新版本 → 共享编译校验 → 持久提交／切换可用版本
```

The example implements only reading local source files, version computation, reference checks, and in-memory catalog construction. Runtime candidate extraction, review, persistence transactions, CAS, deletion, and permission filtering remain the App's responsibility; writing a flow in this file does not mean those tools are integrated.

When integrating other formats, databases, or retrieval services, keep this flow and the same structure/reference checks, and replace only the input and commit adapters. There is no need to hard-code storage paths or one product's data tables into Core.
