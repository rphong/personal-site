import type { Metadata } from "next";
import { PageHero } from "../../components/page-hero";
import { contact, routeByKey } from "../../content/site-content";
import { createPageMetadata } from "../../lib/site-metadata";

const route = routeByKey.contact;

export function generateMetadata(): Metadata {
  return createPageMetadata("contact");
}

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
        poster={route.heroPoster}
        sceneId={route.heroSceneId}
        summary={route.heroSummary}
        title={route.title}
      />
      <section className="content-surface" id="page-content">
        <div className="content-inner">
          <div className="content-grid">
            <div>
              <p className="section-kicker">Direct lines</p>
              <h2 className="section-heading">{"Let's get in touch."}</h2>
            </div>
            <div className="prose">
              <p>{contact.introduction}</p>
              <a
                className="text-link"
                download
                href={contact.resumeHref}
              >
                Download résumé
              </a>
            </div>
          </div>
          <ul className="contact-list" aria-label="Contact Richard">
            {contact.actions.map((action) => {
              const external = action.href.startsWith("https://");

              return (
                <li key={action.href}>
                  <a
                    className="contact-card"
                    href={action.href}
                    rel={external ? "noreferrer" : undefined}
                    target={external ? "_blank" : undefined}
                  >
                    <strong>{action.label}</strong>
                    <span>{action.display}</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <section className="privacy-panel prose" id="privacy">
            <p className="section-kicker">Operational telemetry</p>
            <h2 className="chapter-heading">Privacy, plainly.</h2>
            <p>{contact.privacy}</p>
          </section>
        </div>
      </section>
    </main>
  );
}
