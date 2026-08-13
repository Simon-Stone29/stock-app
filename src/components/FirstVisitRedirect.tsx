"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const VISITED_KEY = "alphapool_has_visited";

/**
 * Redirects a user to /about exactly once, on their very first visit to the
 * site's home route. Renders nothing — mount it once in the root layout.
 */
export function FirstVisitRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Only gate the home route — don't hijack someone opening a direct link
    // to /leaderboard or /group-portfolio.
    if (pathname !== "/") return;

    const hasVisited = localStorage.getItem(VISITED_KEY);
    if (!hasVisited) {
      // Set the flag before navigating, so even if they bounce off /about
      // without clicking through, they won't be redirected again.
      localStorage.setItem(VISITED_KEY, "true");
      router.replace("/about");
    }
  }, [pathname, router]);

  return null;
}