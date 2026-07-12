"use client";

import { usePathname } from "next/navigation";
import { routeKeyFromPathname } from "../content/site-content";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

type SiteShellProps = {
  children: React.ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  const activeRoute = routeKeyFromPathname(usePathname());

  return (
    <div className="site-shell" data-route={activeRoute}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div aria-hidden="true" className="scene-stage" data-scene-stage />
      <SiteNav activeRoute={activeRoute} />
      <div className="site-shell__content" id="main-content" tabIndex={-1}>
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
