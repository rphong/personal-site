"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getSceneDefinition,
  isSceneId,
  LIVE_SCENE_IDS,
} from "./scene-registry";
import { useSceneRuntime } from "./scene-runtime-context";
import { tuningFromScene } from "./scene-tuning";
import type {
  LiveSceneId,
  SceneCameraTuning,
  SceneTuning,
  Vector3Tuple,
} from "./types";

const DEBUG_QUERY = "debug3d";
const DEBUG_SCENE_QUERY = "debugScene";
const DEBUG_QUERY_EVENT = "scene-debug-querychange";

function queryRequestsDebug(): boolean {
  return new URLSearchParams(window.location.search).get(DEBUG_QUERY) === "1";
}

function setDebugQuery(enabled: boolean): void {
  const url = new URL(window.location.href);
  if (enabled) url.searchParams.set(DEBUG_QUERY, "1");
  else {
    url.searchParams.delete(DEBUG_QUERY);
    url.searchParams.delete(DEBUG_SCENE_QUERY);
  }
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new Event(DEBUG_QUERY_EVENT));
}

function subscribeToDebugQuery(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(DEBUG_QUERY_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(DEBUG_QUERY_EVENT, onChange);
  };
}

function subscribeToHydration(): () => void {
  return () => undefined;
}

function updateTuple(
  tuple: Vector3Tuple,
  index: number,
  value: number,
): Vector3Tuple {
  const next = [...tuple] as [number, number, number];
  next[index] = value;
  return next;
}

function NumericControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}) {
  const change = (raw: string) => {
    const next = Number(raw);
    if (Number.isFinite(next)) onChange(next);
  };

  return (
    <label className="scene-debug__control">
      <span>{label}</span>
      <input
        aria-label={`${label} slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => change(event.target.value)}
      />
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(3))}
        onChange={(event) => change(event.target.value)}
      />
    </label>
  );
}

function VectorControls({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  readonly label: string;
  readonly value: Vector3Tuple;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: Vector3Tuple) => void;
}) {
  return (
    <fieldset className="scene-debug__fieldset">
      <legend>{label}</legend>
      {(["X", "Y", "Z"] as const).map((axis, index) => (
        <NumericControl
          key={axis}
          label={`${label} ${axis}`}
          value={value[index]}
          min={min}
          max={max}
          step={step}
          onChange={(next) => onChange(updateTuple(value, index, next))}
        />
      ))}
    </fieldset>
  );
}

function CameraControls({
  camera,
  onChange,
}: {
  readonly camera: SceneCameraTuning;
  readonly onChange: (camera: SceneCameraTuning) => void;
}) {
  return (
    <>
      <VectorControls
        label="Camera position"
        value={camera.cameraPosition}
        min={-20}
        max={20}
        step={0.05}
        onChange={(cameraPosition) => onChange({ ...camera, cameraPosition })}
      />
      <VectorControls
        label="Camera target"
        value={camera.cameraTarget}
        min={-20}
        max={20}
        step={0.05}
        onChange={(cameraTarget) => onChange({ ...camera, cameraTarget })}
      />
      <NumericControl
        label="Field of view"
        value={camera.fov}
        min={5}
        max={120}
        step={0.5}
        onChange={(fov) => onChange({ ...camera, fov })}
      />
    </>
  );
}

function SceneDebugEditor({ mobile }: { readonly mobile: boolean }) {
  const runtime = useSceneRuntime();
  const [baseline, setBaseline] = useState<SceneTuning>(() =>
    tuningFromScene(runtime.activeScene as ReturnType<typeof getSceneDefinition> & { requiredLive: true }),
  );
  const [draft, setDraft] = useState<SceneTuning>(baseline);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const activeSceneId = runtime.activeSceneId;
  const setDebugTuning = runtime.setDebugTuning;

  const publishDraft = useCallback(
    (next: SceneTuning) => {
      setDraft(next);
      setSaveState("idle");
      setDebugTuning?.(activeSceneId, next);
    },
    [activeSceneId, setDebugTuning],
  );

  const save = async () => {
    setSaveState("saving");
    try {
      const response = await fetch("/__scene-tuning", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sceneId: activeSceneId, tuning: draft }),
      });
      if (!response.ok) throw new Error("Save failed");
      setBaseline(draft);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify({ [activeSceneId]: draft }, null, 2),
    );
    setSaveState("saved");
  };

  const currentCamera = mobile ? draft.mobile : draft.desktop;

  return (
    <>
      <div className="scene-debug__scroll">
        <details open>
          <summary>Model pose</summary>
          <VectorControls
            label="Position"
            value={draft.model.position}
            min={-20}
            max={20}
            step={0.05}
            onChange={(position) =>
              publishDraft({
                ...draft,
                model: { ...draft.model, position },
              })
            }
          />
          <VectorControls
            label="Rotation"
            value={draft.model.rotation}
            min={-180}
            max={180}
            step={1}
            onChange={(rotation) =>
              publishDraft({
                ...draft,
                model: { ...draft.model, rotation },
              })
            }
          />
          <NumericControl
            label="Scale"
            value={draft.model.scale}
            min={0.05}
            max={20}
            step={0.01}
            onChange={(scale) =>
              publishDraft({
                ...draft,
                model: { ...draft.model, scale },
              })
            }
          />
        </details>

        <details open>
          <summary>
            {mobile ? "Mobile" : "Desktop"} camera
            <small> switches at 767px</small>
          </summary>
          <CameraControls
            camera={currentCamera}
            onChange={(camera) =>
              publishDraft({
                ...draft,
                [mobile ? "mobile" : "desktop"]: camera,
              })
            }
          />
        </details>
      </div>

      <footer className="scene-debug__footer">
        <button
          type="button"
          disabled={saveState === "saving"}
          onClick={() => void save()}
        >
          {saveState === "saving" ? "Saving…" : "Save to project"}
        </button>
        <button type="button" onClick={() => void copy()}>
          Copy JSON
        </button>
        <button type="button" onClick={() => publishDraft(baseline)}>
          Revert
        </button>
        <span role="status" aria-live="polite">
          {saveState === "saved"
            ? "Saved"
            : saveState === "error"
              ? "Couldn’t save — copy JSON instead"
              : "Alt+D toggles this panel"}
        </span>
      </footer>
    </>
  );
}

export function SceneDebugPanel() {
  const runtime = useSceneRuntime();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const queryOpen = useSyncExternalStore(
    subscribeToDebugQuery,
    queryRequestsDebug,
    () => false,
  );
  const open =
    process.env.NODE_ENV !== "production" && hydrated && queryOpen;
  const [mobile, setMobile] = useState(false);
  const [side, setSide] = useState<"left" | "right">("left");

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const keydown = (event: KeyboardEvent) => {
      if (!(event.altKey && event.key.toLowerCase() === "d")) return;
      event.preventDefault();
      setDebugQuery(!queryRequestsDebug());
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const requested = new URLSearchParams(window.location.search).get(
      DEBUG_SCENE_QUERY,
    );
    if (
      requested &&
      isSceneId(requested) &&
      getSceneDefinition(requested).requiredLive &&
      requested !== runtime.activeSceneId
    ) {
      runtime.activateScene(requested);
    }
  }, [open, runtime]);

  const selectScene = (sceneId: LiveSceneId) => {
    const scene = getSceneDefinition(sceneId);
    const url = new URL(window.location.href);
    url.searchParams.set(DEBUG_QUERY, "1");
    url.searchParams.set(DEBUG_SCENE_QUERY, sceneId);
    if (scene.route !== runtime.activeScene.route) {
      window.location.assign(`${scene.route}${url.search}`);
      return;
    }
    window.history.replaceState({}, "", url);
    runtime.activateScene(sceneId);
  };

  const close = () => {
    setDebugQuery(false);
  };

  if (process.env.NODE_ENV === "production") return null;
  if (!open) {
    return (
      <button
        className="scene-debug-launcher"
        type="button"
        onClick={() => {
          setDebugQuery(true);
        }}
      >
        Tune 3D
      </button>
    );
  }

  return (
    <aside
      className="scene-debug"
      data-side={side}
      aria-label="3D scene tuning panel"
    >
      <header className="scene-debug__header">
        <div>
          <span className="scene-debug__eyebrow">Live scene tuner</span>
          <strong>{runtime.activeScene.label}</strong>
        </div>
        <div className="scene-debug__header-actions">
          <button
            className="scene-debug__side-toggle"
            type="button"
            onClick={() => setSide((current) => current === "left" ? "right" : "left")}
          >
            Move {side === "left" ? "right" : "left"}
          </button>
          <button type="button" onClick={close} aria-label="Close 3D tuner">
            Close
          </button>
        </div>
      </header>

      <label className="scene-debug__select">
        <span>Scene</span>
        <select
          value={runtime.activeSceneId}
          onChange={(event) => selectScene(event.target.value as LiveSceneId)}
        >
          {LIVE_SCENE_IDS.map((sceneId) => (
            <option key={sceneId} value={sceneId}>
              {getSceneDefinition(sceneId).label}
            </option>
          ))}
        </select>
      </label>

      {runtime.activeScene.requiredLive ? (
        <SceneDebugEditor key={runtime.activeSceneId} mobile={mobile} />
      ) : (
        <p>This scene uses a poster and has no live model to tune.</p>
      )}
    </aside>
  );
}
