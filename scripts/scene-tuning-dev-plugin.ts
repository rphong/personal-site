import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const TUNING_FILE = fileURLToPath(
  new URL("../app/three/scene-tuning.generated.json", import.meta.url),
);
const LIVE_SCENE_IDS = new Set([
  "home-hero",
  "experience-hero",
  "experience-intro",
  "nasa-rocket",
  "projects-hero",
  "league-ban",
  "froggie-adventures",
  "contact-hero",
]);
const MAX_BODY_BYTES = 64 * 1024;

function finiteTuple(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function validCamera(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    finiteTuple(candidate.cameraPosition) &&
    finiteTuple(candidate.cameraTarget) &&
    typeof candidate.fov === "number" &&
    Number.isFinite(candidate.fov) &&
    candidate.fov >= 5 &&
    candidate.fov <= 120
  );
}

function validTuning(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const model = candidate.model as Record<string, unknown> | undefined;
  return (
    validCamera(candidate.desktop) &&
    validCamera(candidate.mobile) &&
    !!model &&
    finiteTuple(model.position) &&
    finiteTuple(model.rotation) &&
    typeof model.scale === "number" &&
    Number.isFinite(model.scale) &&
    model.scale > 0 &&
    model.scale <= 20
  );
}

function reply(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new RangeError("Request body is too large");
    }
  }
  return JSON.parse(body);
}

async function readTunings(): Promise<Record<string, unknown>> {
  const source = await readFile(TUNING_FILE, "utf8");
  const parsed = JSON.parse(source) as unknown;
  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : {};
}

async function saveTuning(sceneId: string, tuning: unknown): Promise<void> {
  const tunings = await readTunings();
  tunings[sceneId] = tuning;
  const temporary = `${TUNING_FILE}.tmp`;
  await writeFile(temporary, `${JSON.stringify(tunings, null, 2)}\n`, "utf8");
  await rename(temporary, TUNING_FILE);
}

export function sceneTuningDevPlugin(): Plugin {
  return {
    name: "scene-tuning-dev-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url
          ? new URL(request.url, "http://localhost").pathname
          : "";
        if (pathname !== "/__scene-tuning") {
          next();
          return;
        }

        if (request.method === "GET") {
          try {
            reply(response, 200, await readTunings());
          } catch {
            reply(response, 500, { error: "Could not read scene tunings" });
          }
          return;
        }

        if (request.method !== "PUT") {
          response.setHeader("allow", "GET, PUT");
          reply(response, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = (await readBody(request)) as {
            readonly sceneId?: unknown;
            readonly tuning?: unknown;
          };
          if (
            typeof body.sceneId !== "string" ||
            !LIVE_SCENE_IDS.has(body.sceneId) ||
            !validTuning(body.tuning)
          ) {
            reply(response, 400, { error: "Invalid scene tuning" });
            return;
          }
          await saveTuning(body.sceneId, body.tuning);
          reply(response, 200, { saved: true, sceneId: body.sceneId });
        } catch (error) {
          const status = error instanceof SyntaxError || error instanceof RangeError
            ? 400
            : 500;
          reply(response, status, { error: "Could not save scene tuning" });
        }
      });
    },
  };
}
