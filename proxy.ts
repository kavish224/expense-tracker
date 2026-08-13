import { clerkMiddleware } from "@clerk/nextjs/server";

// Route-matching in middleware is deprecated by Clerk in favor of resource-based
// checks — every page/route calls requireUserId()/requireUserIdApi() (lib/user.ts)
// itself, which is what actually enforces auth. This just makes Clerk's auth
// context available on the request.
export const proxy = clerkMiddleware();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|.*\\.png$).*)"],
};
