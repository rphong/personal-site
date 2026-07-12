import type { Metadata } from "next";
import { PageHero } from "../../components/page-hero";
import { projects, routeByKey } from "../../content/site-content";
import { createPageMetadata } from "../../lib/site-metadata";
import { SceneSection } from "../three/scene-section";

const route = routeByKey.projects;

export function generateMetadata(): Metadata {
  return createPageMetadata("projects");
}

export default function ProjectsPage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
        sceneId={route.heroSceneId}
        summary={route.heroSummary}
        title={route.title}
      />
      <article className="content-surface" id="page-content">
        <header className="model-free-surface projects-intro">
          <div className="content-inner content-grid">
            <div>
              <p className="section-kicker">Formative favorites</p>
              <h2 className="section-heading">
                Projects with a point of view.
              </h2>
            </div>
            <div className="prose">
              <p>
                These are not meant to be polished flagship case studies. I
                keep them here because they show the moments when software
                connected with something I already cared about, or became more
                meaningful through the people building it with me.
              </p>
            </div>
          </div>
        </header>
        <div className="chapter-list">
          {projects.map((project) => (
            <SceneSection
              className="chapter"
              id={project.id}
              key={project.id}
              sceneId={project.sceneId}
            >
              <div className="chapter-layout">
                <div aria-hidden="true" className="chapter-model-space" />
                <div className="chapter-copy">
                  <div className="chapter-copy__inner">
                    <p className="section-kicker">Creative project</p>
                    <h2 className="chapter-heading">{project.name}</h2>
                    <div className="prose">
                      <p>{project.reflection}</p>
                    </div>
                    <p className="technical-line">{project.technicalLine}</p>
                    <a
                      className="text-link"
                      href={project.repository}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View {project.name} on GitHub
                    </a>
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
