import { prisma } from "@/lib/db";

// Verifies a referenced accountId/categoryId actually belongs to the calling user
// before it's used as a foreign key in a write. Without this, any authenticated
// user can attach transactions to (and read metadata from) another user's account
// or category simply by guessing/observing its id.
export async function assertOwnedAccount(userId: string, accountId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
  return !!account;
}

export async function assertOwnedCategory(userId: string, categoryId: string): Promise<boolean> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } });
  return !!category;
}
