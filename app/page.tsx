import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../components/page-hero";
import { getOwnerGatedFields, home, routeByKey } from "../content/site-content";
import { createPageMetadata } from "../lib/site-metadata";

const route = routeByKey.home;
const unresolvedOwnerFields = getOwnerGatedFields(home);

export function generateMetadata(): Metadata {
  return createPageMetadata("home");
}

export default function HomePage() {
  return (
    <main>
      <PageHero
        sceneId={route.heroSceneId}
        title={route.title}
        titleStyle="editorial"
      />
      <section className="content-surface" id="page-content">
        <div className="content-inner content-grid">
          <div>
            <p className="section-kicker">A little context</p>
            <h2 className="section-heading">Welcome to my corner.</h2>
          </div>
          <div className="prose">
            <p>{home.introduction}</p>
            <p>
              <strong>{home.currentRole}</strong>
            </p>
            <div
              className="link-cluster"
              aria-label="Explore Richard's site"
            >
              {home.links.map((link) => {
                const external = link.href.startsWith("https://");

                return (
                  <Link
                    className="text-link"
                    href={link.href}
                    key={link.href}
                    rel={external ? "noreferrer" : undefined}
                    target={external ? "_blank" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div
              className="owner-gate"
              data-owner-gated-fields="home.nonWorkInterest home.technicalCuriosity"
            >
              <p>{home.nonWorkInterest}</p>
              <p>{home.technicalCuriosity}</p>
              {unresolvedOwnerFields.length > 0 ? (
                <p>{home.ownerDraftMessage}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
