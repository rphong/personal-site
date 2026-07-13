import type { Metadata } from "next";
import { PageHero } from "../../components/page-hero";
import { contact, experience, routeByKey } from "../../content/site-content";
import { createPageMetadata } from "../../lib/site-metadata";
import { SceneSection } from "../three/scene-section";

const route = routeByKey.experience;

export function generateMetadata(): Metadata {
  return createPageMetadata("experience");
}

export default function ExperiencePage() {
  return (
    <main>
      <PageHero
        sceneId={route.heroSceneId}
        title={route.title}
      />
      <article className="content-surface" id="page-content">
        <SceneSection
          className="chapter chapter--intro"
          sceneId="experience-intro"
        >
          <div className="chapter-layout">
            <div aria-hidden="true" className="chapter-model-space" />
            <div className="chapter-copy">
              <div className="chapter-copy__inner">
                <p className="section-kicker">The through line</p>
                <h2 className="section-heading">
                  Learning by building what matters.
                </h2>
                <div className="prose">
                  <p>
                    I think about my experience as a set of company chapters
                    rather than a list of disconnected tasks. Each one changed
                    the scale, stakes, or audience of the software I was
                    learning to build.
                  </p>
                  <a className="text-link" download href={contact.resumeHref}>
                    Download my résumé
                  </a>
                </div>
              </div>
            </div>
          </div>
        </SceneSection>
        <div className="chapter-list">
          {experience.map((chapter) => (
            <SceneSection
              className="chapter"
              id={chapter.id}
              key={chapter.id}
              sceneId={chapter.sceneId}
            >
              <div className="chapter-layout">
                <div aria-hidden="true" className="chapter-model-space" />
                <div className="chapter-copy">
                  <div className="chapter-copy__inner">
                    <p className="section-kicker">Company chapter</p>
                    <h2 className="chapter-heading">{chapter.company}</h2>
                    <ul
                      className="role-list"
                      aria-label={`${chapter.company} roles`}
                    >
                      {chapter.roles.map((role) => (
                        <li
                          className="role-entry"
                          key={`${role.title}-${role.dates}`}
                        >
                          <strong>{role.title}</strong>
                          <span>{role.dates}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="prose">
                      {chapter.narrative.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </SceneSection>
          ))}
        </div>
      </article>
    </main>
  );
}
