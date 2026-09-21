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
      <div className="space-y-16 pb-14 pt-6 sm:space-y-20 sm:pt-10 lg:pb-20 lg:pt-14">
        <section className="relative isolate overflow-hidden border-y border-white/10 bg-[#080d13]">
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-blue-500" />
          <div aria-hidden="true" className="absolute -right-8 -top-12 select-none font-mono text-[12rem] font-black leading-none text-white/[0.025] sm:text-[20rem] lg:text-[28rem]">FRL</div>
          <div className="grid min-h-[34rem] lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.5fr)]">
            <div className="flex min-w-0 flex-col justify-center px-5 py-14 sm:px-10 lg:px-14 lg:py-20">
              <p className="eyebrow flex max-w-full items-center gap-2 text-[0.58rem] leading-5 min-[375px]:text-[0.65rem]"><Gauge size={16} className="shrink-0" /> <span className="min-w-0">F1 Realistic League · Race Control</span></p>
              <h1 className="mt-6 max-w-full text-[2.35rem] font-black uppercase leading-[0.88] tracking-[-0.055em] text-white min-[375px]:text-[2.65rem] sm:max-w-5xl sm:text-7xl sm:tracking-[-0.065em] xl:text-[6.6rem]">
                Race<br /><span className="text-blue-400">operations.</span>
              </h1>
              <p className="mt-7 max-w-xl border-l border-slate-700 pl-4 text-base leading-7 text-slate-300 sm:text-lg">Kalender, Klassifikationen und Meisterschaften. Ein operatives System für den gesamten FRL-Grid.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              {user ? (
                <Link href="/dashboard" className="wizard-primary-button min-h-12 w-full sm:w-auto">Zum Dashboard <ArrowRight size={18} /></Link>
              ) : (
                <DiscordSignInButton />
              )}
              <Link href="/login" className="wizard-secondary-button min-h-12 w-full sm:w-auto">Race Control öffnen</Link>
              </div>
            </div>
            <aside className="relative min-w-0 border-t border-white/10 bg-black/20 px-5 py-8 sm:px-6 lg:border-l lg:border-t-0 lg:px-8 lg:py-12">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-slate-600">System modules</p>
              <ol className="mt-6 divide-y divide-slate-800">
                {capabilities.map(({ icon: Icon, title }, index) => <li key={title} className="grid grid-cols-[2rem_2.5rem_1fr] items-center gap-3 py-5"><span className="font-mono text-xs text-slate-600">0{index + 1}</span><Icon size={19} className="text-blue-300" /><span className="text-sm font-bold uppercase tracking-[0.08em] text-slate-200">{title}</span></li>)}
              </ol>
              <p className="mt-8 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-300"><span className="size-1.5 bg-emerald-400" /> Operational</p>
            </aside>
            </div>
        </section>

        <section aria-labelledby="platform-title">
          <div className="max-w-2xl">
            <p className="eyebrow">Eine Plattform</p>
            <h2 id="platform-title" className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Vom ersten Termin bis zur finalen Wertung.</h2>
          </div>
          <div className="mt-8 divide-y divide-slate-800 border-y border-slate-800">
            {capabilities.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="grid gap-3 py-6 sm:grid-cols-[3rem_3rem_minmax(0,1fr)] sm:items-center sm:gap-5">
                <span className="font-mono text-xs font-bold text-slate-600">0{index + 1}</span>
                <span className="flex size-11 items-center justify-center border border-blue-400/25 bg-blue-400/10 text-blue-300"><Icon size={20} /></span>
                <div><h3 className="text-lg font-black uppercase tracking-[0.03em] text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
