import savedTuningsJson from "./scene-tuning.generated.json";
import type {
  LiveSceneDefinition,
  SceneCameraTuning,
  SceneDefinition,
  SceneId,
  SceneModelTransform,
  SceneTuning,
  Vector3Tuple,
} from "./types";

const savedTunings = savedTuningsJson as Partial<Record<SceneId, unknown>>;

function finiteTuple(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function validCamera(value: unknown): value is SceneCameraTuning {
  if (!value || typeof value !== "object") return false;
  const camera = value as Partial<SceneCameraTuning>;
  return (
    finiteTuple(camera.cameraPosition) &&
    finiteTuple(camera.cameraTarget) &&
    typeof camera.fov === "number" &&
    Number.isFinite(camera.fov) &&
    camera.fov >= 5 &&
    camera.fov <= 120
  );
}

function validModel(value: unknown): value is SceneModelTransform {
  if (!value || typeof value !== "object") return false;
  const model = value as Partial<SceneModelTransform>;
  return (
    finiteTuple(model.position) &&
    finiteTuple(model.rotation) &&
    typeof model.scale === "number" &&
    Number.isFinite(model.scale) &&
    model.scale > 0 &&
    model.scale <= 20
  );
}

export function isSceneTuning(value: unknown): value is SceneTuning {
  if (!value || typeof value !== "object") return false;
  const tuning = value as Partial<SceneTuning>;
  return (
    validCamera(tuning.desktop) &&
    validCamera(tuning.mobile) &&
    validModel(tuning.model)
  );
}

function cameraFromFrame(
  frame: LiveSceneDefinition["desktop"],
): SceneCameraTuning {
  return {
    cameraPosition: [...frame.cameraPosition],
    cameraTarget: [...frame.cameraTarget],
    fov: frame.fov,
  };
}

export function tuningFromScene(scene: LiveSceneDefinition): SceneTuning {
  return {
    desktop: cameraFromFrame(scene.desktop),
    mobile: cameraFromFrame(scene.mobile),
    model: {
      position: [...scene.modelTransform.position],
      rotation: [...scene.modelTransform.rotation],
      scale: scene.modelTransform.scale,
    },
  };
}

export function getSavedSceneTuning(
  scene: LiveSceneDefinition,
): SceneTuning {
  const saved = savedTunings[scene.id];
  return isSceneTuning(saved) ? saved : tuningFromScene(scene);
}

export function applySceneTuning(
  scene: SceneDefinition,
  tuning?: SceneTuning,
): SceneDefinition {
  if (!scene.requiredLive) return scene;
  const next = tuning ?? getSavedSceneTuning(scene);
  return {
    ...scene,
    desktop: {
      ...scene.desktop,
      ...next.desktop,
    },
    mobile: {
      ...scene.mobile,
      ...next.mobile,
    },
    modelTransform: next.model,
  };
}
