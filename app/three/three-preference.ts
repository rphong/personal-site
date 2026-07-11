"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const THREE_PREFERENCE_STORAGE_KEY = "personal-site:three-enabled";

export type StoredThreePreference = "on" | "off" | null;
export type ThreePreferenceMode = "enabled" | "disabled" | "unsupported";

export interface ThreePreferenceResolution {
  readonly mode: ThreePreferenceMode;
  readonly explicit: boolean;
}

interface NavigatorWithConnection extends Navigator {
  readonly connection?: { readonly saveData?: boolean };
}

export function resolveThreePreference(input: {
  readonly stored: StoredThreePreference;
  readonly saveData: boolean;
  readonly webgl2: boolean;
}): ThreePreferenceResolution {
  if (!input.webgl2) {
    return { mode: "unsupported", explicit: input.stored !== null };
  }
  if (input.stored === "off") return { mode: "disabled", explicit: true };
  if (input.stored === "on") return { mode: "enabled", explicit: true };
  if (input.saveData) return { mode: "disabled", explicit: false };
  return { mode: "enabled", explicit: false };
}

export function supportsWebGL2(documentRef?: Document): boolean {
  if (!documentRef && typeof document === "undefined") return false;
  try {
    const canvas = (documentRef ?? document).createElement("canvas");
    const context = canvas.getContext("webgl2", {
      powerPreference: "high-performance",
    });
    if (!context) return false;
    try {
      context.getExtension?.("WEBGL_lose_context")?.loseContext();
    } catch {
      // Capability detection succeeded; releasing its temporary context is best-effort.
    }
    return true;
  } catch {
    return false;
  }
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): PreferenceStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredPreference(
  storage: PreferenceStorage | null = browserStorage(),
): StoredThreePreference {
  try {
    const value = storage?.getItem(THREE_PREFERENCE_STORAGE_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPreference(
  value: Exclude<StoredThreePreference, null>,
  storage: PreferenceStorage | null = browserStorage(),
): boolean {
  try {
    storage?.setItem(THREE_PREFERENCE_STORAGE_KEY, value);
    return storage !== null;
  } catch {
    return false;
  }
}

function readsReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean((navigator as NavigatorWithConnection).connection?.saveData);
}

interface ThreeEnvironmentSnapshot {
  readonly saveData: boolean;
  readonly webgl2: boolean;
}

function readEnvironmentSnapshot(): ThreeEnvironmentSnapshot {
  return {
    saveData: readsReducedData(),
    webgl2: supportsWebGL2(),
  };
}

export interface ThreePreferenceState {
  readonly initialized: boolean;
  readonly enabled: boolean;
  readonly supported: boolean;
  readonly explicit: boolean;
  readonly setEnabled: (enabled: boolean) => void;
}

export function useThreePreference(): ThreePreferenceState {
  const environmentRef = useRef<ThreeEnvironmentSnapshot | null>(null);
  const [resolution, setResolution] = useState<ThreePreferenceResolution>({
    mode: "disabled",
    explicit: false,
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const environment =
        environmentRef.current ?? readEnvironmentSnapshot();
      environmentRef.current = environment;
      setResolution(
        resolveThreePreference({
          stored: readStoredPreference(),
          ...environment,
        }),
      );
      setInitialized(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    const stored: Exclude<StoredThreePreference, null> = enabled ? "on" : "off";
    const environment = environmentRef.current ?? readEnvironmentSnapshot();
    environmentRef.current = environment;
    writeStoredPreference(stored);
    setResolution(
      resolveThreePreference({
        stored,
        ...environment,
      }),
    );
    setInitialized(true);
  }, []);

  return {
    initialized,
    enabled: resolution.mode === "enabled",
    supported: resolution.mode !== "unsupported",
    explicit: resolution.explicit,
    setEnabled,
  };
}
