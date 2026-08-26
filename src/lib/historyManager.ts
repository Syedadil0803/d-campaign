/**
 * The snapshot shapes the editors' undo history is built from.
 *
 * This file used to hold a HistoryManager class as well — a single-level
 * undo that could swap back once and no further. UndoStack replaced it in
 * both editors and the class sat here uninstantiated. Only these two
 * descriptions of what a snapshot contains are still needed.
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

