# MockGPT 模拟模型 Kit

MockGPT 用固定数据、函数及轻量文本算法模拟模型回复，适合调试协议、工具选择、流式输出、失败与取消。它不执行真实 LLM 推理。普通规则不联网；网页来源是显式的可选网络能力。

使用 `/mock`、`/mock/node`、`/mock/web` 前需安装 `@jangts/mock-gpt`；它是可选 peer 依赖，不会随本包自动安装。

## 入口与公开导出

| 入口 | 运行时导出 | 类型导出 |
| --- | --- | --- |
| `@jangts/agent-core/mock` | `MockGPT`、`generators`、`generatorNames`、`responses`、`ResponseDescription`、`MockGPTError`、`routes`、`encodeModelResponse` | `JsonValue`、`Message`、`ModelRequest`、`GenerationInput`、`GenerationOptions`、`GenerationContext`、`Generator`、`Generated`、`Rule`、`MockGPTOptions`、`CallRecord`、`ToolCall`、`OutputOptions`、`ModelOutput`、`HttpFault`、`Usage`、`TextSource`、`TextOptions` |
| `@jangts/agent-core/mock/node` | `createMockServer`、`createMockHandler` | `ServerOptions`、`HandlerOptions` |
| `@jangts/agent-core/mock/web` | `sources`、`isPublicAddress` | `WebOptions`、`LoadedPage`、`WebProfile` |

Node HTTP 与网页提取分别从子入口导入；根入口可在前端或服务端直接生成数据。三个入口转发同一实现，不另建规则协议。

## 从固定回复开始

### TypeScript

```ts
import { MockGPT, type MockGPTOptions } from '@jangts/agent-core/mock';

const options: MockGPTOptions = {
  rules: [{ id: 'greeting', prompt: '你好', generator: '你好，有什么可以帮你？' }],
};
const mock = new MockGPT(options);
const value = await mock.generate({
  model: 'demo', messages: [{ role: 'user', content: '你好' }],
});
console.log(value);
```

### JavaScript

```js
import { MockGPT } from '@jangts/agent-core/mock';
const mock = new MockGPT({
  rules: [{ prompt: '你好', generator: '你好，有什么可以帮你？' }],
});
console.log(await mock.generate({
  model: 'demo', messages: [{ role: 'user', content: '你好' }],
}));
```

`generate(input, options?) → Promise<Generated>`：input 包含 `model: string`、`messages: readonly Message[]`，可附加 JSON 条件字段；options 接受 `signal`。Message 有必需 role，以及 content、tool_calls、tool_call_id 和扩展字段。

返回值为字符串、原生 JSON 或显式 ResponseDescription 的独立冻结快照。generate 不创建 HTTP 响应，也不执行描述中的延迟、切片或故障；调用方自行解释描述。输入对象的可选 undefined 字段省略；数组空位、数组 undefined、循环引用和非 JSON 数据拒绝。输出同样必须是完整合法 JSON，不能含 undefined。

JSON 快照最多 64 层、100,000 个值节点；请求超限为 `MOCK_REQUEST`（400），生成结果超限为 `MOCK_GENERATION`。字段读取一次，不执行隐藏 `toJSON`；`__proto__` 等名称保留为普通自有数据字段。

`encodeModelResponse(request, output, id, created, signal, finish)` 将已校验的模型结果编码为 Chat Completions JSON／SSE Response。`created` 使用 Unix 秒；`finish(error?, cancelled?)` 在响应完成、失败或取消时调用。适配器负责请求校验、首包前延迟、ID 与生命周期，编码器负责内容分片、背压、工具、usage 与终止帧，不执行规则或修改 MockGPT 记录。

## 实例配置与规则

| MockGPTOptions | 语义／默认 |
| --- | --- |
| rules | 必需，有序 Rule 数组 |
| fallback | 可选 Generator；未匹配且无 fallback 时失败，不转发真实模型 |
| selectPrompt(request) | 同步返回匹配文本；默认取最后一条 user 消息中的文本块并按原顺序换行拼接 |
| stream | 实例默认 chunkSize=24、intervalMs=0，可选 wireChunkSize |
| seed | 随机初值，默认1；0至4294967295 |
| clock | 返回毫秒时间的函数，默认当前时间 |
| recordLimit | 最多保留记录数，默认100；0至10000 |
| maxBodyBytes | fetch 请求体字节上限，默认1048576，正安全整数 |
| maxOutputChars | 输出字符上限，默认1000000，正安全整数 |

Rule 的 `generator` 为必需；`id` 可省略，由位置生成，显式 ID 必须唯一。`prompt` 接受精确字符串或正则，`model` 限定模型名，`when(request)` 为同步布尔谓词，`times` 为正整数命中上限。声明顺序决定优先级，第一个满足全部条件且未耗尽的规则执行。

Generator 是 JSON／字符串／ResponseDescription，或 `(context) => Generated | Promise<Generated>`。context 包含冻结 request、投影 prompt、正则 match、全局 callIndex、当前规则命中 ruleIndex、signal、random、clock 和 report(metadata)。request 是含 model、messages、stream、可选 tools／stream_options 的标准请求。

命中时分配次数和序号，失败或取消不返还。固定 seed 只有在调用顺序、clock、回调和外部环境也固定时才能逐字复现。配置保存快照，回调闭包的外部状态仍归调用者负责。

## 输入相关生成器

所有生成器从 `generators` 获取，`generatorNames` 给出同一注册表中的名称。

| 方法 | 参数与结果 |
| --- | --- |
| summary(options?) | 提取代表句，默认最多240码点、3句 |
| bullets(options?) | 要点文本，默认最多500码点、3项 |
| keywords(options?) | 词频排序后的 JSON 字符串数组，count 默认3 |
| title(options?) | 首句标题，默认最多24码点 |
| reply(options?) | 模拟回复，默认最多500码点；可提供 template({ text, previous }) |
| extract(options?) | 返回字段对象；fields 为名称到正则的字典，取首捕获组或完整匹配，无匹配为 null；默认 email/date/amount |
| integer(min?, max?)／float(min?, max?) | 返回数字生成函数；整数默认0至100，浮点默认0至1 |
| boolean()／pick(items) | 返回布尔／选项生成函数；items 非空 |
| id(prefix?)／date()／sentence() | 返回 ID／ISO 日期／内置句子生成函数；ID 前缀默认 mock |
| imageUrl({ width?, height? }?) | 返回本地 SVG data URL 生成函数；默认320×180，边长1至4096 |
| sequence(items) | 按规则命中序号选择非空列表中的 Generator，耗尽失败 |
| toolCall(name, arguments, options?) | 生成显式工具提议，不执行工具 |

TextOptions 支持 `source: string | (context => string | Promise<string>)`、`maxChars`（1至30000）、`count`（1至100）；source 默认 prompt。summary／bullets 使用句子排序与重复控制，最多分析30000码点和180个分布候选句，超长来源按首／中／尾采样；其他文本生成器最多分析前30000码点。JSON 数组和对象不会为字符限制而截成非法 JSON。这些算法不提供语义推理准确率保证。

```ts
import { MockGPT, generators } from '@jangts/agent-core/mock';
const age = generators.integer(18, 60);
const mock = new MockGPT({
  seed: 42,
  rules: [
    { prompt: /总结/, generator: generators.summary({ maxChars: 120 }) },
    { prompt: '用户资料', generator: context => ({ age: age(context) }) },
  ],
});
```

上例也可直接作为 JavaScript。字段生成函数应在 generator 回调内用当前 context 求值，不能直接作为 JSON 字段返回。

## 显式响应与故障

`ResponseDescription` 通过 kind 与 value 区分 model、http、reject；普通 JSON 不会因字段同名而变成传输控制。

| helper | 输入／产物 |
| --- | --- |
| responses.text(content, options?) | 文本 ModelOutput 描述 |
| responses.toolCalls(tools, options?) | 工具数组描述，content=null；每项含 name、JSON arguments 和可选 id |
| responses.httpError(status, body?) | HTTP 400至599；默认 error.message 为模拟错误说明 |
| responses.reject(message?) | 网络失败描述 |

OutputOptions：`finishReason` 为 stop／length／tool_calls／content_filter；`usage` 含 prompt_tokens、completion_tokens、total_tokens，均为非负安全整数且总数相等。`delayMs` 首次响应延迟、`intervalMs` 帧间隔均默认0；`chunkSize` 控制内容／工具 delta 的码点数，`wireChunkSize` 再按字节切分 SSE；`interruptAfter` 在指定数据帧后中断，不发送成功结束标记。切片大小1至1000000，延迟／间隔0至60000毫秒，中断帧数0至60000。

```js
import { MockGPT, responses } from '@jangts/agent-core/mock';
const mock = new MockGPT({ rules: [
  { prompt: '限流', generator: responses.httpError(429, { error: { message: 'limited' } }) },
  { prompt: '中断', generator: responses.text('逐步输出', { chunkSize: 1, interruptAfter: 2 }) },
  { generator: responses.toolCalls([{ name: 'lookup', arguments: { id: 'demo' } }]) },
] });
```

## fetch 与流式协议

`mock.fetch(input, init?) → Promise<Response>` 是已绑定的标准 fetch 回调，可直接注入接受自定义 fetch 的客户端。`routes` 列出支持路由：POST `/v1/chat/completions` 和 `/chat/completions`。普通 JSON 返回单一 choice，普通 JSON 产物编码为 message.content 中的 JSON 文本；stream=true 返回 SSE。仅支持 n=1，显式 usage 只在请求 stream_options.include_usage 时进入 SSE 用量块，不估算真实 token。

```js
const response = await mock.fetch('https://mock.local/v1/chat/completions', {
  method: 'POST',
  body: JSON.stringify({ model: 'demo', messages: [{ role: 'user', content: '你好' }] }),
});
console.log(await response.json());
```

不全局拦截网络，不转发真实模型。HTTP 错误返回对应 Response；网络故障拒绝 fetch；流式中断由 response.body 读取失败表达。请求取消阻止未开始生成器并中止延迟、流和等待；已发出的外部副作用不自动回滚，自定义生成器应配合 signal。

## Node HTTP 服务

```ts
import { MockGPT } from '@jangts/agent-core/mock';
import { createMockServer } from '@jangts/agent-core/mock/node';
const mock = new MockGPT({ rules: [{ generator: '调试回复' }] });
const server = createMockServer({ mock });
const address = await server.listen({ port: 4317 });
console.log(address);
// 调试结束：await server.close();
```

JavaScript 使用同一写法。HandlerOptions 包含必需 mock、maxBodyBytes（默认1048576）、requestTimeoutMs（默认30000）、allowedHosts、allowedOrigins；ServerOptions 另有 closeTimeoutMs（默认1000毫秒）。`createMockHandler(options)` 返回 Node IncomingMessage／ServerResponse handler，可挂到现有 HTTP 服务。

`listen({ host?, port? }?)` 默认回环主机和4317端口，port=0 用于临时测试；返回 `{ host: string, port: number, url: string }`。关闭会取消在途请求并受关闭期限约束；启动中、监听中或关闭中重复 listen 以 MOCK_ACTIVE 拒绝；并发 close 等待同一关闭，关闭后可重新监听。

Host 先于 Origin 校验。默认仅接受 localhost、回环地址与连接到达的本地地址；绑定的显式主机名也可用。allowedHosts 显式列出代理主机名，不支持通配符；allowedOrigins 单独授权跨域来源，不放宽 Host。代理不能靠伪造 Origin 绕过目标校验。

## 网页来源

```js
import { MockGPT, generators } from '@jangts/agent-core/mock';
import { sources } from '@jangts/agent-core/mock/web';
const mock = new MockGPT({ rules: [{
  generator: generators.summary({ source: sources.web({
    url: 'https://example.com/', timeoutMs: 20000,
    fallback: '无法取得网页正文，请提供文字材料。',
  }) }),
}] });
```

`sources.web(options?) → TextSource` 获取 HTML 或纯文本、提取正文；不是浏览器，不登录、不携带 Cookie 或模型凭据。WebOptions：url 为固定 HTTP(S) URL 或同步 context 选择函数；省略时 prompt 必须只有一个 URL。profile 使用 browser；类型还接受 crawler（相同请求头）；headers 只用于受限内容协商。timeoutMs 默认20000，覆盖完整下载；maxBytes 默认2097152、maxChars 默认30000、maxRedirects 默认3。

只允许公网地址，DNS 与重定向逐跳检查；`isPublicAddress(address)` 返回地址可用性布尔值。拒绝本地、私网、特殊用途地址及带凭据 URL。fallback 是读取失败时的替代来源文本，仍经过文本生成器，记录 sourceFallback；取消、非法 URL 和目标地址拒绝不转为成功兜底。验证页、登录跳转、防火墙与上游 HTTP 失败保留真实原因。

可信 `load(url: URL, signal, maxBytes) → Promise<LoadedPage>` 可注入离线或自定义读取；LoadedPage 为 `{ bytes: Uint8Array, url: string, contentType: string, status?: number }`，省略 status 视为200。自定义 load 自行拥有目标访问策略，不能由远端请求注入。

## 记录、取消与错误

`mock.records` 返回 CallRecord 快照：id、index、model、可选 path／ruleId、fallback、status（pending/completed/error/cancelled）、可选 errorCode、metadata。默认不保存请求和生成正文，report 仅接受有界 JSON 元数据。`mock.counts` 返回规则命中数，`activeRequests` 包含尚未完成的流。`reset()` 清记录、计数、随机状态；有活动请求或流时以 MOCK_ACTIVE 拒绝。

MockGPTError 带 code、status 及可选 details。常见代码：MOCK_CONFIG 配置无效、MOCK_REQUEST 请求无效、MOCK_BODY_LIMIT／MOCK_OUTPUT_LIMIT 超预算、MOCK_RULE_NOT_FOUND 无匹配、MOCK_SEQUENCE_EXHAUSTED 序列耗尽、MOCK_NETWORK 网络故障、MOCK_HTTP 模拟HTTP故障、MOCK_ACTIVE 活动生命周期冲突。取消保留调用者 signal 原因；fetch 可将可响应错误编码为 error 响应，自定义生成器异常记录为失败，不伪造成功内容。

这些预算限制模拟执行，不替代 Agent 的真实模型／工具预算与权限。工具提议始终由调用方授权和执行；手写损坏 SSE、非法字节等底层负例仍由专用 fixture 表达。
