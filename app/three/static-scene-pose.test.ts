import {
  AnimationClip,
  Group,
  NumberKeyframeTrack,
} from "three";
import { describe, expect, it } from "vitest";
import { applyStaticScenePose } from "./scene-model";

describe("static scene poses", () => {
  it("samples each reviewed clip time exactly once and stays frozen", () => {
    const root = new Group();
    const left = new Group();
    left.name = "Left prop";
    const right = new Group();
    right.name = "Right prop";
    root.add(left, right);
    const clips = [
      new AnimationClip("left", 1, [
        new NumberKeyframeTrack("Left prop.position[x]", [0, 1], [0, 4]),
      ]),
      new AnimationClip("right", 1, [
        new NumberKeyframeTrack("Right prop.position[y]", [0, 1], [0, 8]),
      ]),
    ];

    const mixer = applyStaticScenePose(root, clips, {
      clips: [
        { name: "left", timeSeconds: 0.25 },
        { name: "right", timeSeconds: 0.75 },
      ],
    });

    expect(left.position.x).toBeCloseTo(1);
    expect(right.position.y).toBeCloseTo(6);
    mixer.update(10);
    expect(left.position.x).toBeCloseTo(1);
    expect(right.position.y).toBeCloseTo(6);
  });

  it("fails closed when an approved clip is absent", () => {
    expect(() =>
      applyStaticScenePose(new Group(), [], {
        clips: [{ name: "missing", timeSeconds: 0 }],
      }),
    ).toThrow(/clips are missing: missing/i);
  });

  it.each([Number.NaN, -0.01, 1.01])(
    "rejects an out-of-range sample time (%s)",
    (timeSeconds) => {
      const clip = new AnimationClip("pose", 1, []);
      expect(() =>
        applyStaticScenePose(new Group(), [clip], {
          clips: [{ name: "pose", timeSeconds }],
        }),
      ).toThrow(/time is outside pose/i);
    },
  );

  it("rejects duplicate pose clips", () => {
    const clip = new AnimationClip("pose", 1, []);
    expect(() =>
      applyStaticScenePose(new Group(), [clip], {
        clips: [
          { name: "pose", timeSeconds: 0 },
          { name: "pose", timeSeconds: 1 },
        ],
      }),
    ).toThrow(/clip is duplicated: pose/i);
  });
});
