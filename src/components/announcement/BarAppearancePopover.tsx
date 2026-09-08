"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
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

export function BarAppearancePopover({
  triggerRef,
  open,
  onClose,
}: BarAppearancePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const themesContainerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [tab, setTab] = useState<Tab>("presets");
  const [hasScrolled, setHasScrolled] = useState(false);

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

  // Sync tab with isThemeMode when popover opens
  useEffect(() => {
    if (open) {
      setTab(isThemeMode ? "presets" : "custom");
      setHasScrolled(false); // Reset scroll state when popover opens
    }
  }, [open, isThemeMode]);

  // Scroll to active theme silently when popover opens
  useEffect(() => {
    // Only run once per open, when on presets tab
    if (!open || tab !== "presets" || hasScrolled || !themesContainerRef.current) return;

    const container = themesContainerRef.current;
    const activeButton = container.querySelector(
      'button[aria-pressed="true"]'
    ) as HTMLButtonElement | null;

    if (activeButton) {
      // Use requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        // Calculate position manually for precise control
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        const scrollOffset = buttonRect.top - containerRect.top - containerRect.height / 2 + buttonRect.height / 2;

        container.scrollTo({
          top: container.scrollTop + scrollOffset,
          behavior: "instant", // Silent, no animation
        });

        setHasScrolled(true);
      });
    }
  }, [open, tab, activeThemeId, hasScrolled]);

  // Position the popover
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPOVER_WIDTH = 360;
    const gap = 6;
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8;
    }
    setPos({ top: rect.bottom + gap, left });
  }, [open, triggerRef]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const POPOVER_WIDTH = 360;
      const gap = 6;
      let left = rect.left;
      if (left + POPOVER_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPOVER_WIDTH - 8;
      }
      setPos({ top: rect.bottom + gap, left });
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, triggerRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !pos || typeof document === "undefined") return null;

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === "custom") {
      updateBg({});
    }
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 360,
        zIndex: 9990,
      }}
      className="rounded-2xl border border-border bg-surface-elevated shadow-2xl overflow-hidden"
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

      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => handleTabChange("presets")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            tab === "presets"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Themes
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("custom")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            tab === "custom"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Build Your Own
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === "presets" && (
          <div
            ref={themesContainerRef}
            className="campaign-custom-scrollbar overflow-y-auto"
            style={{ maxHeight: 220 }}
          >
            <div className="grid grid-cols-2 gap-2">
              {announcementThemes.map((theme) => {
                const isActive = activeThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      applyAnnouncementTheme(theme);
                    }}
                    aria-pressed={isActive}
                    className={`relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all border ${
                      isActive
                        ? "border-primary ring-1 ring-primary/60"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {/* Colour swatch */}
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
        )}

        {tab === "custom" && (
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