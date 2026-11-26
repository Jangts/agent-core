# Choose a model protocol and call lifecycle

A ticket summary should return in the current request. Thousands of independent tickets can be processed as a batch. A voice assistant that users interrupt needs a connection that sends and receives. The protocol determines what can be sent and how results are read. The lifecycle determines where work starts, stops, and recovers.

## Choose based on how the task waits

| Situation | Integration | What the host configures or records |
| --- | --- | --- |
| Question or short tool sequence | `ModelRunner` with an explicit provider protocol | Request cancellation, budget, and tool scope |
| One long operation | Background operations on Responses or Interactions | Stable operation identity, remote ID, polling, and cancellation |
| Many independent inputs | Native Batch on OpenAI, Anthropic, or Gemini | Input IDs, per-item terminal results, and retention |
| Two-way voice or interaction | OpenAI Realtime or Gemini Live | Bounded connection ports, session authorization, media, and interruption |

`Support.createModelProvider` explicitly adapts Chat Completions, Responses, Messages, GenerateContent, and Interactions. Check the target model's modality, schema, and tool capabilities before choosing. Hosted search needs explicit authorization. Local tool proposals still go through the application's execution boundary.

Use `runModelOperation` for a submission, query, read, or cancel action and `waitModelOperation` for bounded polling. `Support.createBatchModelProvider` compiles portable messages and correlates successes and failures by item ID. Start a realtime connection with `openModelRealtime` and provide media and ephemeral authentication at the host boundary. Batch attempts are charged per generation item. Polling queries spend no generation allowance.

## Preserve uncertainty across requests and connections

Match protocol, model, and host scope on continuation. If the remote operation is confirmed and local saving fails, `MODEL_OPERATION_SAVE_UNCONFIRMED` carries the confirmed result for reconciliation under the same operation identity. A completed batch still needs per-item terminal results. `BATCH_ITEM_TERMINAL_MISSING` indicates an item without a recognized generation terminal. In realtime, wait until the connection can send and track interrupts and results for the current generation so stale events cannot enter delivery.

Run `node node_modules/@jangts/agent-core/development/examples/model-protocols.mjs` and `node node_modules/@jangts/agent-core/development/examples/model-lifecycles.mjs`. These use fixed protocol fixtures. Verify capabilities and permissions against the deployed model and vendor environment. [Model protocols and lifecycles](../docs/api/model-protocols.en.md) · [Workflow design Skill](../skills/agent-core-workflow-design/SKILL.md)

[Technical articles](README.en.md)
