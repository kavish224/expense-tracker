"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { useShell } from "@/components/AppShell";

interface GmailStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  needsReconnect: boolean;
}

export function SettingsClient({ gmail }: { gmail: GmailStatus }) {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useShell();
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const result = params.get("gmail");
    if (result === "connected") toast("Gmail connected — new bank alerts will be picked up automatically.");
    if (result === "error") toast(`Couldn't connect Gmail (${params.get("reason") || "unknown error"}) — try again.`);
    if (result) router.replace("/settings");
  }, [params, router, toast]);

  async function disconnect() {
    if (!confirm("Disconnect Gmail? Automatic alert parsing will stop until you reconnect.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("disconnect failed");
      router.refresh();
    } catch {
      toast("Couldn't disconnect — check your connection and try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 18px 40px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 18 }}>Settings</h1>

      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Gmail alert parsing</div>
            {gmail.connected && !gmail.needsReconnect ? (
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Connected as {gmail.email}
                {gmail.connectedAt ? ` · since ${new Date(gmail.connectedAt).toLocaleDateString()}` : ""}
              </div>
            ) : gmail.needsReconnect ? (
              <div style={{ fontSize: 13, color: "var(--danger, #e5484d)" }}>
                Access expired or was revoked — reconnect to resume automatic parsing.
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Not connected — bank alert emails won&apos;t be parsed automatically.
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {gmail.connected && !gmail.needsReconnect ? (
              <Button size="sm" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            ) : (
              <a href="/api/gmail/oauth/start">
                <Button size="sm">{gmail.needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}</Button>
              </a>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
