import Navbar from "./Navbar";

type LayoutProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Layout({ children, className = "" }: LayoutProps) {
  return (
    <div className={`min-h-screen bg-[#05070A] text-white ${className}`}>
      <Navbar />

      <main className="mx-auto max-w-7xl px-8 py-10">
        {children}
      </main>
    </div>
  );
}
