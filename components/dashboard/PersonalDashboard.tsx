"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarClock,
  Check,
  EyeOff,
  Flag,
  GripVertical,
  Medal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Trophy,
  X,
} from "lucide-react";
import AttendanceWidget from "@/components/dashboard/AttendanceWidget";
import NextRaceWidget from "@/components/dashboard/NextRaceWidget";
import NotificationsWidget from "@/components/dashboard/NotificationsWidget";
import QuickActionsWidget from "@/components/dashboard/QuickActionsWidget";
import RankingsWidget from "@/components/dashboard/RankingsWidget";
import SeasonProgressWidget from "@/components/dashboard/SeasonProgressWidget";
import DriverHero from "@/components/dashboard/DriverHero";
import MetricBlock from "@/components/ui/MetricBlock";
import type { DashboardData } from "@/lib/dashboard/types";
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

const sizeClasses: Record<DashboardWidgetSize, string> = {
  small: "md:col-span-1 lg:col-span-3",
  medium: "md:col-span-1 lg:col-span-6",
  large: "md:col-span-2 lg:col-span-8",
  full: "md:col-span-2 lg:col-span-12",
};

const sizeLabels: Record<DashboardWidgetSize, string> = {
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  full: "Volle Breite",
};

export default function PersonalDashboard({
  data,
  initialLayout,
  availableWidgetIds,
}: {
  data: DashboardData;
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      const moved = arrayMove(visible, from, to);
      const hidden = items.filter((item) => !item.visible);
      return [...moved, ...hidden];
    });
  }, [updateAllViewports]);

  const dragEnded = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    updateAllViewports((items) => {
      const visible = items.filter((item) => item.visible).sort((a, b) => a.order - b.order);
      const from = visible.findIndex((item) => item.id === event.active.id);
      const to = visible.findIndex((item) => item.id === event.over?.id);
      return from < 0 || to < 0 ? items : [...arrayMove(visible, from, to), ...items.filter((item) => !item.visible)];
    });
  };

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

      <DriverHero data={data} />

      <div className="space-y-2">
        {editing ? <p className="text-xs font-semibold text-cyan-300">Fahrer-Hero und Next Race sind fest angeheftet.</p> : null}
        <NextRaceWidget race={data.nextRace} attendance={data.attendance} league={data.identity.driver?.league.code ?? null} />
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnded}>
        <SortableContext items={visibleItems.map((item) => item.id)} strategy={verticalListSortingStrategy} disabled={!editing}>
          <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5" aria-label="Persönliche Dashboard-Widgets">
            {visibleItems.map((item, index) => (
              <SortableWidget
                key={item.id}
                item={item}
                index={index}
                count={visibleItems.length}
                editing={editing}
                data={data}
                onMove={moveWidget}
                onHide={(id) => updateAllViewports((items) => items.map((entry) => entry.id === id ? { ...entry, visible: false } : entry))}
                onSize={(id, size) => updateAllViewports((items) => items.map((entry) => entry.id === id ? { ...entry, size } : entry))}
              />
            ))}
          </section>
        </SortableContext>
      </DndContext>

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

function SortableWidget({
  item,
  index,
  count,
  editing,
  data,
  onMove,
  onHide,
  onSize,
}: {
  item: DashboardWidgetItem;
  index: number;
  count: number;
  editing: boolean;
  data: DashboardData;
  onMove: (id: DashboardWidgetId, direction: -1 | 1) => void;
  onHide: (id: DashboardWidgetId) => void;
  onSize: (id: DashboardWidgetId, size: DashboardWidgetSize) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !editing });
  const definition = dashboardWidgetRegistry[item.id];
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <article
      ref={setNodeRef}
      style={style}
      aria-label={`${definition.title}, Position ${index + 1} von ${count}`}
      className={`min-w-0 ${sizeClasses[item.size]} ${isDragging ? "z-20 opacity-70" : ""}`}
    >
      {editing ? (
        <div className="mb-2 rounded-2xl border border-cyan-500/30 bg-slate-950/90 p-2 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" {...attributes} {...listeners} aria-label={`${definition.title} ziehen`} className="flex size-11 touch-none items-center justify-center rounded-xl border border-slate-700 text-cyan-200 active:cursor-grabbing"><GripVertical size={20} /></button>
            <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-white">{definition.title}</span>
            <button type="button" onClick={() => onMove(item.id, -1)} disabled={index === 0} aria-label={`${definition.title} nach oben verschieben`} className="flex size-11 items-center justify-center rounded-xl border border-slate-700 disabled:opacity-30"><ArrowUp size={18} /></button>
            <button type="button" onClick={() => onMove(item.id, 1)} disabled={index === count - 1} aria-label={`${definition.title} nach unten verschieben`} className="flex size-11 items-center justify-center rounded-xl border border-slate-700 disabled:opacity-30"><ArrowDown size={18} /></button>
            <button type="button" onClick={() => onHide(item.id)} aria-label={`${definition.title} ausblenden`} className="flex size-11 items-center justify-center rounded-xl border border-slate-700 text-slate-300"><EyeOff size={18} /></button>
          </div>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-400">
            Größe
            <select value={item.size} onChange={(event) => onSize(item.id, event.target.value as DashboardWidgetSize)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white">
              {definition.allowedSizes.map((size) => <option key={size} value={size}>{sizeLabels[size]}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      <DashboardWidget item={item} data={data} />
    </article>
  );
}

function DashboardWidget({ item, data }: { item: DashboardWidgetItem; data: DashboardData }) {
  switch (item.id) {
    case "attendance": return <AttendanceWidget race={data.nextRace} driverId={data.identity.driver?.id ?? null} attendance={data.attendance} />;
    case "quick-actions": return <QuickActionsWidget />;
    case "championship-position": return <MetricBlock label="WM-Position" value={data.championship.driver ? `P${data.championship.driver.position}` : "–"} detail={data.championship.driver?.gapToLeader === 0 ? "Meisterschaftsführung" : data.championship.driver ? `${data.championship.driver.gapToLeader} Pkt. Rückstand` : "Noch keine Wertung"} icon={Trophy} tone="yellow" className="h-full" />;
    case "championship-points": return <MetricBlock label="Saisonpunkte" value={data.championship.driver?.points ?? "–"} detail={data.championship.driver ? `${data.championship.driver.lastRacePoints} beim letzten Rennen` : "Noch keine Saisonpunkte"} icon={Medal} tone="cyan" className="h-full" />;
    case "fia-open-tickets": return <MetricBlock label="Offene FIA-Tickets" value={data.fia.openTickets} detail="Race-Control-Vorgänge" icon={ShieldAlert} tone={data.fia.openTickets > 0 ? "purple" : "green"} className="h-full" />;
    case "unread-notifications": return <MetricBlock label="Ungelesen" value={data.unreadNotificationCount} detail="Neue Benachrichtigungen" icon={Bell} tone={data.unreadNotificationCount > 0 ? "orange" : "green"} className="h-full" />;
    case "recent-activity": return <NotificationsWidget notifications={data.notifications.slice(0, 4)} />;
    case "rankings": return <RankingsWidget championship={data.championship} />;
    case "season-progress": return <SeasonProgressWidget progress={data.seasonProgress} />;
    case "next-calendar-event": return (
      <section className="surface-panel h-full rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
        <div className="flex items-center gap-2 text-cyan-300"><CalendarClock size={18} /><h2 className="text-xs font-bold uppercase tracking-[0.14em]">Nächster Termin</h2></div>
        <p className="mt-3 font-semibold text-white">{data.nextRace?.name ?? "Noch offen"}</p>
        <p className="mt-1 text-sm text-slate-400">{data.nextRace ? `Runde ${data.nextRace.round} · ${data.nextRace.circuit}` : "Kein weiteres Rennen geplant"}</p>
        <Link href="/calendar" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-300"><Flag size={15} /> Zum Kalender</Link>
      </section>
    );
  }
}
