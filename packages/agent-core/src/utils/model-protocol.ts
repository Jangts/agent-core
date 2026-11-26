/**
 * Fail a model-facing protocol contract.
 *
 * Model output is untrusted input: violations are reported as `ValidationError`
 * issues so callers can inspect every problem instead of catching a bare Error.
 *
 * Exports: `modelProtocolError`.
 */
import { ValidationError } from '../structs/errors.js';

/**
 * Throw a model protocol validation error.
 *
 * @param message - Primary issue message, always reported with code `MODEL_PROTOCOL`.
 * @param reason - Optional secondary code for the same message, used to distinguish variants.
 * @returns Never returns; the declared `never` return lets callers use it in expressions.
 * @throws ValidationError carrying one or two issues.
 */
export function modelProtocolError(message: string, reason?: string): never {
  throw new ValidationError([
    { code: 'MODEL_PROTOCOL', message },
    ...(reason ? [{ code: reason, message }] : []),
  ]);
}
