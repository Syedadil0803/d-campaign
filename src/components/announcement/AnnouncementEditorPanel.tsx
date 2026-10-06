'use client';

import { CalendarClock, Sparkles, Trash2, X } from 'lucide-react';
import { getBackgroundStyle } from '@/lib/utils';
import { rgbToHex } from '@/lib/editor/colorUtils';
import RichTextToolbar from '@/components/shared/RichTextToolbar';
import { useAnnouncementEditor } from '@/components/announcement/AnnouncementEditorContext';
import { AnnouncementEditorPopups } from '@/components/announcement/AnnouncementEditorPopups';
import { AnnouncementDraftChip } from '@/components/announcement/AnnouncementDraftChip';
import { startsLater } from '@/lib/announcement/stagedDraft';
import { canSchedule, liveIndices, SCHEDULE_LIMIT_MESSAGE } from '@/lib/announcement/listSections';
import { clipChars, countChars, messageLength, MESSAGE_LIMIT } from '@/lib/announcement/messageLength';

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
    config,
    staged,
    stagedIndex,
    editStaged,
    discardStaged,
    publishStaged,
    publishingStaged,
    stagedPosition,
    setStagedPosition,
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
    clearSelection,
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

  // Counted as a reader sees it: spaces, letters and whole emoji once each.
  const charCount = messageLength(newAnnouncementText);
  const isOverLimit = charCount > MESSAGE_LIMIT;

  /**
   * A future start date turns staging into scheduling, so the button says so
   * before the click rather than after it.
   */
  const stageLabel = startsLater(selectedStartDate) ? 'Schedule' : 'Stage draft';

  /**
   * All three schedule slots are taken and this message would need a fourth.
   * Editing a message that is already scheduled doesn't count — it keeps its
   * own slot.
   */
  /** Live messages in order — the slots a new message can be placed between. */
  const liveMessages = liveIndices(config.announcementBar.announcements).map(
    (i) => config.announcementBar.announcements[i],
  );

  const scheduleFull =
    startsLater(selectedStartDate) &&
    !canSchedule(config.announcementBar.announcements, selectedIndex);

  return (
    <div className="box-border h-[370px] rounded-2xl border border-border campaign-card-surface p-5 shadow-sm flex flex-col transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">

      {/* Header — the original title and description; the Manage
          Announcements card beside it uses the same, so they sit level. */}
      <div className="shrink-0 flex flex-col gap-1">
        <h4 className="text-xl font-bold leading-[28px] text-on-surface">
          Announcement Content
        </h4>
        <p className="text-sm leading-[20px] text-on-surface-variant">
          Create your message, optionally attach a link, and add timing only if needed.
        </p>
      </div>
      <div className="my-5 h-[1px] w-full shrink-0 bg-border" />

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 min-h-0">

        {/*
          With a message staged there is nothing left to compose, so the chip
          takes the place of the whole toolbar-and-input body. Its three
          actions are the only ways on from here.
        */}
        {staged ? (
          <div className="flex flex-1 flex-col min-h-0">
            <AnnouncementDraftChip
              staged={staged}
              replacing={stagedIndex != null}
              onEdit={editStaged}
              onDiscard={discardStaged}
              onPublish={publishStaged}
              publishing={publishingStaged}
              position={stagedIndex == null && !startsLater(staged.startDate) ? {
                value: Math.min(stagedPosition, liveMessages.length + 1),
                max: liveMessages.length + 1,
                onChange: (value) => setStagedPosition(Math.min(Math.max(value, 1), liveMessages.length + 1)),
                liveTexts: liveMessages.map((m) => m.text),
              } : undefined}
            />
            {/* The same footer rule as the compose state, so the card keeps its
                shape and the line stays level with the list's footer. */}
            <p className="mt-3 flex shrink-0 items-center border-t border-border pt-2 text-[11px] leading-4 text-on-surface-variant/70">
              Saved to your account — you can publish it from any device.
            </p>
          </div>
        ) : (
          <>

        {/* Toolbar sub-card */}
        {/* Roomier than before: the card has the height, and a toolbar with
            space around it reads as the main control rather than squeezed in. */}
        <div className="shrink-0 rounded-lg border border-border bg-surface-subtle px-4 py-6">
          <div className="flex items-center justify-between mb-4">
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
                firmBorder
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
                      className={`cursor-pointer flex items-center gap-1 px-2 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed text-xs ${selectedUrl ? 'border-primary/80 bg-primary/10 text-primary' : 'border-on-surface/25 hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
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
                      className={`cursor-pointer flex items-center gap-1 px-2 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed text-xs ${(selectedStartDate || selectedEndDate) ? 'border-primary/80 bg-primary/10 text-primary' : 'border-on-surface/25 hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
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
                    className="cursor-pointer flex items-center gap-1 px-2 py-1 border rounded transition-colors shrink-0 border-on-surface/25 hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant text-xs"
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
        <div className="mt-6 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] leading-none">
              Message
            </label>
            {/* Empties the text only — link, dates and the row being edited are
                kept. Snapshotted first, so Ctrl+Z brings the text back. */}
            <div className="flex items-center gap-3">
            {/* Editing a published message: the way out without changing it. */}
            {selectedIndex !== null && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); clearSelection(); }}
                className="flex items-center gap-1 text-[11px] font-medium leading-none text-primary transition-colors hover:opacity-80"
                title="Stop editing — the published message stays as it is"
              >
                <X className="h-3 w-3" />
                Cancel edit
              </button>
            )}
            {/* Always shown so its place never jumps; disabled while empty.
                Styled like the list's old "Clear all". */}
            <button
              type="button"
              disabled={!newAnnouncementText.replace(/<[^>]*>/g, '').replace(/\u200B/g, '').trim()}
              onMouseDown={(e) => {
                e.preventDefault();
                const editor = richEditorRef.current;
                if (!editor || !newAnnouncementText.replace(/<[^>]*>/g, '').replace(/\u200B/g, '').trim()) return;
                pushImmediateState(getEditorSnapshot());
                editor.innerHTML = '';
                onRichTextInput();
                setActiveFormats({ bold: false, italic: false, size: 'md', color: editorDefaultColor });
                editor.focus();
              }}
              className="flex items-center gap-1 text-[11px] font-medium leading-none text-on-surface-variant transition-colors hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-on-surface-variant"
              title="Clear the message (Ctrl+Z to undo)"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
            </div>
          </div>

          {/* One line to start, growing with the text to two (the 120-char
              limit fits in two). The card is 370px to match Manage
              Announcements, which leaves no room for a third. */}
          <div className="flex gap-2 mt-2">
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
                  const remaining = MESSAGE_LIMIT - countChars(richEditorRef.current?.textContent ?? '');

                  if (remaining <= 0) return;
                  // Truncate to what fits, without splitting an emoji
                  const pasteText = clipChars(text, remaining);
                  document.execCommand('insertText', false, pasteText);
                }}
                onMouseDown={() => { }}
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
                    if (countChars(richEditorRef.current?.textContent ?? '') >= MESSAGE_LIMIT) {
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
                className="rich-editor shadow-sm block w-full sm:text-sm rounded-md p-3 border outline-none overflow-y-auto overflow-x-hidden break-words transition-colors focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70 border-on-surface/25 min-h-[44px] max-h-[64px]"
                //add here in styles background: getBackgroundStyle(previewBg) for the preview background color
                style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%', caretColor: 'auto' }}
              />
            </div>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (!isOverLimit && newAnnouncementText.trim() && !scheduleFull) {
                  addAnnouncement();
                }
              }}
              disabled={!newAnnouncementText.trim() || isOverLimit || scheduleFull}
              title={scheduleFull ? SCHEDULE_LIMIT_MESSAGE : undefined}
              className="h-11 px-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-on-primary bg-primary hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 self-end"
            >
              {stageLabel}
            </button>
          </div>

          {/* Shown only once all three slots are taken and a future date is
              picked — the moment the Schedule button above stops working. */}
          {scheduleFull && (
            <p className="mt-2 flex shrink-0 items-start gap-1.5 text-[11px] leading-4 text-amber-600 dark:text-amber-400">
              <CalendarClock className="mt-px h-3.5 w-3.5 shrink-0" />
              {SCHEDULE_LIMIT_MESSAGE}
            </p>
          )}

          {/*
            Footer: character count and the Enter hint, pinned to the card's
            base with a rule. Same classes as the Manage Announcements footer,
            so the two rules sit level across the pair.
          */}
          <div className="mt-auto flex shrink-0 items-center justify-between border-t border-border pt-2 leading-4">
            <span className={`text-[11px] leading-none ${isOverLimit ? 'text-red-500 font-medium' : 'text-on-surface-variant/50'}`}>
              {charCount}&nbsp;/&nbsp;{MESSAGE_LIMIT} chars
              {isOverLimit && ' ⚠️ Limit exceeded'}
            </span>
            <span className="text-[11px] text-on-surface-variant/50 leading-none">
              Press ↵ Enter to {stageLabel.toLowerCase()}
            </span>
          </div>
        </div>
          </>
        )}

      </div>

      <AnnouncementEditorPopups />
    </div>
  );
}