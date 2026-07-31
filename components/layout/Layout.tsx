import Navbar from "./Navbar";

type LayoutProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Layout({ children, className = "" }: LayoutProps) {
  return (
    <div className={`min-h-screen bg-[#05070A] text-white ${className}`}>
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
