import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SceneCapturePage, { SceneCaptureContent } from "./page";

const notFound = vi.hoisted(() =>
  vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));

function parameters(scene: string | string[] | undefined) {
  return { searchParams: Promise.resolve({ scene }) };
}

describe("SceneCapturePage", () => {
  beforeEach(() => {
    vi.stubEnv("SCENE_CAPTURE", "1");
    vi.stubEnv("SITE_ENV", "preview");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the validated registry scene to the capture viewport", async () => {
    const result = await SceneCaptureContent({
      searchParams: Promise.resolve({
        scene: ["league-ban", "home-hero"],
        scroll: "1",
        controls: "1",
      }),
    });

    expect(result.props).toMatchObject({
      sceneId: "league-ban",
      scrollTest: true,
      showControls: true,
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "not-a-scene",
    [],
    ["not-a-scene", "home-hero"],
  ])(
    "returns not-found for invalid scene query %s",
    async (scene) => {
      await expect(SceneCaptureContent(parameters(scene))).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(notFound).toHaveBeenCalledOnce();
    },
  );

  it("fails non-scalar controls and scroll flags closed", async () => {
    const result = await SceneCaptureContent({
      searchParams: Promise.resolve({
        scene: "home-hero",
        controls: ["1"],
        scroll: "true",
      }),
    });

    expect(result.props).toMatchObject({
      sceneId: "home-hero",
      scrollTest: false,
      showControls: false,
    });
  });

  it.each([
    { capture: "0", site: "preview" },
    { capture: "1", site: "production" },
    { capture: "1", site: "" },
  ])(
    "returns not-found when SCENE_CAPTURE=$capture and SITE_ENV=$site",
    async ({ capture, site }) => {
      vi.stubEnv("SCENE_CAPTURE", capture);
      vi.stubEnv("SITE_ENV", site);

      expect(() => SceneCapturePage(parameters("home-hero"))).toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(notFound).toHaveBeenCalledOnce();
    },
  );
});
