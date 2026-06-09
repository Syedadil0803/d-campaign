/**
 * TimerToolbar — the editor's built-in Bold/Italic/Size/Color controls.
 *
 * Lives inside the Lexical composer, so it reads the selection and dispatches
 * via $readActiveFormats / $applyTimerStyle directly. The app integration uses
 * its OWN toolbar instead (showToolbar=false) and drives the editor through
 * LexicalTimerField's imperative ref; this is mainly for standalone use.
 */

'use client';

import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import {
  $applyTimerStyle,
  $readActiveFormats,
  timerStylePatch,
  SIZE_REM_TO_LABEL,
  type ActiveFormats,
} from './format-commands';
import { $isTimerChipNode } from './TimerChipNode';
import { useTimerChipTarget } from './TimerChipTarget';

const SIZES: Array<{ label: string; display: string }> = [
  { label: 'xs', display: 'XS' },
  { label: 'sm', display: 'SM' },
  { label: 'md', display: 'MD' },
  { label: 'lg', display: 'LG' },
  { label: 'xl', display: 'XL' },
  { label: 'xxl', display: '2XL' },
];

const COLORS: string[] = [
  '#ffffff',
  '#000000',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const INITIAL_FORMATS: ActiveFormats = {
  bold: false,
  italic: false,
  size: 'md',
  color: '',
};

export function TimerToolbar(): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  const { target } = useTimerChipTarget();
  const [formats, setFormats] = useState<ActiveFormats>(INITIAL_FORMATS);

  // Refresh active formats. When a chip part is targeted, reflect THAT part's
  // style; otherwise reflect the document text selection.
  useEffect(() => {
    const updateFormats = () => {
      editor.getEditorState().read(() => {
        if (target) {
          const chip = $getNodeByKey(target.chipKey);
          if ($isTimerChipNode(chip)) {
            const css = chip.readStyle(target.cell);
            setFormats({
              bold: css['font-weight'] === 'bold' || (parseInt(css['font-weight'] || '', 10) || 0) >= 700,
              italic: css['font-style'] === 'italic',
              size: SIZE_REM_TO_LABEL[css['font-size'] || ''] || 'md',
              color: css['color'] || '',
            });
            return;
          }
        }
        setFormats($readActiveFormats());
      });
    };
    updateFormats();
    return editor.registerUpdateListener(updateFormats);
  }, [editor, target]);

  // -------------------------------------------------------------
  // Dispatchers — all wrapped in editor.update so changes are atomic and
  // collectible into a single history entry. When a chip part is targeted,
  // the patch goes onto the chip's structured style model; otherwise it
  // styles the document text/selection.
  // -------------------------------------------------------------

  const apply = (patch: ReturnType<typeof timerStylePatch>) => {
    editor.update(() => {
      if (target) {
        const chip = $getNodeByKey(target.chipKey);
        if ($isTimerChipNode(chip)) {
          if (target.cell) chip.setCellStyle(target.cell, patch);
          else chip.setWholeStyle(patch);
          return;
        }
      }
      $applyTimerStyle(patch);
    });
  };

  const onBold = () => {
    // Toggle: if currently bold, '' removes the inline font-weight.
    apply(timerStylePatch({ kind: 'bold', on: !formats.bold }));
  };
  const onItalic = () => {
    apply(timerStylePatch({ kind: 'italic', on: !formats.italic }));
  };
  const onSize = (label: string) => {
    apply(timerStylePatch({ kind: 'size', label }));
  };
  const onColor = (value: string) => {
    apply(timerStylePatch({ kind: 'color', value }));
  };

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------

  const baseBtn =
    'px-2 py-1 text-xs border rounded transition-colors border-border ' +
    'hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant';
  const activeBtn = 'bg-primary/10 text-primary border-primary/80';

  // mousedown + preventDefault: keeps the editor's selection alive while the
  // user clicks the button (otherwise the click would steal focus and the
  // selection would collapse before the command runs).
  const buttonMouseDown = (handler: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    handler();
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        className={`${baseBtn} font-bold ${formats.bold ? activeBtn : ''}`}
        onMouseDown={buttonMouseDown(onBold)}
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        className={`${baseBtn} italic ${formats.italic ? activeBtn : ''}`}
        onMouseDown={buttonMouseDown(onItalic)}
        title="Italic"
      >
        I
      </button>

      <div className="border-l border-gray-300 h-4 mx-1" />

      {SIZES.map((s) => (
        <button
          key={s.label}
          type="button"
          className={`${baseBtn} ${formats.size === s.label ? activeBtn : ''}`}
          onMouseDown={buttonMouseDown(() => onSize(s.label))}
          title={`Size ${s.display}`}
        >
          {s.display}
        </button>
      ))}

      <div className="border-l border-gray-300 h-4 mx-1" />

      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onMouseDown={buttonMouseDown(() => onColor(c))}
            className={`h-5 w-5 rounded border ${
              formats.color.toLowerCase() === c.toLowerCase()
                ? 'border-primary ring-1 ring-primary/60'
                : 'border-border'
            }`}
            style={{ background: c }}
            title={c}
          />
        ))}
        {/* Reset color */}
        <button
          type="button"
          className={`${baseBtn} text-[10px] uppercase`}
          onMouseDown={buttonMouseDown(() => onColor(''))}
          title="Reset color"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
