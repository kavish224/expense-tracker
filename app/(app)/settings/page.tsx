import { requireUserId } from "@/lib/user";
import { prisma } from "@/lib/db";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailEmail: true, gmailConnectedAt: true, gmailNeedsReconnect: true, gmailRefreshToken: true },
  });

  const gmail = {
    connected: !!user?.gmailRefreshToken,
    email: user?.gmailEmail ?? null,
    connectedAt: user?.gmailConnectedAt?.toISOString() ?? null,
    needsReconnect: user?.gmailNeedsReconnect ?? false,
  };

  return <SettingsClient gmail={gmail} />;
}
