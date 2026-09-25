import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";

export const revalidate = 300;

export default function Home() {
  return (
    <Layout>
      <section className="relative isolate flex min-h-[calc(100dvh-8rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#070b12] sm:min-h-[calc(100dvh-10rem)] lg:min-h-[calc(100dvh-12rem)]">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,rgba(37,99,235,.2),transparent_30%),radial-gradient(circle_at_18%_90%,rgba(14,116,144,.12),transparent_32%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
        <div aria-hidden="true" className="absolute -right-[0.16em] bottom-[-0.16em] select-none font-black leading-none tracking-[-0.12em] text-white/[0.035] text-[clamp(10rem,35vw,34rem)]">FRL</div>

        <div className="relative flex w-full flex-col justify-between px-5 py-7 sm:px-9 sm:py-10 lg:px-14 lg:py-14">
          <div className="flex items-center gap-3 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-slate-400">
            <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_1rem_rgba(103,232,249,.8)]" />
            Offizielle FRL-Plattform
          </div>

          <div className="py-14 sm:py-20 lg:py-24">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200 sm:text-base">Die Zukunft der FRL</p>
            <h1 className="mt-4 font-black uppercase leading-[0.72] tracking-[-0.1em] text-white text-[clamp(5.4rem,21vw,17rem)]">FRL</h1>
            <div className="mt-8 max-w-2xl border-l border-cyan-300/60 pl-4 sm:mt-10 sm:pl-5">
              <p className="text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl">Race Control</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:mt-4 sm:text-base sm:leading-7">Die zentrale Plattform für die FRL.</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 border-t border-white/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-lg text-sm leading-6 text-slate-400">Verwaltung, Ergebnisse, Teams, Fahrer und Kommunikation an einem Ort.</p>
            <Link href="/login" className="wizard-primary-button min-h-12 w-full shrink-0 sm:w-auto">
              Anmelden <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
