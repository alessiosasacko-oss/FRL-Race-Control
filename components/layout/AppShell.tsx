import ThemeSurface from "@/components/design/ThemeSurface";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { getResolvedThemeForPreference } from "@/lib/design/queries";
import MobileNavigation from "./MobileNavigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type AppShellProps = {
  children: React.ReactNode;
  user: AuthenticatedUser;
};

export default async function AppShell({ children, user }: AppShellProps) {
  const theme = await getResolvedThemeForPreference(user.themePreference);
  const canManageAdministration = hasPermission(
    user.roles,
    Permission.ManageAdministration,
  );

  return (
    <ThemeSurface config={theme.config} mode={theme.mode}>
      <div className="app-shell flex min-h-screen">
        <Sidebar user={user} settings={theme.config.navigationSettings} />
        <div className="min-w-0 flex-1">
          <Topbar user={user} unreadNotifications={user.unreadNotificationCount} />
          <main className="app-content mobile-safe-bottom min-h-[calc(100vh-4rem)] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
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
