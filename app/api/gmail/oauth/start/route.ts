import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/user";
import { isGmailEnabled, getGmailAuthUrl } from "@/lib/email/gmail";

// Kicks off the "Connect Gmail" button on /settings — redirects the logged-in
// user straight to Google's consent screen. See oauth/callback/route.ts for the
// other half of the flow.
export async function GET(req: NextRequest) {
  await requireUserId(); // redirects to /login if not signed in

  if (!isGmailEnabled()) {
    return NextResponse.json({ error: "Gmail app credentials (GMAIL_CLIENT_ID/SECRET) are not configured" }, { status: 503 });
  }

  const redirectUri = new URL("/api/gmail/oauth/callback", req.nextUrl.origin).toString();
  const authUrl = getGmailAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
