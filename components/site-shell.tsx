"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import {
  routeByKey,
  routeKeyFromPathname,
} from "../content/site-content";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

type SiteShellProps = {
  children: React.ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  const activeRoute = routeKeyFromPathname(usePathname());
  const theme = routeByKey[activeRoute].theme;
  const themeProperties = {
    "--route-accent": theme.accent,
    "--route-background": theme.background,
    "--route-pale-heading": theme.paleHeading,
  } as CSSProperties;

  return (
    <div
      className="site-shell"
      data-route={activeRoute}
      style={themeProperties}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteNav activeRoute={activeRoute} />
      <div className="site-shell__content" id="main-content" tabIndex={-1}>
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
