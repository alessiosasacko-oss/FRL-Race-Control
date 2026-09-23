import type { Metadata, Viewport } from "next";
import PwaLifecycle from "@/components/pwa/PwaLifecycle";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "FRL Race Control",
  title: {
    default: "FRL Race Control",
    template: "%s | FRL Race Control",
  },
  description: "Die offizielle Verwaltungsplattform der F1 Realistic League.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FRL",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/frl-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/frl-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05080E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <PwaLifecycle />
      </body>
    </html>
  );
}
