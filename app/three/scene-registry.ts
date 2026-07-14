import type {
  LiveSceneId,
  PercentInsets,
  RotationLimits,
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

function frame(
  cameraPosition: Vector3Tuple,
  cameraTarget: Vector3Tuple,
  fov: number,
  rotationArea: PercentInsets,
): SceneFrame {
  return { cameraPosition, cameraTarget, fov, rotationArea };
}

function lighting(background: string, position: Vector3Tuple): SceneLighting {
  return {
    ambient: { color: "#ffffff", intensity: 1.2 },
    key: {
      color: background,
      intensity: 2.4,
      position,
      castShadow: false,
    },
  };
}

const HOME_LIGHTING: SceneLighting = {
  ambient: { color: "#e8f3f0", intensity: 2.4 },
  key: {
    color: "#e8f3f0",
    intensity: 1.4,
    position: [-3.5, 6, 4.5],
    castShadow: false,
  },
};

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
    desktop: frame([6.5, 2.8, 3.7], [0, 0.1, 0], 34, DESKTOP_AREA),
    mobile: frame([8.2, 3.5, 4.7], [0, -0.2, 0], 38, MOBILE_AREA),
    lighting: HOME_LIGHTING,
    contactShadow: {
      opacity: 0.16,
      position: [-0.25, -0.47, -0.6],
      scale: [1.8, 0.8],
      textureSize: 64,
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
    desktop: frame([5.8, 3.2, 7.4], [0.2, 0.8, 0.3], 36, DESKTOP_AREA),
    mobile: frame([5.2, 4.1, 9.6], [0.2, 0.8, 0.3], 40, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [5, 7, 4]),
    staticPose: {
      clips: [
        { name: "Dumbell L", timeSeconds: 65 / 24 },
        { name: "Dumbell R", timeSeconds: 65 / 24 },
        { name: "Lifting Weights", timeSeconds: 65 / 24 },
      ],
    },
    rotation: DEFAULT_ROTATION,
    nextSceneId: "experience-intro",
  },
  "experience-intro": {
    id: "experience-intro",
    label: "Crane throwing a paper plane",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: true,
    modelUrl: "/models/crane-throwing-plane.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/experience-intro-desktop.webp",
      mobile: "/posters/experience-intro-mobile.webp",
      alt: "",
    },
    desktop: frame([6.4, 3.7, 9.2], [0, 1, 0], 35, DESKTOP_AREA),
    mobile: frame([8.3, 6.3, 16.9], [0, 1.4, 0], 39, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [4, 6, 5]),
    staticPose: {
      clips: [
        { name: "EmptyAction", timeSeconds: 18 / 24 },
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
    background: "#DFA9B5",
    requiredLive: true,
    modelUrl: "/models/rocket.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/nasa-rocket-desktop.webp",
      mobile: "/posters/nasa-rocket-mobile.webp",
      alt: "",
    },
    desktop: frame([5.8, 3.8, 8.2], [0, 1.5, 0], 34, DESKTOP_AREA),
    mobile: frame([5, 4.7, 10.6], [0, 2, 0], 39, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [6, 8, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "eog-poster",
  },
  "eog-poster": {
    id: "eog-poster",
    label: "EOG Resources poster",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: false,
    modelUrl: null,
    poster: {
      desktop: "/posters/eog-poster-desktop.webp",
      mobile: "/posters/eog-poster-mobile.webp",
      alt: "",
    },
    desktop: frame([0, 0, 5], [0, 0, 0], 35, DESKTOP_AREA),
    mobile: frame([0, 0, 6], [0, 0, 0], 40, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [4, 6, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "paycom-poster",
  },
  "paycom-poster": {
    id: "paycom-poster",
    label: "Paycom poster",
    route: "/experience",
    background: "#DFA9B5",
    requiredLive: false,
    modelUrl: null,
    poster: {
      desktop: "/posters/paycom-poster-desktop.webp",
      mobile: "/posters/paycom-poster-mobile.webp",
      alt: "",
    },
    desktop: frame([0, 0, 5], [0, 0, 0], 35, DESKTOP_AREA),
    mobile: frame([0, 0, 6], [0, 0, 0], 40, MOBILE_AREA),
    lighting: lighting("#DFA9B5", [4, 6, 5]),
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
      [6.2, 3.6, 8.4],
      [0.2, 0.8, 0.3],
      36,
      DESKTOP_AREA,
    ),
    mobile: frame([5.5, 4.4, 10.8], [0.2, 0.8, 0.3], 40, MOBILE_AREA),
    lighting: lighting("#AFD4E1", [5, 7, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "league-ban",
  },
  "league-ban": {
    id: "league-ban",
    label: "League Ban Site workstation scene",
    route: "/projects",
    background: "#AFD4E1",
    requiredLive: true,
    modelUrl: "/models/crane-on-league.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/league-ban-desktop.webp",
      mobile: "/posters/league-ban-mobile.webp",
      alt: "",
    },
    desktop: frame([6.6, 4, 8.8], [0, 1.1, 0], 35, DESKTOP_AREA),
    mobile: frame([8.4, 6.3, 16.2], [0, 1.5, 0], 40, MOBILE_AREA),
    lighting: lighting("#AFD4E1", [5, 7, 5]),
    rotation: DEFAULT_ROTATION,
    nextSceneId: "froggie-adventures",
  },
  "froggie-adventures": {
    id: "froggie-adventures",
    label: "Froggie Adventures display scene",
    route: "/projects",
    background: "#AFD4E1",
    requiredLive: true,
    modelUrl: "/models/froggie-display.glb",
    modelTransform: DEFAULT_MODEL_TRANSFORM,
    poster: {
      desktop: "/posters/froggie-adventures-desktop.webp",
      mobile: "/posters/froggie-adventures-mobile.webp",
      alt: "",
    },
    desktop: frame([5.1, 4.3, 10.2], [0, 1.4, 0], 40, DESKTOP_AREA),
    mobile: frame([5.1, 4.3, 10.2], [0, 1.4, 0], 40, MOBILE_AREA),
    lighting: lighting("#AFD4E1", [5, 7, 5]),
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
    desktop: frame([5.8, 3.2, 7.4], [0.2, 0.8, 0.3], 36, DESKTOP_AREA),
    mobile: frame([5.2, 4.1, 9.6], [0.2, 0.8, 0.3], 40, MOBILE_AREA),
    lighting: lighting("#C9BAE4", [5, 7, 4]),
    staticPose: {
      clips: [
        { name: "Dumbell L", timeSeconds: 65 / 24 },
        { name: "Dumbell R", timeSeconds: 65 / 24 },
        { name: "Lifting Weights", timeSeconds: 65 / 24 },
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
