import Link from "next/link";
import { routes, type RouteKey } from "../content/site-content";

type SiteNavProps = {
  activeRoute: RouteKey;
};

export function SiteNav({ activeRoute }: SiteNavProps) {
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
          </Link>
        ))}
      </nav>
    </header>
  );
}
