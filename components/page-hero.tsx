import { ScenePoster } from "./scene-poster";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  summary: string;
  poster: string;
  sceneId: string;
  titleStyle?: "rounded" | "editorial";
};

export function PageHero({
  eyebrow,
  title,
  summary,
  poster,
  sceneId,
  titleStyle = "rounded",
}: PageHeroProps) {
  return (
    <section
      className={`page-hero page-hero--${titleStyle}`}
      data-scene-id={sceneId}
    >
      <ScenePoster className="page-hero__poster" priority src={poster} />
      <div className="page-hero__wash" aria-hidden="true" />
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-hero__summary">{summary}</p>
      </div>
      <a className="scroll-cue" href="#page-content">
        Continue
      </a>
    </section>
  );
}
