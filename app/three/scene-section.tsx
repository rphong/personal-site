"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { getSceneDefinition } from "./scene-registry";
import { ScenePoster } from "./scene-poster";
import { useOptionalSceneRuntime } from "./scene-runtime-context";
import type { SceneId } from "./types";

interface SceneSectionProps
  extends Omit<ComponentPropsWithoutRef<"section">, "children"> {
  readonly sceneId: SceneId;
  readonly forceActive?: boolean;
  readonly contentClassName?: string;
  readonly posterClassName?: string;
  readonly posterPriority?: boolean;
  readonly children: ReactNode;
}

export function SceneSection({
  sceneId,
  forceActive = false,
  contentClassName = "",
  posterClassName = "",
  posterPriority = false,
  className = "",
  children,
  ...sectionProps
}: SceneSectionProps) {
  const elementRef = useRef<HTMLElement>(null);
  const runtime = useOptionalSceneRuntime();
  const scene = getSceneDefinition(sceneId);
  const isActive = runtime?.activeSceneId === sceneId;
  const registerSection = runtime?.registerSection;
  const activateScene = runtime?.activateScene;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !registerSection) return;
    return registerSection(sceneId, element);
  }, [registerSection, sceneId]);

  useEffect(() => {
    if (forceActive) activateScene?.(sceneId);
  }, [activateScene, forceActive, sceneId]);

  return (
    <section
      {...sectionProps}
      ref={elementRef}
      className={`scene-section ${className}`.trim()}
      data-scene-id={sceneId}
      data-scene-active={isActive ? "true" : "false"}
      data-scene-status={isActive && runtime ? runtime.status : "poster"}
    >
      <ScenePoster
        scene={scene}
        className={`scene-section__poster ${posterClassName}`.trim()}
        priority={posterPriority}
      />
      <div
        className={`scene-section__content ${contentClassName}`.trim()}
      >
        {children}
      </div>
    </section>
  );
}
