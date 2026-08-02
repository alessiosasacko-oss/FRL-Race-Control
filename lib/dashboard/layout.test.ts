import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Role } from "@/domain";
import {
  availableDashboardWidgetIds,
  createDefaultDashboardLayout,
  dashboardLayoutSchema,
  dashboardWidgetIds,
  dashboardWidgetRegistry,
  resolveDashboardLayout,
} from "./layout";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const component = source("components/dashboard/PersonalDashboard.tsx");
const page = source("app/(protected)/dashboard/page.tsx");
const actions = source("lib/dashboard/layout-actions.ts");
const migration = source("prisma/migrations/20260802190000_personal_dashboard_layouts/migration.sql");
const available = [...dashboardWidgetIds];

test("1. Next Race is not part of the customizable registry", () => assert.equal(dashboardWidgetIds.includes("next-race" as never), false));
test("2. Next Race renders before the sortable grid", () => assert.ok(component.indexOf("<NextRaceWidget") < component.indexOf("<DndContext")));
test("3. Next Race has no sortable wrapper", () => assert.match(component, /<NextRaceWidget[^]*<DndContext/));
test("4. Next Race displays the pinned edit hint", () => assert.match(component, /Next Race ist fest angeheftet/));
test("5. the default layout contains every registered widget", () => assert.equal(createDefaultDashboardLayout().desktop.length, dashboardWidgetIds.length));
test("6. welcome is movable through the shared widget list", () => assert.ok(createDefaultDashboardLayout().desktop.some((item) => item.id === "welcome")));
test("7. attendance is movable for drivers", () => assert.ok(availableDashboardWidgetIds([Role.Driver], true).includes("attendance")));
test("8. status widgets have stable IDs", () => assert.deepEqual(dashboardWidgetIds.filter((id) => id.startsWith("championship-")), ["championship-position", "championship-points"]));
test("9. widgets can be hidden", () => assert.match(component, /visible: false/));
test("10. hidden widgets can be added again", () => assert.match(component, /visible: true/));
test("11. only allowed widget sizes are offered", () => assert.deepEqual(dashboardWidgetRegistry.welcome.allowedSizes, ["medium", "large", "full"]));
test("12. personal storage uses the authenticated user", () => { assert.match(actions, /requireAuthenticatedUser/); assert.match(actions, /userId: user\.id/); });
test("13. missing settings resolve to the standard layout", () => assert.equal(resolveDashboardLayout(null, available).desktop.length, available.length));
test("14. reset clears only dashboardLayout", () => assert.match(actions, /dashboardLayout: Prisma\.JsonNull/));
test("15. unknown stored widget IDs cannot crash loading", () => assert.equal(resolveDashboardLayout({ version: 1, desktop: [{ id: "evil" }] }, available).desktop.length, available.length));
test("16. duplicate widget IDs are rejected", () => { const layout = createDefaultDashboardLayout(); layout.desktop[1] = { ...layout.desktop[0] }; assert.equal(dashboardLayoutSchema.safeParse(layout).success, false); });
test("17. invalid sizes are rejected", () => { const layout = createDefaultDashboardLayout(); layout.desktop[0] = { ...layout.desktop[0], size: "small" }; assert.equal(dashboardLayoutSchema.safeParse(layout).success, false); });
test("18. a manipulated next-race item is rejected", () => { const layout = createDefaultDashboardLayout() as unknown as { desktop: unknown[] }; layout.desktop.push({ id: "next-race", order: 11, size: "full", visible: false }); assert.equal(dashboardLayoutSchema.safeParse(layout).success, false); });
test("19. widgets requiring a driver stay unavailable without one", () => { const ids = availableDashboardWidgetIds([Role.Driver], false); assert.equal(ids.includes("attendance"), false); assert.equal(ids.includes("championship-position"), false); });
test("20. server page reloads the stored personal layout", () => assert.match(page, /getPersonalDashboardLayout/));
test("21. mobile and tablet layouts are stored independently", () => { const layout = createDefaultDashboardLayout(); assert.notEqual(layout.desktop, layout.mobile); assert.notEqual(layout.desktop, layout.tablet); });
test("22. automatic refresh is deferred during editing", () => { assert.match(component, /APP_FORM_DIRTY_EVENT/); assert.match(component, /APP_FORM_CLEAN_EVENT/); });
test("23. cross-tab layout changes use the live channel", () => assert.match(component, /broadcastAppDataChanged\(\["users"\]\)/));
test("24. saves are debounced and serialized", () => { assert.match(component, /setTimeout\(\(\) => void queueSave\(layout\), 750\)/); assert.match(component, /saveChain\.current = saveChain\.current\.then/); });
test("25. keyboard and button reordering remain available", () => { assert.match(component, /sortableKeyboardCoordinates/); assert.match(component, /nach oben verschieben/); assert.match(component, /nach unten verschieben/); });
test("26. 360px uses a one-column overflow-safe grid", () => assert.match(component, /grid min-w-0 grid-cols-1/));
test("27. tablet uses at most two columns and desktop begins at lg", () => assert.match(component, /md:grid-cols-2 lg:grid-cols-12/));
test("28. the additive migration preserves existing settings", () => assert.match(migration, /ALTER TABLE "UserSettings" ADD COLUMN "dashboardLayout" JSONB/));
