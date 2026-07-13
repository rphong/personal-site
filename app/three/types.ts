export const THREE_STATUSES = [
  "poster",
  "loading",
  "ready",
  "error",
  "unsupported",
  "disabled",
  "context-lost",
] as const;

export type ThreeStatus = (typeof THREE_STATUSES)[number];

export type SceneId =
  | "home-hero"
  | "experience-hero"
  | "experience-intro"
  | "nasa-rocket"
  | "eog-poster"
  | "paycom-poster"
  | "projects-hero"
  | "league-ban"
  | "froggie-adventures"
  | "contact-hero";

export type PosterOnlySceneId = "eog-poster" | "paycom-poster";
export type LiveSceneId = Exclude<SceneId, PosterOnlySceneId>;

export type SiteRoute = "/" | "/experience" | "/projects" | "/contact";

export type Vector3Tuple = readonly [x: number, y: number, z: number];

export interface SceneRotation {
  readonly yaw: number;
  readonly pitch: number;
}

export interface RotationLimits {
  readonly yaw: readonly [min: number, max: number];
  readonly pitch: readonly [min: number, max: number];
  readonly default: SceneRotation;
  readonly degreesPerPixel: number;
}

export interface PercentInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface SceneFrame {
  readonly cameraPosition: Vector3Tuple;
  readonly cameraTarget: Vector3Tuple;
  readonly fov: number;
  readonly rotationArea: PercentInsets;
}

export interface SceneLighting {
  readonly ambient: {
    readonly color: string;
    readonly intensity: number;
  };
  readonly key: {
    readonly color: string;
    readonly intensity: number;
    readonly position: Vector3Tuple;
    readonly castShadow: false;
  };
}

export interface SceneContactShadow {
  readonly opacity: number;
  readonly position: Vector3Tuple;
  readonly scale: readonly [width: number, depth: number];
  readonly textureSize: 64;
}

export interface ScenePosterDefinition {
  readonly desktop: string;
  readonly mobile: string;
  readonly alt: "";
}

interface SceneDefinitionBase<Id extends SceneId> {
  readonly id: Id;
  readonly label: string;
  readonly route: SiteRoute;
  readonly background: string;
  readonly poster: ScenePosterDefinition;
  readonly desktop: SceneFrame;
  readonly mobile: SceneFrame;
  readonly lighting: SceneLighting;
  readonly contactShadow?: SceneContactShadow;
  readonly rotation: RotationLimits;
  readonly nextSceneId: SceneId | null;
}

export interface LiveSceneDefinition
  extends SceneDefinitionBase<LiveSceneId> {
  readonly requiredLive: true;
  readonly modelUrl: `/models/${string}.glb`;
}

export interface PosterOnlySceneDefinition
  extends SceneDefinitionBase<PosterOnlySceneId> {
  readonly requiredLive: false;
  readonly modelUrl: null;
}

export type SceneDefinition =
  | LiveSceneDefinition
  | PosterOnlySceneDefinition;

export type SceneFailureReason =
  | "fetch"
  | "decode"
  | "timeout"
  | "webgl2-unavailable"
  | "context-lost"
  | "unknown";
