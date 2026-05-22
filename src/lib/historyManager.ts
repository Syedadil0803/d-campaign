/**
 * HistoryManager — Simple 1-level undo/redo.
 * 
 * Only tracks: previous state and current state.
 * Undo = restore previous. Redo = restore current.
 * Each new change overwrites the previous.
 * commit() clears both (called on "Add").
 */

export interface EditorSnapshot {
  html: string;
  bold: boolean;
  italic: boolean;
  textColor: string;
  textSize: string;
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
  private currentState: T | null = null;
  private redoState: T | null = null;
  private isEqual: (a: T, b: T) => boolean;
  private label: string;

  constructor(isEqual?: (a: T, b: T) => boolean, label = 'History') {
    this.isEqual = isEqual || ((a, b) => JSON.stringify(a) === JSON.stringify(b));
    this.label = label;
  }

  /** Push state before a change. This becomes the "previous" you can undo to. */
  pushState(snapshot: T): void {
    // Don't push if same as current previous
    if (this.previousState !== null && this.isEqual(this.previousState, snapshot)) {
      console.log(`📝 [${this.label}] PUSH skipped (duplicate)`);
      return;
    }
    this.previousState = snapshot;
    this.redoState = null;
    console.log(`📝 [${this.label}] PUSH — previous set`);
  }

  /** Undo: restore previous state. Current goes to redo. */
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

  /** Redo: restore the state that was undone from. */
  redo(currentState: T): T | null {
    if (this.redoState === null) {
      console.log(`↪️ [${this.label}] REDO — nothing to redo`);
      return null;
    }
    const result = this.redoState;
    this.previousState = currentState; // So you can undo back after redo
    this.redoState = null;
    console.log(`↪️ [${this.label}] REDO — restored redo state`);
    return result;
  }

  /** Clear everything (called on Add). */
  commit(): void {
    this.previousState = null;
    this.currentState = null;
    this.redoState = null;
    console.log(`✅ [${this.label}] COMMIT — cleared`);
  }

  canUndo(): boolean {
    return this.previousState !== null;
  }

  canRedo(): boolean {
    return this.redoState !== null;
  }

  clear(): void {
    this.previousState = null;
    this.currentState = null;
    this.redoState = null;
  }
}
