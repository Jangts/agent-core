/** Optional waiting records and App-owned storage; no Core scheduling contract. */
import type { MaybePromise, OperationContext } from '../common.js';

/** A wait id is an opaque generation, not an authorization grant. */
export interface WaitIdentity {
  readonly taskId: string;
  readonly waitId: string;
  readonly subject: string;
}

/** JSON-serializable local record, bound to one gate definition and revision. */
export type WaitRecord<Answer> = {
  readonly version: 1;
  readonly definitionId: string;
  readonly revision: string;
  readonly identity: WaitIdentity;
  readonly expiresAtMs: number;
} & (
  | { readonly status: 'pending' | 'cancelled'; readonly submission?: never }
  | {
      readonly status: 'resolved';
      readonly submission: { readonly id: string; readonly answer: Answer };
    }
);

/** All writers must share the same exclusive scope and durable save semantics. */
export interface WaitStore<Answer> {
  exclusive<T>(key: string, operation: () => Promise<T>): Promise<T>;
  load(key: string): Promise<WaitRecord<Answer> | undefined>;
  save(key: string, record: WaitRecord<Answer>): Promise<void>;
}

/** Current App policy is checked for every operation, including repeated submissions. */
export interface WaitGateDefinition<Answer, App> {
  readonly id: string;
  readonly revision: string;
  isAnswer(value: unknown): value is Answer;
  authorize(
    identity: Readonly<WaitIdentity>,
    context: OperationContext<App> & { readonly operation: 'open' | 'read' | 'respond' | 'cancel' },
  ): MaybePromise<void>;
}

/** Ports are bound once; no default persistence or authorization is installed. */
export interface WaitGateOptions<Answer> {
  readonly store: WaitStore<Answer>;
  readonly now?: () => number;
}

/** App calls the gate at its own task boundaries; pending does not throw or retain a request. */
export interface WaitGate<Answer, App> {
  open(
    request: {
      readonly identity: WaitIdentity;
      readonly expiresAtMs: number;
      /** Explicit compare-and-swap of a terminal slot; pending waits cannot be replaced. */
      readonly previousWaitId?: string;
    },
    context: OperationContext<App>,
  ): Promise<WaitRecord<Answer>>;
  read(identity: WaitIdentity, context: OperationContext<App>): Promise<WaitRecord<Answer>>;
  respond(
    request: {
      readonly identity: WaitIdentity;
      readonly submissionId: string;
      readonly answer: Answer;
    },
    context: OperationContext<App>,
  ): Promise<WaitRecord<Answer>>;
  cancel(identity: WaitIdentity, context: OperationContext<App>): Promise<WaitRecord<Answer>>;
}
