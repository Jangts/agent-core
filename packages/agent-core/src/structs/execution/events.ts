/**
 * Live execution observation contract.
 *
 * The same fact that diagnostics may persist can also be observed while it happens. Observers
 * receive metadata by default; content-bearing events require an explicit `accepts` decision so a
 * host cannot leak user or model content by accident.
 *
 * Exports: `CoreEvent` (type re-export), `ExecutionEventDescriptor`, `ExecutionObserver`.
 */
import type { CoreEvent, CoreEventDescriptor, DiagnosticIdentity } from '../diagnostics.js';

/** The same execution fact is observed live and optionally projected into a log. */
export type { CoreEvent } from '../diagnostics.js';
/** Event name, content class and the producing execution identity. */
export interface ExecutionEventDescriptor extends CoreEventDescriptor, DiagnosticIdentity {}
/** Live consumer of Core facts. */
export interface ExecutionObserver {
  /** Metadata-only by default. Content requires an explicit accepts decision. */
  accepts?(descriptor: Readonly<ExecutionEventDescriptor>): boolean;
  /** Handles one fact; a rejected promise propagates to the emitting call. */
  event(event: Readonly<CoreEvent>): void | Promise<void>;
}
