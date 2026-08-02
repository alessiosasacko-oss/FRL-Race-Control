"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudOff, Radio, RefreshCw, TriangleAlert } from "lucide-react";
import {
  APP_DATA_CHANNEL,
  APP_DATA_EVENT,
  APP_DATA_STORAGE_KEY,
  isAppDataChangedEvent,
  type AppDataChangedEvent,
} from "@/lib/live/data-events";

const REFRESH_INTERVAL_MS = 15_000;
const MIN_REFRESH_GAP_MS = 5_000;
const EVENT_DEBOUNCE_MS = 500;

type LiveStatus = "live" | "updated" | "offline" | "pending" | "failed";

export default function AppAutoRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<LiveStatus>("live");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const dirtyForms = useRef(new Set<HTMLFormElement>());
  const submittedForms = useRef(new Set<HTMLFormElement>());
  const pendingBackgroundRefresh = useRef(false);
  const lastRefreshAt = useRef(0);
  const refreshInFlight = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRunner = useRef<(force?: boolean) => void>(() => undefined);

  const runRefresh = useCallback((force = false) => {
    if (typeof document === "undefined") return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    if (!force && dirtyForms.current.size > 0) {
      pendingBackgroundRefresh.current = true;
      setStatus("pending");
      return;
    }
    if (refreshInFlight.current || isPending) return;

    const wait = MIN_REFRESH_GAP_MS - (Date.now() - lastRefreshAt.current);
    if (wait > 0) {
      if (gapTimer.current) clearTimeout(gapTimer.current);
      gapTimer.current = setTimeout(() => refreshRunner.current(force), wait);
      return;
    }

    refreshInFlight.current = true;
    pendingBackgroundRefresh.current = false;
    setStatus("live");
    try {
      startTransition(() => router.refresh());
      const now = Date.now();
      lastRefreshAt.current = now;
      setUpdatedAt(now);
      setStatus("updated");
      inFlightTimer.current = setTimeout(() => {
        refreshInFlight.current = false;
      }, MIN_REFRESH_GAP_MS);
    } catch {
      refreshInFlight.current = false;
      setStatus("failed");
    }
  }, [isPending, router]);

  useEffect(() => {
    refreshRunner.current = runRefresh;
  }, [runRefresh]);

  const queueEventRefresh = useCallback((force = false) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runRefresh(force), EVENT_DEBOUNCE_MS);
  }, [runRefresh]);

  const flushDeferredRefresh = useCallback(() => {
    if (dirtyForms.current.size === 0 && pendingBackgroundRefresh.current) {
      queueEventRefresh(false);
    }
  }, [queueEventRefresh]);

  useEffect(() => {
    const markDirty = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const form = target.closest("form");
      if (form) dirtyForms.current.add(form);
    };
    const markSubmitted = (event: Event) => {
      if (event.target instanceof HTMLFormElement) submittedForms.current.add(event.target);
    };
    const markClean = (event: Event) => {
      const form = event.target instanceof HTMLFormElement
        ? event.target
        : event.target instanceof HTMLElement
          ? event.target.closest("form")
          : null;
      if (!form) return;
      dirtyForms.current.delete(form);
      submittedForms.current.delete(form);
      flushDeferredRefresh();
    };
    const discardClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest<HTMLElement>("[data-live-discard-form]");
      if (button) markClean({ target: button } as unknown as Event);
    };
    const ownDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<AppDataChangedEvent>).detail;
      if (!isAppDataChangedEvent(detail)) return;
      for (const form of submittedForms.current) {
        dirtyForms.current.delete(form);
        form.closest("dialog")?.close();
      }
      submittedForms.current.clear();
      queueEventRefresh(true);
    };

    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("submit", markSubmitted, true);
    document.addEventListener("reset", markClean, true);
    document.addEventListener("cancel", markClean, true);
    document.addEventListener("click", discardClick, true);
    window.addEventListener(APP_DATA_EVENT, ownDataChanged);
    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("submit", markSubmitted, true);
      document.removeEventListener("reset", markClean, true);
      document.removeEventListener("cancel", markClean, true);
      document.removeEventListener("click", discardClick, true);
      window.removeEventListener(APP_DATA_EVENT, ownDataChanged);
    };
  }, [flushDeferredRefresh, queueEventRefresh]);

  useEffect(() => {
    const backgroundRefresh = () => runRefresh(false);
    const visibilityRefresh = () => {
      if (document.visibilityState === "visible") backgroundRefresh();
    };
    const onlineRefresh = () => {
      setStatus("live");
      backgroundRefresh();
    };
    const offline = () => setStatus("offline");

    window.addEventListener("focus", backgroundRefresh);
    window.addEventListener("online", onlineRefresh);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visibilityRefresh);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        backgroundRefresh();
      }
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", backgroundRefresh);
      window.removeEventListener("online", onlineRefresh);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibilityRefresh);
      window.clearInterval(interval);
    };
  }, [runRefresh]);

  useEffect(() => {
    const receive = (value: unknown) => {
      if (isAppDataChangedEvent(value)) queueEventRefresh(false);
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== APP_DATA_STORAGE_KEY || !event.newValue) return;
      try {
        receive(JSON.parse(event.newValue));
      } catch {
        // Invalid cross-tab payloads are ignored.
      }
    };
    const channel = "BroadcastChannel" in window
      ? new BroadcastChannel(APP_DATA_CHANNEL)
      : null;
    if (channel) channel.onmessage = (event) => receive(event.data);
    window.addEventListener("storage", storage);
    return () => {
      channel?.close();
      window.removeEventListener("storage", storage);
    };
  }, [queueEventRefresh]);

  useEffect(() => {
    const refreshFailure = () => {
      if (!refreshInFlight.current) return;
      refreshInFlight.current = false;
      setStatus("failed");
    };
    window.addEventListener("error", refreshFailure);
    window.addEventListener("unhandledrejection", refreshFailure);
    return () => {
      window.removeEventListener("error", refreshFailure);
      window.removeEventListener("unhandledrejection", refreshFailure);
    };
  }, []);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (gapTimer.current) clearTimeout(gapTimer.current);
    if (inFlightTimer.current) clearTimeout(inFlightTimer.current);
  }, []);

  return <LiveIndicator status={status} updatedAt={updatedAt} />;
}

function LiveIndicator({ status, updatedAt }: { status: LiveStatus; updatedAt: number | null }) {
  const content = status === "offline"
    ? { icon: CloudOff, label: "Offline", style: "border-slate-700 text-slate-400" }
    : status === "pending"
      ? { icon: TriangleAlert, label: "Neue Daten verfügbar", style: "border-amber-500/30 text-amber-200" }
      : status === "failed"
        ? { icon: TriangleAlert, label: "Aktualisierung fehlgeschlagen", style: "border-red-500/30 text-red-200" }
        : status === "updated"
          ? { icon: Check, label: "Aktualisiert", style: "border-emerald-500/30 text-emerald-200" }
          : { icon: Radio, label: "Live", style: "border-cyan-500/30 text-cyan-200" };
  const Icon = content.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      title={updatedAt ? `Zuletzt aktualisiert: ${new Intl.DateTimeFormat("de-DE", { timeStyle: "medium" }).format(new Date(updatedAt))}` : content.label}
      className={`fixed right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex min-h-11 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border bg-slate-950/90 px-3 text-xs font-bold shadow-lg backdrop-blur lg:right-4 lg:bottom-4 ${content.style}`}
    >
      {status === "live" && updatedAt ? <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" /> : <Icon size={14} />}
      <span className="truncate">{content.label}</span>
    </div>
  );
}
