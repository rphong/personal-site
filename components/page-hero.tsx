import { SceneSection } from "../app/three/scene-section";
import type { SceneId } from "../app/three/types";

type PageHeroProps = {
  title: string;
  sceneId: SceneId;
  titleStyle?: "rounded" | "editorial";
};

export function PageHero({
  title,
  sceneId,
  titleStyle = "rounded",
}: PageHeroProps) {
  return (
    <SceneSection
      className={`page-hero page-hero--${titleStyle} page-hero--layered`}
      contentClassName="page-hero__content"
      posterClassName="page-hero__poster"
      posterPriority
      sceneId={sceneId}
    >
      <div className="page-hero__wash" aria-hidden="true" />
      <div className="page-hero__copy">
        <h1>{title}</h1>
      </div>
      <a className="scroll-cue" href="#page-content">
        Scroll down
      </a>
    </SceneSection>
  );
}
