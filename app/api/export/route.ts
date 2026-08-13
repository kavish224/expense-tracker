import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";

// CSV export of transactions. (PDF export is generated client-side via jsPDF on Analytics.)
export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.transaction.findMany({
    where: { userId },
    include: { account: true, category: true },
    orderBy: { txnDatetime: "desc" },
    take: 5000,
  });

  const header = ["Date", "Merchant", "Category", "Account", "Rail", "Direction", "Amount", "Ref"];
  const lines = [header.join(",")];
  for (const t of rows) {
    lines.push(
      [
        t.txnDatetime.toISOString().slice(0, 10),
        csv(t.merchantName ?? ""),
        csv(t.category?.name ?? ""),
        csv(t.account.name),
        t.paymentRail,
        t.direction,
        Number(t.amount).toFixed(2),
        csv(t.externalRef ?? ""),
      ].join(",")
    );
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csv(s: string) {
  // Neutralize formula/DDE injection: a leading =, +, -, @, tab, or CR makes some
  // spreadsheet apps interpret the cell as a formula when the file is opened.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
