"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudOff, Radio, RefreshCw, TriangleAlert } from "lucide-react";
import {
  APP_DATA_CHANNEL,
  APP_DATA_EVENT,
  APP_DATA_STORAGE_KEY,
  APP_FORM_CLEAN_EVENT,
  APP_FORM_DIRTY_EVENT,
  broadcastAppDataChanged,
  isAppDataChangedEvent,
  type AppDataChangedEvent,
} from "@/lib/live/data-events";
import {
  canClaimPollingLeadership,
  createPollingLeaderLease,
  parsePollingLeaderLease,
} from "@/lib/live/leader-lease";
import {
  changedRevisionScopes,
  nextRevisionBackoff,
  parseRevisionSnapshot,
  type RevisionSnapshot,
} from "@/lib/live/revision-client";

const REVISION_POLL_MS = 45_000;
const LEADER_LEASE_MS = 70_000;
const LEADER_HEARTBEAT_MS = 20_000;
const LEADER_STORAGE_KEY = "frl-live-poll-leader";
const MIN_REFRESH_GAP_MS = 5_000;
const EVENT_DEBOUNCE_MS = 500;

type LiveStatus = "live" | "updated" | "offline" | "pending" | "failed";

export default function AppAutoRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<LiveStatus>("live");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const dirtyForms = useRef(new Set<HTMLFormElement>());
  const explicitDirtyCount = useRef(0);
  const submittedForms = useRef(new Set<HTMLFormElement>());
  const pendingBackgroundRefresh = useRef(false);
  const lastRefreshAt = useRef(0);
  const refreshInFlight = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRunner = useRef<(force?: boolean) => void>(() => undefined);
  const metrics = useRef({ skipped: 0, executed: 0 });

  const hasDirtyState = useCallback(
    () => dirtyForms.current.size > 0 || explicitDirtyCount.current > 0,
    [],
  );

  const runRefresh = useCallback((force = false) => {
    if (typeof document === "undefined") return;
    if (!navigator.onLine) {
      setStatus("offline");
      metrics.current.skipped += 1;
      return;
    }
    if (!force && hasDirtyState()) {
      pendingBackgroundRefresh.current = true;
      setStatus("pending");
      metrics.current.skipped += 1;
      return;
    }
    if (refreshInFlight.current || isPending) {
      metrics.current.skipped += 1;
      return;
    }

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
      metrics.current.executed += 1;
      setUpdatedAt(now);
      setStatus("updated");
      inFlightTimer.current = setTimeout(() => {
        refreshInFlight.current = false;
      }, MIN_REFRESH_GAP_MS);
    } catch {
      refreshInFlight.current = false;
      setStatus("failed");
    }
  }, [hasDirtyState, isPending, router]);

  useEffect(() => {
    refreshRunner.current = runRefresh;
  }, [runRefresh]);

  const queueEventRefresh = useCallback((force = false) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runRefresh(force), EVENT_DEBOUNCE_MS);
  }, [runRefresh]);

  const flushDeferredRefresh = useCallback(() => {
    if (!hasDirtyState() && pendingBackgroundRefresh.current) queueEventRefresh(false);
  }, [hasDirtyState, queueEventRefresh]);

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
    const explicitlyDirty = () => {
      explicitDirtyCount.current += 1;
    };
    const explicitlyClean = () => {
      explicitDirtyCount.current = Math.max(0, explicitDirtyCount.current - 1);
      flushDeferredRefresh();
    };

    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("submit", markSubmitted, true);
    document.addEventListener("reset", markClean, true);
    document.addEventListener("cancel", markClean, true);
    document.addEventListener("click", discardClick, true);
    window.addEventListener(APP_DATA_EVENT, ownDataChanged);
    window.addEventListener(APP_FORM_DIRTY_EVENT, explicitlyDirty);
    window.addEventListener(APP_FORM_CLEAN_EVENT, explicitlyClean);
    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("submit", markSubmitted, true);
      document.removeEventListener("reset", markClean, true);
      document.removeEventListener("cancel", markClean, true);
      document.removeEventListener("click", discardClick, true);
      window.removeEventListener(APP_DATA_EVENT, ownDataChanged);
      window.removeEventListener(APP_FORM_DIRTY_EVENT, explicitlyDirty);
      window.removeEventListener(APP_FORM_CLEAN_EVENT, explicitlyClean);
    };
  }, [flushDeferredRefresh, queueEventRefresh]);

  useEffect(() => {
    const refreshMetrics = metrics;
    const tabId = crypto.randomUUID();
    let revisionSnapshot: RevisionSnapshot | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let pollInFlight = false;
    let backoffMs = REVISION_POLL_MS;
    let stopped = false;

    const visibleAndOnline = () => document.visibilityState === "visible" && navigator.onLine;
    const claimLeadership = () => {
      if (!visibleAndOnline()) return false;
      const now = Date.now();
      const current = parsePollingLeaderLease(localStorage.getItem(LEADER_STORAGE_KEY));
      if (!canClaimPollingLeadership(current, tabId, now)) return false;
      const next = createPollingLeaderLease(tabId, now, LEADER_LEASE_MS);
      try {
        localStorage.setItem(LEADER_STORAGE_KEY, JSON.stringify(next));
        return parsePollingLeaderLease(localStorage.getItem(LEADER_STORAGE_KEY))?.owner === tabId;
      } catch {
        return true;
      }
    };
    const releaseLeadership = () => {
      try {
        const current = parsePollingLeaderLease(localStorage.getItem(LEADER_STORAGE_KEY));
        if (current?.owner === tabId) localStorage.removeItem(LEADER_STORAGE_KEY);
      } catch {
        // Another visible tab can reclaim the lease after its short expiry.
      }
    };
    const schedule = (delay: number) => {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => void checkRevisions(), delay);
    };
    const checkRevisions = async () => {
      if (stopped || !visibleAndOnline() || pollInFlight || !claimLeadership()) return;
      pollInFlight = true;
      try {
        const response = await fetch("/api/live/revisions", {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`revision-endpoint-${response.status}`);
        const next = parseRevisionSnapshot(await response.json());
        if (!next) throw new Error("invalid-revision-response");
        const changed = changedRevisionScopes(revisionSnapshot, next);
        revisionSnapshot = next;
        backoffMs = REVISION_POLL_MS;
        if (changed.length > 0) {
          broadcastAppDataChanged(changed);
          queueEventRefresh(false);
        }
        setStatus("live");
        schedule(REVISION_POLL_MS);
      } catch {
        setStatus("failed");
        backoffMs = nextRevisionBackoff(backoffMs, REVISION_POLL_MS);
        schedule(backoffMs);
      } finally {
        pollInFlight = false;
      }
    };
    const checkNow = () => {
      if (visibleAndOnline()) {
        setStatus("live");
        schedule(0);
      }
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "visible") checkNow();
      else releaseLeadership();
    };
    const offline = () => {
      setStatus("offline");
      releaseLeadership();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === LEADER_STORAGE_KEY && visibleAndOnline()) schedule(250);
    };

    window.addEventListener("focus", checkNow);
    window.addEventListener("online", checkNow);
    window.addEventListener("offline", offline);
    window.addEventListener("storage", storageChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    heartbeatTimer = setInterval(() => {
      claimLeadership();
    }, LEADER_HEARTBEAT_MS);
    checkNow();

    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      releaseLeadership();
      window.removeEventListener("focus", checkNow);
      window.removeEventListener("online", checkNow);
      window.removeEventListener("offline", offline);
      window.removeEventListener("storage", storageChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
      if (process.env.NODE_ENV === "development") {
        console.debug("[live-refresh] session metrics", refreshMetrics.current);
      }
    };
  }, [queueEventRefresh]);

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
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(APP_DATA_CHANNEL) : null;
    if (channel) channel.onmessage = (event) => receive(event.data);
    window.addEventListener("storage", storage);
    return () => {
      channel?.close();
      window.removeEventListener("storage", storage);
    };
  }, [queueEventRefresh]);

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
