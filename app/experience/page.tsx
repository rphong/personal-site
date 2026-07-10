import { PageHero } from "../../components/page-hero";
import { ScenePoster } from "../../components/scene-poster";
import { contact, experience, routeByKey } from "../../content/site-content";

const route = routeByKey.experience;

export default function ExperiencePage() {
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
          <header
            className="content-grid"
            data-required-live="true"
            data-scene-id="experience-intro"
          >
            <div>
              <p className="section-kicker">The through line</p>
              <h2 className="section-heading">
                Learning by building what matters.
              </h2>
            </div>
            <div className="prose">
              <p>
                I think about my experience as a set of company chapters rather
                than a list of disconnected tasks. Each one changed the scale,
                stakes, or audience of the software I was learning to build.
              </p>
              <a className="text-link" download href={contact.resumeHref}>
                Download my résumé
              </a>
            </div>
          </header>
          <div className="chapter-list">
            {experience.map((chapter) => (
              <section
                className="chapter"
                data-required-live={chapter.requiredLive}
                data-scene-id={chapter.sceneId}
                id={chapter.id}
                key={chapter.id}
              >
                <div className="chapter-layout">
                  <ScenePoster src={chapter.poster} />
                  <div>
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
              </section>
            ))}
          </div>
        </div>
      </article>
    </main>
  );
}
