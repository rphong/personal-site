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

export interface SceneModelTransform {
  readonly position: Vector3Tuple;
  readonly rotation: Vector3Tuple;
  readonly scale: number;
}

export interface SceneCameraTuning {
  readonly cameraPosition: Vector3Tuple;
  readonly cameraTarget: Vector3Tuple;
  readonly fov: number;
}

export interface SceneTuning {
  readonly desktop: SceneCameraTuning;
  readonly mobile: SceneCameraTuning;
  readonly model: SceneModelTransform;
}

export type SceneAreaEmitterShape = "square" | "disk";

export interface SceneAreaLight {
  readonly source: {
    readonly shape: SceneAreaEmitterShape;
    /** Blender size: square edge length or disk diameter. */
    readonly size: number;
    /** Blender emitter power in watts. */
    readonly power: number;
  };
  readonly color: string;
  readonly intensity: number;
  readonly position: Vector3Tuple;
  readonly target: Vector3Tuple;
  readonly width: number;
  readonly height: number;
}

export interface SceneWorldLight {
  /** Blender-authored world color in linear sRGB. */
  readonly linearColor: Vector3Tuple;
  readonly strength: number;
}

export interface SceneLighting {
  readonly exposure: number;
  readonly world: SceneWorldLight;
  readonly key: SceneAreaLight;
}

export interface SceneGroundShadowLobe {
  readonly profile: "contact" | "cast";
  readonly opacity: number;
  readonly position: Vector3Tuple;
  readonly scale: readonly [width: number, depth: number];
  readonly rotation: number;
}

export interface SceneGroundShadow {
  readonly lobes: readonly SceneGroundShadowLobe[];
  readonly textureSize: 256;
}

export interface StaticScenePose {
  readonly clips: readonly {
    readonly name: string;
    readonly timeSeconds: number;
  }[];
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
  readonly groundShadow?: SceneGroundShadow;
  readonly rotation: RotationLimits;
  readonly nextSceneId: SceneId | null;
}

export interface LiveSceneDefinition
  extends SceneDefinitionBase<LiveSceneId> {
  readonly requiredLive: true;
  readonly modelUrl: `/models/${string}.glb`;
  readonly staticPose?: StaticScenePose;
  readonly modelTransform: SceneModelTransform;
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
