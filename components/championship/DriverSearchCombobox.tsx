"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { driverDropdownPosition } from "@/lib/championship/driver-dropdown-position";

type Props = {
  value: string;
  options: readonly { id: number; content: ReactNode }[];
  onQueryChange: (value: string) => void;
  onSelect: (id: number) => void;
  compact?: boolean;
};

/** The list lives outside the desktop scroll shell and the clipped mobile cards. */
export default function DriverSearchCombobox({ value, options, onQueryChange, onSelect, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const expanded = open && Boolean(value);
  const activeIndex = options.findIndex((option) => option.id === activeId);

  useLayoutEffect(() => {
    if (!expanded || !input.current || !list.current) return;
    const anchor = input.current;
    const menu = list.current;
    let frame = 0;
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const bounds = { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? document.documentElement.clientWidth, height: viewport?.height ?? window.innerHeight };
      let visibleTop = bounds.top, visibleBottom = bounds.top + bounds.height;
      let visibleLeft = bounds.left, visibleRight = bounds.left + bounds.width;
      for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const parentRect = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          visibleTop = Math.max(visibleTop, parentRect.top);
          visibleBottom = Math.min(visibleBottom, parentRect.bottom);
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          visibleLeft = Math.max(visibleLeft, parentRect.left);
          visibleRight = Math.min(visibleRight, parentRect.right);
        }
      }
      if (!anchor.getClientRects().length || rect.bottom <= visibleTop || rect.top >= visibleBottom || rect.right <= visibleLeft || rect.left >= visibleRight) {
        setOpen(false);
        return;
      }
      const position = driverDropdownPosition(rect, bounds, compact);
      Object.assign(menu.style, { left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`, transform: position.upwards ? "translateY(-100%)" : "none", visibility: "visible" });
    };
    const schedulePosition = (event?: Event) => {
      // Scrolling the options must not move the table or reposition the anchor.
      if (event?.target instanceof Node && menu.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    updatePosition();
    window.addEventListener("scroll", schedulePosition, true);
    window.addEventListener("resize", schedulePosition);
    window.visualViewport?.addEventListener("resize", schedulePosition);
    window.visualViewport?.addEventListener("scroll", schedulePosition);
    const observer = new ResizeObserver(() => schedulePosition());
    observer.observe(anchor);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedulePosition, true);
      window.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
    };
  }, [expanded, compact]);

  useEffect(() => {
    if (!expanded) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !input.current?.contains(event.target) && !list.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    const menu = list.current;
    const option = activeId === null ? null : document.getElementById(`${listId}-${activeId}`);
    if (!expanded || !menu || !option) return;
    // Only scroll the list, never scrollIntoView() the surrounding results table.
    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
  }, [activeId, expanded, listId]);

  function select(id: number) {
    onSelect(id);
    input.current?.focus({ preventScroll: true });
    setOpen(false);
    setActiveId(null);
  }

  return (
    <div className="relative">
      <span className="relative block">
        <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
        <input
          ref={input}
          data-result-cell
          role="combobox"
          aria-label="Fahrer suchen"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded && activeIndex >= 0 ? `${listId}-${activeId}` : undefined}
          autoComplete="off"
          value={value}
          onFocus={() => { setOpen(true); setActiveId(null); }}
          onChange={(event) => { onQueryChange(event.target.value); setOpen(true); setActiveId(null); if (list.current) list.current.scrollTop = 0; }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && value) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
              const next = event.key === "ArrowDown" ? (expanded ? activeIndex + 1 : 0) : (expanded && activeIndex >= 0 ? activeIndex - 1 : options.length - 1);
              setActiveId(options.length ? options[(next + options.length) % options.length].id : null);
            } else if (event.key === "Enter" && expanded) {
              event.preventDefault();
              event.stopPropagation();
              const option = options[Math.max(0, activeIndex)];
              if (option) select(option.id);
            } else if (event.key === "Escape" && expanded) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActiveId(null);
            } else if (event.key === "Tab") setOpen(false);
          }}
          placeholder="Fahrer suchen"
          className={`form-control min-h-11 pl-9 ${compact ? "" : "min-w-60"}`}
        />
      </span>
      {expanded ? createPortal(
        <div ref={list} id={listId} role="listbox" aria-label="Verfügbare Fahrer"
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-950 p-1 text-sm text-white shadow-2xl"
          style={{ visibility: "hidden" }}>
          {options.map((option) => (
            <button key={option.id} id={`${listId}-${option.id}`} type="button" role="option" tabIndex={-1}
              aria-selected={option.id === activeId}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option.id)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800 ${option.id === activeId ? "bg-slate-800 ring-1 ring-inset ring-cyan-400/50" : ""}`}>
              {option.content}
            </button>
          ))}
          {options.length === 0 ? <p className="px-3 py-3 text-sm text-slate-400">Kein verfügbarer Fahrer gefunden.</p> : null}
        </div>, document.body,
      ) : null}
    </div>
  );
}
