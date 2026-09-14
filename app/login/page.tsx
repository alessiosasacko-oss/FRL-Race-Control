import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import DiscordSignInButton from "@/components/auth/DiscordSignInButton";
import Layout from "@/components/layout/Layout";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { callbackUrl, error } = await searchParams;

  return (
    <Layout scope="LOGIN">
      <div className="mx-auto grid min-h-[calc(100dvh-10rem)] max-w-5xl items-center gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-12">
        <section className="hidden lg:block">
          <p className="eyebrow">FRL Control Center</p>
          <h1 className="mt-4 text-6xl font-black tracking-[-0.055em] text-white">Dein Rennen.<br /><span className="text-cyan-300">Dein Überblick.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">Sicherer Zugriff auf die operative Plattform der F1 Realistic League.</p>
          <ul className="mt-9 space-y-4 text-sm text-slate-300">
            {["Persönliches, anpassbares Dashboard", "Aktuelle Kalender- und Ergebnisdaten", "Rollenbasierter Zugriff für die Ligaverwaltung"].map((item) => (
              <li key={item} className="flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-300" />{item}</li>
            ))}
          </ul>
        </section>

        <section className="surface-panel relative overflow-hidden p-6 sm:p-9">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-300 to-blue-500" />
          <div className="flex items-center gap-4">
            <Image src="/images/frl-logo.png" alt="FRL" width={56} height={56} className="size-14 rounded-2xl" priority />
            <div><p className="eyebrow">Willkommen</p><h2 className="mt-1 text-2xl font-black text-white">Race Control Login</h2></div>
          </div>
          <p className="mt-7 text-sm leading-6 text-slate-400">Melde dich mit deinem verknüpften Discord-Konto an. Die bestehende Authentifizierung und deine Berechtigungen bleiben unverändert.</p>
          {error ? <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">Die Discord-Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.</p> : null}
          <div className="mt-7 [&_button]:min-h-12 [&_button]:w-full"><DiscordSignInButton callbackUrl={callbackUrl} /></div>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-slate-500"><LockKeyhole size={14} />Geschützter Zugang über Discord OAuth</p>
        </section>
      </div>
    </Layout>
  );
}
