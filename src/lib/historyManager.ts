/**
 * HistoryManager — Simple 1-level undo/redo with lock mechanism.
 * 
 * - pushState locks the "previous" state (first push only, subsequent skipped)
 * - undo restores previous, saves current to redo, clears lock
 * - redo restores redo state, saves current as previous (so undo still works)
 * - commit clears everything (called on "Add")
 */

export interface EditorSnapshot {
  html: string;
  bgType: string;
  bgStartColor: string;
  bgEndColor: string;
  bgDirection: string;
  bgMidpoint: number;
  link: string;
  openInNewTab: boolean;
  startDate: string;
  endDate: string;
}

export interface LinkSnapshot {
  link: string;
  openInNewTab: boolean;
}

export class HistoryManager<T> {
  private previousState: T | null = null;
  private redoState: T | null = null;
  private label: string;

  constructor(label = 'History') {
    this.label = label;
  }

  /** Push state before a change. Only the FIRST push locks — subsequent are skipped until undo/redo resets. */
  pushState(snapshot: T): void {
    if (this.previousState !== null) {
      console.log(`📝 [${this.label}] PUSH skipped (already locked)`);
      return;
    }
    this.previousState = snapshot;
    this.redoState = null;
    console.log(`📝 [${this.label}] PUSH — previous locked`);
  }

  /** Undo: restore previous state. Current goes to redo. Clears lock. */
  undo(currentState: T): T | null {
    if (this.previousState === null) {
      console.log(`↩️ [${this.label}] UNDO — nothing to undo`);
      return null;
    }
    this.redoState = currentState;
    const result = this.previousState;
    this.previousState = null;
    console.log(`↩️ [${this.label}] UNDO — restored previous`);
    return result;
  }

  /** Redo: restore redo state. Current becomes previous (so undo works after redo). */
  redo(currentState: T): T | null {
    if (this.redoState === null) {
      console.log(`↪️ [${this.label}] REDO — nothing to redo`);
      return null;
    }
    const result = this.redoState;
    this.previousState = currentState;
    this.redoState = null;
    console.log(`↪️ [${this.label}] REDO — restored redo state`);
    return result;
  }

  /** Clear everything (called on Add). */
  commit(): void {
    this.previousState = null;
    this.redoState = null;
    console.log(`✅ [${this.label}] COMMIT — cleared`);
  }

  canUndo(): boolean {
    return this.previousState !== null;
  }

  canRedo(): boolean {
    return this.redoState !== null;
  }

  /** Unlock the previous state so next push can set a new one. */
  unlock(): void {
    this.previousState = null;
    console.log(`\uD83D\uDD13 [${this.label}] UNLOCK \u2014 ready for new session`);
  }

  clear(): void {
    this.previousState = null;
    this.redoState = null;
  }
}
