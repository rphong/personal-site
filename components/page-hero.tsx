import { SceneSection } from "../app/three/scene-section";
import type { SceneId } from "../app/three/types";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  summary: string;
  sceneId: SceneId;
  composition?: "standard" | "layered";
  titleStyle?: "rounded" | "editorial";
};

export function PageHero({
  eyebrow,
  title,
  summary,
  sceneId,
  composition = "standard",
  titleStyle = "rounded",
}: PageHeroProps) {
  const isLayered = composition === "layered";

  return (
    <SceneSection
      className={`page-hero page-hero--${titleStyle} page-hero--${composition}`}
      contentClassName="page-hero__content"
      posterClassName="page-hero__poster"
      posterPriority
      sceneId={sceneId}
    >
      <div className="page-hero__wash" aria-hidden="true" />
      <div className="page-hero__copy">
        {isLayered ? null : <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {isLayered ? null : <p className="page-hero__summary">{summary}</p>}
      </div>
      {isLayered ? null : (
        <a className="scroll-cue" href="#page-content">
          Continue
        </a>
      )}
    </SceneSection>
  );
}
