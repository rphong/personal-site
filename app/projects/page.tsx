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
        sceneId={route.heroSceneId}
        title={route.title}
      />
      <article className="content-surface projects-surface" id="page-content">
        <div className="chapter-list project-chapter-list">
          {projects.map((project) => (
            <SceneSection
              className={`chapter project-chapter project-chapter--${project.sceneId}`}
              id={project.id}
              key={project.id}
              sceneId={project.sceneId}
            >
              <div className="chapter-layout chapter-layout--project">
                <div aria-hidden="true" className="chapter-model-space" />
                <div className="chapter-copy">
                  <div className="chapter-copy__inner">
                    <p className="section-kicker">College project</p>
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
