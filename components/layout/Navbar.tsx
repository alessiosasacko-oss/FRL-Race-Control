import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#05080e]/80 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:min-h-20 lg:px-8">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl" aria-label="FRL Race Control Startseite">
          <Image src="/images/frl-logo.png" alt="" width={48} height={48} className="size-10 shrink-0 rounded-xl lg:size-12" priority />
          <span className="min-w-0"><span className="block truncate text-sm font-black tracking-tight text-white sm:text-base">FRL Race Control</span><span className="block text-[0.62rem] font-bold uppercase tracking-[0.2em] text-cyan-300">Control Center</span></span>
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 text-sm font-bold text-blue-100 transition hover:border-blue-300 hover:bg-blue-500/20">
          Anmelden <ArrowRight size={16} />
        </Link>
      </div>
    </nav>
  );
}
