import type {
  LiveSceneId,
  PercentInsets,
  RotationLimits,
  SceneAreaLight,
  SceneDefinition,
  SceneFrame,
  SceneId,
  SceneLighting,
  SceneModelTransform,
  SiteRoute,
  Vector3Tuple,
} from "./types";

export const LIVE_SCENE_IDS = [
  "home-hero",
  "experience-hero",
  "experience-intro",
  "nasa-rocket",
  "projects-hero",
  "league-ban",
  "froggie-adventures",
  "contact-hero",
] as const satisfies readonly LiveSceneId[];

const DEFAULT_ROTATION: RotationLimits = {
  yaw: [-25, 25],
  pitch: [-8, 8],
  default: { yaw: 0, pitch: 0 },
  degreesPerPixel: 0.14,
};

const DEFAULT_MODEL_TRANSFORM: SceneModelTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
};

const DESKTOP_AREA: PercentInsets = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};
const MOBILE_AREA: PercentInsets = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};
const EXPERIENCE_CHAPTER_DESKTOP_AREA: PercentInsets = {
  top: 12,
  right: 4,
  bottom: 12,
  left: 42,
};
const EXPERIENCE_CHAPTER_MOBILE_AREA: PercentInsets = {
  top: 6,
  right: 8,
  bottom: 50,
  left: 8,
};
const PROJECT_CHAPTER_DESKTOP_AREA: PercentInsets = {
  top: 10,
  right: 14,
  bottom: 46,
  left: 14,
};
const PROJECT_CHAPTER_MOBILE_AREA: PercentInsets = {
  top: 6,
  right: 6,
  bottom: 50,
  left: 6,
};

function frame(
  cameraPosition: Vector3Tuple,
  cameraTarget: Vector3Tuple,
  fov: number,
  rotationArea: PercentInsets,
): SceneFrame {
  return { cameraPosition, cameraTarget, fov, rotationArea };
}

function areaLight(
  power: number,
  size: number,
  position: Vector3Tuple,
  target: Vector3Tuple,
): SceneAreaLight {
  return {
    color: "#ffffff",
    // Blender area lights store total power. Three.js stores luminance, and
    // derives power as intensity * width * height * PI.
    intensity: power / (Math.PI * size * size),
    position,
    target,
    width: size,
    height: size,
  };
}

function sourceLighting(
  power: number,
  size: number,
  position: Vector3Tuple,
  target: Vector3Tuple,
  ambientIntensity = 0.16,
): SceneLighting {
  return {
    exposure: 1,
    ambient: { color: "#ffffff", intensity: ambientIntensity },
    key: areaLight(power, size, position, target),
  };
}

// These rigs mirror the single broad AREA lights kept in the Blender source
// scenes (Blender Z-up positions converted to glTF/Three.js Y-up). The dim
// ambient term approximates the source world's 0.05 background strength.
const CRANE_LIGHT_POSITION = [
  0.334772,
  7.233446,
  1.919428,
] as const satisfies Vector3Tuple;
const CRANE_LIGHT_SIZE = 26.463022;

const HOME_LIGHTING = sourceLighting(
  3000,
  CRANE_LIGHT_SIZE,
  CRANE_LIGHT_POSITION,
  [0, 0, 0],
);
const EXPERIENCE_HERO_LIGHTING = sourceLighting(
  3000,
  CRANE_LIGHT_SIZE,
  CRANE_LIGHT_POSITION,
  [0, 0, 0],
);
const EXPERIENCE_INTRO_LIGHTING = sourceLighting(
  4000,
  CRANE_LIGHT_SIZE,
  CRANE_LIGHT_POSITION,
  [0, 0, 0],
);
const NASA_ROCKET_LIGHTING = sourceLighting(
  5000,
  20,
  [-3.736411, 4.354816, 0.722618],
  [-1.06, 0, 0.5],
);
const PINK_POSTER_LIGHTING = HOME_LIGHTING;
const PROJECTS_HERO_LIGHTING = sourceLighting(
  3750,
  CRANE_LIGHT_SIZE,
  [1.141019, 6.502828, 1.778768],
  [-1.7, 0, -0.15],
);
const LEAGUE_BAN_LIGHTING = sourceLighting(
  4000,
  30,
  [-0.84895, 3.693709, 0.832018],
  [-0.86, 0, 0.88],
);
const FROGGIE_LIGHTING = sourceLighting(
  720,
  5,
  [4.2, 7.2, 5],
  [-1.85, 0, -2.2],
  0.11,
);
const CONTACT_LIGHTING = EXPERIENCE_HERO_LIGHTING;

export const SCENE_DEFINITIONS = {
  "home-hero": {
    id: "home-hero",
    label: "Origami crane home scene",
    route: "/",
    background: "#9ECCC0",
    requiredLive: true,
    modelUrl: "/models/crane.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/home-hero-desktop.webp",
      mobile: "/posters/home-hero-mobile.webp",
      alt: "",
    },
    desktop: frame([6, 2.6, 3.4], [0, 0.2, 0], 34, DESKTOP_AREA),
    mobile: frame([7.6, 3.25, 4.35], [0, -0.05, 0], 38, MOBILE_AREA),
    lighting: HOME_LIGHTING,
    contactShadow: {
      opacity: 0.58,
      position: [-1.05, -0.46, -0.55],
      scale: [1.9, 0.72],
      textureSize: 256,
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "experience-hero",
  },
  "experience-hero": {
    id: "experience-hero",
    label: "Workout crane experience scene",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: true,
    modelUrl: "/models/crane-workout.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/experience-hero-desktop.webp",
      mobile: "/posters/experience-hero-mobile.webp",
      alt: "",
    },
    desktop: frame([3.7, 2.3, 4.7], [0.2, 0.8, 0.3], 36, DESKTOP_AREA),
    mobile: frame([5.2, 4.1, 9.6], [0.2, 0.8, 0.3], 40, MOBILE_AREA),
    lighting: EXPERIENCE_HERO_LIGHTING,
    contactShadow: {
      opacity: 0.44,
      position: [0.1, -0.01, 0.45],
      scale: [3.4, 1.55],
      textureSize: 256,
    },
    staticPose: {
      clips: [
        { name: "Dumbell L", timeSeconds: 40 / 24 },
        { name: "Dumbell R", timeSeconds: 40 / 24 },
        { name: "Lifting Weights", timeSeconds: 40 / 24 },
      ],
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "experience-intro",
  },
  "experience-intro": {
    id: "experience-intro",
    label: "Crane throwing a paper plane",
    route: "/experience",
    background: "transparent",
    requiredLive: true,
    modelUrl: "/models/crane-throwing-plane.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/experience-intro-desktop.webp",
      mobile: "/posters/experience-intro-mobile.webp",
      alt: "",
    },
    desktop: frame(
      [4.4, 3.2, 7.2],
      [0, 0.6, 0],
      34,
      EXPERIENCE_CHAPTER_DESKTOP_AREA,
    ),
    mobile: frame(
      [4.6, 2.9, 7.2],
      [0, 0.5, 0],
      34,
      EXPERIENCE_CHAPTER_MOBILE_AREA,
    ),
    lighting: EXPERIENCE_INTRO_LIGHTING,
    contactShadow: {
      opacity: 0.5,
      position: [-0.1, -0.01, 0],
      scale: [2.3, 0.95],
      textureSize: 256,
    },
    staticPose: {
      clips: [
        { name: "EmptyAction", timeSeconds: 1 / 24 },
        { name: "Hat propellerAction.002", timeSeconds: 2 / 24 },
      ],
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "nasa-rocket",
  },
  "nasa-rocket": {
    id: "nasa-rocket",
    label: "NASA rocket scene",
    route: "/experience",
    background: "transparent",
    requiredLive: true,
    modelUrl: "/models/rocket.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/nasa-rocket-desktop.webp",
      mobile: "/posters/nasa-rocket-mobile.webp",
      alt: "",
    },
    desktop: frame(
      [5.7, 3.9, 8.8],
      [0, 0.9, 0],
      36,
      EXPERIENCE_CHAPTER_DESKTOP_AREA,
    ),
    mobile: frame(
      [3.8, 3.4, 8],
      [0, 1, 0],
      36,
      EXPERIENCE_CHAPTER_MOBILE_AREA,
    ),
    lighting: NASA_ROCKET_LIGHTING,
    contactShadow: {
      opacity: 0.46,
      position: [0, 0.01, -0.95],
      scale: [4.3, 2.05],
      textureSize: 256,
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "eog-poster",
  },
  "eog-poster": {
    id: "eog-poster",
    label: "EOG Resources poster",
    route: "/experience",
    background: "#EEEEEE",
    requiredLive: false,
    modelUrl: null,
    poster: {
      desktop: "/posters/eog-poster-desktop.webp",
      mobile: "/posters/eog-poster-mobile.webp",
      alt: "",
    },
    desktop: frame([0, 0, 5], [0, 0, 0], 35, DESKTOP_AREA),
    mobile: frame([0, 0, 6], [0, 0, 0], 40, MOBILE_AREA),
    lighting: PINK_POSTER_LIGHTING,
    rotation: DEFAULT_ROTATION,
    nextSceneId: "paycom-poster",
  },
  "paycom-poster": {
    id: "paycom-poster",
    label: "Paycom poster",
    route: "/experience",
    background: "#EEEEEE",
    requiredLive: false,
    modelUrl: null,
    poster: {
      desktop: "/posters/paycom-poster-desktop.webp",
      mobile: "/posters/paycom-poster-mobile.webp",
      alt: "",
    },
    desktop: frame([0, 0, 5], [0, 0, 0], 35, DESKTOP_AREA),
    mobile: frame([0, 0, 6], [0, 0, 0], 40, MOBILE_AREA),
    lighting: PINK_POSTER_LIGHTING,
    rotation: DEFAULT_ROTATION,
    nextSceneId: "projects-hero",
  },
  "projects-hero": {
    id: "projects-hero",
    label: "Crane making table project scene",
    route: "/projects",
    background: "#AFD4E1",
    requiredLive: true,
    modelUrl: "/models/crane-making-table.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/projects-hero-desktop.webp",
      mobile: "/posters/projects-hero-mobile.webp",
      alt: "",
    },
    desktop: frame(
      [4.4, 2.8, 6.1],
      [0.2, 0.8, 0.3],
      36,
      DESKTOP_AREA,
    ),
    mobile: frame([5.5, 4.4, 10.8], [0.2, 0.8, 0.3], 40, MOBILE_AREA),
    lighting: PROJECTS_HERO_LIGHTING,
    contactShadow: {
      opacity: 0.4,
      position: [-0.6, -0.01, 1],
      scale: [4.3, 1.85],
      textureSize: 256,
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "league-ban",
  },
  "league-ban": {
    id: "league-ban",
    label: "League Ban Site workstation scene",
    route: "/projects",
    background: "transparent",
    requiredLive: true,
    modelUrl: "/models/crane-on-league.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/league-ban-desktop.webp",
      mobile: "/posters/league-ban-mobile.webp",
      alt: "",
    },
    desktop: frame(
      [4.5, 2.9, 6.5],
      [0, 0, 0],
      34,
      PROJECT_CHAPTER_DESKTOP_AREA,
    ),
    mobile: frame(
      [7.5, 5.2, 13.5],
      [0, -0.1, 0],
      38,
      PROJECT_CHAPTER_MOBILE_AREA,
    ),
    lighting: LEAGUE_BAN_LIGHTING,
    contactShadow: {
      opacity: 0.52,
      position: [0.65, -0.01, 0.2],
      scale: [5.8, 2.7],
      textureSize: 256,
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "froggie-adventures",
  },
  "froggie-adventures": {
    id: "froggie-adventures",
    label: "Froggie Adventures display scene",
    route: "/projects",
    background: "transparent",
    requiredLive: true,
    modelUrl: "/models/froggie-display.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/froggie-adventures-desktop.webp",
      mobile: "/posters/froggie-adventures-mobile.webp",
      alt: "",
    },
    desktop: frame(
      [5.1, 4.3, 10.5],
      [0, 2, 0],
      37,
      PROJECT_CHAPTER_DESKTOP_AREA,
    ),
    mobile: frame(
      [6.2, 5, 12.5],
      [0, 1.7, 0],
      39,
      PROJECT_CHAPTER_MOBILE_AREA,
    ),
    lighting: FROGGIE_LIGHTING,
    contactShadow: {
      opacity: 0.46,
      position: [0, -0.01, 0],
      scale: [2.9, 1.3],
      textureSize: 256,
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "contact-hero",
  },
  "contact-hero": {
    id: "contact-hero",
    label: "Workout crane contact scene",
    route: "/contact",
    background: "#C9BAE4",
    requiredLive: true,
    modelUrl: "/models/crane-workout.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/contact-hero-desktop.webp",
      mobile: "/posters/contact-hero-mobile.webp",
      alt: "",
    },
    desktop: frame([3.7, 2.3, 4.7], [0.2, 0.8, 0.3], 36, DESKTOP_AREA),
    mobile: frame([5.2, 4.1, 9.6], [0.2, 0.8, 0.3], 40, MOBILE_AREA),
    lighting: CONTACT_LIGHTING,
    contactShadow: {
      opacity: 0.62,
      position: [0.1, -0.01, 0.45],
      scale: [2.6, 1.2],
      textureSize: 256,
    },
    staticPose: {
      clips: [
        { name: "Dumbell L", timeSeconds: 40 / 24 },
        { name: "Dumbell R", timeSeconds: 40 / 24 },
        { name: "Lifting Weights", timeSeconds: 40 / 24 },
      ],
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: null,
  },
} as const satisfies Record<SceneId, SceneDefinition>;

const SCENE_IDS = Object.keys(SCENE_DEFINITIONS) as SceneId[];

const ROUTE_HEROES: Record<SiteRoute, LiveSceneId> = {
  "/": "home-hero",
  "/experience": "experience-hero",
  "/projects": "projects-hero",
  "/contact": "contact-hero",
};

export function isSceneId(value: string): value is SceneId {
  return SCENE_IDS.includes(value as SceneId);
}

export function getSceneDefinition<Id extends SceneId>(
  sceneId: Id,
): (typeof SCENE_DEFINITIONS)[Id] {
  return SCENE_DEFINITIONS[sceneId];
}

export function getRouteHeroSceneId(pathname: string): LiveSceneId {
  return ROUTE_HEROES[pathname as SiteRoute] ?? "home-hero";
}

export function getScenePreloadUrls(sceneId: SceneId): readonly string[] {
  const current = getSceneDefinition(sceneId);
  if (!current.requiredLive) return [];

  const urls: string[] = [current.modelUrl];
  if (current.nextSceneId) {
    const next = getSceneDefinition(current.nextSceneId);
    if (next.requiredLive) urls.push(next.modelUrl);
  }
  return [...new Set(urls)];
}
