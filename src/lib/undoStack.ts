/**
 * Bounded undo/redo stack for the promo editor.
 *
 * Separate from HistoryManager, which is a single-step swap (one previous, one
 * redo) — fine for the announcement bar's undo/redo buttons, but it cannot walk
 * back through a session, which is what the promo editor needs.
 *
 * The model is "snapshot before each action": push the state as it was, so undo
 * restores the moment before the change. A step is one ACTION, not one
 * keystroke — grouping is the caller's job (see `coalesceMs`), because only the
 * caller knows whether a keystroke continues a burst or starts something new.
 */

export interface UndoStackOptions {
  /** How many actions to keep. Older ones roll off the back. */
  limit?: number;
  /**
   * Pushes within this window of the previous one are treated as the same
   * action and skipped, so a burst of typing collapses to a single step.
   */
  coalesceMs?: number;
  /** Injectable clock — the default reads the wall clock. */
  now?: () => number;
}

export class UndoStack<T> {
  private past: T[] = [];
  private future: T[] = [];
  private lastPushAt = 0;
  private readonly limit: number;
  private readonly coalesceMs: number;
  private readonly now: () => number;

  constructor({ limit = 30, coalesceMs = 900, now = () => Date.now() }: UndoStackOptions = {}) {
    this.limit = limit;
    this.coalesceMs = coalesceMs;
    this.now = now;
  }

  /**
   * Record the state as it was BEFORE a change.
   *
   * @param force Bypass coalescing — for actions that are their own step even
   *              when they land mid-burst (a color change, a date change, the
   *              start of a delete run).
   */
  push(snapshot: T, { force = false }: { force?: boolean } = {}): void {
    const t = this.now();
    const withinBurst = !force && this.past.length > 0 && t - this.lastPushAt < this.coalesceMs;
    this.lastPushAt = t;
    // A new action invalidates any redo — you can't go forward down a path you
    // just stepped off.
    this.future = [];
    if (withinBurst) return;

    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.shift();
  }

  /** Returns the state to restore, or null when there's nothing to undo. */
  undo(current: T): T | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(current);
    // The next push starts a fresh action rather than joining the burst that
    // was interrupted by this undo.
    this.lastPushAt = 0;
    return previous;
  }

  /** Returns the state to restore, or null when there's nothing to redo. */
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    this.lastPushAt = 0;
    return next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Drop everything.
   *
   * Called at the boundaries the spec draws: applying a template or variant,
   * starting fresh. Those are undone by their own toast, and letting Ctrl+Z
   * step back across one would wipe a design the user had just chosen.
   */
  clear(): void {
    this.past = [];
    this.future = [];
    this.lastPushAt = 0;
  }

  /** Depth, for tests and debugging. */
  get size(): number {
    return this.past.length;
  }
}
