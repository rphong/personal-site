"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { routes, type RouteKey } from "../content/site-content";

type SiteNavProps = {
  activeRoute: RouteKey;
};

export function SiteNav({ activeRoute }: SiteNavProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <header className="site-nav">
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
