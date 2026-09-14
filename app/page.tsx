import Link from "next/link";
import { ArrowRight, CalendarDays, Gauge, Layers3, Trophy } from "lucide-react";
import DiscordSignInButton from "@/components/auth/DiscordSignInButton";
import Layout from "@/components/layout/Layout";
import { getCurrentUser } from "@/lib/auth/session";

const capabilities = [
  { icon: CalendarDays, title: "Rennkalender", text: "Alle Termine, Rennwochenenden und Streckeninformationen an einem Ort." },
  { icon: Trophy, title: "Meisterschaften", text: "Fahrer- und Teamwertungen mit klarer, nachvollziehbarer Punkteübersicht." },
  { icon: Layers3, title: "Ergebnisse", text: "Veröffentlichte Klassifikationen vom Qualifying bis zum Hauptrennen." },
] as const;

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <Layout>
      <div className="space-y-20 pb-14 pt-8 sm:space-y-24 sm:pt-14 lg:pb-20 lg:pt-20">
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#07101d]/85 px-5 py-14 shadow-2xl shadow-black/30 sm:px-10 sm:py-20 lg:px-16 lg:py-24">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(34,211,238,0.18),transparent_28rem),radial-gradient(circle_at_10%_90%,rgba(37,99,235,0.2),transparent_25rem),linear-gradient(120deg,transparent_0_66%,rgba(255,255,255,0.035)_66%_67%,transparent_67%_100%)]" />
          <div className="max-w-4xl">
            <p className="eyebrow flex items-center gap-2"><Gauge size={16} /> F1 Realistic League</p>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl lg:text-8xl">
              Race operations.<br /><span className="text-cyan-300">Built for the grid.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Der zentrale Ort für Rennkalender, Meisterschaften, Ergebnisse, Fahrer und Teams der FRL.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              {user ? (
                <Link href="/dashboard" className="wizard-primary-button min-h-12 w-full sm:w-auto">Zum Dashboard <ArrowRight size={18} /></Link>
              ) : (
                <DiscordSignInButton />
              )}
              <Link href="/login" className="wizard-secondary-button min-h-12 w-full sm:w-auto">Race Control öffnen</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="platform-title">
          <div className="max-w-2xl">
            <p className="eyebrow">Eine Plattform</p>
            <h2 id="platform-title" className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Vom ersten Termin bis zur finalen Wertung.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <article key={title} className="surface-panel p-6 sm:p-7">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300"><Icon size={22} /></span>
                <h3 className="mt-6 text-xl font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
