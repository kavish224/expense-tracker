// Categorisation: rules, then the user's own merchant history, then a generic
// merchant-keyword heuristic (FSD 3.1). Returns categoryKey + confidence.
// Unknown → "misc" low confidence → review.
import { normalizeMerchant } from "./merchant";

export interface RuleRecord {
  matchType: string; // MERCHANT_CONTAINS | VPA_EQUALS
  matchValue: string;
  setCategoryId: string;
  priority: number;
}

const KEYWORDS: Record<string, string[]> = {
  food: ["swiggy", "zomato", "eatsure", "dominos", "kfc", "mcdonald", "restaurant", "cafe", "chai", "starbucks", "biryani"],
  grocery: ["bigbasket", "blinkit", "zepto", "grofers", "dmart", "instamart", "supermarket", "kirana"],
  transport: ["uber", "ola", "rapido", "metro", "irctc", "indianoil", "hpcl", "bpcl", "fuel", "petrol", "namma"],
  shopping: ["amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "croma", "reliance digital"],
  bills: ["netflix", "spotify", "hotstar", "jio", "airtel", "vi ", "electricity", "bescom", "recharge", "prime", "youtube"],
  health: ["pharmeasy", "1mg", "apollo", "netmeds", "practo", "hospital", "clinic", "medical"],
  entertainment: ["bookmyshow", "pvr", "inox", "gaming", "steam"],
};

export interface CategorizeResult {
  categoryKey: string;
  confidence: number;
}

// `categoryIdToKey` is required alongside `rules` because a Rule stores the target as an
// actual DB categoryId, but this function otherwise operates in the fixed-key space shared
// by every categorization call site (email ingest, CSV/XLSX import, LLM fallback) — a rule
// whose target category can't be resolved back to a key is skipped rather than guessed at.
export function categorize(
  input: { merchantName?: string; narration?: string; vpa?: string; amount?: number; accountId?: string },
  rules: RuleRecord[] = [],
  categoryIdToKey?: Map<string, string>,
  // Keyed by normalizeMerchant(...).toLowerCase() → the category this user has most
  // often confirmed for that merchant in their own history. Built once per request
  // in categorizeUser.ts (see loadCategorizationContext) from past reviewed
  // transactions — this is implicit, per-user learning distinct from (and checked
  // before) the generic KEYWORDS table below, without requiring the user to have
  // explicitly created a Rule for every merchant they've ever confirmed.
  merchantMajority?: Map<string, string>
): CategorizeResult {
  const hay = `${input.merchantName || ""} ${input.narration || ""} ${input.vpa || ""}`.toLowerCase();

  // 1) user-taught rules (highest priority first) — a rule is a certainty, confidence 1
  if (categoryIdToKey) {
    for (const r of [...rules].sort((a, b) => b.priority - a.priority)) {
      let hit = false;
      if (r.matchType === "MERCHANT_CONTAINS" && r.matchValue && hay.includes(r.matchValue.toLowerCase())) hit = true;
      else if (r.matchType === "VPA_EQUALS" && input.vpa && input.vpa.toLowerCase() === r.matchValue.toLowerCase()) hit = true;
      if (hit) {
        const key = categoryIdToKey.get(r.setCategoryId);
        if (key) return { categoryKey: key, confidence: 1 };
      }
    }
  }

  // 2) this user's own confirmed history for the same merchant — stronger signal
  // than a generic keyword guess, since it reflects how *this* person actually
  // categorizes that specific merchant.
  if (merchantMajority && input.merchantName) {
    const key = merchantMajority.get(normalizeMerchant(input.merchantName).toLowerCase());
    if (key) return { categoryKey: key, confidence: 0.75 };
  }

  // 3) keyword heuristic
  for (const [key, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => hay.includes(w))) return { categoryKey: key, confidence: 0.85 };
  }

  // 4) unknown → misc, low confidence (routes to review)
  return { categoryKey: "misc", confidence: 0.3 };
}
