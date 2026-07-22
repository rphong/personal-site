import { describe, expect, expectTypeOf, it } from "vitest";
import { THREE_STATUSES } from "./types";
import type {
  LiveSceneDefinition,
  PosterOnlySceneDefinition,
  PosterOnlySceneId,
  SceneLighting,
} from "./types";

describe("THREE_STATUSES", () => {
  it("exposes the complete stable host status contract", () => {
    expect(THREE_STATUSES).toEqual([
      "poster",
      "loading",
      "ready",
      "error",
      "unsupported",
      "disabled",
      "context-lost",
    ]);
  });

  it("makes live assets, poster-only scenes, and shadow policy type-safe", () => {
    expectTypeOf<PosterOnlySceneId>().toEqualTypeOf<
      "eog-poster" | "paycom-poster"
    >();
    expectTypeOf<LiveSceneDefinition["modelUrl"]>().toEqualTypeOf<
      `/models/${string}.glb`
    >();
    expectTypeOf<PosterOnlySceneDefinition["modelUrl"]>().toEqualTypeOf<null>();
    expectTypeOf<SceneLighting["key"]["castShadow"]>().toEqualTypeOf<false>();
    expectTypeOf<SceneLighting["fill"]["castShadow"]>().toEqualTypeOf<false>();
    expectTypeOf<SceneLighting["rim"]["castShadow"]>().toEqualTypeOf<false>();
    expectTypeOf<
      SceneLighting["hemisphere"]["groundColor"]
    >().toEqualTypeOf<string>();
  });
});
