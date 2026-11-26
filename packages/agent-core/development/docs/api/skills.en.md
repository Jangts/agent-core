# Task Skills

Select a method from `taskSkills[id]` in an App handler. Use `description` for discovery and pass `instructions` to the model stage that performs the task. A handler with a fixed purpose can select its method directly.

| ID | When to use it |
| --- | --- |
| `evidence-answering` | Answer a factual question from sources already read and identify relevant gaps |
| `guided-operation` | Explain how to perform an operation using the applicable guide |
| `option-comparison` | Compare specified options on comparable terms |
| `structured-extraction` | Extract requested fields from selected materials and retain their sources |
| `tabular-analysis` | Answer statistical questions using the App's table query and calculation capabilities |
| `delivery-review` | Check a draft, explanation, or report against its sources |
| `document-authoring` | Draft an outline or document, or revise a specified section |
| `change-review` | Verify changes between two versions of the same object |
| `meeting-assistance` | Prepare a meeting outline or record decisions and follow-ups |
| `task-planning` | Turn a goal into steps, dependencies, and completion criteria |
| `task-handover` | Give the next owner the current state and next actions |
| `worklist-triage` | Prioritize existing work and identify what each item is waiting for |
| `asset-selection` | Choose suitable assets from candidates that have been retrieved |
| `data-quality-review` | Report data rule violations and the scope actually checked |
| `record-reconciliation` | Align sources by stable identifiers and report missing records and order differences |
| `import-preflight` | Review import changes, blockers, and the baseline to confirm |

This handler uses the request's bound ModelRunner. The caller reads authorized sources for the question and checks the sources cited in the answer.

```ts
import type { ModelRunner } from '@jangts/agent-core';
import { taskSkills } from '@jangts/agent-core/skills';

export function answerFromSources(
  runner: ModelRunner,
  question: string,
  sources: readonly { id: string; content: string }[],
) {
  return runner.invoke({
    input: [
      { role: 'system', content: taskSkills['evidence-answering'].instructions },
      { role: 'user', content: JSON.stringify({ question, sources }) },
    ],
  });
}
```

The catalog and its entries are read-only. The App registers tools, supplies identity and authorizes actions. The model uses the current request's budget and cancellation signal. For per-item checks and bounded repairs, use the same instructions in an Answering Kit `generate` handler. [Answering Kit](knowledge-answering.en.md)

Filesystem-based Skill hosts can read the bundled Chinese plain-text instructions in `skills/<id>/SKILL.md`.

Use the separate [Development Skills](../agent-development.en.md#development-skills) to design, inspect, and verify App workflows with a coding assistant.
