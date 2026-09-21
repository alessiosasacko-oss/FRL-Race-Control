import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#06090d]/95">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:min-h-18 lg:px-8">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-3" aria-label="FRL Race Control Startseite">
          <Image src="/images/frl-logo.png" alt="" width={44} height={44} className="size-10 shrink-0 rounded" priority />
          <span className="min-w-0"><span className="block truncate text-sm font-black uppercase tracking-[0.08em] text-white sm:text-base">FRL // RC</span><span className="block text-[0.58rem] font-bold uppercase tracking-[0.22em] text-slate-500">F1 Realistic League</span></span>
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center justify-center gap-2 border border-blue-400/30 bg-blue-500/10 px-4 text-xs font-bold uppercase tracking-[0.08em] text-blue-100 transition hover:border-blue-300 hover:bg-blue-500/20">
          Anmelden <ArrowRight size={16} />
        </Link>
      </div>
    </nav>
  );
}
