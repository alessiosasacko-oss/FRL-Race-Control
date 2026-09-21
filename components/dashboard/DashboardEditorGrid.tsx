"use client";

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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, EyeOff, GripVertical } from "lucide-react";
import {
  dashboardWidgetRegistry,
  type DashboardWidgetId,
  type DashboardWidgetItem,
  type DashboardWidgetSize,
} from "@/lib/dashboard/layout";
import type { DashboardData } from "@/lib/dashboard/types";
import DashboardWidgetContent, { dashboardWidgetSizeClasses } from "./DashboardWidgetContent";

const sizeLabels: Record<DashboardWidgetSize, string> = {
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  full: "Volle Breite",
};

export default function DashboardEditorGrid({
  items,
  data,
  onReorder,
  onMove,
  onHide,
  onSize,
}: {
  items: DashboardWidgetItem[];
  data: DashboardData;
  onReorder: (activeId: DashboardWidgetId, overId: DashboardWidgetId) => void;
  onMove: (id: DashboardWidgetId, direction: -1 | 1) => void;
  onHide: (id: DashboardWidgetId) => void;
  onSize: (id: DashboardWidgetId, size: DashboardWidgetSize) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dragEnded = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    onReorder(event.active.id as DashboardWidgetId, event.over.id as DashboardWidgetId);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnded}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12" aria-label="Dashboard-Widgets anordnen">
          {items.map((item, index) => (
            <SortableWidget key={item.id} item={item} index={index} count={items.length} data={data} onMove={onMove} onHide={onHide} onSize={onSize} />
          ))}
        </section>
      </SortableContext>
    </DndContext>
  );
}

function SortableWidget({
  item,
  index,
  count,
  data,
  onMove,
  onHide,
  onSize,
}: {
  item: DashboardWidgetItem;
  index: number;
  count: number;
  data: DashboardData;
  onMove: (id: DashboardWidgetId, direction: -1 | 1) => void;
  onHide: (id: DashboardWidgetId) => void;
  onSize: (id: DashboardWidgetId, size: DashboardWidgetSize) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const definition = dashboardWidgetRegistry[item.id];
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} aria-label={`${definition.title}, Position ${index + 1} von ${count}`} className={`min-w-0 ${dashboardWidgetSizeClasses[item.size]} ${isDragging ? "z-20 opacity-70" : ""}`}>
      <div className="mb-2 border border-blue-400/35 bg-[#0b1119] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" {...attributes} {...listeners} aria-label={`${definition.title} ziehen`} className="flex size-11 touch-none items-center justify-center rounded border border-slate-700 text-blue-200 active:cursor-grabbing"><GripVertical size={20} /></button>
          <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-white">{definition.title}</span>
          <button type="button" onClick={() => onMove(item.id, -1)} disabled={index === 0} aria-label={`${definition.title} nach oben verschieben`} className="flex size-11 items-center justify-center rounded border border-slate-700 disabled:opacity-30"><ArrowUp size={18} /></button>
          <button type="button" onClick={() => onMove(item.id, 1)} disabled={index === count - 1} aria-label={`${definition.title} nach unten verschieben`} className="flex size-11 items-center justify-center rounded border border-slate-700 disabled:opacity-30"><ArrowDown size={18} /></button>
          <button type="button" onClick={() => onHide(item.id)} aria-label={`${definition.title} ausblenden`} className="flex size-11 items-center justify-center rounded border border-slate-700 text-slate-300"><EyeOff size={18} /></button>
        </div>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-400">
          Größe
          <select value={item.size} onChange={(event) => onSize(item.id, event.target.value as DashboardWidgetSize)} className="min-h-11 min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-3 text-sm text-white">
            {definition.allowedSizes.map((size) => <option key={size} value={size}>{sizeLabels[size]}</option>)}
          </select>
        </label>
      </div>
      <DashboardWidgetContent item={item} data={data} />
    </article>
  );
}
