import type { SceneDefinition } from "./types";

export function ScenePoster({
  scene,
  className,
  onLoad,
  priority = false,
}: {
  readonly scene: SceneDefinition;
  readonly className: string;
  readonly onLoad?: (image: HTMLImageElement) => void;
  readonly priority?: boolean;
}) {
  return (
    <picture className={className}>
      <source
        media="(max-width: 767px)"
        srcSet={scene.poster.mobile}
        width={585}
        height={1266}
      />
      <img
        src={scene.poster.desktop}
        alt={scene.poster.alt}
        width={1920}
        height={1080}
        draggable={false}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        onLoad={(event) => onLoad?.(event.currentTarget)}
      />
    </picture>
  );
}
