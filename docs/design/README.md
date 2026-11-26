# Agent Core 现行设计

## 职责与执行

- [Core、Support 与 Kit](design-layers.md)说明调用方向、运行保证与可选扩展。
- [模块职责与源码定位](modules.md)按能力查找入口与实现。
- [执行蓝本](implementation-blueprint.md)说明装配、编排、调用、恢复与运行事实的归属。

## 接口与协议

- [Agent Core 接口设计约定](interface-design-conventions.md)说明路由、生成器和执行接口的具体规则。
- [API 一致性设计](api-consistency-design.md)说明实例绑定、配置扩展、错误与生命周期。
- [传输与协议规范](protocols.md)说明模型、工具、SSE 和交互的运行保证。

## 诊断与可选能力

- [Agent Core 日志规则](diagnostics-design.md)说明事件、观察与隐私边界。
- [日志回查与复盘](diagnostics-history-design.md)说明读取、复盘和状态版本。
- [知识、回答与内容输出 Kit](knowledge-output-design.md)说明资料、正文、检查和输出模块的职责。

公开参数、返回值与示例见 [API 手册](../../packages/agent-core/development/docs/api/README.md)。设计演进和验收证据见[维护资料](../maintenance/README.md)。
