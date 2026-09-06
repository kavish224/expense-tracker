import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/constants";

// Called once per brand-new local user (first time we see their Clerk id) so
// they aren't dropped into an empty app — Quick-Add needs at least one category
// + one account to be usable. Only "Cash" is created (not fabricated bank/card
// accounts): the user adds their real accounts via the Accounts page.
export async function bootstrapNewUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.category.createMany({
      data: CATEGORIES.map((c) => ({ userId, name: c.name, colorToken: c.colorToken, icon: c.icon })),
    }),
    prisma.account.create({
      data: { userId, name: "Cash", type: "CASH", colorToken: "misc", icon: "💵" },
    }),
  ]);
}

// Our Prisma models are keyed by a local User.id (see FSD data model). Clerk owns
// identity now, so on first sight of a given Clerk user we mint the matching
// local User row — keyed by the Clerk id itself, no separate mapping table —
// and bootstrap their defaults.
async function ensureLocalUser(clerkUserId: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { id: clerkUserId } });
  if (existing) return existing.id;

  const cu = await currentUser();
  const email = cu?.primaryEmailAddress?.emailAddress ?? `${clerkUserId}@users.noreply`;
  try {
    const user = await prisma.user.create({ data: { id: clerkUserId, email } });
    await bootstrapNewUser(user.id);
    return user.id;
  } catch {
    // Unique-constraint race with a concurrent request creating the same row.
    const raced = await prisma.user.findUnique({ where: { id: clerkUserId } });
    if (raced) return raced.id;
    throw new Error(`Failed to provision local user for Clerk id ${clerkUserId}`);
  }
}

// For Server Components / pages — redirects to /login if unauthenticated.
export async function requireUserId(): Promise<string> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/login");
  return ensureLocalUser(clerkUserId);
}

// For Route Handlers — returns null instead of redirecting so the caller can
// respond 401 (redirecting from an API route would return a 3xx to a fetch()
// caller instead of a JSON error).
export async function requireUserIdApi(): Promise<string | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  return ensureLocalUser(clerkUserId);
}

export async function getShellData(userId: string) {
  const [accounts, categories] = await Promise.all([
    // Manually-tracked net-worth accounts (INVESTMENT/LOAN/OTHER_ASSET, FSD 3.6)
    // carry no transaction ledger — excluded here so quick-add/command-palette
    // never let a transaction post against one and silently vanish from every
    // balance/analytics view that reads the ledger instead.
    prisma.account.findMany({ where: { userId, isArchived: false, type: { in: ["BANK", "CREDIT_CARD", "CASH"] } }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);
  return {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, colorToken: a.colorToken, icon: a.icon, identifierHint: a.identifierHint })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, colorToken: c.colorToken, icon: c.icon })),
  };
}

export type ShellAccount = Awaited<ReturnType<typeof getShellData>>["accounts"][number];
export type ShellCategory = Awaited<ReturnType<typeof getShellData>>["categories"][number];
