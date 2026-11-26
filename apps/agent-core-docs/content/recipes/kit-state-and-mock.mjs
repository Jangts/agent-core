// Agent Core 文档站的 Kit 状态与模拟类配方：产物解析、Durable 检查点，以及 MockGPT
// 的生成、响应描述、Node 服务与网页来源。默认导出配方数组，由 kits.mjs 汇总。
const sample = (title, level, ts, note) => ({
  title,
  level,
  environment: 'Node.js',
  ts,
  ...(note ? { note } : {}),
});

const durableStore = `import { Durable } from '@jangts/agent-core/kits/durable';
import type { DurableCheckpoint, DurableStore } from '@jangts/agent-core/kits/durable';
type State = { count: number };
const records = new Map<string, DurableCheckpoint<State>>([
  ['demo-task', { version: 2, definitionId: 'count', revision: '1', nextStepIndex: 0, attemptCount: 0, maxAttempts: 3, deadlineAtMs: Date.now() + 60_000, status: 'ready', state: { count: 0 } }],
]);
let tail = Promise.resolve();
// 隔离示例：进程内串行锁和内存记录，不是生产持久化实现。
const store: DurableStore<State> = {
  exclusive(_id, operation) { const result = tail.then(operation); tail = result.then(() => {}, () => {}); return result; },
  async load(id) { const record = records.get(id); return record && structuredClone(record); },
  async save(id, record) { records.set(id, structuredClone(record)); },
};
const isState = (value: unknown): value is State => !!value && typeof value === 'object' && 'count' in value && typeof value.count === 'number';`;

export default [
  {
    id: 'kit-artifacts',
    title: 'Artifacts：按引用解析真实产物',
    layer: 'kit',
    matches: ['Artifacts', 'defineArtifactCatalog'],
    summary: '引用只包含 resolverId、artifactId 和可选 revision，真实内容由 App 的解析器提供。',
    details: `defineArtifactCatalog(resolvers) 返回只读目录与异步 resolve(reference,context)。空身份、未知 resolverId、非函数 resolver 会拒绝。引用先形成快照，解析器接收同一引用及 App/取消/诊断上下文；等待期间或解析结束后取消，不作为成功返回。

产物 ID 或 revision 本身不是文件路径、访问权限、内容真实性证明或发布回执。解析器必须检查当前调用者、真实保存状态、版本和到期，返回 App 定义的 Value。Kit 不保存文件、不创建下载接口，也不保证仅凭引用即可交付给用户。`,
    examples: [
      sample(
        '先解析一个明确的内存产物',
        '入门',
        `import { Artifacts } from '@jangts/agent-core/kits/artifacts';
const content = new Map([['manual', { text: 'Agent Core 使用说明', revision: '1' }]]);
const artifacts = Artifacts.defineArtifactCatalog([
  { id: 'document', resolve(reference) { const value = content.get(reference.artifactId); if (!value) throw new Error('产物不存在'); return value; } },
]);
const result = await artifacts.resolve({ resolverId: 'document', artifactId: 'manual' }, { app: {}, signal: new AbortController().signal });
console.log(result.text);`,
      ),
      sample(
        '相同 resolve 增加真实权限与版本核对',
        '配置',
        `import { Artifacts } from '@jangts/agent-core/kits/artifacts';
type Value = { text: string; revision: string };
type App = { canRead: boolean; documents: Map<string, Value> };
const artifacts = Artifacts.defineArtifactCatalog<Value, App>([
  { id: 'document', async resolve(reference, { app, signal }) {
    signal.throwIfAborted();
    if (!app.canRead) throw new Error('没有产物读取权限');
    const value = app.documents.get(reference.artifactId);
    if (!value) throw new Error('产物不存在或已到期');
    if (reference.revision && reference.revision !== value.revision) throw new Error('产物版本已变化');
    return structuredClone(value);
  } },
]);
const app = { canRead: true, documents: new Map([['manual', { text: 'Agent Core 使用说明', revision: '1' }]]) };
console.log(await artifacts.resolve({ resolverId: 'document', artifactId: 'manual', revision: '1' }, { app, signal: new AbortController().signal }));`,
      ),
    ],
    policies: [
      {
        title: '引用快照、解析器登记和取消',
        file: 'src/kits/artifacts.ts',
        symbols: ['snapshotArtifactReference', 'defineArtifactCatalog'],
      },
    ],
  },
  {
    id: 'kit-durable',
    title: 'Durable：显式检查点与受控恢复',
    layer: 'kit',
    matches: ['Durable', 'defineDurableTask', 'durableStatuses', 'durableReplayPolicies'],
    summary: 'App 提供实际检查点存储和排他锁，任务沿同一定义与累计额度显式运行或恢复。',
    details: `defineDurableTask({id,revision,isState,steps}, options?) 返回 run({taskId,store},context)。store 必须提供跨所有写者有效的 exclusive、load、save。检查点 version=2，包含 definitionId/revision、nextStepIndex、attemptCount/maxAttempts、deadlineAtMs、status 和 state；必须由 App 创建，任务不会自动 seed 或查找业务。

ready 开始下一步，running 表示该步曾中断，completed 校验后返回结果，cancelled 拒绝。safe 表示这一步允许重做；reconcile 表示中断后必须走 reconcile，缺少时拒绝。尝试数在 handler 前累加并保存，成功后保存新状态和下一步；恢复不重置累计次数或 deadline。每次保存都在锁内等待，但取消不能撤销已经发生的外部提交。

App 通过显式调用启动或恢复任务，并提供持久存储、幂等键、副作用对账、重新授权和存储事务。`,
    examples: [
      sample(
        '先用隔离内存检查点理解一次执行',
        '入门',
        durableStore +
          `
const task = Durable.defineDurableTask<State, undefined>({
  id: 'count', revision: '1', isState,
  steps: [{ id: 'increment', replayPolicy: 'safe', async run(state) { return { count: state.count + 1 }; } }],
});
const context = { app: undefined, signal: new AbortController().signal };
console.log(await task.run({ taskId: 'demo-task', store }, context));
console.log(records.get('demo-task')?.attemptCount);`,
        '这是最小存储合同的隔离演示；真正跨进程/跨请求恢复必须换成具备排他与持久保证的 App store。',
      ),
      sample(
        '同一 run 增加中断后的真实对账策略',
        '配置',
        durableStore +
          `
// 假设业务服务以 taskId 为幂等键保存真实提交结果；这里用内存 Map 演示。
const committed = new Map<string, number>();
const task = Durable.defineDurableTask<State, { key: string }>({
  id: 'count', revision: '1', isState,
  steps: [{ id: 'commit', replayPolicy: 'reconcile',
    async run(state, { app }) {
      const value = committed.get(app.key) ?? state.count + 1;
      committed.set(app.key, value);
      return { count: value };
    },
    async reconcile(state, { app }) {
      const value = committed.get(app.key);
      if (value === undefined) throw new Error('没有可核实的提交结果，需要 App 决定后续动作');
      return { count: value };
    },
  }],
});
const context = { app: { key: 'demo-task' }, signal: new AbortController().signal };
console.log(await task.run({ taskId: 'demo-task', store }, context));
console.log(await task.run({ taskId: 'demo-task', store }, context)); // 已完成记录不会再次执行步骤
console.log(committed.size);`,
        '示例不擅自把“无法确认是否提交”解释成失败或重新执行；生产对账需查询真实业务系统。',
      ),
    ],
    policies: [
      {
        title: '状态、累计预算、期限和对账顺序',
        file: 'src/kits/durable.ts',
        symbols: ['defineDurableTask', 'assertActive', 'snapshotCheckpoint'],
      },
      {
        title: '当前状态与重放策略枚举',
        file: 'src/structs/kits/durable.ts',
        symbols: ['durableStatuses', 'durableReplayPolicies'],
      },
    ],
  },
  {
    id: 'kit-mock-generation',
    title: 'MockGPT：直接生成与 Provider 注入',
    layer: 'kit',
    matches: [
      'MockGPT',
      'MockGPT.generate',
      'MockGPT.fetch',
      'MockGPT.records',
      'MockGPT.counts',
      'MockGPT.activeRequests',
      'MockGPT.reset',
      'MockGPTError',
      'routes',
    ],
    summary: '直接取得字符串或 JSON；需要检验模型通信时，将同一个实例注入 Provider。',
    details: `从 @jangts/agent-core/mock 导入，不需要单独安装模拟器。new MockGPT({rules,fallback?,seed?,clock?,recordLimit?,maxBodyBytes?,maxOutputChars?,stream?,selectPrompt?}) 固定配置。规则依次匹配 prompt、model、同步 when，times 限制命中次数；字符串精确匹配，RegExp 可捕获分组。函数生成器收到冻结的 request、prompt、match、signal、callIndex、ruleIndex、random、clock 和 report。

await mock.generate({model,messages,...fields},{signal?}) 返回字符串、原生 JSON 或显式 ResponseDescription 的独立冻结快照。直接调用不创建 HTTP 对象，也不执行描述的延迟、SSE 或 HTTP 故障；描述由调用方解释。输入可选对象字段 undefined 会省略，数组空槽、数组 undefined、循环引用与非 JSON 数据拒绝；输出 undefined 不省略。JSON 快照最多64层、100000个值节点，请求超限为 MOCK_REQUEST（400），生成结果超限为 MOCK_GENERATION；字段只读取一次，不执行隐藏 toJSON，原型名称作为普通自有数据字段保留。失败或取消不归还已分配的规则次数。

mock.fetch 是已绑定的标准 fetch 适配，可注入 Support.CompatibleModelProvider。routes 声明 /v1/chat/completions 与 /chat/completions；只接受 POST，支持 JSON 与 stream=true SSE、一个 choice。它不全局拦截请求，也不转发真实模型。

records 是有界内存元数据快照，默认100条，recordLimit=0关闭；counts 是规则命中数，activeRequests 包括未消费的 SSE。活动请求存在时 reset 拒绝，空闲时清空记录、计数及 seed，不重置自定义闭包。固定 seed 与 clock 适合确定性测试，不代表真实模型质量、延迟或容量。错误以 MockGPTError.code 和 details 区分：配置、请求、未匹配、输出、取消和传输边界。`,
    examples: [
      sample(
        '直接生成原生 JSON',
        '入门',
        `import { MockGPT } from '@jangts/agent-core/mock';
const mock = new MockGPT({ rules: [{ prompt: '服务状态', generator: { online: true, source: 'fixture' } }] });
const value = await mock.generate({ model: 'demo', messages: [{ role: 'user', content: '服务状态' }] });
console.log(value); // { online: true, source: 'fixture' }
console.log(mock.counts, mock.records);`,
      ),
      sample(
        '同一实例注入真实 Core 模型边界',
        '配置',
        `import { ModelRunner, Support } from '@jangts/agent-core';
import { MockGPT, responses } from '@jangts/agent-core/mock';
const mock = new MockGPT({ rules: [{ prompt: '服务状态', generator: responses.text('服务在线。', { chunkSize: 2, wireChunkSize: 3 }) }] });
const provider = new Support.CompatibleModelProvider({
  config: { baseUrl: 'https://mock.local/v1', apiKey: 'offline-example', model: 'demo' },
  ports: { request: mock.fetch },
});
const result = await new ModelRunner({ provider, maxCalls: 1 }).invoke('服务状态');
console.log(result.value, result.invocation.status);`,
      ),
    ],
  },
  {
    id: 'kit-mock-responses',
    title: 'MockGPT：响应描述与场景生成器',
    layer: 'kit',
    matches: [
      'responses',
      'responses.text',
      'responses.toolCalls',
      'responses.httpError',
      'responses.reject',
      'ResponseDescription',
      'generators',
      'generatorNames',
      'encodeModelResponse',
    ],
    summary: '固定结果用于严格回归，输入相关生成器用于探索接线，显式响应描述用于故障和流式场景。',
    details: `responses.text(text,options?)、toolCalls([{name,arguments,id?}],options?)、httpError(status,body)、reject(message) 返回 ResponseDescription。普通 JSON 不会因为字段相似就成为传输指令。HTTP 故障状态必须为400—599且有 body，工具提议必须提供 arguments；直接构造 ResponseDescription 也执行相同规则校验。

OutputOptions 提供 delayMs、chunkSize、intervalMs、wireChunkSize、interruptAfter、finishReason、usage。内容分片按码点，wireChunkSize 按编码字节；中断不补成功终止帧。generate 返回描述本身；fetch 解释描述并在 stream=true 时输出 SSE。usage 只能显式提供，不估计真实 token。

generatorNames 与 generators 来自同一清单。integer、float、boolean、pick、id、date、sentence、imageUrl 返回值生成函数，在自定义 generator 内用同一 context 求值。sequence 按规则实例命中顺序选择，耗尽拒绝；toolCall 生成提议，不执行工具。

summary、bullets、keywords、title、extract、reply 接受可选 source（字符串或上下文函数），缺省使用 prompt。摘要采用代表句排序和重复控制，不进行 LLM 改写；summary 默认240码点、bullets/reply 500、title 24，summary/bullets 默认3项。摘要最多分析30000码点和180个分布候选句，超长文本按首中尾采样；关键词输出数组，提取缺失值为 null。来源、模板和 options 在构造时形成快照，回调闭包仍由 App 管理。`,
    examples: [
      sample(
        '编码已校验的模型结果',
        '扩展',
        `import { encodeModelResponse } from '@jangts/agent-core/mock';
const controller = new AbortController();
const response = encodeModelResponse(
  { model: 'demo', messages: [{ role: 'user', content: '状态' }], stream: false },
  { content: '服务在线。' }, 'mock-1', 1700000000, controller.signal,
  (error, cancelled) => console.log({ error, cancelled }),
);
console.log(await response.json());`,
        '适配器负责请求校验、首包前延迟和生命周期；编码器不执行规则或修改 MockGPT 调用记录。',
      ),
      sample(
        '从输入生成可检查的摘要',
        '入门',
        `import { MockGPT, generators } from '@jangts/agent-core/mock';
const mock = new MockGPT({ rules: [{ generator: generators.summary({ maxChars: 120, count: 2 }) }] });
console.log(await mock.generate({ model: 'demo', messages: [{ role: 'user', content: '服务刚完成维护。健康检查通过。用户可以查询状态。' }] }));
console.log(mock.records);`,
      ),
      sample(
        '字段生成器复用同一随机源',
        '配置',
        `import { MockGPT, generators, generatorNames } from '@jangts/agent-core/mock';
const id = generators.id('user');
const age = generators.integer(18, 60);
const mock = new MockGPT({ seed: 42, clock: () => 1700000000000, rules: [{
  generator: context => ({ id: id(context), age: age(context) }),
}] });
console.log(await mock.generate({ model: 'demo', messages: [{ role: 'user', content: '生成资料' }] }));
console.log(generatorNames);`,
      ),
      sample(
        '按相同请求顺序模拟错误和恢复',
        '扩展',
        `import { MockGPT, generators, responses, ResponseDescription } from '@jangts/agent-core/mock';
const mock = new MockGPT({ rules: [{ prompt: '服务状态', generator: generators.sequence([
  responses.httpError(429, { error: { message: 'limited' } }),
  responses.text('服务在线。', { chunkSize: 2 }),
]) }] });
const input = { model: 'demo', messages: [{ role: 'user', content: '服务状态' }] };
const first = await mock.generate(input);
console.log(first instanceof ResponseDescription); // true；generate 不执行 HTTP 故障
const response = await mock.fetch('https://mock.local/v1/chat/completions', { method: 'POST', body: JSON.stringify(input) });
console.log(await response.json());`,
      ),
    ],
  },
  {
    id: 'kit-mock-node',
    title: 'MockGPT Node：最小模型服务与 HTTP 挂载',
    layer: 'kit',
    matches: ['createMockServer', 'createMockHandler'],
    summary: '同一 MockGPT 配置作为独立模型 API，或挂入现有 Node HTTP 服务。',
    details: `@jangts/agent-core/mock/node 是 Node 专用入口。createMockServer({mock,maxBodyBytes?,requestTimeoutMs?,allowedOrigins?,allowedHosts?,closeTimeoutMs?}) 返回 listen({host?,port?}) 与 close。createMockHandler 使用相同请求策略，返回 Node IncomingMessage/ServerResponse 处理器，宿主拥有监听和关闭。

默认仅接受回环、本次连接到达的本地地址和显式绑定的主机名。Host 先于 Origin 校验，allowedHosts 是精确主机名/IP，不接受通配符；allowedOrigins 单独允许跨域，不能放行非法 Host。请求体、超时和关闭等待有界。listen 在启动、监听或关闭过程中重复调用会以 MOCK_ACTIVE 拒绝，close 等待启动及同一次关闭，结束后可重新监听。

HTTP 外壳将生成错误转换为带 code 的错误响应；responses.reject 关闭连接，区别于显式 HTTP 错误。未匹配且没有 fallback 时失败，不连接真实模型。模拟服务不提供业务鉴权；对外暴露由宿主配置访问边界。`,
    examples: [
      sample(
        '启动最小模型 API，用完关闭',
        '入门',
        `import { MockGPT } from '@jangts/agent-core/mock';
import { createMockServer } from '@jangts/agent-core/mock/node';
const mock = new MockGPT({ rules: [{ prompt: '你好', generator: '你好。' }] });
const server = createMockServer({ mock });
try {
  const address = await server.listen({ host: '127.0.0.1', port: 0 });
  console.log(address);
  // 将输出地址的 /v1 作为模型客户端 base URL。
} finally { await server.close(); }`,
      ),
      sample(
        '挂入已有 Node HTTP 生命周期',
        '配置',
        `import { createServer } from 'node:http';
import { MockGPT } from '@jangts/agent-core/mock';
import { createMockHandler } from '@jangts/agent-core/mock/node';
const mock = new MockGPT({ rules: [{ generator: '演示回复' }] });
const handler = createMockHandler({ mock, requestTimeoutMs: 5000 });
const server = createServer(handler);
server.listen(4317, '127.0.0.1');
// 宿主退出时关闭 server；需要自定义域名时显式配置 allowedHosts。`,
      ),
    ],
  },
  {
    id: 'kit-mock-web',
    title: 'MockGPT Web：可信来源与本地摘要',
    layer: 'kit',
    matches: ['sources', 'sources.web', 'isPublicAddress'],
    summary: '从真实网页或可信 load 取得正文，再交给输入相关生成器。',
    details: `@jangts/agent-core/mock/web 是 Node 专用入口。sources.web({url?,profile?,headers?,timeoutMs?,maxBytes?,maxChars?,maxRedirects?,fallback?,load?}) 返回供文本生成器使用的来源。默认从 prompt 取得唯一 URL；普通生成器不联网。默认总期限20000毫秒、2MiB、30000码点和3次重定向。正文先排除脚本/模板，再用 Readability 提取，不执行页面 JS、登录或读取 PDF。

默认抓取逐跳校验协议、DNS 地址和重定向，固定实际连接地址，拒绝本机/私网/保留目标；isPublicAddress 只判断单个地址，不是完整 URL 授权器。压缩前后均限大小。headers 不允许 Host、Cookie 或 Authorization 覆盖，不传递模型凭据。

load(url,signal,maxBytes) 是可信配置端口，返回 {bytes,url,contentType}；注入者拥有目标地址与传输安全责任，不能接受远程请求任意提供该函数。读取失败默认抛错，显式 fallback 仅承接允许降级的网页读取失败，再作为来源文本交给生成器；取消、非法 URL 和目标地址拒绝不转为兜底成功。sourceError、sourceFallback、webStage、receivedBytes 等记录区分失败、替代文本与实际正文，不能把验证页或登录页说成读取成功。实时网页变化不由 seed 固定。`,
    examples: [
      sample(
        '可信 load 提供离线正文',
        '入门',
        `import { MockGPT, generators } from '@jangts/agent-core/mock';
import { sources, isPublicAddress } from '@jangts/agent-core/mock/web';
const source = sources.web({ url: 'https://example.com/article', async load(url, signal, maxBytes) {
  signal.throwIfAborted();
  const bytes = new TextEncoder().encode('服务维护完成。健康检查通过。');
  if (bytes.byteLength > maxBytes) throw new Error('来源超过预算');
  return { bytes, url: url.href, contentType: 'text/plain; charset=utf-8' };
} });
const mock = new MockGPT({ rules: [{ generator: generators.summary({ source }) }] });
console.log(await mock.generate({ model: 'demo', messages: [{ role: 'user', content: '概括正文' }] }));
console.log(isPublicAddress('127.0.0.1')); // false`,
      ),
      sample(
        '显式开启网页来源与失败替代文本',
        '配置',
        `import { MockGPT, generators } from '@jangts/agent-core/mock';
import { sources } from '@jangts/agent-core/mock/web';
const mock = new MockGPT({ rules: [{ generator: generators.summary({ source: sources.web({
  url: 'https://example.com/article', timeoutMs: 5000,
  fallback: '网页不可读取，请提供正文。',
}) }) }] });
console.log(await mock.generate({ model: 'demo', messages: [{ role: 'user', content: '总结文章' }] }));
console.log(mock.records); // 检查 sourceFallback/sourceError，不把替代文本当原文`,
      ),
    ],
  },
];
