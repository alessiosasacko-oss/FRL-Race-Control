"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  X,
} from "lucide-react";
import DashboardWidgetContent, { dashboardWidgetSizeClasses } from "@/components/dashboard/DashboardWidgetContent";
import type { DashboardWidgetData } from "@/lib/dashboard/types";
import {
  APP_FORM_CLEAN_EVENT,
  APP_FORM_DIRTY_EVENT,
  broadcastAppDataChanged,
} from "@/lib/live/data-events";
import {
  createDefaultDashboardLayout,
  dashboardWidgetRegistry,
  dashboardViewports,
  resolveDashboardLayout,
  type DashboardLayout,
  type DashboardWidgetId,
  type DashboardWidgetItem,
  type DashboardWidgetSize,
} from "@/lib/dashboard/layout";
import {
  resetDashboardLayoutAction,
  saveDashboardLayoutAction,
} from "@/lib/dashboard/layout-actions";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const DashboardEditorGrid = lazy(() => import("./DashboardEditorGrid"));

const sizeLabels: Record<DashboardWidgetSize, string> = {
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  full: "Volle Breite",
};

export default function PersonalDashboard({
  data,
  pinnedContent,
  initialLayout,
  availableWidgetIds,
}: {
  data: DashboardWidgetData;
  pinnedContent: React.ReactNode;
  initialLayout: DashboardLayout;
  availableWidgetIds: DashboardWidgetId[];
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [changeVersion, setChangeVersion] = useState(0);
  const editBaseline = useRef(initialLayout);
  const addDialog = useRef<HTMLDialogElement>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const liveDirty = useRef(false);
  useEffect(() => () => {
    if (liveDirty.current) window.dispatchEvent(new Event(APP_FORM_CLEAN_EVENT));
  }, []);

  const markChanged = useCallback(() => {
    setChangeVersion((version) => version + 1);
    if (!liveDirty.current) {
      liveDirty.current = true;
      window.dispatchEvent(new Event(APP_FORM_DIRTY_EVENT));
    }
  }, []);

  const cleanEditor = useCallback(() => {
    if (liveDirty.current) {
      liveDirty.current = false;
      window.dispatchEvent(new Event(APP_FORM_CLEAN_EVENT));
    }
  }, []);

  const queueSave = useCallback((nextLayout: DashboardLayout) => {
    const stamped: DashboardLayout = { ...nextLayout, updatedAt: new Date().toISOString() };
    setSaveStatus("saving");
    setSaveMessage("Speichert …");
    const operation = async () => {
      const result = await saveDashboardLayoutAction(stamped);
      if (result.status === "success") {
        setSaveStatus("saved");
        setSaveMessage("Gespeichert");
        broadcastAppDataChanged(["users"]);
      } else {
        setSaveStatus("error");
        setSaveMessage(result.message);
      }
    };
    saveChain.current = saveChain.current.then(operation, operation);
    return saveChain.current;
  }, []);

  useEffect(() => {
    if (!editing || changeVersion === 0) return;
    const timer = window.setTimeout(() => void queueSave(layout), 750);
    return () => window.clearTimeout(timer);
  }, [changeVersion, editing, layout, queueSave]);

  const visibleItems = useMemo(
    () => layout.desktop.filter((item) => item.visible).sort((left, right) => left.order - right.order),
    [layout.desktop],
  );
  const hiddenItems = useMemo(
    () => layout.desktop.filter((item) => !item.visible).sort((left, right) => left.order - right.order),
    [layout.desktop],
  );

  const updateAllViewports = useCallback((update: (items: DashboardWidgetItem[]) => DashboardWidgetItem[]) => {
    setLayout((current) => {
      const next = { ...current };
      for (const viewport of dashboardViewports) {
        next[viewport] = update(current[viewport]).map((item, order) => ({ ...item, order }));
      }
      return next;
    });
    markChanged();
  }, [markChanged]);

  const moveWidget = useCallback((id: DashboardWidgetId, direction: -1 | 1) => {
    updateAllViewports((items) => {
      const visible = items.filter((item) => item.visible).sort((a, b) => a.order - b.order);
      const from = visible.findIndex((item) => item.id === id);
      const to = Math.max(0, Math.min(visible.length - 1, from + direction));
      if (from < 0 || from === to) return items;
      const moved = moveArrayItem(visible, from, to);
      const hidden = items.filter((item) => !item.visible);
      return [...moved, ...hidden];
    });
  }, [updateAllViewports]);

  const reorderWidget = useCallback((activeId: DashboardWidgetId, overId: DashboardWidgetId) => {
    updateAllViewports((items) => {
      const visible = items.filter((item) => item.visible).sort((a, b) => a.order - b.order);
      const from = visible.findIndex((item) => item.id === activeId);
      const to = visible.findIndex((item) => item.id === overId);
      return from < 0 || to < 0 ? items : [...moveArrayItem(visible, from, to), ...items.filter((item) => !item.visible)];
    });
  }, [updateAllViewports]);

  const hideWidget = useCallback((id: DashboardWidgetId) => {
    updateAllViewports((items) => items.map((entry) => entry.id === id ? { ...entry, visible: false } : entry));
  }, [updateAllViewports]);

  const resizeWidget = useCallback((id: DashboardWidgetId, size: DashboardWidgetSize) => {
    updateAllViewports((items) => items.map((entry) => entry.id === id ? { ...entry, size } : entry));
  }, [updateAllViewports]);

  const startEditing = () => {
    editBaseline.current = layout;
    setChangeVersion(0);
    setSaveStatus("idle");
    setEditing(true);
  };

  const finishEditing = async () => {
    if (changeVersion > 0) await queueSave(layout);
    setEditing(false);
    cleanEditor();
  };

  const discardChanges = async () => {
    const baseline = editBaseline.current;
    setLayout(baseline);
    if (changeVersion > 0) await queueSave(baseline);
    setEditing(false);
    cleanEditor();
  };

  const resetLayout = async () => {
    if (!window.confirm("Möchtest du dein persönliches Dashboard auf das FRL-Standardlayout zurücksetzen?")) return;
    setSaveStatus("saving");
    setSaveMessage("Speichert …");
    await saveChain.current;
    const result = await resetDashboardLayoutAction();
    if (result.status === "error") {
      setSaveStatus("error");
      setSaveMessage(result.message);
      return;
    }
    const standard = resolveDashboardLayout(createDefaultDashboardLayout(), availableWidgetIds);
    setLayout(standard);
    editBaseline.current = standard;
    setChangeVersion(0);
    setSaveStatus("saved");
    setSaveMessage("Standard wiederhergestellt");
    broadcastAppDataChanged(["users"]);
  };

  return (
    <div className="page-stack page-accent-dashboard min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {!editing ? (
          <button type="button" onClick={startEditing} className="wizard-secondary-button min-h-11 w-full sm:w-auto">
            <Pencil size={17} /> Dashboard anpassen
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addDialog.current?.showModal()} className="wizard-secondary-button min-h-11 flex-1 sm:flex-none">
              <Plus size={17} /> Widgets hinzufügen
            </button>
            <button type="button" onClick={finishEditing} className="wizard-primary-button min-h-11 flex-1 sm:flex-none">
              <Check size={17} /> Fertig
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {editing ? <p className="text-xs font-semibold text-cyan-300">Fahrer-Hero und Next Race sind fest angeheftet.</p> : null}
        {pinnedContent}
      </div>

      {editing ? (
        <div className="surface-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div role="status" aria-live="polite" className="flex min-h-11 items-center gap-2 text-sm text-slate-300">
            {saveStatus === "saving" ? <Save size={17} className="animate-pulse text-cyan-300" /> : null}
            {saveStatus === "saved" ? <Check size={17} className="text-emerald-300" /> : null}
            {saveStatus === "error" ? <ShieldAlert size={17} className="text-red-300" /> : null}
            {saveMessage || "Ziehe Widgets oder nutze die Pfeiltasten."}
          </div>
          <div className="flex flex-wrap gap-2">
            {saveStatus === "error" ? <button type="button" onClick={() => void queueSave(layout)} className="wizard-secondary-button min-h-11">Erneut speichern</button> : null}
            <button type="button" onClick={resetLayout} className="wizard-secondary-button min-h-11 flex-1 sm:flex-none"><RotateCcw size={16} /> Standard</button>
            <button type="button" onClick={discardChanges} className="wizard-secondary-button min-h-11 flex-1 sm:flex-none"><X size={16} /> Verwerfen</button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <Suspense fallback={<DashboardGridSkeleton count={visibleItems.length} />}>
          <DashboardEditorGrid items={visibleItems} data={data} onReorder={reorderWidget} onMove={moveWidget} onHide={hideWidget} onSize={resizeWidget} />
        </Suspense>
      ) : (
        <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12" aria-label="Persönliche Dashboard-Widgets">
          {visibleItems.map((item) => (
            <article key={item.id} className={`min-w-0 ${dashboardWidgetSizeClasses[item.size]}`}>
              <DashboardWidgetContent item={item} data={data} />
            </article>
          ))}
        </section>
      )}

      {visibleItems.length === 0 ? (
        <div className="surface-panel p-8 text-center text-sm text-slate-400">Deine persönliche Fläche ist leer. Next Race bleibt weiterhin sichtbar.</div>
      ) : null}

      <dialog ref={addDialog} className="m-0 max-h-[85dvh] w-full max-w-none self-end overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-950 p-0 text-white backdrop:bg-black/70 lg:m-auto lg:max-w-2xl lg:self-auto lg:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div><p className="eyebrow">Dashboard</p><h2 className="mt-1 text-xl font-bold">Widgets hinzufügen</h2></div>
          <button type="button" onClick={() => addDialog.current?.close()} aria-label="Dialog schließen" className="flex size-11 items-center justify-center rounded-xl border border-slate-700"><X size={19} /></button>
        </div>
        <div className="space-y-3 p-5">
          {hiddenItems.map((item) => {
            const definition = dashboardWidgetRegistry[item.id];
            return (
              <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div><h3 className="font-semibold">{definition.title}</h3><p className="mt-1 text-sm text-slate-400">{definition.description}</p><p className="mt-2 text-xs text-slate-500">{definition.allowedSizes.map((size) => sizeLabels[size]).join(" · ")}</p></div>
                <button type="button" onClick={() => { updateAllViewports((items) => items.map((entry) => entry.id === item.id ? { ...entry, visible: true } : entry)); addDialog.current?.close(); }} className="wizard-primary-button mt-4 min-h-11 w-full sm:mt-0 sm:w-auto"><Plus size={16} /> Hinzufügen</button>
              </div>
            );
          })}
          {hiddenItems.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">Alle verfügbaren Widgets sind bereits sichtbar.</p> : null}
        </div>
      </dialog>
    </div>
  );
}

function moveArrayItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function DashboardGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12" aria-label="Dashboard-Editor wird geladen" aria-busy="true">
      {Array.from({ length: Math.max(1, Math.min(count, 4)) }, (_, index) => (
        <div key={index} className="h-40 animate-pulse border border-slate-800 bg-slate-900/70 md:col-span-1 lg:col-span-3" />
      ))}
    </div>
  );
}
