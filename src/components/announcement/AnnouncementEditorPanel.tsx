'use client';

import { Sparkles } from 'lucide-react';
import { getBackgroundStyle } from '@/lib/utils';
import { rgbToHex } from '@/lib/editor/colorUtils';
import RichTextToolbar from '@/components/shared/RichTextToolbar';
import { useAnnouncementEditor } from '@/components/announcement/AnnouncementEditorContext';
import { AnnouncementEditorPopups } from '@/components/announcement/AnnouncementEditorPopups';

/**
 * The left-hand card: the message editor, its toolbar, and the three popups
 * that hang off it.
 *
 * Reads the editor context rather than taking props. At eighty-odd members a
 * prop list would be a keyhole into the section rather than a boundary, and
 * because the context names match the section's own locals exactly, the markup
 * moved here unaltered — verified against the original by a normalised diff.
 */
export function AnnouncementEditorPanel() {
  const {
    activeFormats,
    applyColor,
    applyEditorSnapshot,
    detectFormats,
    editorDefaultColor,
    ensureDefaultFontSize,
    formatText,
    getEditorSnapshot,
    linkBtnRef,
    newAnnouncementText,
    pushImmediateState,
    pushTypingState,
    redoEditor,
    richEditorRef,
    saveSelection,
    scheduleBtnRef,
    selectedEndDate,
    selectedIndex,
    selectedStartDate,
    selectedUrl,
    setActiveFormats,
    setShowLinkPopup,
    setShowRichToolbar,
    setShowSchedulePopup,
    setShowShortcutsTip,
    shortcutsTipShown,
    showLinkPopup,
    showSchedulePopup,
    undoEditor,
    activeFormatsRef,
    addAnnouncement,
    applyFormatToAll,
    applyingFormatRef,
    detectFormatsForSelectMode,
    isDeletingRef,
    justDeletedStyledRef,
    onRichTextInput,
    openChatGptWithPrompt,
    previewBg,
    restoringSnapshotRef,
    scheduleRangeInvalid,
  } = useAnnouncementEditor();

  // Get plain text length
  const getPlainTextLength = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/\u200B/g, '').length;
  };

  // Check if text exceeds limit
  const isOverLimit = getPlainTextLength(newAnnouncementText) > 120;

  return (
    <div className="box-border h-[320px] rounded-2xl border border-border campaign-card-surface px-6 py-[30px] shadow-sm flex flex-col transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">

      {/* Zone 1: Header Block (52px) */}
      <div className="shrink-0 flex flex-col gap-1">
        <h4 className="text-xl font-bold leading-[28px] text-on-surface">
          Announcement Content
        </h4>
        <p className="text-sm leading-[20px] text-on-surface-variant">
          Create your message, optionally attach a link, and add timing only if needed.
        </p>
      </div>

      {/* Divider Line & Margins (41px Total - Divider sits exactly at 102px Y-offset) */}
      <div className="my-5 h-[1px] w-full bg-border" />

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* Toolbar sub-card */}
        <div className="shrink-0 rounded-lg border border-border bg-surface-subtle px-3 pt-3 pb-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant/60 leading-none">
              Formatting &amp; Options
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant/60 leading-none">
              AI Assistant
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <RichTextToolbar
                activeFormats={activeFormats}
                onFormat={(format) => {
                  const sel = window.getSelection();
                  const hasSelectionInEditor = sel && !sel.isCollapsed && richEditorRef.current?.contains(sel.anchorNode);
                  if (hasSelectionInEditor) {
                    pushImmediateState(getEditorSnapshot());
                    saveSelection();
                    formatText(format);
                    const currentColor = activeFormats.color;
                    setTimeout(() => {
                      const s = window.getSelection();
                      if (s && s.anchorNode) {
                        let foundColor = '';
                        let node: Node | null = s.anchorNode;
                        while (node && node !== document.body) {
                          if (node instanceof HTMLElement && node.style.color) {
                            foundColor = node.style.color.startsWith('rgb') ? rgbToHex(node.style.color) : node.style.color;
                            break;
                          }
                          node = node.parentNode;
                        }
                        if (!foundColor) {
                          setActiveFormats(prev => ({ ...prev, color: currentColor }));
                        }
                      }
                    }, 0);
                  } else {
                    const hasContent = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                    if (hasContent) {
                      pushImmediateState(getEditorSnapshot());
                      applyFormatToAll(() => formatText(format));
                    } else {
                      if (format.startsWith('size-')) {
                        setActiveFormats(prev => ({ ...prev, size: format.replace('size-', '') }));
                      } else if (format === 'bold') {
                        setActiveFormats(prev => ({ ...prev, bold: !prev.bold }));
                      } else if (format === 'italic') {
                        setActiveFormats(prev => ({ ...prev, italic: !prev.italic }));
                      }
                    }
                  }
                }}
                onColorSelect={(color) => {
                  const sel = window.getSelection();
                  const hasSelectionInEditor = sel && !sel.isCollapsed && richEditorRef.current?.contains(sel.anchorNode);
                  if (hasSelectionInEditor) {
                    pushImmediateState(getEditorSnapshot());
                    saveSelection();
                    applyColor(color);
                    onRichTextInput();
                  } else {
                    const hasContent = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                    if (hasContent) {
                      pushImmediateState(getEditorSnapshot());
                      applyFormatToAll(() => applyColor(color));
                    }
                    setActiveFormats(prev => ({ ...prev, color }));
                  }
                }}
                extraActions={
                  <>
                    <div className="border-l border-border h-4 mx-2 shrink-0" />
                    <button
                      ref={linkBtnRef}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!newAnnouncementText.trim() || isOverLimit) return;
                        setShowLinkPopup(!showLinkPopup);
                        setShowSchedulePopup(false);
                      }}
                      disabled={!newAnnouncementText.trim() || isOverLimit}
                      className={`cursor-pointer flex items-center gap-1 px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed text-xs ${selectedUrl ? 'border-primary/80 bg-primary/10 text-primary' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                      title={newAnnouncementText.trim() ? (isOverLimit ? 'Character limit exceeded' : 'Add link') : 'Enter text first'}
                    >
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="leading-none">Link</span>
                    </button>
                    <button
                      ref={scheduleBtnRef}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!newAnnouncementText.trim() || isOverLimit) return;
                        if (showSchedulePopup && scheduleRangeInvalid) return;
                        setShowSchedulePopup(!showSchedulePopup);
                        setShowLinkPopup(false);
                      }}
                      disabled={!newAnnouncementText.trim() || isOverLimit}
                      className={`cursor-pointer flex items-center gap-1 px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed text-xs ${(selectedStartDate || selectedEndDate) ? 'border-primary/80 bg-primary/10 text-primary' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                      title={newAnnouncementText.trim() ? (isOverLimit ? 'Character limit exceeded' : 'Schedule this message') : 'Enter text first'}
                    >
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="leading-none">Schedule</span>
                    </button>
                  </>
                }
                rightActions={
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openChatGptWithPrompt();
                    }}
                    className="cursor-pointer flex items-center gap-1 px-1.5 py-1 border rounded transition-colors shrink-0 border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant text-xs"
                    title="Open ChatGPT with a prompt"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                }
              />
            </div>
          </div>
        </div>

        {/* ── Message input section ── */}
        <div className="mt-4 flex-1 flex flex-col min-h-0">
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] leading-none">
            Message
          </label>

          <div className="flex gap-2 mt-2 flex-1">
            <div className="flex-1 min-w-0 flex flex-col">
              <div
                ref={richEditorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={true}
                data-placeholder="Enter announcement text…"
                onInput={onRichTextInput}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text/plain');
                  const currentText = richEditorRef.current?.textContent?.replace(/\u200B/g, '') || '';
                  const remaining = 120 - currentText.length;
                  
                  if (remaining <= 0) return;
                  // Truncate pasted text to fit remaining characters
                  const pasteText = text.slice(0, remaining);
                  document.execCommand('insertText', false, pasteText);
                }}
                onMouseDown={() => {}}
                onMouseUp={() => {
                  if (!richEditorRef.current) return;
                  const hasContent = richEditorRef.current.textContent?.replace(/\u200B/g, '').trim();
                  if (!hasContent) return;
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0 && richEditorRef.current.contains(sel.anchorNode)) {
                    detectFormats();
                  }
                }}
                onKeyUp={(e) => {
                  if (!richEditorRef.current) return;
                  if (e.key === 'Backspace' || e.key === 'Delete') {
                    const editor = richEditorRef.current;
                    editor.querySelectorAll('span[style], b, strong, i, em').forEach((el) => {
                      if (!el.textContent?.replace(/\u200B/g, '').trim()) el.remove();
                    });
                    const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                    if (!hasContent) {
                      setActiveFormats({ bold: false, italic: false, size: 'md', color: editorDefaultColor });
                      editor.innerHTML = '';
                      justDeletedStyledRef.current = false;
                      return;
                    }
                    justDeletedStyledRef.current = true;
                    detectFormatsForSelectMode(editor.innerHTML);
                    return;
                  }
                  const hasContent = richEditorRef.current.textContent?.replace(/\u200B/g, '').trim();
                  if (!hasContent) return;
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0 && richEditorRef.current.contains(sel.anchorNode)) {
                    detectFormats();
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent typing if at limit
                  if (!e.metaKey && !e.ctrlKey && e.key.length === 1) {
                    const currentText = richEditorRef.current?.textContent?.replace(/\u200B/g, '') || '';
                    if (currentText.length >= 120) {
                      e.preventDefault();
                      return;
                    }
                  }

                  if (!e.metaKey && !e.ctrlKey) {
                    const sel = window.getSelection();
                    if (
                      sel && !sel.isCollapsed &&
                      richEditorRef.current?.contains(sel.anchorNode) &&
                      (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')
                    ) {
                      pushImmediateState(getEditorSnapshot());
                      isDeletingRef.current = e.key === 'Backspace' || e.key === 'Delete';
                    }
                  }
                  if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.ctrlKey) {
                    const sel = window.getSelection();
                    if (sel?.isCollapsed && !isDeletingRef.current) {
                      isDeletingRef.current = true;
                      pushImmediateState(getEditorSnapshot());
                    }
                  } else if ((e.key.length === 1 || e.key === 'Enter') && !e.metaKey && !e.ctrlKey) {
                    if (isDeletingRef.current) {
                      isDeletingRef.current = false;
                      pushImmediateState(getEditorSnapshot());
                    } else {
                      pushTypingState(getEditorSnapshot());
                    }
                  }
                  const mod = e.metaKey || e.ctrlKey;
                  if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
                    e.preventDefault();
                    const isUndo = e.key.toLowerCase() === 'z' && !e.shiftKey;
                    const isRedo = (e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y';
                    if (isUndo) {
                      const snapshot = undoEditor(getEditorSnapshot());
                      if (snapshot) applyEditorSnapshot(snapshot);
                    } else if (isRedo) {
                      const snapshot = redoEditor(getEditorSnapshot());
                      if (snapshot) applyEditorSnapshot(snapshot);
                    }
                    isDeletingRef.current = false;
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isOverLimit && newAnnouncementText.trim()) {
                      addAnnouncement();
                    }
                    return;
                  }
                  if (!e.metaKey && !e.ctrlKey && e.key.length === 1 && richEditorRef.current) {
                    const editor = richEditorRef.current;
                    const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                    if (!hasContent) {
                      e.preventDefault();
                      const { size, color, bold, italic } = activeFormatsRef.current;
                      const fontSize = size ? ({ xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', xxl: '1.5rem' }[size] || '1rem') : '1rem';
                      const resolvedColor = color || editorDefaultColor;
                      let html = `<span style="font-size: ${fontSize}; color: ${resolvedColor}">${e.key}</span>`;
                      if (bold) html = `<b>${html}</b>`;
                      if (italic) html = `<i>${html}</i>`;
                      editor.innerHTML = html;
                      const sel = window.getSelection();
                      if (sel) {
                        sel.removeAllRanges();
                        const range = document.createRange();
                        let lastNode: Node = editor;
                        while (lastNode.lastChild) lastNode = lastNode.lastChild;
                        if (lastNode.nodeType === Node.TEXT_NODE) {
                          range.setStart(lastNode, lastNode.textContent?.length || 0);
                          range.collapse(true);
                        } else {
                          range.selectNodeContents(editor);
                          range.collapse(false);
                        }
                        sel.addRange(range);
                      }
                      onRichTextInput();
                      justDeletedStyledRef.current = false;
                    } else if (justDeletedStyledRef.current) {
                      e.preventDefault();
                      justDeletedStyledRef.current = false;
                      const { size, color, bold, italic } = activeFormatsRef.current;
                      const fontSize = size ? ({ xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', xxl: '1.5rem' }[size] || '1rem') : '1rem';
                      const resolvedColor = color || editorDefaultColor;
                      let charHtml = `<span style="font-size: ${fontSize}; color: ${resolvedColor}">${e.key}</span>`;
                      if (bold) charHtml = `<b>${charHtml}</b>`;
                      if (italic) charHtml = `<i>${charHtml}</i>`;
                      document.execCommand('insertHTML', false, charHtml);
                      onRichTextInput();
                    } else {
                      ensureDefaultFontSize();
                    }
                  }
                }}
                onFocus={() => {
                  if (applyingFormatRef.current) return;
                  if (restoringSnapshotRef.current) return;
                  setShowRichToolbar(true);
                  if (!shortcutsTipShown.current && localStorage.getItem('ann_shortcuts_seen') !== 'never') {
                    shortcutsTipShown.current = true;
                    setShowShortcutsTip(true);
                  }
                  if (richEditorRef.current) {
                    const editor = richEditorRef.current;
                    const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                    if (hasContent) detectFormatsForSelectMode(editor.innerHTML);
                  }
                }}
                onBlur={(e) => {
                  if (applyingFormatRef.current) return;
                  if (restoringSnapshotRef.current) return;
                  const relatedTarget = e.relatedTarget as HTMLElement | null;
                  const editorContainer = e.currentTarget.closest('.space-y-4');
                  if (!(relatedTarget && editorContainer?.contains(relatedTarget))) {
                    pushImmediateState(getEditorSnapshot());
                  }
                  const text = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                  if (!text && selectedIndex === null) {
                    setShowRichToolbar(true);
                    if (richEditorRef.current) richEditorRef.current.innerHTML = '';
                  }
                }}
                className="rich-editor shadow-sm block w-full sm:text-sm rounded-md p-3 border outline-none overflow-y-auto overflow-x-hidden break-words transition-colors focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70 border-border resize-y min-h-[44px] max-h-[120px]"
                style={{ background: getBackgroundStyle(previewBg), wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%', caretColor: 'auto' }}
              />
            </div>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (!isOverLimit && newAnnouncementText.trim()) {
                  addAnnouncement();
                }
              }}
              disabled={!newAnnouncementText.trim() || isOverLimit}
              className="h-11 px-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-on-primary bg-primary hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 self-start"
            >
              {selectedIndex !== null ? 'Update' : 'Add'}
            </button>
          </div>

          {/* Footer hint with character count and limit warning */}
          <div className="mt-2 flex items-center justify-between shrink-0">
            <span className={`text-[11px] leading-none ${isOverLimit ? 'text-red-500 font-medium' : 'text-on-surface-variant/50'}`}>
              {(newAnnouncementText.replace(/<[^>]*>/g, '').replace(/\u200B/g, '').length)}&nbsp;/&nbsp;120 chars
              {isOverLimit && ' ⚠️ Limit exceeded'}
            </span>
            <span className="text-[11px] text-on-surface-variant/50 leading-none">
              Press ↵ Enter to add
            </span>
          </div>
        </div>

      </div>

      <AnnouncementEditorPopups />
    </div>
  );
}