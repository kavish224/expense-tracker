// WhatsApp notifications via Meta's WhatsApp Business Cloud API. Personal
// single-recipient use case — configured entirely via env vars (mirrors the
// GMAIL_TARGET_USER_EMAIL pattern), no per-user DB config.
//
// Business-initiated messages are only reliably deliverable via pre-approved
// Message Templates — free-form text only works within the 24h "customer
// service window" opened by the recipient messaging the business number
// first. Each send below tries the template first and falls back to free-form
// text if the template call fails (e.g. still pending Meta review) — this is
// a stopgap for the approval-pending period; once both templates are
// Approved, sends succeed on the template attempt and the fallback never
// triggers, so no code change is needed when that happens. The fallback
// itself will start failing once the 24h window closes — that's expected,
// not a bug — send the bot any WhatsApp message to reopen it.
//
// Both templates must be created and APPROVED in Meta Business Manager, with
// this exact body text. Meta requires named variables (lowercase +
// underscores, e.g. {{amount}}) rather than positional {{1}}/{{2}} for new
// templates — the `name` fields below must match exactly, since the send
// call addresses each parameter by parameter_name, not position:
//
//   transaction_alert (category: Utility, language: English):
//     "💸 *Transaction Alert*
//
//     Amount: {{amount}}
//     Merchant: {{merchant}}
//     Account: {{account}}
//     Time: {{txn_time}}
//
//     Auto-logged from your Gmail bank alerts."
//
//   daily_summary (category: Utility, language: English):
//     "📊 *Daily Summary — {{summary_date}}*
//
//     Total spent: {{total_spent}}
//     Transactions: {{txn_count}}
//     Top merchant: {{top_merchant}}
//
//     Have a great day!"

const GRAPH_VERSION = "v21.0";

export function isWhatsAppEnabled(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TO_NUMBER);
}

async function graphSend(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = res.ok ? "" : await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

async function sendTemplate(templateName: string, params: { name: string; value: string }[]): Promise<{ ok: boolean; status: number; body: string }> {
  const to = process.env.WHATSAPP_TO_NUMBER;
  return graphSend({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: [{ type: "body", parameters: params.map((p) => ({ type: "text", parameter_name: p.name, text: p.value })) }],
    },
  });
}

async function sendFreeText(text: string): Promise<{ ok: boolean; status: number; body: string }> {
  const to = process.env.WHATSAPP_TO_NUMBER;
  return graphSend({ messaging_product: "whatsapp", to, type: "text", text: { body: text } });
}

// Tries the template first; on failure (most likely: still pending review),
// falls back to free-form text. Never throws — errors are caught and logged
// by the caller-facing notify* functions below so a WhatsApp/Meta outage
// never blocks transaction ingestion.
async function sendWithFallback(templateName: string, params: { name: string; value: string }[], freeText: string): Promise<void> {
  const templateResult = await sendTemplate(templateName, params);
  if (templateResult.ok) return;

  console.warn(`WhatsApp template "${templateName}" send failed (${templateResult.status}): ${templateResult.body.slice(0, 300)} — falling back to free-form text`);
  const textResult = await sendFreeText(freeText);
  if (!textResult.ok) {
    throw new Error(
      `WhatsApp send failed on both template and free-text fallback (${textResult.status}): ${textResult.body.slice(0, 300)} — ` +
        `if this is a 24h-window error, send the bot any WhatsApp message to reopen it`
    );
  }
}

export async function notifyTransaction(opts: {
  merchantName: string | null | undefined;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  accountName: string;
  when: Date;
}): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  const sign = opts.direction === "CREDIT" ? "+" : "-";
  const time = opts.when.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
  const amount = `${sign}₹${opts.amount.toFixed(2)}`;
  const merchant = opts.merchantName || "Unknown";
  try {
    await sendWithFallback(
      "transaction_alert",
      [
        { name: "amount", value: amount },
        { name: "merchant", value: merchant },
        { name: "account", value: opts.accountName },
        { name: "txn_time", value: time },
      ],
      `💸 Transaction Alert\n\nAmount: ${amount}\nMerchant: ${merchant}\nAccount: ${opts.accountName}\nTime: ${time}\n\nAuto-logged from your Gmail bank alerts.`
    );
  } catch (err) {
    console.error("WhatsApp transaction alert failed:", err);
  }
}

export async function notifyDailySummary(opts: {
  dateLabel: string;
  totalSpent: number;
  count: number;
  topMerchant: string | null;
}): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  const total = `₹${opts.totalSpent.toFixed(2)}`;
  const top = opts.topMerchant || "—";
  try {
    await sendWithFallback(
      "daily_summary",
      [
        { name: "summary_date", value: opts.dateLabel },
        { name: "total_spent", value: total },
        { name: "txn_count", value: String(opts.count) },
        { name: "top_merchant", value: top },
      ],
      `📊 Daily Summary — ${opts.dateLabel}\n\nTotal spent: ${total}\nTransactions: ${opts.count}\nTop merchant: ${top}\n\nHave a great day!`
    );
  } catch (err) {
    console.error("WhatsApp daily summary failed:", err);
  }
}

// Ops alert for pipeline failures (Gmail auth expired, poll errors, etc) — no
// approved template exists for this, so it's always free-form text, which
// means it only delivers within the 24h window. That's an acceptable tradeoff
// for a personal single-recipient alert: worst case (window closed) it's
// silently dropped exactly like any other WhatsApp send failure, and the
// underlying failure is still visible in Vercel logs regardless.
export async function notifyError(context: string, message: string): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  try {
    const result = await sendFreeText(`⚠️ ${context}\n\n${message}`);
    if (!result.ok) {
      console.error(`WhatsApp error alert send failed (${result.status}): ${result.body.slice(0, 300)}`);
    }
  } catch (err) {
    console.error("WhatsApp error alert failed:", err);
  }
}
