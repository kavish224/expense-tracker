// Enriches an existing (Clerk-authenticated) user with realistic sample data for
// testing. Identity now comes from Clerk — this script no longer creates a user
// or a password; it targets a User row that already exists in the DB (created
// automatically by lib/user.ts on that person's first sign-in) and replaces
// their bootstrap defaults (categories + a bare Cash account) with a fuller
// dataset: 7 bank/card accounts + Cash, budgets, and ~75 days of transactions.
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ACCOUNT_SEEDS, CATEGORIES } from "../lib/constants";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MERCHANTS = [
  { name: "Swiggy", cat: "food", rail: "UPI", min: 180, max: 640 },
  { name: "Zomato", cat: "food", rail: "UPI", min: 200, max: 700 },
  { name: "Blinkit", cat: "grocery", rail: "UPI", min: 300, max: 1600 },
  { name: "BigBasket", cat: "grocery", rail: "UPI", min: 800, max: 2600 },
  { name: "Uber", cat: "transport", rail: "CARD", min: 90, max: 480 },
  { name: "Rapido", cat: "transport", rail: "UPI", min: 40, max: 160 },
  { name: "Indian Oil", cat: "transport", rail: "CARD", min: 500, max: 2500 },
  { name: "Amazon IN", cat: "shopping", rail: "CARD", min: 299, max: 4999 },
  { name: "Myntra", cat: "shopping", rail: "CARD", min: 599, max: 3499 },
  { name: "Netflix", cat: "bills", rail: "UPI", fixed: 649 },
  { name: "Airtel", cat: "bills", rail: "UPI", fixed: 599 },
  { name: "PharmEasy", cat: "health", rail: "UPI", min: 200, max: 1400 },
  { name: "BookMyShow", cat: "entertainment", rail: "CARD", min: 300, max: 1200 },
];

function rand(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}
function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

async function resolveTargetUser(): Promise<{ id: string; email: string }> {
  const emailArg = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1];
  if (emailArg) {
    const user = await prisma.user.findUnique({ where: { email: emailArg } });
    if (!user) throw new Error(`No user with email ${emailArg}. Sign in via Clerk first, then re-run seed.`);
    return user;
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (users.length === 0) {
    throw new Error("No users in the DB yet. Sign in via Clerk once (creates your account), then re-run `npm run seed`.");
  }
  if (users.length > 1) {
    throw new Error("Multiple users found — re-run with `npm run seed -- --email=you@example.com` to pick one.");
  }
  return users[0];
}

async function main() {
  const user = await resolveTargetUser();

  // Replace whatever this user currently has (bootstrap defaults or a prior
  // seed run) with the full realistic dataset.
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });

  // categories
  const catMap: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const created = await prisma.category.create({
      data: { userId: user.id, name: c.name, colorToken: c.colorToken, icon: c.icon },
    });
    catMap[c.key] = created.id;
  }

  // accounts
  const accounts: { id: string; name: string; type: string }[] = [];
  for (const a of ACCOUNT_SEEDS) {
    const created = await prisma.account.create({
      data: {
        userId: user.id,
        name: a.name,
        type: a.type as any,
        institution: a.institution,
        identifierHint: a.identifierHint,
        colorToken: a.colorToken,
        icon: a.icon,
        openingBalance: a.type === "CASH" ? 5000 : a.type === "BANK" ? 45000 : 0,
      },
    });
    accounts.push({ id: created.id, name: created.name, type: created.type });
  }
  const cards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const banks = accounts.filter((a) => a.type === "BANK");
  const cash = accounts.find((a) => a.type === "CASH")!;

  // budgets — overall + per category
  await prisma.budget.create({ data: { userId: user.id, categoryId: null, amount: 60000, period: "MONTHLY" } });
  const budgetCats: Record<string, number> = { food: 8000, grocery: 6000, transport: 5000, shopping: 8000, bills: 3000, health: 2000, entertainment: 2000 };
  for (const [k, amt] of Object.entries(budgetCats)) {
    await prisma.budget.create({ data: { userId: user.id, categoryId: catMap[k], amount: amt, period: "MONTHLY" } });
  }

  // transactions across last 75 days
  const now = new Date();
  const txns: any[] = [];
  for (let d = 75; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const count = Math.random() < 0.85 ? 1 + Math.floor(Math.random() * 4) : 0; // some no-spend days
    for (let i = 0; i < count; i++) {
      const m = pick(MERCHANTS);
      const amount = (m as any).fixed ?? rand(m.min!, m.max!);
      // UPI-on-credit heavy: most UPI + card spend on cards; some UPI from bank; rare cash
      let account;
      const r = Math.random();
      if (m.rail === "CARD") account = pick(cards);
      else if (r < 0.6) account = pick(cards); // UPI on RuPay CC (heavy)
      else if (r < 0.9) account = pick(banks); // UPI from bank
      else account = cash;
      const when = new Date(day);
      when.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));
      txns.push({
        userId: user.id,
        accountId: account.id,
        direction: "DEBIT",
        amount,
        txnDatetime: when,
        categoryId: catMap[m.cat],
        merchantName: m.name,
        paymentRail: account.id === cash.id ? "CASH" : (m.rail as any),
        source: "MANUAL",
        confidence: 1,
        isReviewed: true,
        externalRef: m.rail !== "CASH" ? String(2401_00000000 + Math.floor(Math.random() * 8999_9999)) : null,
      });
    }
  }
  // monthly salary credits
  for (let mo = 0; mo < 3; mo++) {
    const when = new Date(now);
    when.setMonth(now.getMonth() - mo, 1);
    when.setHours(11, 0);
    txns.push({
      userId: user.id, accountId: banks[0].id, direction: "CREDIT", amount: 184000, txnDatetime: when,
      categoryId: catMap["income"], merchantName: "Salary", paymentRail: "NEFT", source: "MANUAL", isReviewed: true,
    });
  }
  // a few pending (to-review) imported items
  for (let i = 0; i < 4; i++) {
    const m = pick(MERCHANTS);
    const when = new Date(now); when.setDate(now.getDate() - i);
    txns.push({
      userId: user.id, accountId: pick(cards).id, direction: "DEBIT", amount: rand(200, 1500), txnDatetime: when,
      categoryId: catMap[m.cat], merchantName: m.name, paymentRail: "UPI", source: "IMPORT",
      confidence: 0.5, isReviewed: false, rawNarration: `UPI/${m.name.toLowerCase()}@ybl/${m.name}/SUCCESS`,
    });
  }

  await prisma.transaction.createMany({ data: txns });

  console.log(`Seeded sample data for ${user.email}`);
  console.log(`  ${accounts.length} accounts, ${CATEGORIES.length} categories, ${txns.length} transactions`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
