/**
 * TimerChipNode — the countdown chip, an atomic inline DecoratorNode.
 *
 * Modelled as a Decorator (not editable text) so Lexical handles caret flow
 * around it natively — that's what makes typing prefix/suffix rock-solid.
 * Carries a structured per-cell style model (whole + each cell) because the
 * chip is styled by CLICK, not document text-selection.
 */

import {
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import * as React from 'react';
import { TimerChipComponent } from './TimerChipComponent';
import type { ChipCell } from './TimerChipTarget';

/** Kebab-case CSS map (so it maps 1:1 to setProperty / React style). */
export type Css = Record<string, string>;
export interface ChipStyleModel {
  /** Applies to the whole chip. */
  whole?: Css;
  /** Per-cell overrides (each number, word, and colon). */
  cells?: Partial<Record<ChipCell, Css>>;
}

export type SerializedTimerChipNode = Spread<
  { endDate: string; model: ChipStyleModel },
  SerializedLexicalNode
>;

function mergeCss(base: Css | undefined, patch: Css): Css {
  const out: Css = { ...(base || {}) };
  Object.entries(patch).forEach(([k, v]) => {
    if (v === '' || v == null) delete out[k];
    else out[k] = v;
  });
  return out;
}

function cloneModel(m: ChipStyleModel): ChipStyleModel {
  const cells: Partial<Record<ChipCell, Css>> = {};
  if (m.cells) {
    (Object.keys(m.cells) as ChipCell[]).forEach((k) => {
      const c = m.cells![k];
      if (c) cells[k] = { ...c };
    });
  }
  return { whole: m.whole && { ...m.whole }, cells };
}

export class TimerChipNode extends DecoratorNode<React.ReactElement> {
  __endDate: string;
  __model: ChipStyleModel;

  static getType(): string {
    return 'timer-chip';
  }

  static clone(node: TimerChipNode): TimerChipNode {
    return new TimerChipNode(node.__endDate, cloneModel(node.__model), node.__key);
  }

  constructor(endDate: string, model: ChipStyleModel = {}, key?: NodeKey) {
    super(key);
    this.__endDate = endDate;
    this.__model = model;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement('span');
    el.setAttribute('data-timer-chip', '');
    el.style.display = 'inline-block';
    el.style.verticalAlign = 'baseline';
    el.style.whiteSpace = 'nowrap';
    // Not natively selectable — the chip is a widget. A clicked part shows
    // OUR selection-colored highlight (see TimerChipComponent), which Lexical
    // can't clear the way it clears native selection inside a decorator.
    el.style.userSelect = 'none';
    return el;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return true;
  }
  isKeyboardSelectable(): boolean {
    return true;
  }

  // --- accessors ---
  getEndDate(): string {
    return this.__endDate;
  }
  setEndDate(d: string): void {
    (this.getWritable() as TimerChipNode).__endDate = d;
  }
  getModel(): ChipStyleModel {
    return cloneModel(this.__model);
  }

  /** Style the whole chip. */
  setWholeStyle(patch: Css): void {
    const w = this.getWritable() as TimerChipNode;
    const next = cloneModel(w.__model);
    next.whole = mergeCss(next.whole, patch);
    w.__model = next;
  }

  /** Style a single cell (a number, word, or colon). */
  setCellStyle(cell: ChipCell, patch: Css): void {
    const w = this.getWritable() as TimerChipNode;
    const next = cloneModel(w.__model);
    next.cells = next.cells || {};
    next.cells[cell] = mergeCss(next.cells[cell], patch);
    w.__model = next;
  }

  /** Read the effective style for a target (whole, or a specific cell —
   *  whole merged with the cell's overrides). */
  readStyle(cell: ChipCell | null): Css {
    if (!cell) return { ...(this.__model.whole || {}) };
    return { ...(this.__model.whole || {}), ...(this.__model.cells?.[cell] || {}) };
  }

  exportJSON(): SerializedTimerChipNode {
    return {
      type: TimerChipNode.getType(),
      version: 1,
      endDate: this.__endDate,
      model: cloneModel(this.__model),
    };
  }

  static importJSON(s: SerializedTimerChipNode): TimerChipNode {
    return new TimerChipNode(s.endDate, cloneModel(s.model || {}));
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return (
      <TimerChipComponent
        nodeKey={this.getKey()}
        endDate={this.__endDate}
        model={this.__model}
      />
    );
  }
}

export function $createTimerChipNode(
  endDate: string,
  model: ChipStyleModel = {},
): TimerChipNode {
  return new TimerChipNode(endDate, model);
}

export function $isTimerChipNode(
  node: LexicalNode | null | undefined,
): node is TimerChipNode {
  return node instanceof TimerChipNode;
}
