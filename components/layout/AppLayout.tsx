import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireAuthenticatedUser();

  return (
    <div className="flex min-h-screen bg-[#080B10] text-white">

      <Sidebar user={user} />

      <div className="flex flex-1 flex-col">

        <Topbar user={user} />

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>

      </div>

    </div>
  );
}
