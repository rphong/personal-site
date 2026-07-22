import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "../components/page-hero";
import { home, routeByKey } from "../content/site-content";
import { createPageMetadata } from "../lib/site-metadata";
import styles from "./home.module.css";

const route = routeByKey.home;

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
      <div className="content-surface" id="page-content">
        <section className={`content-inner ${styles.homeIntro}`}>
          <p className="section-kicker">Hello</p>
          <h2 className="chapter-heading">Hi, I&apos;m Richard.</h2>
          <div className="prose">
            <p>{home.introduction}</p>
          </div>
          <div className="link-cluster">
            <Link className="text-link" href={home.experienceLink.href}>
              {home.experienceLink.label}
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="rabbit-holes-heading"
          className={`content-inner ${styles.homeRabbitHoles}`}
        >
          <h2 className="section-kicker" id="rabbit-holes-heading">
            Rabbit holes
          </h2>
          <ul aria-label="Rabbit holes" className={styles.domainGrid}>
            {home.rabbitHoles.map((rabbitHole) => {
              const external = rabbitHole.href.startsWith("https://");

              return (
                <li key={rabbitHole.index}>
                  <Link
                    className={styles.domain}
                    href={rabbitHole.href}
                    rel={external ? "noreferrer" : undefined}
                    target={external ? "_blank" : undefined}
                  >
                    <span className={styles.domainIndex}>{rabbitHole.index}</span>
                    <h3 className={styles.domainTitle}>{rabbitHole.title}</h3>
                    <p>{rabbitHole.description}</p>
                    <span className={styles.domainGo}>{rabbitHole.linkLabel}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
