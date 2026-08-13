// Categorisation: rules first, then merchant-keyword heuristic (FSD 3.1).
// Returns categoryKey + confidence. Unknown → "misc" low confidence → review.

export interface RuleLite {
  matchType: string; // MERCHANT_CONTAINS | VPA_EQUALS | AMOUNT_RANGE | ACCOUNT
  matchValue: string;
  setCategoryKey: string;
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

export function categorize(
  input: { merchantName?: string; narration?: string; vpa?: string; amount?: number; accountId?: string },
  rules: RuleLite[] = []
): CategorizeResult {
  const hay = `${input.merchantName || ""} ${input.narration || ""} ${input.vpa || ""}`.toLowerCase();

  // 1) rules (highest priority first)
  for (const r of [...rules].sort((a, b) => b.priority - a.priority)) {
    if (r.matchType === "MERCHANT_CONTAINS" && hay.includes(r.matchValue.toLowerCase()))
      return { categoryKey: r.setCategoryKey, confidence: 1 };
    if (r.matchType === "VPA_EQUALS" && input.vpa && input.vpa.toLowerCase() === r.matchValue.toLowerCase())
      return { categoryKey: r.setCategoryKey, confidence: 1 };
    if (r.matchType === "ACCOUNT" && input.accountId === r.matchValue)
      return { categoryKey: r.setCategoryKey, confidence: 0.8 };
  }

  // 2) keyword heuristic
  for (const [key, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => hay.includes(w))) return { categoryKey: key, confidence: 0.85 };
  }

  // 3) unknown → misc, low confidence (routes to review)
  return { categoryKey: "misc", confidence: 0.3 };
}
