import { requireAuthenticatedUser } from "@/lib/auth/session";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  await requireAuthenticatedUser();

  return children;
}
