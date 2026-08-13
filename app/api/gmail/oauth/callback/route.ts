import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/user";
import { exchangeGmailCode } from "@/lib/email/gmail";
import { prisma } from "@/lib/db";

// Google redirects here after consent. Exchanges the code for a refresh token
// and stores it on the current user's row — see lib/email/gmail.ts for how
// pollGmailForAlerts() consumes it, and how it gets cleared (with
// gmailNeedsReconnect set) if Google later revokes/expires it.
export async function GET(req: NextRequest) {
  const userId = await requireUserId();

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const settingsUrl = new URL("/settings", req.nextUrl.origin);

  if (error) {
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("reason", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("reason", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = new URL("/api/gmail/oauth/callback", req.nextUrl.origin).toString();
    const { refreshToken, email } = await exchangeGmailCode(code, redirectUri);
    await prisma.user.update({
      where: { id: userId },
      data: { gmailRefreshToken: refreshToken, gmailEmail: email, gmailConnectedAt: new Date(), gmailNeedsReconnect: false },
    });
    settingsUrl.searchParams.set("gmail", "connected");
  } catch (err) {
    console.error("Gmail OAuth callback failed:", err);
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("reason", "exchange_failed");
  }

  return NextResponse.redirect(settingsUrl);
}
