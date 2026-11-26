// Scenario declarations and samples share exact public contracts; host ports remain explicit.
export default [
  {
    "id": "review-detection-admission",
    "title": "结果评审与版本化接纳检查",
    "layer": "kit",
    "matches": [
      "defineResultReview",
      "checkReviewAdmission"
    ],
    "summary": "结果评审与版本化接纳检查。",
    "details": "发现 confirmed 不等于事实正确，coverage complete 不等于结论正确。检测器与策略由宿主声明；接纳前比较 scope、内容和政策修订及必需检测覆盖。检查返回 allowed/reasons，不执行写入、不替代授权或宿主原子提交。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { defineResultReview, checkReviewAdmission } from '@jangts/agent-core/kits';\nexport function review<Value, App>(\n  definition: Parameters<typeof defineResultReview<Value, App>>[0]) {\n  return defineResultReview(definition);\n}\nconst scope = { id: 'decision', contentRevision: 'content:1', policyRevision: 'policy:1' };\nconst result = { scope, findings: [], coverage: [{ detectorId: 'sources',\n  status: 'complete' as const, inspected: ['pair'], skipped: [] }] };\nconst admission = checkReviewAdmission({ result, scopeId: scope.id,\n  contentRevision: scope.contentRevision, policyRevision: scope.policyRevision,\n  requiredDetectorIds: ['sources'] });\nconsole.log(admission.allowed, admission.reasons);"
      }
    ],
    "policies": []
  },
  {
    "id": "review-waiting-decision",
    "title": "等待答复与显式裁决接纳",
    "layer": "kit",
    "matches": [
      "defineWaitGate",
      "defineReviewDecision"
    ],
    "summary": "等待答复与显式裁决接纳。",
    "details": "WaitGate 绑定定义修订、任务、等待代次、主体和期限，每次操作重新授权。resolved 只表示答复已记录；ReviewDecision 还需读取当前资源/政策，并经宿主 accept 原子比较接纳。持久存储的排他、幂等与回执由真实端口提供，不用内存示例冒充跨请求保证。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { defineWaitGate, defineReviewDecision } from '@jangts/agent-core/kits';\nexport function waiting<Answer, App>(\n  definition: Parameters<typeof defineWaitGate<Answer, App>>[0],\n  storage: Parameters<typeof defineWaitGate<Answer, App>>[1]) {\n  return defineWaitGate(definition, storage);\n}\nexport function decision<Answer, Result, App>(\n  definition: Parameters<typeof defineReviewDecision<Answer, Result, App>>[0]) {\n  const port = defineReviewDecision(definition);\n  return port;\n}"
      }
    ],
    "policies": []
  },
  {
    "id": "review-choice-binding",
    "title": "检查候选并绑定裁决答复",
    "layer": "kit",
    "matches": [
      "inspectReviewChoices",
      "isReviewChoice",
      "isReviewChoiceAnswer",
      "bindReviewChoiceDecision"
    ],
    "summary": "检查候选并绑定裁决答复。",
    "details": "候选先经过结构和证据范围检查，再绑定原争议、内容修订与等待身份。结构判断函数只证明数据形状，不能授予权限；绑定对象继续使用宿主当前授权、读取和保存端口。不能用候选编号代替真实工具执行回执。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { inspectReviewChoices, isReviewChoice, isReviewChoiceAnswer,\n  bindReviewChoiceDecision } from '@jangts/agent-core/kits';\nexport async function inspect(\n  options: Parameters<typeof inspectReviewChoices>[0],\n  host: Parameters<typeof bindReviewChoiceDecision>[1], answer: unknown) {\n  const choice = await inspectReviewChoices(options);\n  if (!isReviewChoice(choice)) throw new TypeError('Invalid review choice');\n  console.log(isReviewChoiceAnswer(choice, answer));\n  return bindReviewChoiceDecision(choice, host);\n}"
      }
    ],
    "policies": []
  },
  {
    "id": "branch-settled-aggregation",
    "title": "按声明身份汇总已结束分支",
    "layer": "kit",
    "matches": [
      "aggregateBranchResults"
    ],
    "summary": "按声明身份汇总已结束分支。",
    "details": "输入为已声明分支及真实 settled 结果，不启动并行任务。同一顶层字段的补丁即为冲突，包括值相同的写入；助手不会推断嵌套语义、资源身份或自动合并业务事实。调用方检查完整性与冲突后才决定如何提交。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { aggregateBranchResults } from '@jangts/agent-core/kits';\nconst result = aggregateBranchResults<{ title: string; count: number }>({\n  branches: ['title', 'count'], results: [\n    { id: 'title', status: 'succeeded', patch: { title: 'ready' } },\n    { id: 'count', status: 'succeeded', patch: { count: 1 } },\n  ],\n});\nconsole.log(result);"
      }
    ],
    "policies": []
  },
  {
    "id": "mock-protocol-lifecycle-catalogs",
    "title": "查看模拟协议与生命周期故障目录",
    "layer": "kit",
    "matches": [
      "protocolCatalog",
      "findProtocol",
      "lifecycleCatalog",
      "lifecycleFaultCatalog"
    ],
    "summary": "查看模拟协议与生命周期故障目录。",
    "details": "模拟器的有限协议目录与状态转换/故障目录用于测试预期，不是厂商能力事实。路径查找可能返回 undefined；先确定支持范围，再为故障与未知状态分别写断言。使用本地构建或候选包时明确工件，不能用旧已发布 peer 证明新协议。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { protocolCatalog, findProtocol, lifecycleCatalog,\n  lifecycleFaultCatalog } from '@jangts/mock-gpt';\nconsole.log(protocolCatalog.length);\nconsole.log(findProtocol('/v1/responses') !== undefined);\nconsole.log(Object.keys(lifecycleCatalog), Object.keys(lifecycleFaultCatalog));"
      }
    ],
    "policies": []
  },
  {
    "id": "mock-realtime-adapters",
    "title": "在内存、WebSocket 和 DataChannel 间替换模拟链路",
    "layer": "kit",
    "matches": [
      "createMockDuplex",
      "createMockWebSocketServer",
      "bindMockDataChannel"
    ],
    "summary": "在内存、WebSocket 和 DataChannel 间替换模拟链路。",
    "details": "内存 duplex、回环 WebSocket 和宿主 DataChannel 是三种传输接线，复用同一模拟请求规则；它们不代表真实厂商音视频。调用方提供协议设置和有界队列，并在结束时关闭资源。Node server 必须从 node 子路径导入，避免浏览器拉入 Node 依赖。",
    "examples": [
      {
        "title": "接入并检查结果",
        "level": "配置",
        "environment": "Node.js",
        "ts": "import { createMockDuplex, bindMockDataChannel } from '@jangts/mock-gpt';\nimport { createMockWebSocketServer } from '@jangts/mock-gpt/node';\nexport async function loopback(mock: Parameters<typeof createMockDuplex>[0],\n  options: Parameters<typeof createMockWebSocketServer>[1]) {\n  const server = await createMockWebSocketServer(mock, options);\n  return server;\n}\nexport function memory(mock: Parameters<typeof createMockDuplex>[0],\n  options: Parameters<typeof createMockDuplex>[1]) {\n  return createMockDuplex(mock, options);\n}\nexport function dataChannel(mock: Parameters<typeof bindMockDataChannel>[0],\n  channel: Parameters<typeof bindMockDataChannel>[1],\n  options: Parameters<typeof bindMockDataChannel>[2]) {\n  return bindMockDataChannel(mock, channel, options);\n}"
      }
    ],
    "policies": []
  }
];
