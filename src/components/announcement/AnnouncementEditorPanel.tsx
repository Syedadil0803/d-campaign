'use client';

import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { getBackgroundStyle } from '@/lib/utils';
import { rgbToHex } from '@/lib/editor/richTextUtils';
import RichTextToolbar from '@/components/shared/RichTextToolbar';
import { AnnouncementLinkPopup } from '@/components/announcement/AnnouncementLinkPopup';
import { AnnouncementSchedulePopup } from '@/components/announcement/AnnouncementSchedulePopup';
import { AnnouncementStylePanel } from '@/components/announcement/AnnouncementStylePanel';
import { useAnnouncementEditor } from '@/components/announcement/AnnouncementEditorContext';

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
    actionMenuIndex,
    actionMenuPos,
    actionMenuRef,
    activeFormats,
    annCountryBtnRef,
    annCountryMenuRef,
    annCountryPos,
    applyColor,
    applyEditorSnapshot,
    applyLinkSnapshot,
    backgroundTypeBtnRef,
    backgroundTypeMenuRef,
    backgroundTypePos,
    cancelCloseActionMenu,
    detectFormats,
    directionBtnRef,
    directionMenuRef,
    directionPos,
    editorDefaultColor,
    endDateCalendarRef,
    endDateView,
    ensureDefaultFontSize,
    formatText,
    getEditorSnapshot,
    getLinkSnapshot,
    handleMenuAddLink,
    handleMenuDelete,
    handleMenuSchedule,
    linkBtnRef,
    linkPopupRef,
    linkPos,
    newAnnouncementText,
    pushImmediateState,
    pushLinkState,
    pushTypingState,
    redoEditor,
    redoLink,
    richEditorRef,
    saveSelection,
    scheduleBtnRef,
    scheduleCloseActionMenu,
    schedulePopupRef,
    schedulePos,
    selectedCountryCode,
    selectedCtaType,
    selectedEndDate,
    selectedIndex,
    selectedOpenInNewTab,
    selectedStartDate,
    selectedUrl,
    selectedWhatsappNumber,
    setActiveFormats,
    setAnnCountryPos,
    setEndDateView,
    setSelectedCountryCode,
    setSelectedCtaType,
    setSelectedEndDate,
    setSelectedOpenInNewTab,
    setSelectedStartDate,
    setSelectedUrl,
    setSelectedWhatsappNumber,
    setShowAnnCountryDropdown,
    setShowBackgroundTypeDropdown,
    setShowDirectionDropdown,
    setShowEndDateCalendar,
    setShowLinkPopup,
    setShowRichToolbar,
    setShowSchedulePopup,
    setShowShortcutsTip,
    setShowStartDateCalendar,
    setStartDateView,
    shortcutsTipShown,
    showAnnCountryDropdown,
    showBackgroundTypeDropdown,
    showDirectionDropdown,
    showEndDateCalendar,
    showLinkPopup,
    showSchedulePopup,
    showStartDateCalendar,
    startDateCalendarRef,
    startDateView,
    undoEditor,
    undoLink,
    activeFormatsRef,
    addAnnouncement,
    applyFormatToAll,
    applyingFormatRef,
    bg,
    closePopupAndFocusEditor,
    detectFormatsForSelectMode,
    isDeletingRef,
    justDeletedStyledRef,
    linkDeletingRef,
    onRichTextInput,
    openChatGptWithPrompt,
    previewBg,
    restoringSnapshotRef,
    scheduleRangeInvalid,
    setPreviewDirection,
    updateBg,
    updateBgWithHistory,
  } = useAnnouncementEditor();

  return (
    <div className="space-y-5 rounded-2xl border border-border campaign-card-surface p-4 shadow-sm flex flex-col h-[490px] transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">
      <div className="border-b border-border pb-4">
        <h4 className="text-2xl font-semibold leading-8 text-on-surface">Announcement Content</h4>
        <p className="mt-2 text-sm text-on-surface-variant">Create your message, optionally attach a link, and add timing only if needed.</p>
      </div>

      {/* Announcement Input */}
      <div className="flex-1 flex flex-col justify-between">
        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] mb-4">Message</label>

        {/* Rich Text Toolbar + Link/Schedule buttons — same row, show/hide with focus */}
        <div className="mb-4">
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
                    // No selection in editor: apply to all text or track for future
                    const hasContent = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                    if (hasContent) {
                      pushImmediateState(getEditorSnapshot());
                      applyFormatToAll(() => formatText(format));
                    } else {
                      // Empty editor: just track the format for future typing
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
                    // No selection in editor: apply to all text or track for future
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
                    <div className="border-l border-border h-4 mx-0.5 shrink-0" />

                    <button
                      ref={linkBtnRef}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!newAnnouncementText.trim()) return;
                        setShowLinkPopup(!showLinkPopup);
                        setShowSchedulePopup(false);
                      }}
                      disabled={!newAnnouncementText.trim()}
                      className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${selectedUrl ? 'border-primary/80 bg-primary/10 text-primary' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                      title={newAnnouncementText.trim() ? 'Add link' : 'Enter text first'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </button>

                    <button
                      ref={scheduleBtnRef}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!newAnnouncementText.trim()) return;
                        // Don't let the toggle close the popup while its
                        // date range is invalid — fix it or press Clear.
                        if (showSchedulePopup && scheduleRangeInvalid) return;
                        setShowSchedulePopup(!showSchedulePopup);
                        setShowLinkPopup(false);
                      }}
                      disabled={!newAnnouncementText.trim()}
                      className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${(selectedStartDate || selectedEndDate) ? 'border-primary/80 bg-primary/10 text-primary' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                      title={newAnnouncementText.trim() ? 'Schedule' : 'Enter text first'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
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
                    className="cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant ml-1"
                    title="Open ChatGPT with a prompt"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                }
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface-variant mb-2">Enter text below</p>
            <div ref={richEditorRef} contentEditable suppressContentEditableWarning
              spellCheck={true}
              onInput={onRichTextInput}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
              onMouseDown={() => {
                // Click in editor resets styling session
              }}
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

                // After delete, clean up empty styled nodes
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  const editor = richEditorRef.current;
                  // Remove empty styled spans and wrappers
                  editor.querySelectorAll('span[style], b, strong, i, em').forEach((el) => {
                    if (!el.textContent?.replace(/\u200B/g, '').trim()) {
                      el.remove();
                    }
                  });

                  const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                  if (!hasContent) {
                    setActiveFormats({ bold: false, italic: false, size: 'md', color: editorDefaultColor });
                    editor.innerHTML = '';
                    justDeletedStyledRef.current = false;
                    return;
                  }
                  // Mark that we just deleted — next typed char should use detected formats
                  justDeletedStyledRef.current = true;
                  // Use DOM-walking detection (not queryCommandState which reads stale context)
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
                // Any keystroke ends the styling session

                // ── 1. Selection overwrite — snapshot before replacing selected text ──
                // A deliberate selection+overwrite always starts a NEW session
                if (!e.metaKey && !e.ctrlKey) {
                  const sel = window.getSelection();
                  if (
                    sel &&
                    !sel.isCollapsed &&
                    richEditorRef.current?.contains(sel.anchorNode) &&
                    (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')
                  ) {
                    pushImmediateState(getEditorSnapshot());
                    // Typing over a selection is a typing run, not a delete
                    // run — leave the lock off so the rest of the word
                    // collapses into this one step.
                    isDeletingRef.current =
                      e.key === 'Backspace' || e.key === 'Delete';
                  }
                }

                // ── 2. First Backspace/Delete — snapshot before destruction begins ──
                if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.ctrlKey) {
                  const sel = window.getSelection();
                  if (sel?.isCollapsed && !isDeletingRef.current) {
                    isDeletingRef.current = true;
                    pushImmediateState(getEditorSnapshot());
                  }
                } else if (
                  (e.key.length === 1 || e.key === 'Enter') &&
                  !e.metaKey &&
                  !e.ctrlKey
                ) {
                  // Ordinary typing. Snapshot BEFORE the character lands,
                  // so undo restores the text as it was; the stack's
                  // coalescing window folds the rest of the burst in.
                  if (isDeletingRef.current) {
                    // Typing after a delete run ends that run and opens its
                    // own step, so the words survive one Ctrl+Z instead of
                    // being swallowed together with the deletion.
                    isDeletingRef.current = false;
                    pushImmediateState(getEditorSnapshot());
                  } else {
                    pushTypingState(getEditorSnapshot());
                  }
                }

                // ── 3. Suppress native undo/redo ──
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
                  // After undo/redo, reset delete mode
                  isDeletingRef.current = false;
                  return;
                }

                // ── 4. Enter to submit ──
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addAnnouncement();
                  return;
                }

                // ── 5. Seed empty editor ──
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
                    // After deleting styled text, force-insert with surrounding style
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
                  if (hasContent) {
                    detectFormatsForSelectMode(editor.innerHTML);
                  }
                }
              }}
              onBlur={(e) => {
                if (applyingFormatRef.current) return;
                if (restoringSnapshotRef.current) return;

                // Skip if focus moved to toolbar or editor UI (not a true blur)
                const relatedTarget = e.relatedTarget as HTMLElement | null;
                const editorContainer = e.currentTarget.closest('.space-y-4');
                if (relatedTarget && editorContainer?.contains(relatedTarget)) {
                  // Focus stayed inside editor UI — skip snapshot
                } else {
                  // True blur — capture final state
                  pushImmediateState(getEditorSnapshot());
                }

                const text = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                if (!text && selectedIndex === null) {
                  setShowRichToolbar(true);
                  if (richEditorRef.current) richEditorRef.current.innerHTML = '';
                }
              }}
              className={`rich-editor shadow-sm block w-full sm:text-sm rounded-md p-3 border outline-none overflow-y-auto overflow-x-hidden h-[44px] min-h-[44px] max-h-[360px] resize-y break-words transition-colors focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70 border-border`}
              style={{ background: getBackgroundStyle(previewBg), wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%', caretColor: 'auto' }} />
          </div>
          <button onMouseDown={(e) => {
            e.preventDefault();
            addAnnouncement();
          }}
            disabled={!newAnnouncementText.trim()}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-on-primary bg-primary hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed self-end">
            {selectedIndex !== null ? 'Update' : 'Add'}
          </button>
        </div>
      </div>

      <AnnouncementLinkPopup
        open={showLinkPopup}
        position={linkPos}
        popupRef={linkPopupRef}
        closePopupAndFocusEditor={closePopupAndFocusEditor}
        selectedCtaType={selectedCtaType}
        setSelectedCtaType={setSelectedCtaType}
        selectedUrl={selectedUrl}
        setSelectedUrl={setSelectedUrl}
        selectedOpenInNewTab={selectedOpenInNewTab}
        setSelectedOpenInNewTab={setSelectedOpenInNewTab}
        selectedCountryCode={selectedCountryCode}
        setSelectedCountryCode={setSelectedCountryCode}
        selectedWhatsappNumber={selectedWhatsappNumber}
        setSelectedWhatsappNumber={setSelectedWhatsappNumber}
        showAnnCountryDropdown={showAnnCountryDropdown}
        setShowAnnCountryDropdown={setShowAnnCountryDropdown}
        annCountryPos={annCountryPos}
        setAnnCountryPos={setAnnCountryPos}
        annCountryBtnRef={annCountryBtnRef}
        annCountryMenuRef={annCountryMenuRef}
        linkDeletingRef={linkDeletingRef}
        getLinkSnapshot={getLinkSnapshot}
        applyLinkSnapshot={applyLinkSnapshot}
        pushLinkState={pushLinkState}
        undoLink={undoLink}
        redoLink={redoLink}
      />

      <AnnouncementSchedulePopup
        open={showSchedulePopup}
        position={schedulePos}
        popupRef={schedulePopupRef}
        closePopupAndFocusEditor={closePopupAndFocusEditor}
        scheduleRangeInvalid={scheduleRangeInvalid}
        selectedStartDate={selectedStartDate}
        setSelectedStartDate={setSelectedStartDate}
        selectedEndDate={selectedEndDate}
        setSelectedEndDate={setSelectedEndDate}
        startDateView={startDateView}
        setStartDateView={setStartDateView}
        endDateView={endDateView}
        setEndDateView={setEndDateView}
        showStartDateCalendar={showStartDateCalendar}
        setShowStartDateCalendar={setShowStartDateCalendar}
        showEndDateCalendar={showEndDateCalendar}
        setShowEndDateCalendar={setShowEndDateCalendar}
        startDateCalendarRef={startDateCalendarRef}
        endDateCalendarRef={endDateCalendarRef}
      />

      {actionMenuIndex !== null && actionMenuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={actionMenuRef}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseEnter={() => cancelCloseActionMenu()}
          onMouseLeave={() => scheduleCloseActionMenu()}
          style={{ position: 'absolute', top: actionMenuPos.top, left: actionMenuPos.left, zIndex: 9999 }}
          className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1 w-[180px]"
        >
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleMenuAddLink(actionMenuIndex); }}
            className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-subtle"
          >
            Add link
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleMenuSchedule(actionMenuIndex); }}
            className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-subtle"
          >
            Schedule
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleMenuDelete(actionMenuIndex); }}
            className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10"
          >
            Delete
          </button>
        </div>,
        document.body
      )}

      <AnnouncementStylePanel
        bg={bg}
        updateBg={updateBg}
        updateBgWithHistory={updateBgWithHistory}
        pushImmediateState={pushImmediateState}
        getEditorSnapshot={getEditorSnapshot}
        showBackgroundTypeDropdown={showBackgroundTypeDropdown}
        setShowBackgroundTypeDropdown={setShowBackgroundTypeDropdown}
        backgroundTypeBtnRef={backgroundTypeBtnRef}
        backgroundTypeMenuRef={backgroundTypeMenuRef}
        backgroundTypePos={backgroundTypePos}
        showDirectionDropdown={showDirectionDropdown}
        setShowDirectionDropdown={setShowDirectionDropdown}
        directionBtnRef={directionBtnRef}
        directionMenuRef={directionMenuRef}
        directionPos={directionPos}
        setPreviewDirection={setPreviewDirection}
      />
    </div>
  );
}
