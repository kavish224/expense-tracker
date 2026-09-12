import { Suspense } from "react";
import { SettlementsClient } from "./SettlementsClient";

export const dynamic = "force-dynamic";

export default function SettlementsPage() {
  return (
    <Suspense fallback={null}>
      <SettlementsClient />
    </Suspense>
  );
}
