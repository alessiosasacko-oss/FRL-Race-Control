import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireAuthenticatedUser();
  const unreadNotifications = await getUnreadNotificationCount(user.id);

  return (
    <div className="flex min-h-screen bg-[#080B10] text-white">

      <Sidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col">

        <Topbar user={user} unreadNotifications={unreadNotifications} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

      </div>

    </div>
  );
}
