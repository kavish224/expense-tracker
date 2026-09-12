"use client";
import { useSyncExternalStore } from "react";

/** SSR-safe media query hook via useSyncExternalStore — the React-recommended
 * way to subscribe to an external browser API like matchMedia without the
 * setState-in-effect render cascade a useState+useEffect version causes. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false // server snapshot: mobile-first, matches first client render before hydration settles
  );
}
