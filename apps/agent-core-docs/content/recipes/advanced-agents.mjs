// Agent Core 文档站的高级场景配方：子任务组合、日志复盘、Agent 分支与知识发布。
// 示例代码优先复用 SDK 手册中的类型示例，只在此声明页面标题、说明与策略源码入口。
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sdkRoot } from '../../scripts/paths.mjs';

// Reuse the SDK handbook's integration examples rather than maintain competing
// definitions of the same authorization and storage contracts.
const manual = await readFile(
  path.join(sdkRoot, 'development/docs/api/advanced-agents.md'),
  'utf8',
);
function handbookExample(heading) {
  const section = manual.split('## ' + heading + '\n')[1]?.split('\n## ')[0];
  const code = section?.match(/```ts\n([\s\S]*?)```/)?.[1];
  if (!code) throw new Error(`Missing typed handbook example: ${heading}`);
  return code;
}
const example = (title, level, ts, note) => ({ title, level, ts, note, environment: 'Node.js' });
const children = `import { ModelRunner, Support } from '@jangts/agent-core';
import type { ChatProvider } from '@jangts/agent-core';

export async function analyze(provider: ChatProvider, inputs: readonly [string, string], signal: AbortSignal) {
  const model = new ModelRunner({ provider, maxCalls: 5, execution: { signal } });
  return Support.runChildren(model, inputs.map((input, index) => ({
    id: 'analysis-' + index, maxCalls: 2, reserveCalls: 1, timeoutMs: 30000, interactions: [],
    async run(child: ModelRunner) { return (await child.invoke(input)).value; },
  })), {
    accept(value) { if (!value.trim()) throw new Error('分析结果为空'); },
  });
}`;

/**
 * Support 层的场景配方：用 runChildren 组合子任务、共享预算并按声明顺序提交结果。
 * 由 core-support.mjs 汇总后交给 generate.mjs 渲染为 /recipes 页面。
 */
export const supportRecipes = [
  {
    id: 'child-composition',
    title: '子任务组合：顺序执行与受控并行',
    layer: 'support',
    matches: ['runChildren', 'ModelChildTask', 'ModelChildrenOptions', 'ModelChildPolicy'],
    summary: '复用 createChild 和共享预算，检查全部结果后按声明顺序提交。',
    details: `runChildren 的并发数默认取根 Runner 的 maxConcurrentCalls。每项任务显式配置可见传输、调用上限和父级保留额度，结果数组保持声明顺序。

accept 检查每项结果；全部接受后才调用可选 commit。失败会取消同组任务，迟到结果不能提交。需要整体事务时，由 App 在真实事务中处理返回数组；已发生的提交不因取消而回滚。`,
    examples: [
      example('顺序分析两段资料', '入门', children),
      example(
        '同一组分析增加并发容量',
        '配置',
        children.replace(
          'execution: { signal }',
          'execution: { signal }, children: { maxConcurrentCalls: 2 }',
        ),
        '同一个函数与任务清单，只增加根 Runner 的容量配置。局部预算和父级预留仍生效。',
      ),
    ],
    policies: [
      {
        title: '子任务接受、取消与顺序提交',
        file: 'src/support/model/children.ts',
        symbols: ['runChildren'],
      },
    ],
  },
];

/**
 * Kit 层的场景配方：复盘证据源、Agent 分支版本与知识候选发布。
 * 每条配方声明命中符号、说明、示例与对应策略源码，供文档站生成示例页与关联链接。
 */
export const kitRecipes = [
  {
    id: 'execution-reflection',
    title: '日志复盘：授权元数据与证据报告',
    layer: 'kit',
    matches: [
      'Reflection',
      'defineReflection',
      'defineReflectionLogSource',
      'reflectionFindingKinds',
      'reflectionIdentityFields',
      'ReflectionLogReader',
    ],
    summary: 'App 提供获准证据源，复盘任务通过普通模型与工具合同生成有来源的报告。',
    details: `source 对每次查询检查真实身份与可见范围。模型通过 history.query 读取证据，再提交 observed、hypothesis 或 recommendation；observed 必须引用本次实际读到的证据 ID。

报告保留不完整与缺失说明，默认 persisted=false。读取许可、交给模型处理与披露结果分别由 App 决定；元数据适配器不传原始日志正文。`,
    examples: [
      example('绑定复盘模型、证据源和授权', '入门', handbookExample('元数据复盘')),
      example(
        '从日志 reader 构造同一种证据源',
        '配置',
        `import { defineReflectionLogSource } from '@jangts/agent-core/kits/reflection';
import type { ReflectionLogReader } from '@jangts/agent-core/kits/reflection';
import type { OperationContext } from '@jangts/agent-core';

export function logSource<App>(reader: ReflectionLogReader, traceId: string,
  authorize: (context: OperationContext<App>) => Promise<void>) {
  return defineReflectionLogSource({ reader, traceId, id: 'authorized-history', authorize });
}`,
        'reader 的目录范围、关闭与保留期由 App 管理。适配后的 source 可传入同一个 defineReflection。',
      ),
    ],
    policies: [
      {
        title: '复盘证据引用和报告检查',
        file: 'src/kits/reflection.ts',
        symbols: ['defineReflection'],
      },
    ],
  },
  {
    id: 'agent-family',
    title: 'Agent 分支：版本、合并与显式启用',
    layer: 'kit',
    matches: [
      'BranchVersions',
      'defineBranchVersioning',
      'branchVersionOperations',
      'BranchVersionStore',
      'BranchVersionRecord',
      'BranchVersion',
    ],
    summary: '在真实 CAS 存储上管理数据分支，候选版本经检查和授权后显式启用。',
    details: `create 建立初始版本，fork 根据真实父分支身份保存候选，merge 通过 App 的三方合并器检查冲突，promote 显式切换 activeId。候选的 base 必须仍是当前 active。

BranchVersionStore.compareAndSwap 原子提交版本集合和 activeId。读取权限由 store 执行，变更通过 authorize 与 validate 检查。数据版本不携带运行中的函数、工具实例或权限；使用版本时由 App 重新装配依赖。`,
    examples: [
      example('配置状态检查、来源验证和三方合并', '配置', handbookExample('持久分支与显式启用')),
      example(
        '显式启用已批准的候选版本',
        '扩展',
        `import type { BranchVersioning } from '@jangts/agent-core/kits/branch-versioning';
import type { OperationContext } from '@jangts/agent-core';

export async function activate<State, App>(family: BranchVersioning<State, App>, id: string,
  candidateId: string, context: OperationContext<App>) {
  const record = await family.read(id, context);
  return family.promote({ id, revision: record.revision, candidateId,
    expectedActiveId: record.activeId }, context);
}`,
        'App 在真实审批后调用；promote 仍重新执行来源、授权、版本和 CAS 检查。',
      ),
    ],
    policies: [
      {
        title: '分支版本冲突与启用检查',
        file: 'src/kits/family.ts',
        symbols: ['defineBranchVersioning'],
      },
    ],
  },
  {
    id: 'knowledge-publication',
    title: '知识候选：编译检查与显式发布',
    layer: 'kit',
    matches: [
      'defineKnowledgePublication',
      'knowledgePublicationOperations',
      'KnowledgePublication',
      'KnowledgePublicationStore',
    ],
    summary: '候选准备与发布复用 Knowledge 编译器，真实存储通过 CAS 提交正式资料。',
    details: `propose 检查完整替换后的资料集合，只写候选。publish 重新核对授权、来源、有效期及 publishedRevision，再原子替换正式集合。reject 删除候选。

store.revision 协调全部写入，publishedRevision 标识正式集合变化。正文或元信息发生变化时，文档需要新的 revision。普通知识读取使用 documents，候选不进入事实目录。`,
    examples: [
      example(
        '绑定资料存储与来源授权',
        '入门',
        `import { defineKnowledgePublication } from '@jangts/agent-core/kits/knowledge';
import type { KnowledgePublicationOptions } from '@jangts/agent-core/kits/knowledge';

export function publication<App>(store: KnowledgePublicationOptions<App>['store'],
  authorize: KnowledgePublicationOptions<App>['authorize'],
  verifySources: KnowledgePublicationOptions<App>['verifySources']) {
  return defineKnowledgePublication({ store, authorize, verifySources, maxReadChars: 12000 });
}`,
      ),
      example(
        '发布已批准的候选资料',
        '配置',
        `import type { KnowledgePublication } from '@jangts/agent-core/kits/knowledge';
import type { OperationContext } from '@jangts/agent-core';

export async function publish<App>(publication: KnowledgePublication<App>, candidateId: string,
  context: OperationContext<App>) {
  const record = await publication.read(context);
  return publication.publish({ revision: record.revision, candidateId }, context);
}`,
        '在 App 的真实审批流程后调用。来源变化、候选过期或版本冲突会拒绝提交。',
      ),
    ],
    policies: [
      {
        title: '资料候选编译、来源检查与 CAS 发布',
        file: 'src/kits/knowledge/publication.ts',
        symbols: ['defineKnowledgePublication'],
      },
    ],
  },
];
