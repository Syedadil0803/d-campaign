/**
 * HistoryManager — Custom undo/redo stack with full snapshot restore.
 * 
 * Architecture:
 * - currentState tracks the live state (NOT on the undoStack)
 * - undoStack holds previous states only, capped at MAX_STATES
 * - Any new action clears the redo stack
 * - commit() clears all stacks (called on "Add")
 * - undo()/redo() return the snapshot to restore, or null
 * - No diffing — always store and restore full snapshots
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

const DEFAULT_MAX_STATES = 10;

export class HistoryManager<T> {
  private undoStack: T[] = [];  // previous states only (NOT including current)
  private redoStack: T[] = [];
  private currentState: T | null = null;  // track current state separately
  private isEqual: (a: T, b: T) => boolean;
  private label: string; // for log grouping
  private maxStates: number;

  constructor(isEqual?: (a: T, b: T) => boolean, label = 'History', maxStates = DEFAULT_MAX_STATES) {
    this.isEqual = isEqual || ((a, b) => JSON.stringify(a) === JSON.stringify(b));
    this.label = label;
    this.maxStates = maxStates;
  }

  /** Strip HTML tags for readable log preview */
  private _preview(snapshot: T): string {
    const html = (snapshot as any).html;
    if (typeof html === 'string') {
      const text = html.replace(/<[^>]*>/g, '').substring(0, 50);
      return text || '(empty)';
    }
    return JSON.stringify(snapshot).substring(0, 50);
  }

  pushState(snapshot: T): void {
    // Don't push if identical to current state
    if (this.currentState !== null && this.isEqual(this.currentState, snapshot)) {
      console.log(`📝 [${this.label}] PUSH skipped (duplicate)`);
      return;
    }
    // Move current state to undo stack (it becomes a previous state)
    if (this.currentState !== null) {
      this.undoStack.push(this.currentState);
      if (this.undoStack.length > this.maxStates) {
        this.undoStack.shift();
        console.log(`📝 [${this.label}] PUSH dropped oldest — undo: ${this.undoStack.length}, redo: ${this.redoStack.length}`);
      }
    }
    this.currentState = snapshot;
    this.redoStack = [];
    console.log(`📝 [${this.label}] PUSH — undo: ${this.undoStack.length}, redo: 0 — "${this._preview(snapshot)}"`);
  }

  undo(): T | null {
    if (this.undoStack.length === 0) {
      console.log(`↩️ [${this.label}] UNDO — nothing to undo`);
      return null;
    }
    // Push current state to redo stack
    if (this.currentState !== null) {
      this.redoStack.push(this.currentState);
    }
    // Pop previous state from undo stack → becomes current
    const previous = this.undoStack.pop()!;
    this.currentState = previous;
    console.log(`↩️ [${this.label}] UNDO — undo: ${this.undoStack.length}, redo: ${this.redoStack.length} — restoring "${this._preview(previous)}"`);
    return previous;
  }

  redo(): T | null {
    if (this.redoStack.length === 0) {
      console.log(`↪️ [${this.label}] REDO — nothing to redo`);
      return null;
    }
    // Push current state back to undo stack
    if (this.currentState !== null) {
      this.undoStack.push(this.currentState);
    }
    const next = this.redoStack.pop()!;
    this.currentState = next;
    console.log(`↪️ [${this.label}] REDO — undo: ${this.undoStack.length}, redo: ${this.redoStack.length} — restoring "${this._preview(next)}"`);
    return next;
  }

  commit(): void {
    console.log(`🔄 [${this.label}] COMMIT — cleared all stacks`);
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    console.log(`🧹 [${this.label}] CLEAR — cleared all stacks`);
    this.undoStack = [];
    this.redoStack = [];
    this.currentState = null;
  }
}
