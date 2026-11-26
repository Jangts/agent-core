# 持久等待与继续

[English](harness-durable.en.md) · [源码](harness-durable.mjs)

这是甲计划 R2 的有界参考组合：App 先完成产物任务，然后打开持久确认门；等待正常返回并释放请求。新进程重建存储、当前授权和 gate，消费确认后执行独立保存任务。它不恢复调用栈，也不为 Core 增加暂停协议。

在 `main/` 使用 Node 22.12 及以上和已有最新包产物运行：

```sh
node development/examples/harness-durable.mjs
node --test test/waiting.test.mjs
```

示例不构建、不联网、不调用模型或私有数据库。它在主仓库 `.tmp/` 建立临时文件存储，启动四个新的 Node 进程，结束后删除本次 fixture。导入模块不会启动进程；可调用 `runDurableExample()`。源码和产物不一致时先停止，交由统一构建更新。

## 可观察的过程

1. 第一个进程完成 prepare Durable 任务，把草稿和任务完成事实保存；`defineWaitGate.open` 保存 pending 等待，App 返回 `{ status: 'waiting' }`。此时最终保存尚未发生。
2. 第二个进程用新的当前身份和授权重建接口，调用 `respond` 两次相同 submission；第二次返回首次记录。App 读取完成的 prepare 结果和 resolved 确认，才执行 save Durable 任务。保存端口已持久写入后，模拟一次响应丢失；App 返回明确的 unknown，save 检查点仍是 running、attemptCount 为 1。
3. 第三个进程重新装配当前授权和端口，实际进入 save 的 reconcile，读取真实保存回执，返回 completed。确认计数作为完成状态持久保存为 1，且不增加执行尝试或重新保存产物。
4. 第四个进程将已完成任务的执行期限设为过去，再运行同一 App 入口。Durable 的授权读取返回相同成果，没有重新产草稿或保存。

输出包含四个进程 PID、等待与最终成果，以及 `artifactWrites: 1`、`savedWrites: 1`、`confirmationCount: 1`。两个任务的 attemptCount 均断言为 1。示例中的等待不通过抛错实现，也不把等待当成 Durable 的失败尝试。

## Wait Gate 合同

从 `@jangts/agent-core/kits/waiting` 导入 `defineWaitGate`。App 必须提供 `exclusive/load/save`、同步纯 `isAnswer` 和当前 `authorize`。Core 不读取 pending／resolved／cancelled 等局部状态。

- `identity` 为 `{ taskId, waitId, subject }`，waitId 区分等待代次，App 必须为每次新等待提供不复用的 waitId。存储槽由 gate 定义 ID 和 taskId 定位，记录绑定定义 revision。gate 仅保存当前槽，不维护所有历史 waitId 的去重清单；身份文本不授予权限。
- `open({ identity, expiresAtMs })` 创建等待；相同身份和期限的重复调用返回原记录。不同等待只能以 `previousWaitId` 显式替换相同主体的终态槽；不能覆盖 pending。存储不能把任务 ID 复用于无关工作。
- `read(identity)` 只查询，`cancel(identity)` 将 pending 变为 cancelled。两者均重新授权；到期不禁止当前有权读取或取消。
- `respond({ identity, submissionId, answer })` 在排他区间核对当前等待和期限，然后只保存一次回答。resolved 后相同 submission ID 和相同 JSON 答案返回首次记录，键顺序不影响比较；其他答复冲突。已消费答复的重读不因执行期限过去而重新执行。
- 旧 waitId、不同主体、不同定义 revision、过期的新答复均拒绝。cancelled 不再接收答复。每次操作，包括重复答复，均重新校验当前权限；授权拒绝必须抛错，不能返回 false。
- 答案仅接受有限数值、字符串、布尔、null、普通对象和密集数组组成的 JSON 数据。拒绝 getter、symbol、隐藏字段、类实例、循环及 undefined；返回值和存储值均为独立副本。

Wait Gate 不授予保存权限。App 必须在实际执行前再次鉴权；示例 save Durable 的授权回调同时重读确认门。当前权限、凭据、连接和 signal 均不来自持久快照。

## 存储与验证边界

App 必须让所有写入者使用同一排他机制。保存完成表示记录已持久；取消中已开始的保存会等到结束后才释放锁，调用方仍可能收到取消并需重读确认。

文件端口使用排他目录、文件 sync、原子 rename 及目录 sync；遇到争用直接失败。它没有分布式锁、陈旧锁恢复、数据加密或生产保留策略。进程被杀时的锁回收由真实宿主处理，示例不强行夺锁。

save 步骤声明 reconcile，并可按外部回执返回 completed／not-executed；无法确认的真实端口应返回 unknown。此示例证明新进程组合、正常等待、重复确认和终态查询，不注入真实保存崩溃、磁盘损坏或跨机器故障，也不承诺外部 exactly-once。定向 gate 测试另外覆盖冲突、到期、身份、撤权、并发重复消费和序列化边界。

故障注入范围仅为保存成功后丢失响应：本地合成错误使下一新进程实际进入 reconcile，持久 confirmationCount 为 1。没有模拟进程被强杀、断电或磁盘损坏。
