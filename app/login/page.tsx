import { redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import Layout from "@/components/layout/Layout";
import DiscordSignInButton from "@/components/auth/DiscordSignInButton";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const { callbackUrl, error } = await searchParams;

  return (
    <Layout className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
        <Card title="Anmeldung">
          <div className="space-y-6 text-center">
            <div>
              <p className="text-lg font-semibold text-white">
                Willkommen bei FRL Race Control
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Melde dich mit deinem Discord-Konto an, um fortzufahren.
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                Die Discord-Anmeldung konnte nicht abgeschlossen werden.
              </p>
            ) : null}

            <DiscordSignInButton callbackUrl={callbackUrl} />
          </div>
        </Card>
      </div>
    </Layout>
  );
}
