import MobileNavigation from "./MobileNavigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireAuthenticatedUser();
  const unreadNotifications = await getUnreadNotificationCount(user.id);
  const canManageAdministration = hasPermission(
    user.roles,
    Permission.ManageAdministration,
  );

  return (
    <div className="flex min-h-screen text-white">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1">
        <Topbar user={user} unreadNotifications={unreadNotifications} />
        <main className="mobile-safe-bottom min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="page-container">{children}</div>
        </main>
      </div>
      <MobileNavigation
        user={user}
        canManageAdministration={canManageAdministration}
      />
    </div>
  );
}
