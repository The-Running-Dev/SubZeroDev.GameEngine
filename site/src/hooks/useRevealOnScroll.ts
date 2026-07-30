import { useEffect } from "react";

/**
 * Scroll reveals, built so that failure shows content rather than hiding it.
 *
 * The ordering matters. Content is visible by default in CSS; the hiding rule
 * is scoped to `.js-reveal` on the root, and this hook only adds that class
 * once an IntersectionObserver actually exists. So the page is readable when
 * JavaScript never runs, when it throws before this point, or when the browser
 * has no observer support — none of which are exotic.
 *
 * That is the requirement the dropped no-JavaScript rule was really protecting:
 * a failed or absent reveal must leave content visible, never hidden.
 *
 * Two further guards, because "the observer will fire" is an assumption:
 *
 * - Elements already in view are revealed on the observer's first callback,
 *   which fires immediately on observe(). No scroll needed.
 * - A timeout reveals everything regardless, so a bailed-out observer, a
 *   detached node, or a browser quirk costs a delay rather than a blank page.
 */
const FAILSAFE_MS = 3000;

export function useRevealOnScroll() {
  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    if (targets.length === 0) return;

    const revealAll = () =>
      targets.forEach((el) => el.setAttribute("data-reveal", "shown"));

    // No observer support: leave everything visible and do nothing else.
    if (typeof IntersectionObserver === "undefined") return;

    const root = document.documentElement;
    root.classList.add("js-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-reveal", "shown");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
    );

    targets.forEach((el) => observer.observe(el));

    const failsafe = window.setTimeout(revealAll, FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
      root.classList.remove("js-reveal");
    };
  }, []);
}
