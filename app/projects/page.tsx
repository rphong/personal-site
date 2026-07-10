import { PageHero } from "../../components/page-hero";
import { ScenePoster } from "../../components/scene-poster";
import { projects, routeByKey } from "../../content/site-content";

const route = routeByKey.projects;

export default function ProjectsPage() {
  return (
    <main>
      <PageHero
        eyebrow={route.eyebrow}
        poster={route.heroPoster}
        sceneId={route.heroSceneId}
        summary={route.heroSummary}
        title={route.title}
      />
      <article className="content-surface" id="page-content">
        <div className="content-inner">
          <header className="content-grid">
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
          </header>
          <div className="chapter-list">
            {projects.map((project) => (
              <section
                className="chapter"
                data-required-live={project.requiredLive}
                data-scene-id={project.sceneId}
                id={project.id}
                key={project.id}
              >
                <div className="chapter-layout">
                  <ScenePoster alt={project.posterAlt} src={project.poster} />
                  <div>
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
              </section>
            ))}
          </div>
        </div>
      </article>
    </main>
  );
}
