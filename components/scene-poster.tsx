import Image from "next/image";

type ScenePosterProps = {
  src: string;
  alt?: string;
  priority?: boolean;
  className?: string;
};

export function ScenePoster({
  src,
  alt = "",
  priority = false,
  className = "",
}: ScenePosterProps) {
  return (
    <figure
      aria-hidden={alt === "" ? "true" : undefined}
      className={`scene-poster ${className}`.trim()}
      data-scene-poster={src}
    >
      <Image
        alt={alt}
        className="scene-poster__image"
        fill
        priority={priority}
        sizes="(max-width: 720px) 100vw, 72vw"
        src={src}
      />
    </figure>
  );
}
