"use client";

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { routes, type RouteKey } from "../content/site-content";

type SiteNavProps = {
  activeRoute: RouteKey;
};

type HeaderModeGeometry = {
  currentScrollY: number;
  headerBottom: number;
  heroBottom: number;
  maximumScrollY: number;
};

const SCROLL_BOUNDARY_TOLERANCE_PX = 1;

export function shouldUseNavigationIsland({
  currentScrollY,
  headerBottom,
  heroBottom,
  maximumScrollY,
}: HeaderModeGeometry): boolean {
  if (maximumScrollY <= 0) return false;

  const idealActivationScrollY = Math.max(
    0,
    currentScrollY + heroBottom - headerBottom,
  );
  const reachableActivationScrollY = Math.min(
    idealActivationScrollY,
    maximumScrollY,
  );

  return (
    currentScrollY >=
    reachableActivationScrollY - SCROLL_BOUNDARY_TOLERANCE_PX
  );
}

export function SiteNav({ activeRoute }: SiteNavProps) {
  const prefersReducedMotion = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);
  const [isIsland, setIsIsland] = useState(false);
  const { scrollY } = useScroll();

  const updateHeaderMode = useCallback(() => {
    const header = headerRef.current;
    const hero = document.querySelector<HTMLElement>(".page-hero");

    if (!header || !hero) {
      setIsIsland(false);
      return;
    }

    const headerBounds = header.getBoundingClientRect();
    const heroBounds = hero.getBoundingClientRect();

    // A zero-sized box means the document has not been laid out yet (notably in
    // non-visual environments). The resize/scroll observers will try again.
    if (headerBounds.height <= 0 || heroBounds.height <= 0) {
      setIsIsland(false);
      return;
    }

    const root = document.documentElement;
    const documentHeight = Math.max(
      root.scrollHeight,
      document.body?.scrollHeight ?? 0,
    );
    const viewportHeight = root.clientHeight || window.innerHeight;

    setIsIsland(
      shouldUseNavigationIsland({
        currentScrollY: window.scrollY,
        headerBottom: headerBounds.bottom,
        heroBottom: heroBounds.bottom,
        maximumScrollY: Math.max(0, documentHeight - viewportHeight),
      }),
    );
  }, []);

  useMotionValueEvent(scrollY, "change", updateHeaderMode);

  useEffect(() => {
    updateHeaderMode();
    window.addEventListener("resize", updateHeaderMode);

    const hero = document.querySelector<HTMLElement>(".page-hero");
    const resizeObserver =
      hero && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateHeaderMode)
        : null;

    if (hero) resizeObserver?.observe(hero);

    return () => {
      window.removeEventListener("resize", updateHeaderMode);
      resizeObserver?.disconnect();
    };
  }, [activeRoute, updateHeaderMode]);

  return (
    <header
      className="site-nav"
      data-island={isIsland ? "true" : "false"}
      ref={headerRef}
    >
      <motion.div
        animate={
          isIsland
            ? {
                borderRadius: "999px",
                boxShadow:
                  "0 1rem 2.5rem rgb(40 40 40 / 0.2), 0 0.2rem 0.65rem rgb(40 40 40 / 0.12)",
              }
            : {
                borderRadius: "0px",
                boxShadow:
                  "0 0rem 0rem rgb(40 40 40 / 0), 0 0rem 0rem rgb(40 40 40 / 0)",
              }
        }
        aria-hidden="true"
        className="site-nav__surface"
        initial={false}
        layout={prefersReducedMotion ? false : true}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                borderRadius: { duration: 0.24, ease: "easeOut" },
                boxShadow: { duration: 0.24, ease: "easeOut" },
                layout: {
                  type: "spring",
                  stiffness: 380,
                  damping: 34,
                  mass: 0.72,
                },
              }
        }
      />
      <nav aria-label="Primary navigation" className="site-nav__inner">
        {routes.map((route) => (
          <Link
            aria-current={activeRoute === route.key ? "page" : undefined}
            className="site-nav__link"
            href={route.href}
            key={route.key}
          >
            {route.label}
            {activeRoute === route.key ? (
              <motion.span
                aria-hidden="true"
                className="site-nav__indicator"
                layoutId="site-nav-indicator"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            ) : null}
          </Link>
        ))}
      </nav>
    </header>
  );
}
