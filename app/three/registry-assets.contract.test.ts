import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { SCENE_DEFINITIONS } from "./scene-registry";

interface PosterContract {
  readonly scenes: readonly {
    readonly id: string;
    readonly route: string;
    readonly background: string;
    readonly source:
      | { readonly kind: "web-scene"; readonly modelKey: string }
      | { readonly kind: "svg"; readonly path: string };
    readonly outputs: Readonly<Record<"desktop" | "mobile", string>>;
  }[];
}

interface ModelManifest {
  readonly models: Readonly<Record<string, { readonly url: string }>>;
}

function publicOutputToUrl(output: string): string {
  expect(output).toMatch(/^public\/posters\/.+\.webp$/);
  return `/${output.replace(/^public\//, "")}`;
}

describe("registry asset ownership", () => {
  it("keeps every live and poster-only model binding immutable", () => {
    expect(
      Object.fromEntries(
        Object.values(SCENE_DEFINITIONS).map((scene) => [
          scene.id,
          scene.modelUrl,
        ]),
      ),
    ).toEqual({
      "home-hero": "/models/crane.glb",
      "experience-hero": "/models/crane-workout.glb",
      "experience-intro": "/models/crane-throwing-plane.glb",
      "nasa-rocket": "/models/rocket.glb",
      "eog-poster": null,
      "paycom-poster": null,
      "projects-hero": "/models/crane-making-table.glb",
      "league-ban": "/models/crane-on-league.glb",
      "froggie-adventures": "/models/froggie-display.glb",
      "contact-hero": "/models/crane-workout.glb",
    });
  });

  it("matches every registry scene to the poster and model manifests", async () => {
    const [contract, manifest] = (await Promise.all([
      readFile("assets/poster-contract.json", "utf8").then((source) =>
        JSON.parse(source),
      ),
      readFile("public/models/assets-manifest.json", "utf8").then((source) =>
        JSON.parse(source),
      ),
    ])) as [PosterContract, ModelManifest];

    expect(contract.scenes.map((scene) => scene.id)).toEqual(
      Object.keys(SCENE_DEFINITIONS),
    );
    const expectedBackgrounds = {
      "home-hero": "#9ECCC0",
      "experience-hero": "#DFA9B5",
      "experience-intro": "transparent",
      "nasa-rocket": "transparent",
      "eog-poster": "#EEEEEE",
      "paycom-poster": "#EEEEEE",
      "projects-hero": "#AFD4E1",
      "league-ban": "transparent",
      "froggie-adventures": "transparent",
      "contact-hero": "#C9BAE4",
    } as const;

    for (const contractScene of contract.scenes) {
      const scene =
        SCENE_DEFINITIONS[
          contractScene.id as keyof typeof SCENE_DEFINITIONS
        ];
      expect(scene.route).toBe(contractScene.route);
      expect(scene.background).toBe(
        expectedBackgrounds[
          contractScene.id as keyof typeof expectedBackgrounds
        ],
      );
      expect(scene.poster.desktop).toBe(
        publicOutputToUrl(contractScene.outputs.desktop),
      );
      expect(scene.poster.mobile).toBe(
        publicOutputToUrl(contractScene.outputs.mobile),
      );

      if (contractScene.source.kind === "web-scene") {
        const model = manifest.models[contractScene.source.modelKey];
        if (!model) {
          throw new Error(`${contractScene.id}: missing manifest model`);
        }
        expect(scene.modelUrl).toBe(model.url);
        expect(scene.requiredLive).toBe(true);
      } else {
        expect(scene.modelUrl).toBeNull();
        expect(scene.requiredLive).toBe(false);
      }
    }
  });
});
