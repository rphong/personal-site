import { SceneSection } from "../app/three/scene-section";
import type { SceneId } from "../app/three/types";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  summary: string;
  sceneId: SceneId;
  titleStyle?: "rounded" | "editorial";
};

export function PageHero({
  eyebrow,
  title,
  summary,
  sceneId,
  titleStyle = "rounded",
}: PageHeroProps) {
  return (
    <SceneSection
      className={`page-hero page-hero--${titleStyle}`}
      contentClassName="page-hero__content"
      posterClassName="page-hero__poster"
      posterPriority
      sceneId={sceneId}
    >
      <div className="page-hero__wash" aria-hidden="true" />
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-hero__summary">{summary}</p>
      </div>
      <a className="scroll-cue" href="#page-content">
        Continue
      </a>
    </SceneSection>
  );
}
