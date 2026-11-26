/**
 * Request-local model call accounting.
 *
 * A budget can have a parent, which makes sibling children compete for the same
 * ancestor allowance. Charging is synchronous: there is no await between the check and
 * the counter update, so two concurrent consumers cannot both spend the last call.
 *
 * Exports: `ModelCallBudget` and the `parentModelBudget` hand-off symbol.
 */
import { BudgetError } from '../structs/errors.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Request-local attempt ledger.
 *
 * `reserve` is capacity kept available to the parent: a child with a reserve cannot
 * consume the calls its ancestor still needs for its own turn.
 */
export class ModelCallBudget {
  private consumed = 0;
  private allowance: number;
  private readonly revisions: { previous: number; limit: number; used: number; reason: string }[] =
    [];
  /**
   * @param limit - Calls this ledger may consume; nonnegative safe integer.
   * @param parent - Ancestor ledger charged alongside every local take.
   * @param reserve - Calls of the parent's remaining capacity this ledger must leave untouched.
   * @throws Error When `limit` or `reserve` is not a nonnegative safe integer.
   */
  constructor(
    limit: number,
    private readonly parent?: ModelCallBudget,
    private readonly reserve = 0,
    readonly ceiling = limit,
  ) {
    breakWhile(
      !Number.isSafeInteger(limit) ||
        limit < 0 ||
        !Number.isSafeInteger(reserve) ||
        reserve < 0 ||
        !Number.isSafeInteger(ceiling) ||
        ceiling < limit,
      'Invalid model call budget',
    );
    this.allowance = limit;
  }
  /** Current allowance; adjusting it never resets consumed attempts. */
  get limit(): number {
    return this.allowance;
  }
  /** Detached request-local accounting, including every authorized revision. */
  snapshot() {
    return Object.freeze({
      limit: this.limit,
      ceiling: this.ceiling,
      used: this.used,
      remaining: this.remaining,
      revisions: Object.freeze(this.revisions.map((value) => Object.freeze({ ...value }))),
    });
  }
  /** Adjust within the host ceiling; descendants cannot grant ancestor capacity. */
  adjust(limit: number, reason: string) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < this.used ||
      limit > this.ceiling ||
      typeof reason !== 'string' ||
      !reason.trim()
    )
      throw new TypeError('Invalid model budget adjustment');
    const previous = this.allowance;
    this.allowance = limit;
    this.revisions.push({ previous, limit, used: this.used, reason: reason.trim() });
    return this.snapshot();
  }
  /** Calls already charged to this ledger only. */
  get used(): number {
    return this.consumed;
  }
  /** Calls still available after the local limit and the parent's reserve are applied. */
  get remaining(): number {
    return Math.max(
      0,
      Math.min(
        this.limit - this.consumed,
        this.parent ? this.parent.remaining - this.reserve : Infinity,
      ),
    );
  }
  /**
   * Derive a child ledger that also charges this one.
   *
   * @param limit - Calls the child may consume.
   * @param reserve - Calls of this ledger's remaining capacity the child must leave free.
   * @returns A new ledger linked to this instance.
   */
  child(limit: number, reserve: number): ModelCallBudget {
    return new ModelCallBudget(limit, this, reserve);
  }
  /**
   * Charge one call to this ledger and every ancestor.
   *
   * The parent is charged first so a failure cannot leave the child counter advanced
   * while the ancestor rejected the charge.
   *
   * @throws BudgetError When no call is available on this ledger or an ancestor.
   */
  take(): void {
    breakWhile(this.remaining < 1, () => new BudgetError());
    this.parent?.take();
    this.consumed++;
  }
}

/** Carries an inherited budget into a child runner that was not created by `child`. */
export const parentModelBudget = Symbol('parentModelBudget');
