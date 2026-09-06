import { requireUserId } from "@/lib/user";
import { prisma } from "@/lib/db";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [user, lastProcessed] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { gmailEmail: true, gmailConnectedAt: true, gmailNeedsReconnect: true, gmailRefreshToken: true },
    }),
    // Proxy for "last time the poller actually ran" — Google issues no fixed
    // expiry for this kind of offline access up front (see SettingsClient's
    // note), so the only real signal of freshness is the last successful
    // poll rather than a countdown we'd otherwise have to fabricate.
    prisma.gmailProcessedMessage.aggregate({ _max: { processedAt: true } }),
  ]);

  const gmail = {
    connected: !!user?.gmailRefreshToken,
    email: user?.gmailEmail ?? null,
    connectedAt: user?.gmailConnectedAt?.toISOString() ?? null,
    needsReconnect: user?.gmailNeedsReconnect ?? false,
    lastPolledAt: lastProcessed._max.processedAt?.toISOString() ?? null,
  };

  return <SettingsClient gmail={gmail} />;
}
