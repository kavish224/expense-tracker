import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn/ui utility: merges conditional class lists and resolves
 * conflicting Tailwind classes (e.g. a caller's "p-2" overriding a base "p-4"). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
