# 模型协议与生命周期

`ModelRunner` 负责模型执行的准入、取消、预算、终态与业务结果。`Support.createModelProvider` 把主流会话协议转换为同一 Provider 合同。同一种任务切换协议时，工具定义、授权、循环和结果读取保持一致；目标模型仍须支持任务需要的能力。

## 一次文本调用

```ts
import { ModelRunner, Support } from '@jangts/agent-core';

const provider = Support.createModelProvider({
  protocol: 'responses',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.MODEL_API_KEY!,
  model: process.env.MODEL_NAME!,
});
const runner = new ModelRunner({ provider });
const result = await runner.invoke('用一句话解释什么是工具调用');
console.log(result.value); // string
```

凭据及模型由宿主配置，不进入 URL。`baseUrl` 是协议端点的根地址，不包含下表中的路径。`stream: false` 使用完整 HTTP 返回；默认采用 SSE，二者产生相同的业务结果。

| protocol | 追加路径 | 常用根地址形式 |
| --- | --- | --- |
| chat-completions | /chat/completions | 服务商提供的 /v1 根地址 |
| responses | /responses | 服务商提供的 /v1 根地址 |
| messages | /messages | Anthropic 或兼容服务的 /v1 根地址 |
| generate-content | /models/{model}:streamGenerateContent 或 generateContent | Gemini 的 /v1beta 根地址 |
| interactions | /interactions | Gemini 的 /v1beta 根地址 |

`request` 可注入 fetch 实现；`headers` 用于显式服务商扩展，认证字段由适配器保护。`maxOutputTokens` 设置默认输出请求值，Runner 的调用限额继续有效。`modelProtocolCatalog` 描述协议可表达的能力，不代表任意模型都已实测或获准使用。

完整 JSON 正文按实际读取字节计量，默认上限为 16 MiB，可通过 `maxResponseBytes` 调整。正文超限时释放响应流并报告 `MODEL_RESPONSE_LIMIT`。Runner 另行计量生成内容。

## 同一工具循环

[完整可运行示例](../../examples/model-protocols.mjs)使用同一只读工具目录、授权、历史和停止条件运行五类协议。直接运行示例使用确定性协议返回，不访问网络；`runModelProtocolExample(protocol, connection)` 可显式传入真实连接。示例先通过 Core 执行授权工具，再将真实结果以原调用 ID 回传，不把模型提案当成执行回执。

```ts
const interaction = Support.createModelInteraction({
  id: 'conversation', response: 'tools', tools: runtime.tools,
});
const model = new ModelRunner({ provider, interactions: [interaction] }).bind(execution);
let continuation;
const result = await model.invoke({
  input: history,
  interaction,
  modelOptions: {
    continuation,
    onContinuation(value) { continuation = value; },
  },
});
for (const call of result.value.calls) {
  const receipt = await runtime.invoke(call);
  // 将 receipt.value 作为 tool 结果，以 call.id 关联并加入下一轮 history。
}
```

`runtime` 是 `Support.defineToolCatalog(definitions).bind({ app, execution })` 的结果，`history` 为中立消息数组。`modelOptions` 是每轮可选设置，避免为续接重新构造 interaction。普通文本仍返回 string，单选择 interaction 保留自己的结果类型，session 返回文本与调用集合。JSON 操作选择仍须显式选择 `jsonObjectInteraction`；不会按模型名自动降级。

工具参数采用可移植 schema 子集：对象与基础类型、properties、required、items、enum、additionalProperties、description 和 title。不能表达的关键字在发出生成请求前定位并拒绝，不能静默删除约束。原生严格 schema、JSON 对象模式和本地 parser 是不同保证；工具执行仍需要 Core 的本地解析和当前授权。

## 有序内容与输入资源

`ModelMessage.parts` 是有序内容项，提供时替代简写的 content/images 表示。消息仍提供 content 字符串，纯 typed 输入可填空字符串。协议适配保留各项语义顺序；不支持的模态在生成前拒绝。

```ts
const bound = runner.bind(execution);
const parts = await Support.prepareModelResources({
  runner: bound,
  maxBytes: 2_000_000,
  inputs: [
    { type: 'text', text: '解释这张图片' },
    { type: 'image', source: { kind: 'reference', id: 'photo:1' } },
  ],
  ports: {
    authorize(input, { signal }) { signal.throwIfAborted(); /* 检查当前身份和资源权限 */ },
    async resolve(id, { signal }) {
      signal.throwIfAborted();
      // 从宿主已有资源服务读取；也可返回 {kind:'bytes',bytes,mimeType}。
      return { kind: 'url', url: 'https://assets.example.com/photo.png' };
    },
  },
});
const answer = await bound.invoke({ input: [{ role: 'user', content: '', parts }] });
```

资源准备经绑定 Runner 的零生成调用操作，仍有执行期限和取消；准备失败不调用模型。字节资源与宿主引用可转为受限 data URL；远端 URL 不由库自动下载，未知传输大小不记为已精确计量。宿主控制引用读取、上传存储和保留策略。资源准备后，实际生成输入仍经过 Runner 的快照与计量。

媒体输出通过 `modelOptions.onContent` 接收，不进入文本 collector 或 journal；没有媒体 sink 时明确拒绝。签名推理和续接状态不进入此可见媒体通道。

## 续接与身份隔离

要接收续接信息，在 Provider 配置中指定 `scope`，例如账号与会话的组合。仅同 protocol、model、scope 和端点的状态可以回放。`onContinuation` 提供独立受控状态通道；不能把它作为普通文字历史拼接，也不应写入内容日志。适配器保留必要签名块，业务只持有中立 envelope。

`serializeModelContinuation`、`parseModelContinuation` 提供有大小限制的 JSON 封装和身份校验；`createMemoryContinuationStore` 是请求宿主可选的进程内参考存储，不具备跨进程持久性。持久存储、保留期和恢复时当前权限由宿主提供。切换协议不承诺不透明状态无损迁移。

精确 token 计量无法覆盖不可见远端上下文；要求精确计量的调用不能同时使用不透明 continuation。用量回报不是实时费用硬上限，拒答、失败或取消也可能已发生远端消费。

## 后台、批量与实时

这些是不同生命周期，各自使用统一入口，不强行套成一次文本调用。

- `runModelOperation(provider, request, ports, signal?)` 执行一次有界 submit/query/read/cancel；`waitModelOperation` 提供有限次数等待。ports.run 绑定到同一请求 Runner 的 runOperation；authorize、reserve 和 save 由宿主注入。reserve 必须原子排他，恢复时不能重置提交预留。
- `Support.createOperationHttpProvider` 处理 Responses／Interactions 后台响应及原生批量控制。`Support.createBatchModelProvider` 将中立消息编译成 OpenAI、Anthropic 或 Gemini 原生批量项，并按稳定 item ID 关联产物。Batch 提交按项数消耗生成尝试，查询不重复计为生成。
- `openModelRealtime` 提供 Core 的有界连接和逐次授权；`Support.openProtocolRealtime` 封装 Realtime／Live 的轮次及事件。`connectModelWebSocket`、`connectModelWebRTC` 提供可注入连接接线；媒体采集、播放、短期认证和服务端 SDP 交换由宿主提供。输入队列、帧大小、输出缓冲和生成次数均须设置边界。

提交已发出但没有确定结果时保留 unknown，不自动重新提交。取消本地等待、请求远端取消和确认远端停止是不同事实。取消与只读终态查询可使用独立有界清理入口，不能借此新增生成。实时打断使旧轮次未准入提案失效，不撤销已发生副作用；工具执行与回传前都需要当前授权和调用关联。

远端结果已确认但 `save` 报错时，`MODEL_OPERATION_SAVE_UNCONFIRMED` 携带原始错误 `cause` 和已确认的 `result`。宿主可按操作身份核对本地存储，或使用已确认的远端 ID 查询结果。若远端调用和失败状态的存储都报错，`AggregateError.errors` 依次保留两项错误。

后台和批量 HTTP 请求同样支持 `maxResponseBytes`，默认每个响应 16 MiB。批量 JSONL 另有 `maxJsonlLineBytes`，默认为 1 MiB 与总上限中的较小值，结果数受预留项数限制。整批完成后，每项还需提供可识别的生成结束事件，缺失时该项返回 `BATCH_ITEM_TERMINAL_MISSING`。

实时文字和音频提交先取得授权与生成额度，再推进轮次并依协议发送前置帧。已准入轮次部分发送后发生传输故障时，连接会关闭。

[Core API](core.md) · [Support API](support.md) · [公开符号参考](reference.md)

[完整后台例程](../../examples/model-lifecycles.mjs)

## 显式供应商 profile 与托管搜索

`requestBody` 提供协议专有推理设置，例如兼容 Chat 端点的 `thinking: {type: 'disabled'}`。它不能替换 Core 输入、工具、身份、输出上限、返回模式或生命周期；适配器快照配置，合并支持的 effort 设置时保留 Core 输出格式。参数须按目标模型的官方文档配置。

原生搜索通过 `hostedTools`、`authorizeHostedTools` 和 `onHostedToolEvent` 显式启用。支持 Responses 的 web_search、Messages 名称为 web_search 的基础版 web_search_20250305、Interactions 的 google_search。每次生成前重新授权。事件带 source: provider，经可等待的私有回调报告，不生成本地工具执行回执。回调失败会停止消费，不自动重提或撤销远端执行。查询、来源及加密／原生数据可能含私有内容，不能直接写入普通内容日志。其他托管工具定义明确拒绝。

`capabilities` 可显式缩窄目标端点的模态、本地函数工具和原生 JSON Schema 能力，不能扩大协议表达范围或伪造已验证状态。例如配置 `{ capabilities: { jsonSchema: false } }` 后，原生 schema 请求会本地拒绝；Messages／Interactions 的 JSON 模式借助该原生能力，也会明确拒绝。Chat 的 JSON 对象模式与原生 schema 分开。续接绑定完整可见历史及每个原生助手轮次，改写或裁切已有历史时不能沿用该状态；私有封装的 JSON 字符串 length 上限为 1,048,576。

Runner 可直接接收纯 operation 或 realtime Provider，不需要伪造未使用的 stream。缺少生成能力时，普通生成方法在计账前拒绝。`session.tool` 缓冲阻塞工具组并自动续接，无需伪造用户消息：OpenAI 等原响应结束后只发一次新 response.create，Gemini 批量回传一个 toolResponse。续接发送前重新授权、准入和计账，并进入新 generation。`tool-wait` 是中间阶段，`completed` 表示没有待处理工具的最终回复。`respond()` 仅在本地权限或预算调整后重试尚未触发的续接，不重发已派发结果。
