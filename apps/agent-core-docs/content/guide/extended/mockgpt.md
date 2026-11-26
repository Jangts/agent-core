---
title: 用 MockGPT 做离线验证
description: 把 MockGPT 接入普通 ChatProvider、工具循环与 HTTP 测试，覆盖流式、故障和取消，而不依赖真实模型。
---

# 用 MockGPT 做离线验证

MockGPT 是 SDK 自带的模拟模型 Kit。它按规则返回固定内容、生成器结果或显式故障，适合验证协议、工具选择、流式输出、失败与取消。它不执行真实推理，也不能用来评价回答质量。

接口、生成器和错误码见 [MockGPT API](/manual/api/mock)；本文只讲怎么用、接到哪里、测试该断言什么。示例使用 TypeScript，去掉类型标注即为 JavaScript。

## 三种接入方式

| 要验证的东西 | 入口 | 说明 |
| --- | --- | --- |
| 一段生成逻辑 | `new MockGPT({ rules }).generate(...)` | 不创建 HTTP 对象，直接返回生成值 |
| Core 的模型调用 | `Support.CompatibleModelProvider` + `mock.fetch` | Core 只看到普通 `ChatProvider` |
| 现有 HTTP 客户端 | `createMockServer` 或 `createMockHandler` | 兼容 Chat Completions 路由，可挂到已有服务 |
| 浏览器或自建客户端 | 把 `mock.fetch` 作为 fetch 注入 | 不全局拦截网络 |

### 直接生成

```ts
import { MockGPT } from '@jangts/agent-core/mock';

const mock = new MockGPT({
  rules: [{ prompt: '你好', generator: '你好，这是离线回复。' }],
});
const output = await mock.generate({
  model: 'demo',
  messages: [{ role: 'user', content: '你好' }],
});
console.log(output);
```

`generate` 只负责生成值。需要状态码、SSE 或传输故障时，使用 `responses` 描述，由调用方解释。

### 接入 Core 的模型调用

```ts
import { ModelRunner, Support } from '@jangts/agent-core';
import { MockGPT } from '@jangts/agent-core/mock';

const mock = new MockGPT({ rules: [{ prompt: '你好', generator: '离线回复' }] });
const provider = new Support.CompatibleModelProvider({
  config: { baseUrl: 'https://mock.local/v1', apiKey: 'offline-example', model: 'demo' },
  ports: { request: mock.fetch },
});
const model = new ModelRunner({ provider });
const result = await model.invoke({ input: '你好' });
console.log(result.value, result.invocation.status);
```

Core 不感知 MockGPT，预算、取消和协议解析仍走正常路径。这样验证的是真实调用链，而不是另写一套测试分支。

### 作为 HTTP 服务

```ts
import { createMockServer } from '@jangts/agent-core/mock/node';
import { MockGPT } from '@jangts/agent-core/mock';

const mock = new MockGPT({ rules: [{ generator: '离线回复' }] });
const server = createMockServer({ mock });
const address = await server.listen({ port: 0 });
console.log(address.url);
await server.close();
```

只支持 `POST /v1/chat/completions` 与 `/chat/completions`，`n=1`。默认绑定回环地址；需要代理或跨域时显式配置 `allowedHosts`、`allowedOrigins`，不要用通配符。

## 用规则描述协议

- 规则按声明顺序匹配，第一条满足全部条件且未耗尽的规则生效。
- `prompt` 接受精确字符串或正则；`model` 限定模型名；`when(request)` 是同步布尔谓词；`times` 限制命中次数。
- 没有匹配时使用 `fallback`；仍然没有就以 `MOCK_RULE_NOT_FOUND` 失败，不会转发真实模型。
- 生成器可以是固定值、函数或 `responses.*`。回调能拿到 `request`、`match`、`callIndex`、`ruleIndex`、`signal`、`random`、`clock` 和 `report`。

```ts
import { MockGPT, generators } from '@jangts/agent-core/mock';

const mock = new MockGPT({
  rules: [
    { prompt: /总结/, generator: generators.summary({ maxChars: 120 }) },
    { prompt: '用户资料', generator: ({ callIndex }) => ({ callIndex }) },
  ],
  fallback: '没有匹配规则。',
});
```

一条规则对应一个可验证行为。规则越少、越具体，失败时越容易定位；不要把全部场景塞进一条宽泛的正则。

## 覆盖失败、流式与取消

```ts
import { MockGPT, responses } from '@jangts/agent-core/mock';

const mock = new MockGPT({
  rules: [
    { prompt: '限流', generator: responses.httpError(429, { error: { message: 'limited' } }) },
    { prompt: '断网', generator: responses.reject('模拟网络失败') },
    { prompt: '慢速', generator: responses.text('逐步输出', { chunkSize: 1, intervalMs: 10 }) },
    { prompt: '中断', generator: responses.text('会被截断', { chunkSize: 1, interruptAfter: 2 }) },
    {
      prompt: '查订单',
      generator: responses.toolCalls([{ name: 'lookup', arguments: { id: 'demo' } }]),
    },
  ],
});
```

- `responses.toolCalls` 只提出工具调用，不执行工具；授权和执行仍由 App 的工具注册负责。
- `interruptAfter` 在指定帧后中断，不发送成功结束标记。
- `delayMs` 控制首包延迟，`intervalMs` 控制帧间隔；两者都不会改变真实超时配置。
- 取消通过 `generate(input, { signal })` 或请求 signal 传入。已经发出的外部副作用不会自动回滚。

## 写回归测试

测试目标不是文案，而是协议和边界。可以断言：

- `mock.counts` 与 `mock.records`：规则命中、调用状态、错误码。
- `mock.activeRequests`：尚未完成的流。
- `generate` 返回值：文本、JSON 或 `ResponseDescription` 快照。
- `mock.fetch` 的 `Response` 状态、SSE 帧与中断行为。

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MockGPT, responses } from '@jangts/agent-core/mock';

test('无匹配规则时明确失败', async () => {
  const mock = new MockGPT({ rules: [] });
  await assert.rejects(
    mock.generate({ model: 'demo', messages: [{ role: 'user', content: '你好' }] }),
    (error) => (error as { code?: string }).code === 'MOCK_RULE_NOT_FOUND',
  );
});

test('工具提议不产生执行结果', async () => {
  const mock = new MockGPT({
    rules: [
      {
        prompt: '查订单',
        generator: responses.toolCalls([{ name: 'lookup', arguments: { id: 'demo' } }]),
      },
    ],
  });
  const output = await mock.generate({
    model: 'demo',
    messages: [{ role: 'user', content: '查订单' }],
  });
  assert.equal(mock.records.at(-1)?.status, 'completed');
  assert.ok(JSON.stringify(output).includes('lookup'));
});
```

不要断言真实语义质量、未固定的调用顺序或生成器内部的随机细节。这些不是 MockGPT 能证明的事实。

## 确定性

固定 `seed` 只有在调用顺序、`clock` 和回调外部状态也固定时才能逐字复现。并发测试各自创建实例，不共享记录和规则计数；有活动请求时 `reset()` 会以 `MOCK_ACTIVE` 拒绝。

## 边界

- **不联网**：默认不访问网络；`sources.web` 是显式可选能力，常规测试不要开启。
- **不转发真实模型**：没有匹配规则时失败，而不是悄悄请求真实接口。
- **不评价质量**：固定回复和文本算法只验证结构，不证明语义正确。
- **不替代权限**：工具提议、HTTP 状态和模型输出都不是授权。
- **不全局拦截 fetch**：只绑定 `mock.fetch`，避免影响同进程其他请求。

## 常见错误

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 总是命中第一条规则 | 规则按顺序优先 | 把更具体的规则放前面，或加 `model`、`when` |
| 重跑结果不一致 | `seed` 固定但顺序、时钟或外部状态不固定 | 固定调用顺序与 `clock`，隔离实例 |
| 测试访问了真实网络 | 启用了 web source 或注入了真实 fetch | 常规测试关闭 web source，只注入 `mock.fetch` |
| 工具真的被执行 | 把 `toolCalls` 当成了执行结果 | 执行仍由 App 的工具注册与授权完成 |

## 下一步

- 需要理解工具调用与回执的关系：读[工具接入](/manual/basic-usage)。
- 需要把离线验证纳入完整接入检查：[接入检查](/manual/acceptance)。
- 需要对照生成器、响应描述和 HTTP 细节：[MockGPT API](/manual/api/mock)。
