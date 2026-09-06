import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUserIdApi } from "@/lib/user";
import { detectColumns, extractRow, looksLikeHeader, type ColumnMap } from "@/lib/parsing/columns";
import { parseNarration } from "@/lib/parsing/narration";
import { loadCategorizationContext, categorizeInContext, type CategorizationContext } from "@/lib/parsing/categorizeUser";
import { tieOut, type TieRow } from "@/lib/parsing/tieout";
import { dedup, type DedupExisting } from "@/lib/parsing/dedup";
import { CATEGORY_BY_KEY } from "@/lib/constants";
import { assertOwnedAccount } from "@/lib/ownership";
import { isLlmEnabled, mapRowsWithLLM } from "@/lib/llm/adapter";
import { parseStatementDate } from "@/lib/parsing/date";

// Minimal RFC4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF/LF).
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.length)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellToValue(v: ExcelJS.CellValue): string | number {
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("text" in v && typeof (v as any).text === "string") return (v as any).text;
    if ("result" in v && (v as any).result != null) return cellToValue((v as any).result);
    if ("richText" in v && Array.isArray((v as any).richText)) return (v as any).richText.map((r: any) => r.text).join("");
  }
  return String(v);
}

async function readMatrix(buf: Buffer, fileName: string): Promise<(string | number)[][]> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "csv") return parseCSV(buf.toString("utf-8"));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matrix: (string | number)[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1); // exceljs is 1-indexed
    matrix.push(values.map(cellToValue));
  });
  return matrix;
}

// A column map is only usable if we found a date and at least one amount-bearing column.
function columnMapUsable(map: ColumnMap): boolean {
  return map.date != null && (map.debit != null || map.credit != null || map.amount != null);
}

// Text to hand the LLM fallback for messy/unrecognized formats. For CSV, this reads the
// original file text directly rather than reusing the deterministically-tokenized matrix:
// parseCSV splits on literal commas, so a comma inside a field (e.g. a thousands
// separator like "62,000.00") gets torn into separate cells — reconstructing from those
// cells would feed the LLM corrupted numbers. For XLSX there's no "original line" to
// fall back to, so cell-joining is the best available representation there.
function rawLinesForLLM(buf: Buffer, fileName: string, dataRows: (string | number)[][]): string[] {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "csv") {
    return buf
      .toString("utf-8")
      .split(/\r\n|\r|\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return dataRows.map((r) => r.map((c) => String(c ?? "")).join(" | "));
}

// Fallback for messy/unrecognized statement formats: hand raw text lines to the LLM
// adapter (via Vercel AI Gateway) and build the same parsedRows/tieRows shape the
// deterministic path produces. Rows still go through narration parsing (for rail/VPA/ref
// extraction), categorization (as a backstop when the model didn't return one), and dedup.
async function buildRowsFromLLM(
  rawLines: string[],
  accountId: string,
  existingLite: DedupExisting[],
  ctx: CategorizationContext
): Promise<{ parsedRows: any[]; tieRows: TieRow[] } | null> {
  const llmRows = await mapRowsWithLLM(rawLines);
  if (!llmRows) return null;

  const parsedRows: any[] = [];
  const tieRows: TieRow[] = [];
  let idx = 0;
  for (const row of llmRows) {
    if (!row.amount || !row.direction) continue;
    const nar = parseNarration(row.narration || "");
    const merchantName = row.merchantName || nar.counterparty;
    const cat = row.category ? { categoryKey: row.category, confidence: row.confidence } : categorizeInContext(ctx, { merchantName, narration: row.narration, vpa: nar.vpa, amount: row.amount });
    const date = parseStatementDate(row.date);
    const d = dedup(
      { amount: row.amount, date, accountId, externalRef: nar.externalRef, instrumentHint: nar.vpa, merchantName },
      existingLite
    );
    const needsReview = cat.confidence < 0.5 || d.status === "PROBABLE";
    parsedRows.push({
      rowIndex: idx,
      date: date.toISOString(),
      narration: row.narration,
      merchantName,
      categoryKey: cat.categoryKey,
      categoryName: CATEGORY_BY_KEY[cat.categoryKey]?.name ?? "Misc",
      amount: row.amount,
      direction: row.direction,
      rail: nar.rail,
      externalRef: nar.externalRef,
      confidence: cat.confidence,
      dedupStatus: d.status,
      dedupMatchId: d.matchId ?? null,
      needsReview,
    });
    // No per-row balance from the LLM path — tieOut() falls back to its control-total method.
    tieRows.push({ index: idx, debit: row.direction === "DEBIT" ? row.amount : 0, credit: row.direction === "CREDIT" ? row.amount : 0, balance: undefined });
    idx++;
  }
  return { parsedRows, tieRows };
}

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const accountId = String(form.get("accountId") || "");
  if (!file || !accountId) return NextResponse.json({ error: "file and accountId required" }, { status: 400 });
  if (!(await assertOwnedAccount(userId, accountId))) return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — generous for a bank/card statement, guards against memory exhaustion
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  let matrix: (string | number)[][] = [];
  try {
    matrix = await readMatrix(buf, file.name);
  } catch {
    return NextResponse.json({ error: "Could not read file" }, { status: 400 });
  }

  // Locate header row. Only skip row 0 as a "header" if it actually looks like one,
  // or if it column-detects into a usable map — otherwise (e.g. headerless free-text
  // statements) treat every row as data instead of silently dropping row 0.
  let map: ColumnMap;
  let dataRows: (string | number)[][];
  const headerIdx = matrix.findIndex((r) => looksLikeHeader((r as string[]).map(String)));
  if (headerIdx !== -1) {
    map = detectColumns((matrix[headerIdx] as string[]).map(String));
    dataRows = matrix.slice(headerIdx + 1).filter((r) => r && r.length);
  } else {
    const firstRowMap = matrix.length > 0 ? detectColumns((matrix[0] as string[]).map(String)) : {};
    if (columnMapUsable(firstRowMap)) {
      map = firstRowMap;
      dataRows = matrix.slice(1).filter((r) => r && r.length);
    } else {
      map = {};
      dataRows = matrix.filter((r) => r && r.length);
    }
  }

  const parsedRows: any[] = [];
  const tieRows: TieRow[] = [];
  const catCtx = await loadCategorizationContext(userId);

  // existing txns for dedup (recent window)
  const existing = await prisma.transaction.findMany({
    where: { userId, accountId },
    select: { id: true, amount: true, txnDatetime: true, accountId: true, externalRef: true, instrumentHint: true, merchantName: true },
    orderBy: { txnDatetime: "desc" },
    take: 800,
  });
  const existingLite: DedupExisting[] = existing.map((e) => ({
    id: e.id, amount: Number(e.amount), date: e.txnDatetime, accountId: e.accountId,
    externalRef: e.externalRef, instrumentHint: e.instrumentHint, merchantName: e.merchantName,
  }));

  let idx = 0;
  if (columnMapUsable(map)) {
    for (const raw of dataRows) {
      const ex = extractRow(raw as any, map);
      if (!ex.debit && !ex.credit) continue;
      const nar = parseNarration(ex.narration || ex.ref || "");
      const direction = ex.debit > 0 ? "DEBIT" : "CREDIT";
      const amount = ex.debit > 0 ? ex.debit : ex.credit;
      const cat = categorizeInContext(catCtx, { merchantName: nar.counterparty, narration: ex.narration, vpa: nar.vpa, amount });
      const date = parseStatementDate(ex.dateRaw);
      const d = dedup(
        { amount, date, accountId, externalRef: nar.externalRef, instrumentHint: nar.vpa, merchantName: nar.counterparty },
        existingLite
      );
      const needsReview = cat.confidence < 0.5 || d.status === "PROBABLE";
      parsedRows.push({
        rowIndex: idx,
        date: date.toISOString(),
        narration: ex.narration,
        merchantName: nar.counterparty,
        categoryKey: cat.categoryKey,
        categoryName: CATEGORY_BY_KEY[cat.categoryKey]?.name ?? "Misc",
        amount,
        direction,
        rail: nar.rail,
        externalRef: nar.externalRef,
        confidence: cat.confidence,
        dedupStatus: d.status,
        dedupMatchId: d.matchId ?? null,
        needsReview,
      });
      tieRows.push({ index: idx, debit: ex.debit, credit: ex.credit, balance: ex.balance });
      idx++;
    }
  }

  // Deterministic column detection couldn't make sense of this file (unrecognized
  // header format, or a header we matched but extracted nothing usable from) — fall
  // back to the LLM adapter for messy/unfamiliar statement formats, if enabled.
  let usedLlmFallback = false;
  if ((!columnMapUsable(map) || parsedRows.length === 0) && dataRows.length > 0 && isLlmEnabled()) {
    const llmResult = await buildRowsFromLLM(rawLinesForLLM(buf, file.name, dataRows), accountId, existingLite, catCtx);
    if (llmResult && llmResult.parsedRows.length > 0) {
      parsedRows.length = 0;
      tieRows.length = 0;
      parsedRows.push(...llmResult.parsedRows);
      tieRows.push(...llmResult.tieRows);
      usedLlmFallback = true;
    }
  }

  // tie-out (needs opening/closing from balance column)
  let opening: number | null = null;
  let closing: number | null = null;
  const withBal = tieRows.filter((r) => typeof r.balance === "number");
  if (withBal.length === tieRows.length && tieRows.length > 0) {
    const first = tieRows[0];
    opening = (first.balance as number) - (first.credit - first.debit);
    closing = tieRows[tieRows.length - 1].balance as number;
  }
  const tie = tieOut(tieRows, opening, closing);

  const summary = {
    total: parsedRows.length,
    verified: parsedRows.filter((r) => !r.needsReview && r.dedupStatus === "NEW").length,
    review: parsedRows.filter((r) => r.needsReview).length,
    duplicates: parsedRows.filter((r) => r.dedupStatus === "DUPLICATE").length,
  };

  return NextResponse.json({
    accountId,
    fileName: file.name,
    columnMap: map,
    usedLlmFallback,
    tieOut: { ...tie, opening, closing },
    summary,
    rows: parsedRows,
  });
}
