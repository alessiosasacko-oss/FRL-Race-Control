import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/50 px-8 py-5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Image
  src="/images/frl-logo.png"
  alt="FRL Logo"
  width={64}
  height={64}
  className="rounded-2xl"
/>

        <h1 className="text-2xl font-bold text-red-600">
          FRL Race Control
        </h1>
      </div>

      <div className="flex items-center gap-8">
        <Link href="/" className="text-gray-300 transition hover:text-white">
          Home
        </Link>

        <Link href="/calendar" className="text-gray-300 transition hover:text-white">
          Kalender
        </Link>

        <Link href="/championship" className="text-gray-300 transition hover:text-white">
          Standings
        </Link>

        <Link href="/teams" className="text-gray-300 transition hover:text-white">
          Teams
        </Link>

        <Button text="Discord Login" />
      </div>
    </nav>
  );
}
