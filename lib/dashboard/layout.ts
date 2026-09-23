import { z } from "zod";
import { Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";

export const dashboardWidgetIds = [
  "quick-actions",
  "championship-position",
  "championship-points",
  "latest-result",
  "team-finance",
  "unread-notifications",
  "recent-activity",
  "rankings",
  "season-progress",
  "next-calendar-event",
] as const;
export const dashboardWidgetSizes = ["small", "medium", "large", "full"] as const;
export const dashboardViewports = ["desktop", "tablet", "mobile"] as const;

export type DashboardWidgetId = (typeof dashboardWidgetIds)[number];
export type DashboardWidgetSize = (typeof dashboardWidgetSizes)[number];
export type DashboardViewport = (typeof dashboardViewports)[number];
export type DashboardWidgetDefinition = { id: DashboardWidgetId; title: string; description: string; allowedSizes: readonly DashboardWidgetSize[]; defaultSize: DashboardWidgetSize; requiresDriver?: boolean; requiredPermission?: Permission };

export const dashboardWidgetRegistry: Record<DashboardWidgetId, DashboardWidgetDefinition> = {
  "quick-actions": { id: "quick-actions", title: "Schnellaktionen", description: "Direkte Wege zu wichtigen Bereichen.", allowedSizes: ["small", "medium"], defaultSize: "medium" },
  "championship-position": { id: "championship-position", title: "WM-Position", description: "Dein aktueller Meisterschaftsrang.", allowedSizes: ["small", "medium"], defaultSize: "small", requiresDriver: true },
  "championship-points": { id: "championship-points", title: "Saisonpunkte", description: "Deine Punkte und das letzte Ergebnis.", allowedSizes: ["small", "medium"], defaultSize: "small", requiresDriver: true },
  "latest-result": { id: "latest-result", title: "Letztes Ergebnis", description: "Die zuletzt veröffentlichte Rennklassifikation.", allowedSizes: ["small", "medium"], defaultSize: "small" },
  "team-finance": { id: "team-finance", title: "Teamfinanzen", description: "Der globale Kontostand deiner Teamorganisation.", allowedSizes: ["small", "medium"], defaultSize: "small", requiredPermission: Permission.ViewFinance },
  "unread-notifications": { id: "unread-notifications", title: "Ungelesene Hinweise", description: "Neue persönliche Benachrichtigungen.", allowedSizes: ["small", "medium"], defaultSize: "small" },
  "recent-activity": { id: "recent-activity", title: "Letzte Aktivitäten", description: "Deine neuesten Benachrichtigungen.", allowedSizes: ["medium", "large", "full"], defaultSize: "large" },
  rankings: { id: "rankings", title: "Meisterschaftsrangliste", description: "Die Spitze der Fahrer- und Teamwertung.", allowedSizes: ["medium", "large", "full"], defaultSize: "large" },
  "season-progress": { id: "season-progress", title: "Saisonfortschritt", description: "Absolvierte und verbleibende Rennen.", allowedSizes: ["small", "medium"], defaultSize: "small" },
  "next-calendar-event": { id: "next-calendar-event", title: "Nächster Termin", description: "Kompakter Blick in den Kalender.", allowedSizes: ["small", "medium"], defaultSize: "medium" },
};

const widgetItemSchema = z.object({ id: z.enum(dashboardWidgetIds), order: z.number().int().min(0).max(dashboardWidgetIds.length - 1), size: z.enum(dashboardWidgetSizes), visible: z.boolean() }).superRefine((item, context) => {
  if (!dashboardWidgetRegistry[item.id].allowedSizes.includes(item.size)) context.addIssue({ code: "custom", path: ["size"], message: "Diese Widgetgröße ist nicht erlaubt." });
});
const viewportLayoutSchema = z.array(widgetItemSchema).max(dashboardWidgetIds.length).superRefine((items, context) => {
  const ids = new Set<DashboardWidgetId>(); const orders = new Set<number>();
  for (const [index, item] of items.entries()) { if (ids.has(item.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Widget-ID ist doppelt." }); if (orders.has(item.order)) context.addIssue({ code: "custom", path: [index, "order"], message: "Position ist doppelt." }); ids.add(item.id); orders.add(item.order); }
});

export const dashboardLayoutSchema = z.object({ version: z.literal(3), desktop: viewportLayoutSchema, tablet: viewportLayoutSchema, mobile: viewportLayoutSchema, updatedAt: z.iso.datetime() });
export type DashboardWidgetItem = z.infer<typeof widgetItemSchema>;
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;

const defaultItems: DashboardWidgetItem[] = dashboardWidgetIds.map((id, order) => ({ id, order, size: dashboardWidgetRegistry[id].defaultSize, visible: true }));
export function createDefaultDashboardLayout(now = new Date()): DashboardLayout { return { version: 3, desktop: defaultItems.map((item) => ({ ...item })), tablet: defaultItems.map((item) => ({ ...item })), mobile: defaultItems.map((item) => ({ ...item })), updatedAt: now.toISOString() }; }
export function availableDashboardWidgetIds(roles: readonly Role[], hasDriver: boolean): DashboardWidgetId[] { return dashboardWidgetIds.filter((id) => { const definition = dashboardWidgetRegistry[id]; if (definition.requiresDriver && !hasDriver) return false; return !definition.requiredPermission || hasPermission(roles, definition.requiredPermission); }); }

function normalizeViewport(items: readonly { id: string; order: number; size: DashboardWidgetSize; visible: boolean }[], available: readonly DashboardWidgetId[]): DashboardWidgetItem[] {
  const availableSet = new Set<string>(available); const seen = new Set<string>();
  const result = items.filter((item) => availableSet.has(item.id)).sort((a, b) => a.order - b.order).filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; }).map((item, order) => ({ ...item, id: item.id as DashboardWidgetId, order, size: dashboardWidgetRegistry[item.id as DashboardWidgetId].allowedSizes.includes(item.size) ? item.size : dashboardWidgetRegistry[item.id as DashboardWidgetId].defaultSize }));
  for (const id of available) if (!seen.has(id)) result.push({ id, order: result.length, size: dashboardWidgetRegistry[id].defaultSize, visible: true });
  return result;
}

const retiredWidgetIds = ["welcome", "attendance", "fia-open-tickets", ...dashboardWidgetIds] as const;
const legacyItemSchema = z.object({ id: z.enum(retiredWidgetIds), order: z.number().int().min(0), size: z.enum(dashboardWidgetSizes), visible: z.boolean() });
const legacyLayoutSchema = z.object({ version: z.union([z.literal(1), z.literal(2)]), desktop: z.array(legacyItemSchema), tablet: z.array(legacyItemSchema), mobile: z.array(legacyItemSchema), updatedAt: z.iso.datetime() });

export function resolveDashboardLayout(stored: unknown, available: readonly DashboardWidgetId[]): DashboardLayout {
  const parsed = dashboardLayoutSchema.safeParse(stored); const legacy = legacyLayoutSchema.safeParse(stored); const fallback = createDefaultDashboardLayout(); const source = parsed.success ? parsed.data : legacy.success ? legacy.data : fallback;
  return { version: 3, desktop: normalizeViewport(source.desktop, available), tablet: normalizeViewport(source.tablet, available), mobile: normalizeViewport(source.mobile, available), updatedAt: source.updatedAt };
}
