/**
 * TimerChipComponent — renders a TimerChipNode's live countdown as a row of
 * styleable CELLS (each number, word, and colon). Clicking a cell targets it
 * for the toolbar; clicking empty chip area targets the whole chip. Live tick
 * runs on its own interval (no editor updates → caret never disturbed).
 */

'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import type { ChipStyleModel, Css } from './TimerChipNode';
import { useTimerChipTarget, type ChipCell } from './TimerChipTarget';

interface Props {
  nodeKey: string;
  endDate: string;
  model: ChipStyleModel;
}

function calcRemaining(endDate: string) {
  if (!endDate) return { days: 0, hours: 0, mins: 0, isValid: false };
  let end: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const [y, m, d] = endDate.split('-').map(Number);
    end = new Date(y, m - 1, d, 23, 59, 59, 999);
  } else {
    end = new Date(endDate);
  }
  const diff = end.getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return { days: 0, hours: 0, mins: 0, isValid: false };
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    isValid: true,
  };
}

function toReact(css: Css | undefined): React.CSSProperties {
  if (!css) return {};
  const o: Record<string, string> = {};
  if (css['color']) o.color = css['color'];
  if (css['font-size']) o.fontSize = css['font-size'];
  if (css['font-weight']) o.fontWeight = css['font-weight'];
  if (css['font-style']) o.fontStyle = css['font-style'];
  if (css['text-decoration']) o.textDecoration = css['text-decoration'];
  return o as React.CSSProperties;
}

export function TimerChipComponent({ nodeKey, endDate, model }: Props): React.ReactElement {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { target, setTarget } = useTimerChipTarget();
  const r = calcRemaining(endDate);
  const v = (n: number) => (r.isValid ? String(n) : '--');

  const isActive = (cell: ChipCell | null) =>
    target?.chipKey === nodeKey && target?.cell === cell;

  const pick = (cell: ChipCell | null) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTarget({ chipKey: nodeKey, cell });
  };

  // A CONTAINED highlight (background, not outline) painted INSIDE the cell —
  // an outline draws outside the box and bleeds into the tightly-packed
  // neighbours. Uses the CSS system colors `Highlight` / `HighlightText`,
  // which are the EXACT colors the browser uses for native text selection
  // (double-click / drag-select), so the chip-cell highlight matches it.
  const outline = (cell: ChipCell | null): React.CSSProperties =>
    isActive(cell)
      ? { backgroundColor: 'Highlight', color: 'HighlightText' }
      : {};

  const noSelect: React.CSSProperties = {
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

  // Every visible piece is a clickable cell — numbers, words, AND colons.
  const cells: Array<{ id: ChipCell; text: string }> = [
    { id: 'days-val', text: v(r.days) },
    { id: 'days-lab', text: ' days ' },
    { id: 'sep-0', text: ': ' },
    { id: 'hours-val', text: v(r.hours) },
    { id: 'hours-lab', text: ' hours ' },
    { id: 'sep-1', text: ': ' },
    { id: 'mins-val', text: v(r.mins) },
    { id: 'mins-lab', text: ' mins' },
  ];

  return (
    <span
      data-timer-chip-inner
      onMouseDown={pick(null)}
      style={{
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...toReact(model.whole),
        ...outline(null),
      }}
    >
      {cells.map((c) => (
        <span
          key={c.id}
          data-cell={c.id}
          onMouseDown={pick(c.id)}
          style={{ ...noSelect, ...toReact(model.cells?.[c.id]), ...outline(c.id) }}
        >
          {c.text}
        </span>
      ))}
    </span>
  );
}
