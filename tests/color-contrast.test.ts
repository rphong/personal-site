import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing CSS rule: ${selector}`);
  return match[1];
}

function variable(rule: string, name: string) {
  const match = rule.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`Missing --${name}`);
  return match[1];
}

function rgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex: string) {
  const channels = rgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
}

function contrast(left: string, right: string) {
  const [lighter, darker] = [luminance(left), luminance(right)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("route color contrast", () => {
  const root = cssRule(":root");
  const textStrong = variable(root, "text-strong");
  const routes = [
    ["home", ".site-shell"],
    ["experience", '.site-shell[data-route="experience"]'],
    ["projects", '.site-shell[data-route="projects"]'],
    ["contact", '.site-shell[data-route="contact"]'],
  ] as const;

  it.each(routes)("%s navigation text remains readable", (_, selector) => {
    const route = cssRule(selector);
    const background = variable(route, "route-background");
    const accent = variable(route, "route-accent");

    expect(contrast(textStrong, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(routes)("%s hero halo keeps the large heading legible", (_, selector) => {
    const route = cssRule(selector);
    const background = variable(route, "route-background");
    const accent = variable(route, "route-accent");
    const paleHeading = variable(route, "route-pale-heading");

    expect(contrast(accent, background)).toBeGreaterThanOrEqual(3);
    expect(contrast(paleHeading, accent)).toBeGreaterThanOrEqual(3);
  });
});
