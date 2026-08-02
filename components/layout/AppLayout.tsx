import MobileNavigation from "./MobileNavigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ThemeSurface from "@/components/design/ThemeSurface";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getResolvedTheme } from "@/lib/design/queries";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const { user, theme, unreadNotifications } = await loadAppShellData();
  const canManageAdministration = hasPermission(
    user.roles,
    Permission.ManageAdministration,
  );

  return (
    <ThemeSurface config={theme.config} mode={theme.mode}>
      <div className="app-shell flex min-h-screen">
        <Sidebar user={user} settings={theme.config.navigationSettings} />
        <div className="min-w-0 flex-1">
          <Topbar user={user} unreadNotifications={unreadNotifications} />
          <main className="app-content mobile-safe-bottom min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="page-container">{children}</div>
          </main>
        </div>
        <MobileNavigation
          user={user}
          canManageAdministration={canManageAdministration}
          settings={theme.config.navigationSettings}
        />
      </div>
    </ThemeSurface>
  );
}

async function loadAppShellData() {
  const startedAt = performance.now();
  const user = await requireAuthenticatedUser();
  const [theme, unreadNotifications] = await Promise.all([
    getResolvedTheme(user.id),
    getUnreadNotificationCount(user.id).catch((error: unknown) => {
      console.error("[app-shell] unread notification count unavailable", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : undefined,
      });
      return 0;
    }),
  ]);
  console.info("[app-shell] query completed", {
    durationMs: Math.round(performance.now() - startedAt),
    subqueryCount: 3,
  });
  return { user, theme, unreadNotifications };
}
