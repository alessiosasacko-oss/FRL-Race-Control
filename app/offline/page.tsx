import Image from "next/image";
import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="grid min-h-svh place-items-center bg-[#05080e] px-4 py-10 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1220] p-6 text-center shadow-2xl sm:p-9">
        <Image
          src="/icons/frl-192.png"
          alt="FRL"
          width={72}
          height={72}
          unoptimized
          className="mx-auto size-18 rounded-2xl"
        />
        <CloudOff className="mx-auto mt-7 text-blue-300" size={34} />
        <h1 className="mt-4 text-2xl font-black">Keine Internetverbindung</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          FRL Race Control benötigt eine Internetverbindung für aktuelle Renndaten, Ergebnisse und Kontoinformationen.
        </p>
        <Link href="/" className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black uppercase tracking-wide text-white">
          <RefreshCw size={17} />
          Erneut versuchen
        </Link>
      </section>
    </main>
  );
}
