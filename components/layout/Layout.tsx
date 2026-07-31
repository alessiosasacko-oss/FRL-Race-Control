import Navbar from "./Navbar";
import ThemeSurface from "@/components/design/ThemeSurface";
import { getResolvedTheme } from "@/lib/design/queries";

type LayoutProps = {
  children: React.ReactNode;
  className?: string;
  scope?: "LOGIN" | "PUBLIC";
};

export default async function Layout({ children, className = "", scope = "PUBLIC" }: LayoutProps) {
  const theme = await getResolvedTheme();
  return (
    <ThemeSurface config={theme.config} mode={theme.mode} scope={scope}>
      <div className={`min-h-screen text-white ${className}`}>
        <Navbar />

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </ThemeSurface>
  );
}
