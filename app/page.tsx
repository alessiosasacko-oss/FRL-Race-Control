import DiscordSignInButton from "@/components/auth/DiscordSignInButton";
import Card from "@/components/ui/Card";
import Layout from "@/components/layout/Layout";

export default function Home() {
  return (
    <Layout className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      

      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center py-32 text-center">
        <span className="animate-pulse text-7xl">🏁</span>

        <p className="text-sm font-bold uppercase tracking-[0.4em] text-blue-400">
  F1 Realistic League
</p>

<h1 className="mt-4 text-7xl font-black tracking-tight">
  Race Control
</h1>

        <p className="mt-6 max-w-2xl text-xl text-gray-400">
          Die offizielle Verwaltungsplattform der F1 Realistic League.
        </p>

        <div className="mt-10">
          <DiscordSignInButton />
        </div>
      </div>

      {/* 👇 HIER kommt Schritt 4 hin 👇 */}

      <div className="mx-auto mt-12 max-w-xl px-8">
        <Card title="🏁 Nächstes Rennen">
          <p className="text-lg text-white">
            Bahrain Grand Prix
          </p>

          <p className="mt-2 text-gray-400">
            Sonntag • 20:00 Uhr
          </p>
        </Card>
      </div>

    </Layout>
  );
}
