import Navbar from "./Navbar";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <Navbar />

      <main className="mx-auto max-w-7xl px-8 py-10">
        {children}
      </main>
    </div>
  );
}