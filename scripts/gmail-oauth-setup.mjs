#!/usr/bin/env node
// One-time helper to complete the Gmail OAuth consent flow and print a refresh token.
// Uses the same OAuth2 client @googleapis/gmail uses internally (Google's official
// Node OAuth2 client, re-exported via that package) rather than a hand-built
// authorization URL, so URL construction/encoding is handled correctly and there's
// only one copy of the client library in the dependency tree.
//
// Prerequisite: a Google Cloud project with the Gmail API enabled and an OAuth 2.0
// Client ID with http://localhost:8085/oauth2callback added as an authorized redirect
// URI. See the setup walkthrough for the full steps.
//
// Usage: GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-oauth-setup.mjs
import http from "node:http";
import { auth } from "@googleapis/gmail";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8085/oauth2callback";
// Read-only — the poller never writes anything back to Gmail. Dedup (avoiding
// reprocessing the same email) is tracked in our own DB instead of a Gmail label.
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars first (from your Google Cloud OAuth client), then re-run.");
  process.exit(1);
}

const oauth2Client = new auth.OAuth2({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI });

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline", // required to get a refresh_token
  prompt: "consent", // forces a refresh_token even on repeat runs
  scope: [SCOPE],
});

console.log("\n1. Open this URL in your browser and approve access:\n");
console.log(authUrl);
console.log("\n2. Waiting for the redirect back to localhost:8085 ...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Missing code — close this tab and try again.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("No refresh_token returned — you may have already granted consent before. Revoke access at https://myaccount.google.com/permissions and re-run this script.");
      console.error("\nNo refresh_token in response:", tokens);
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { "Content-Type": "text/plain" }).end("Success — you can close this tab and go back to the terminal.");
    console.log("Success. Add this to your .env:\n");
    console.log(`GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`);
    console.log(`GMAIL_CLIENT_ID="${CLIENT_ID}"`);
    console.log(`GMAIL_CLIENT_SECRET="${CLIENT_SECRET}"`);
    server.close();
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Token exchange failed — see terminal.");
    console.error(err);
    server.close();
    process.exit(1);
  }
});

server.listen(8085);
