type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  // The persistent shell now lives in app/(protected)/layout.tsx. Keeping this
  // compatibility boundary avoids touching every route (and any foreign work)
  // while route content and loading states can stream inside the same shell.
  return children;
}
