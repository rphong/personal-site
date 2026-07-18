import type {
  LiveSceneId,
  PercentInsets,
  RotationLimits,
  SceneDefinition,
  SceneDirectionalLight,
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

function directionalLight(
  color: string,
  intensity: number,
  position: Vector3Tuple,
): SceneDirectionalLight {
  return { color, intensity, position, castShadow: false };
}

const HOME_LIGHTING: SceneLighting = {
  exposure: 1.11,
  hemisphere: {
    skyColor: "#f0f4f2",
    groundColor: "#69716f",
    intensity: 0.62,
  },
  key: directionalLight("#e8f4f2", 2.65, [-5, 9, 3]),
  fill: directionalLight("#d9e9ed", 0.72, [5, 3, 4]),
  rim: directionalLight("#ffffff", 0.98, [2, 7, -6]),
};

const EXPERIENCE_HERO_LIGHTING: SceneLighting = {
  exposure: 1.09,
  hemisphere: {
    skyColor: "#f4f0ee",
    groundColor: "#949791",
    intensity: 1.08,
  },
  key: directionalLight("#e8f4f2", 1.72, [-5, 9, 3.5]),
  fill: directionalLight("#d9e9ed", 0.56, [5, 3, 4]),
  rim: directionalLight("#ffffff", 0.72, [2, 7, -6]),
};

const EXPERIENCE_INTRO_LIGHTING: SceneLighting = {
  exposure: 1.08,
  hemisphere: {
    skyColor: "#f0f4f2",
    groundColor: "#69716f",
    intensity: 0.6,
  },
  key: directionalLight("#e8f4f2", 2.5, [-5, 8.5, 3]),
  fill: directionalLight("#d9e9ed", 0.68, [5, 2.5, 3.5]),
  rim: directionalLight("#ffffff", 0.92, [3, 7, -5]),
};

const NASA_ROCKET_LIGHTING: SceneLighting = {
  exposure: 1,
  hemisphere: {
    skyColor: "#f4f5f3",
    groundColor: "#686d6c",
    intensity: 0.4,
  },
  key: directionalLight("#fffefa", 1.85, [-5, 9, 3.5]),
  fill: directionalLight("#dce8eb", 0.48, [5, 3, 4]),
  rim: directionalLight("#ffffff", 0.68, [2, 8, -6]),
};

const PINK_POSTER_LIGHTING: SceneLighting = {
  exposure: 1,
  hemisphere: {
    skyColor: "#f2d6dc",
    groundColor: "#f0d0c2",
    intensity: 0.95,
  },
  key: directionalLight("#ffe2cf", 1.75, [-4.5, 7, 5]),
  fill: directionalLight("#d5dff0", 0.9, [5, 3, 4]),
  rim: directionalLight("#fff0dc", 1.1, [2, 7, -6]),
};

const PROJECTS_HERO_LIGHTING: SceneLighting = {
  exposure: 1.1,
  hemisphere: {
    skyColor: "#eef2f1",
    groundColor: "#949a99",
    intensity: 1.05,
  },
  key: directionalLight("#e8f4f2", 1.7, [-5, 9, 3.5]),
  fill: directionalLight("#d8e9ed", 0.55, [6, 3, 4]),
  rim: directionalLight("#ffffff", 0.7, [2, 7, -6]),
};

const LEAGUE_BAN_LIGHTING: SceneLighting = {
  exposure: 1.08,
  hemisphere: {
    skyColor: "#eef3f2",
    groundColor: "#686f70",
    intensity: 0.6,
  },
  key: directionalLight("#e8f4f2", 2.45, [-5, 8.5, 3.5]),
  fill: directionalLight("#d8e8ec", 0.66, [6, 3, 4]),
  rim: directionalLight("#ffffff", 0.9, [3, 7, -6]),
};

const FROGGIE_LIGHTING: SceneLighting = {
  exposure: 1,
  hemisphere: {
    skyColor: "#f2f4f3",
    groundColor: "#646b6c",
    intensity: 0.4,
  },
  key: directionalLight("#e8f4f2", 1.65, [-4, 8.5, 3.5]),
  fill: directionalLight("#dce8eb", 0.43, [5, 3, 4]),
  rim: directionalLight("#ffffff", 0.62, [2, 7, -6]),
};

const CONTACT_LIGHTING: SceneLighting = {
  exposure: 1.09,
  hemisphere: {
    skyColor: "#f1f3f3",
    groundColor: "#6c7074",
    intensity: 0.62,
  },
  key: directionalLight("#e8f4f2", 2.65, [-5, 9, 3.5]),
  fill: directionalLight("#dde8ef", 0.72, [5, 3, 4]),
  rim: directionalLight("#ffffff", 0.98, [2, 7, -6]),
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
    desktop: frame([6, 2.6, 3.4], [0, 0.2, 0], 34, DESKTOP_AREA),
    mobile: frame([7.6, 3.25, 4.35], [0, -0.05, 0], 38, MOBILE_AREA),
    lighting: HOME_LIGHTING,
    contactShadow: {
      opacity: 0.58,
      position: [-1.05, -0.46, -0.55],
      scale: [1.9, 0.72],
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
    desktop: frame([3.7, 2.3, 4.7], [0.2, 0.8, 0.3], 36, DESKTOP_AREA),
    mobile: frame([5.2, 4.1, 9.6], [0.2, 0.8, 0.3], 40, MOBILE_AREA),
    lighting: EXPERIENCE_HERO_LIGHTING,
    contactShadow: {
      opacity: 0.44,
      position: [0.1, -0.01, 0.45],
      scale: [3.4, 1.55],
      textureSize: 64,
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
      textureSize: 64,
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
      textureSize: 64,
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
      textureSize: 64,
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
      textureSize: 64,
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
      textureSize: 64,
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
      textureSize: 64,
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
