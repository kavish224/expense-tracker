"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import { Card, Overline, Button } from "@/components/ui";
import { useShell } from "@/components/AppShell";

interface GmailStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  needsReconnect: boolean;
  lastPolledAt: string | null;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
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

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Gmail alert parsing</div>
            {gmail.connected && !gmail.needsReconnect ? (
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Connected as {gmail.email}
                {gmail.connectedAt ? ` · since ${new Date(gmail.connectedAt).toLocaleDateString()}` : ""}
              </div>
            ) : gmail.needsReconnect ? (
              <div style={{ fontSize: 13, color: "var(--neg)" }}>
                Access expired or was revoked — reconnect to resume automatic parsing.
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Not connected — bank alert emails won&apos;t be parsed automatically.
              </div>
            )}
            {gmail.connected && !gmail.needsReconnect && (
              <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 3 }}>
                {gmail.lastPolledAt ? `Last checked ${relativeTime(gmail.lastPolledAt)}` : "Not checked yet"}
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
        {gmail.connected && !gmail.needsReconnect && (
          <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--hairline)", lineHeight: 1.5 }}>
            Google doesn&apos;t hand out a fixed expiry for this kind of access up front — it stays valid until you
            disconnect it, Google flags it unused for an extended period, or (if this app&apos;s Google Cloud project
            is still in Testing publishing status) roughly 7 days pass. There&apos;s no way to show a countdown for
            that in advance — if access does lapse, this card will switch to &quot;Reconnect Gmail&quot; the next
            time a poll runs and finds it revoked.
          </div>
        )}
      </Card>

      <Card style={{ padding: 18 }}>
        <Overline style={{ marginBottom: 14 }}>Account</Overline>
        <div style={{ maxWidth: "100%", overflowX: "auto" }}>
          <UserProfile
            routing="hash"
            appearance={{ elements: { rootBox: { width: "100%" }, cardBox: { width: "100%", boxShadow: "none", border: "none" }, card: { boxShadow: "none", border: "none", padding: 0 } } }}
          />
        </div>
      </Card>
    </div>
  );
}
