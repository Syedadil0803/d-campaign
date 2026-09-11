"use client";

import { useEffect, useRef, useState, type RefObject, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Palette, Settings2 } from "lucide-react";
import {
  announcementThemes,
  themeBackgroundCss,
} from "@/lib/announcement/announcementThemes";
import { useAnnouncementEditor } from "@/components/announcement/AnnouncementEditorContext";
import { AnnouncementStylePanel } from "@/components/announcement/AnnouncementStylePanel";

type Tab = "presets" | "custom";

interface BarAppearancePopoverProps {
  triggerRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
}

const POPOVER_WIDTH = 360;
const GAP = 6;
const MAX_HEIGHT = 220;

export function BarAppearancePopover({
  triggerRef,
  open,
  onClose,
}: BarAppearancePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const themesContainerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("presets");

  const {
    activeThemeId,
    applyAnnouncementTheme,
    bg,
    updateBg,
    updateBgWithHistory,
    pushImmediateState,
    getEditorSnapshot,
    showDirectionDropdown,
    setShowDirectionDropdown,
    directionBtnRef,
    directionMenuRef,
    directionPos,
    setPreviewDirection,
    isThemeMode,
  } = useAnnouncementEditor();

  // Initialize tab ONLY when popover opens (closed → open transition)
  // Not on every isThemeMode change while already open
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setActiveTab(isThemeMode ? "presets" : "custom");
    }
    wasOpenRef.current = open;
  }, [open, isThemeMode]);

  // Calculate popover position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return null;

    const rect = triggerRef.current.getBoundingClientRect();
    let left = rect.left;

    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8;
    }

    return {
      top: rect.bottom + GAP,
      left: Math.max(8, left),
    };
  }, [triggerRef]);

  // Set position when popover opens
  useEffect(() => {
    if (!open) return;

    const newPosition = calculatePosition();
    if (newPosition) {
      setPosition(newPosition);
    }
  }, [open, calculatePosition]);

  // Auto-scroll to active theme - runs when popover is actually rendered
  useEffect(() => {
    if (!open || activeTab !== "presets" || !position) return;
    if (!themesContainerRef.current) return;

    const container = themesContainerRef.current;

    const scrollToActive = () => {
      const activeButton = container.querySelector(
        'button[aria-selected="true"]'
      ) as HTMLButtonElement | null;

      if (activeButton) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        const scrollOffset =
          buttonRect.top - containerRect.top - containerRect.height / 2 + buttonRect.height / 2;

        container.scrollTo({
          top: container.scrollTop + scrollOffset,
          behavior: "instant",
        });
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToActive();
      });
    });
  }, [open, activeTab, activeThemeId, position]);

  // Reposition on scroll/resize - ignore scrolls from inside popover
  useEffect(() => {
    if (!open) return;

    const handleReposition = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) {
        return;
      }
      const newPosition = calculatePosition();
      if (newPosition) {
        setPosition(newPosition);
      }
    };

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, calculatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      const isInsidePopover = popoverRef.current?.contains(target);
      const isInsideTrigger = triggerRef.current?.contains(target);

      if (!isInsidePopover && !isInsideTrigger) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open, onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "custom") {
      updateBg({});
    }
  };

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="rounded-2xl border border-white/10 bg-black/10 backdrop-blur-md shadow-2xl overflow-hidden"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 9990,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
          Customizer
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-md text-on-surface-variant hover:bg-surface-subtle hover:text-on-surface transition-colors"
          aria-label="Close appearance panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "presets"}
          onClick={() => handleTabChange("presets")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "presets"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Themes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "custom"}
          onClick={() => handleTabChange("custom")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "custom"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Build Your Own
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "presets" ? (
          <div
            ref={themesContainerRef}
            className="campaign-custom-scrollbar overflow-y-auto"
            style={{ maxHeight: MAX_HEIGHT }}
          >
            <div className="grid grid-cols-2 gap-2">
              {announcementThemes.map((theme) => {
                const isActive = activeThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      applyAnnouncementTheme(theme);
                    }}
                    className={`relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all border ${
                      isActive
                        ? "border-primary ring-1 ring-primary/60"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span
                      className="h-7 w-7 shrink-0 rounded-md border border-black/10"
                      style={{
                        background: themeBackgroundCss(theme.background),
                      }}
                    />
                    <span className="truncate text-xs font-medium text-on-surface leading-tight">
                      {theme.name}
                    </span>
                    {isActive && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <AnnouncementStylePanel
            bg={bg}
            updateBg={updateBg}
            updateBgWithHistory={updateBgWithHistory}
            pushImmediateState={pushImmediateState}
            getEditorSnapshot={getEditorSnapshot}
            showDirectionDropdown={showDirectionDropdown}
            setShowDirectionDropdown={setShowDirectionDropdown}
            directionBtnRef={directionBtnRef}
            directionMenuRef={directionMenuRef}
            directionPos={directionPos}
            setPreviewDirection={setPreviewDirection}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}