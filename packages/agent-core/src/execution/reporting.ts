/**
 * Per-visit reporting scope for workflow nodes and loop steps.
 *
 * A node may report progress and write sub-steps while it runs. This scope guarantees
 * that reports stop at the end of the visit (`close`), stop on cancellation, and never
 * fail the execution: invalid reports degrade to an error marker.
 *
 * Exports: `NodeReports`.
 */
import { breakWhile } from '../utils/rules.js';
import { createStepRecorder, detachReportedStepRecorder } from '../diagnostics/sub-flow.js';
import type {
  DebugStepsOutput,
  RuntimeNodeReportingContext,
  ReportedStepRecorder,
  ReportedStepRecord,
} from '../structs/debug.js';
import type { DiagnosticContext, CoreEventName } from '../structs/diagnostics.js';
import type { WorkflowNodeReport } from '../structs/execution/workflow.js';

/**
 * The existing node report and diagnostic outlet, scoped to one execution visit.
 *
 * One instance exists per node visit. `close` is called in the engine's `finally`, so
 * reports emitted after the visit ends are dropped rather than attributed to a later
 * node.
 */
export class NodeReports implements RuntimeNodeReportingContext {
  private active = true;
  private logger?: ReportedStepRecorder;
  private usedModel?: boolean;
  private steps: readonly Readonly<ReportedStepRecord>[] = Object.freeze([]);
  /**
   * @param diagnostics - Diagnostic scope of the visit; omitted when observation is off.
   * @param signal - Execution signal; an aborted signal suppresses all further reports.
   * @param terminalEvent - Event whose content switch also enables sub-step capture.
   */
  constructor(
    private readonly diagnostics?: DiagnosticContext,
    private readonly signal?: AbortSignal,
    private readonly terminalEvent: CoreEventName = 'workflow.event',
  ) {}
  /** End the visit; later reports and logger creation are ignored or rejected. */
  close(): void {
    this.active = false;
    if (this.logger) detachReportedStepRecorder(this.logger);
    this.logger = undefined;
  }
  /**
   * Validate a report and retain its model-use flag.
   *
   * `usedModel` is monotonic: once a visit reports model use, a later report cannot take
   * it back, because the observation already claimed a model-assisted step.
   *
   * @param update - Report supplied by the node.
   * @throws TypeError When the report is not an object or its model-use flag conflicts.
   */
  receive(update: WorkflowNodeReport): void {
    breakWhile(!update || typeof update !== 'object', () => new TypeError('Invalid node report'));
    breakWhile(
      Object.hasOwn(update, 'subs'),
      () => new TypeError('Sub-flow logs are recorded automatically'),
    );
    const usedModel = update.usedModel;
    breakWhile(
      usedModel !== undefined &&
        (typeof usedModel !== 'boolean' || (this.usedModel === true && !usedModel)),
      () => new TypeError('Invalid reported model use'),
    );
    if (usedModel !== undefined) this.usedModel = usedModel;
  }
  /** Return the runtime-owned snapshot already received from write/fix. */
  debug(): DebugStepsOutput {
    return {
      usedModel: this.usedModel,
      recordedSubSteps: this.steps.length ? this.steps : undefined,
    };
  }
  /**
   * Publish one progress report.
   *
   * Payload content is only included when content logging is enabled; failures become a
   * fixed `INVALID_NODE_REPORT` marker so a malformed report is visible without breaking
   * the node.
   *
   * @param update - Report supplied by the node.
   */
  report(update: WorkflowNodeReport): void {
    if (!this.active || this.signal?.aborted) return;
    try {
      this.receive(update);
      this.diagnostics?.emit(
        'node.progress',
        () =>
          this.diagnostics?.enabled('node.progress', 'content') ? { payload: update.payload } : {},
        this.debug(),
      );
    } catch {
      this.diagnostics?.emit('node.progress', () => ({ reportError: 'INVALID_NODE_REPORT' }));
    }
  }
  /**
   * Create (once) the logger that records sub-steps for this visit.
   *
   * Status metadata is retained for the active visit. Summary and payload capture require
   * content permission from progress or the terminal event. The bound runtime receives
   * every accepted revision before notifying consumers.
   *
   * @returns The visit's logger, identical on repeated calls.
   * @throws TypeError When the visit is already closed or the execution was aborted.
   */
  /** @deprecated Use createStepRecorder. Both methods return the same per-visit recorder. */
  createSubFlowLogger(): ReportedStepRecorder {
    return this.createStepRecorder();
  }

  createStepRecorder(): ReportedStepRecorder {
    breakWhile(
      !this.active || this.signal?.aborted,
      () => new TypeError('Cannot create a logger for a closed execution'),
    );
    return (this.logger ??= createStepRecorder(
      this,
      () => this.active && !this.signal?.aborted,
      () =>
        this.diagnostics?.enabled('node.progress', 'content') === true ||
        this.diagnostics?.enabled(this.terminalEvent, 'content') === true,
      (_logger, progress, steps) => {
        // Commit before notifying consumers; failed listeners cannot lose the accepted revision.
        this.steps = steps;
        this.diagnostics?.emit('node.progress', () => ({ subStep: progress }), this.debug());
      },
      this.diagnostics?.identity,
    ));
  }
}
