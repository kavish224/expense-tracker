import { requireUserId, getShellData } from "@/lib/user";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const { accounts, categories } = await getShellData(userId);
  return (
    <AppShell accounts={accounts} categories={categories}>
      {children}
    </AppShell>
  );
}
