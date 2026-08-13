import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/user";
import { prisma } from "@/lib/db";

export async function POST() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: userId },
    data: { gmailRefreshToken: null, gmailEmail: null, gmailConnectedAt: null, gmailNeedsReconnect: false },
  });
  return NextResponse.json({ ok: true });
}
