# 共用运行机制

同一项运行保证由一份底层实现负责，Core、Support 与 Kit 在自己的入口调用它；调用方继续拥有业务条件、错误信息和执行时序。下面均为内部复用入口，不新增公开 API，也不改变 Core 不依赖 Support／Kit 的方向。

| 保证 | 实现入口 | 调用方责任 |
| --- | --- | --- |
| 同步回调、布尔谓词与 void 断言 | `src/utils/synchronous.ts`：`synchronous`、`booleanResult`、`assertion`、`maybeAssertion` | 按原接收者调用 handler，选择允许同步或异步的合同，提供所属模块的错误信息。`maybeAssertion` 仅在实际返回 thenable 时产生 Promise，避免同步工具失去同步调用能力。 |
| 父级与局部取消信号合并 | `src/utils/cancellation.ts`：`combineSignals` | 父级始终参与合并；调用方决定信号顺序及超时范围。重复信号去重，单信号保留身份，多个已取消信号仍按原输入顺序取原因。 |
| 停止等待、清理监听器和观察迟到拒绝 | `src/utils/cancellation.ts`：`awaitWithSignal` | 调用前及发布结果前检查取消；取消等待不会撤销已启动的副作用。需要延后派发的 handler 仍由调用方安排微任务并在派发时再检查。 |
| 可异步的授权与校验 | `src/utils/cancellation.ts`：`awaitAssertion` | 传入检查回调与模块错误信息；底层统一检查执行前后取消且只接受 void 成功。 |
| 诊断事件的独立副本与元数据降级 | `src/execution/events.ts`：`eventSnapshot`、`metadataProjections` | writer、observer、sink 复用副本机制；是否接收内容仍分别检查各消费者权限。每个消费者取得独立副本，不可克隆的内容按同一投影降级。新增事件时同时审查事件清单与投影。 |
| Core 分支身份字段校验与快照 | `src/execution/branch.ts`：`snapshotBranch` | Engine 与 Family 使用同一身份合同。Family 自己校验派生关系、版本、授权与持久化规则，Core 不读取 Family 数据结构。 |

预算与上下文的既有统一入口继续由 `src/context/fragments.ts`、模型输入准备和预算模块负责。不同含义的整数限制、业务阶段和状态不因写法相似而合并。

## 必须保留的差异

- Durable、Family、Publication 和子任务提交等原子写入必须等待存储确认。不能用可放弃等待的 helper 提前释放锁或宣布操作结束。
- SSE 的生产与消费交接、回复节奏的定时器、Provider 错误正文的限时读取分别拥有不同的资源生命周期。它们的取消监听与竞速逻辑不整体替换为普通 Promise 等待。
- Workflow 的合同错误具有专属类型；模型尝试预算也有既定错误归属。不能为了统一布尔检查而将其替换为普通 TypeError。
- 原始数据里的布尔字段不是回调返回值，不套用同步回调合同。业务前后的取消检查负责阻止下一阶段副作用，不能因底层等待可取消而删除。
- App 观察回调可以忽略不可克隆的观测数据；Core 诊断则按事件投影降级。二者的隐私规则不同，不合并成一个万能克隆入口。

## 回归维护

`test/shared-mechanisms.test.mjs` 覆盖跨入口共享的关键合同：同步与异步工具、thenable 拒绝、父级和局部取消、监听清理、延迟派发、诊断副本与分支身份。各模块已有测试继续负责其业务错误、提交确认和阶段顺序。修改共用机制时同时检查相关消费者，避免只验证 helper 本身。

Schema 的编译、转换与错误工厂，以及 Evidence 的来源 ID 选择器同样调用同步校验入口。不能只检查主 validator／parser 或布尔谓词，而让外围回调的 Promise 变成普通值或未处理拒绝。

跨 await 的检查还需覆盖持久化请求快照与直接传输入口：`test/persistence-boundaries.test.mjs` 验证 Family／资料发布目标固定、检查数据隔离、缺失来源拒绝、Durable 只读加载取消及 Journal 身份去重；`test/transport-boundaries.test.mjs` 验证 Provider 直接调用、迟到响应释放、错误清理和 SSE 背压取消。原子保存仍等待确认，取消等待只用于可安全放弃的读取。

Workflow 提交先读取一次返回更新，再以同一快照检查 provides 和应用字段；快照期间取消不提交，`__proto__` 作为普通自有数据字段处理。`test/state-commit.test.mjs` 覆盖此合同。内容投影的兜底和连续摘录同样经过既有上下文预算校验，见 `test/projection-budget.test.mjs`。

`test/execution-boundary-followup.test.mjs` 覆盖回调返回后的取消与提交边界：循环／节点进入事件后、路由与完成校验之间、工具诊断与成功回执之间、模型计费前、Provider 入口前、内容消费前，以及答案检查与复核阶段之间。日志复核源直接查询也使用统一取消等待；发现结果先完整校验再加入可读范围，事件页读完后重查证据有效期。底层流清理属于尽力执行，不替换已确定的成功、失败或取消结果。
