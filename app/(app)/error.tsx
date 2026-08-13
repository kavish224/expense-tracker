"use client";
import { useEffect } from "react";
import { Card, Button } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 18px", textAlign: "center" }}>
      <Card style={{ padding: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Something went wrong</div>
        <div style={{ fontSize: 13.5, color: "var(--ink-muted)", marginBottom: 20 }}>
          That page hit an error. Your data is safe — try again.
        </div>
        <Button onClick={reset}>Try again</Button>
      </Card>
    </div>
  );
}
