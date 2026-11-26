// Scenario declarations and samples share exact public contracts; host ports remain explicit.
export default [
  {
    "id": "model-protocol-provider",
    "title": "按明确协议接入模型",
    "layer": "support",
    "matches": [
      "createModelProvider",
      "modelProtocolCatalog"
    ],
    "summary": "按明确协议接入模型。",
    "details": "协议目录说明可表达的协议，不授予工具权限，也不证明特定端点能力。凭据由宿主提供；离线 fetch 示例只演示完整非流式响应，生产调用仍由 Runner 检查预算、取消和终态。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { ModelRunner, Support } from '@jangts/agent-core';\nconsole.log(Object.keys(Support.modelProtocolCatalog));\nconst provider = Support.createModelProvider({\n  protocol: 'chat-completions', baseUrl: 'https://offline.example/v1',\n  apiKey: 'offline-fixture', model: 'fixture', stream: false,\n  request: async () => Response.json({ choices: [{ index: 0,\n    message: { role: 'assistant', content: 'ready' }, finish_reason: 'stop' }] }),\n});\nconst result = await new ModelRunner({ provider, maxCalls: 1 }).invoke('status');\nconsole.log(result.value, result.invocation.invocationId);"
      }
    ],
    "policies": []
  },
  {
    "id": "model-scoped-input",
    "title": "有序资源准备与作用域续接",
    "layer": "support",
    "matches": [
      "prepareModelResources",
      "serializeModelContinuation",
      "parseModelContinuation",
      "createMemoryContinuationStore"
    ],
    "summary": "有序资源准备与作用域续接。",
    "details": "资源授权和读取由宿主端口提供，准备过程是有界零生成动作。续接只保存可序列化数据，绑定 protocol/model/scope；历史锚点和厂商私有块不能当普通文本改写。内存示例不承诺跨进程持久性。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { Support } from '@jangts/agent-core';\nconst continuation = { version: 1 as const, protocol: 'responses',\n  model: 'fixture', scope: 'account:conversation', data: {} };\nconst serialized = Support.serializeModelContinuation(continuation);\nconst restored = Support.parseModelContinuation(serialized, continuation);\nconst store = Support.createMemoryContinuationStore();\nstore.save(restored);\nconsole.log(store.load(continuation)?.scope);\nexport async function prepareInputs(request: Parameters<typeof Support.prepareModelResources>[0]) {\n  const parts = await Support.prepareModelResources(request);\n  console.log(parts.map(part => part.type));\n  return parts;\n}"
      }
    ],
    "policies": []
  },
  {
    "id": "model-background-batch",
    "title": "后台与批处理的提交、等待和确认",
    "layer": "support",
    "matches": [
      "createBackgroundModelProvider",
      "createBatchModelProvider",
      "createOperationHttpProvider",
      "runModelOperation",
      "waitModelOperation"
    ],
    "summary": "后台与批处理的提交、等待和确认。",
    "details": "普通生成、后台和 Batch 的生命周期分开。宿主提供当前授权、原子 reserve/save 及同一 Runner 的 run 端口。提交被接纳不是成果完成；unknown 不自动再次提交。wait 有查询次数和间隔边界，不启动永久轮询器。低层 HTTP Provider 保留原协议动作，高层适配器分别处理消息和批量项目。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { Support, runModelOperation, waitModelOperation } from '@jangts/agent-core';\nexport async function background(\n  config: Parameters<typeof Support.createBackgroundModelProvider>[0],\n  request: Parameters<typeof runModelOperation>[1],\n  ports: Parameters<typeof runModelOperation>[2], signal: AbortSignal) {\n  const provider = Support.createBackgroundModelProvider(config);\n  const submitted = await runModelOperation(provider, request, ports, signal);\n  if (submitted.status === 'unknown' || submitted.status === 'completed') return submitted;\n  return waitModelOperation(provider, { handle: submitted.handle }, ports,\n    { signal, maxQueries: 5, intervalMs: 100 });\n}\nexport function batch(config: Parameters<typeof Support.createBatchModelProvider>[0]) {\n  return Support.createBatchModelProvider(config);\n}\nexport function rawOperations(config: Parameters<typeof Support.createOperationHttpProvider>[0]) {\n  return Support.createOperationHttpProvider(config);\n}"
      }
    ],
    "policies": []
  },
  {
    "id": "model-realtime-session",
    "title": "实时会话与底层帧生命周期",
    "layer": "support",
    "matches": [
      "openProtocolRealtime",
      "createRealtimeProtocolProvider",
      "openModelRealtime"
    ],
    "summary": "实时会话与底层帧生命周期。",
    "details": "openProtocolRealtime 处理协议工具组与显式生成轮次。原始帧调用可选择 createRealtimeProtocolProvider 加 openModelRealtime；两者是不同层级的替代入口，不应为同一次连接重复打开。每次输入和工具结果仍需当前授权，打断不等于撤销已执行副作用。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { Support, openModelRealtime } from '@jangts/agent-core';\nexport async function portableTurns(\n  config: Parameters<typeof Support.openProtocolRealtime>[0],\n  options: Parameters<typeof Support.openProtocolRealtime>[1]) {\n  const session = await Support.openProtocolRealtime(config, options);\n  try { return session; } catch (error) { await session.close(); throw error; }\n}\nexport async function rawFrames(\n  config: Parameters<typeof Support.createRealtimeProtocolProvider>[0],\n  options: Parameters<typeof openModelRealtime>[1]) {\n  return openModelRealtime(Support.createRealtimeProtocolProvider(config), options);\n}"
      }
    ],
    "policies": []
  },
  {
    "id": "model-realtime-wire",
    "title": "关联实时输入与工具结果",
    "layer": "support",
    "matches": [
      "realtimeInput",
      "realtimeToolResult",
      "realtimeFunctionResponse"
    ],
    "summary": "关联实时输入与工具结果。",
    "details": "这些函数只构造协议帧，不执行工具或授予权限。工具 id/name 来自真实收到的提案；Gemini FunctionResponse 要求对象，标量需显式包装。生产路径优先使用高层 session.tool，使整组续答和预算由包内统一控制。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { Support } from '@jangts/agent-core';\nconst input = Support.realtimeInput('openai-realtime', 'check status');\nconst scalar = Support.realtimeFunctionResponse('ready');\nconst result = Support.realtimeToolResult('gemini-live', 'call-1', 'lookup', scalar);\nconsole.log(input, result);"
      }
    ],
    "policies": []
  },
  {
    "id": "model-realtime-connectors",
    "title": "有界 WebSocket 与宿主 WebRTC 接线",
    "layer": "support",
    "matches": [
      "connectModelWebSocket",
      "connectModelWebRTC",
      "createWebSocketDuplex"
    ],
    "summary": "有界 WebSocket 与宿主 WebRTC 接线。",
    "details": "连接器限制排队帧数、单帧字符与待发送字节。已有 socket 可包装为 duplex，也可让连接器建立 WebSocket。WebRTC 的 SDP 交换与媒体设备归宿主；本机模拟链路不证明厂商云端、设备或音视频质量。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { Support } from '@jangts/agent-core';\nconst bounds = { maxQueuedFrames: 32, maxBufferedBytes: 65536, maxFrameChars: 16384 };\nexport async function websocket(url: string,\n  context: Parameters<typeof Support.connectModelWebSocket>[1]) {\n  const duplex = await Support.connectModelWebSocket(url, context, bounds);\n  try { for await (const frame of duplex.frames) console.log(frame.type); }\n  finally { await duplex.close(); }\n}\nexport function existingSocket(socket: WebSocket) {\n  return Support.createWebSocketDuplex(socket, bounds);\n}\nexport function webrtc(context: Parameters<typeof Support.connectModelWebRTC>[0],\n  exchange: Parameters<typeof Support.connectModelWebRTC>[1]['exchange']) {\n  return Support.connectModelWebRTC(context, { ...bounds, exchange });\n}"
      }
    ],
    "policies": []
  }
];
