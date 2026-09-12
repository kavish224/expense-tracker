import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/user";
import { isGmailEnabled, getGmailAuthUrl, signOAuthState } from "@/lib/email/gmail";

// Kicks off the "Connect Gmail" button on /settings — redirects the logged-in
// user straight to Google's consent screen. See oauth/callback/route.ts for the
// other half of the flow. Same route, same code, in local dev and production —
// only the redirect URI's origin differs, and both must be registered on the
// Google Cloud OAuth client.
export async function GET(req: NextRequest) {
  const userId = await requireUserId(); // redirects to /login if not signed in

  if (!isGmailEnabled()) {
    return NextResponse.json({ error: "Gmail app credentials (GMAIL_CLIENT_ID/SECRET) are not configured" }, { status: 503 });
  }

  const redirectUri = new URL("/api/gmail/oauth/callback", req.nextUrl.origin).toString();
  const authUrl = getGmailAuthUrl(redirectUri, signOAuthState(userId));
  return NextResponse.redirect(authUrl);
}
