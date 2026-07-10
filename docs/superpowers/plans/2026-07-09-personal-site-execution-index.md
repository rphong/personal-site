# Personal Site V1 Execution Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved personal-site specification through four independently reviewable plans without drifting shared contracts, overwriting prior work, exposing source references publicly, or enabling production indexing before every launch gate passes.

**Architecture:** The suite first commits the current starter/reference baseline before any implementation worktree exists, then builds four semantic poster-first routes, creates deterministic Blender/GLB artifacts, installs one persistent WebGL 2 runtime and captures final posters, and adds privacy-bounded diagnostics plus source-bound release evidence. A sanitized noindex/telemetry-off artifact remains available for review while inputs are pending. The strict runner later proves the same clean Git target, performs one production-baked build, identity-binds Sentry uploads, and byte-verifies one protected Sites package without rebuilding.

**Tech Stack:** Vinext/Next App Router, React 19, TypeScript 5.9, Blender 3.6.23 LTS, glTF 2.0/GLB, Three.js 0.185.1, React Three Fiber 9.6.1, Cloudflare Workers/Sites/Web Analytics, Sentry SDK 10.64.0 and CLI 3.6.0, Vitest, Node test runner, Testing Library, Playwright, axe-core

---

## Source of truth

Read these documents completely and in this order before changing application code:

1. `docs/superpowers/specs/2026-07-09-personal-site-design.md`
2. `docs/superpowers/plans/2026-07-09-personal-site-foundation.md`
3. `docs/superpowers/plans/2026-07-09-personal-site-assets.md`
4. `docs/superpowers/plans/2026-07-09-personal-site-runtime.md`
5. `docs/superpowers/plans/2026-07-09-personal-site-observability-release.md`

The approved specification wins if a plan disagrees with it. Stop at that task and correct the plan rather than inferring a hostname, owner-written paragraph, visual approval, monitoring credential, or broader interaction.

## Plan ownership and handoff boundaries

| Order | Plan | Owned result | Required handoff state |
| --- | --- | --- | --- |
| 1 | Foundation, Tasks 0-10 (11 headings) | A committed current-workspace/reference baseline followed by four semantic routes, exact light-only palettes and type, fixed navigation, poster-first HTML, unchanged resume, preview-safe metadata, typed content, and the inert scene seam | Baseline `git ls-files` proof precedes any worktree; `npm test` and lint pass; production validation remains red only for explicitly deferred owner/live-asset inputs |
| 2 | Asset pipeline, 8 tasks | Six curated source copies plus authored Froggie display, seven optimized GLBs, source provenance, brand approvals, model manifest, poster contract, and reproducible cross-platform commands | Seven GLBs validate; Richard has completed the named League, Rocket, and Froggie visual checkpoints; the missing-poster gate remains intentionally red |
| 3 | Persistent runtime, 17 tasks | Eight live scenes, two poster-only scenes, one fixed full-viewport Canvas, static scene swaps, WebGL 2 resilience, local 3D preference, pointer/touch rotation, deterministic capture route, 20 final posters, and poster manifest | Model/poster release validation passes; raw public Figma/gameplay copies are removed; non-public source references remain tracked |
| 4 | Observability/release, 9 tasks | Operational-only event reporting, Cloudflare/Sentry privacy controls, disclosure, contrast/accessibility/performance gates, deferred deterministic social artifact, semantic/visual acceptance, release approval, and strict runner | Preview-safe proof passes now; strict production proof stays closed until every source-bound approval and deployment input exists |

Execute plans sequentially. Within a plan, execute its numbered tasks in order and preserve each RED/GREEN/refactor/verification/commit boundary. Do not start a later plan to work around a failed earlier invariant.

## Shared product contracts

### Routes and content order

| Key | Path | Background | Accent |
| --- | --- | --- | --- |
| `home` | `/` | `#9ECCC0` | `#135946` |
| `experience` | `/experience` | `#DFA9B5` | `#722939` |
| `projects` | `/projects` | `#AFD4E1` | `#285D71` |
| `contact` | `/contact` | `#C9BAE4` | `#4B2E7E` |

Navigation order is Home, Experience, Projects, Contact. Experience order is NASA, EOG Resources, Paycom. Project order is League Ban Site, Froggie Adventures. Project years remain omitted. The unchanged resume is published at `/Richard-Phong-Resume.pdf`, 133,744 bytes, SHA-256 `6e3caa86620603e9652d7c58d35a1e1de4174b21abd4a55bae060ef10aeee45e`.

### Scene IDs and runtime models

| Scene ID | Route/section | Runtime asset |
| --- | --- | --- |
| `home-hero` | Home hero | `/models/crane.glb` |
| `experience-hero` | Experience hero | `/models/crane-workout.glb` |
| `experience-intro` | Experience introduction | `/models/crane-throwing-plane.glb` |
| `nasa-rocket` | NASA chapter | `/models/rocket.glb` |
| `eog-poster` | EOG chapter | Poster only |
| `paycom-poster` | Paycom chapter | Poster only |
| `projects-hero` | Projects hero | `/models/crane-making-table.glb` |
| `league-ban` | League Ban Site | `/models/crane-on-league.glb` |
| `froggie-adventures` | Froggie Adventures | `/models/froggie-display.glb` |
| `contact-hero` | Contact hero | `/models/crane-workout.glb` |

The eight live IDs are the only registry entries that can load GLBs. `eog-poster` and `paycom-poster` are intentional poster-only features. All ten IDs receive desktop and mobile WebP posters at `/posters/<sceneId>-<variant>.webp`.

### Tracked, non-public source references

These five files are committed reproducibility inputs. They are never renamed, deleted, copied into the final `public/` tree, or treated as final runtime posters.

| Source | Dimensions | Bytes | SHA-256 | Purpose |
| --- | ---: | ---: | --- | --- |
| `ReferenceImages/Main Page - Mint.png` | 1920x2160 | 323,621 | `a986f7f511252b521e79bc623274093845a244d67e636accd62f9d84672fd8a6` | Home desktop Figma comparison |
| `ReferenceImages/Experience - Pink.png` | 1920x4580 | 804,876 | `d46c5f6d72c6087cb0f4e632bcf50aa41239415aba398682443f8e777e1f47ad` | Experience desktop Figma comparison |
| `ReferenceImages/Projects - Blue.png` | 1920x5580 | 1,027,131 | `5da147a96636afb90d174b2c47a53289ae2530055c95bbcf8c9968daae1d3689` | Projects desktop Figma comparison |
| `ReferenceImages/Experience - Purple.png` | 1920x1080 | 273,901 | `759d9c87f7d5eb92dacc9c8e1d03d9ed1ee27ba0f9cdab64e5474b604381d8d2` | Contact desktop Figma comparison |
| `ReferenceImages/Froggie Gameplay.png` | 2610x1515 | 2,337,398 | `64e43e332977a6e0d9d5b97a515dcfe0aa8846197d2e938034e73e913549d613` | Immutable Froggie texture-generator input |

The foundation temporarily publishes four reference-frame copies and one raw gameplay copy so its standalone slice is complete. Runtime Task 16 deletes those five public copies only after the 20 canonical posters validate. The root `ReferenceImages/` files remain tracked and hash-tested.

### Manifest and approval authority

| Artifact | Authority |
| --- | --- |
| `assets/scene-sources.json` | Authorized Blender inputs, Froggie crop/input contract, source names, and model keys |
| `assets/blender/source-provenance.json` | Exact authorized source/input-to-canonical transformations; unrelated drift is rejected |
| `assets/brand-approvals.json` | Richard's hash-bound League owned-art and Rocket no-official-logo visual approvals |
| `public/models/assets-manifest.json` | Published GLB URLs, sizes, hashes, Meshopt requirements, animations, and embedded image records |
| `assets/poster-contract.json` | Ten scene IDs, two variants, palettes, capture sizes, source/model relationships, and poster output paths |
| `app/three/scene-registry.ts` | Live-scene camera, lighting, scale, framing, and adjacent preload policy |
| `public/posters/poster-manifest.json` | Generated poster dimensions, hashes, registry/render-input bindings, and capture provenance |
| `config/public-artifacts.json` | Immutable resume plus pending/generated deterministic social-card state |
| `.openai/hosting.json` | Persisted Sites `project_id` plus only empty/null logical D1/R2 bindings; credentials and extra keys are forbidden |
| `config/release-approval.json` | Exact Git approval target, artifact/source/Sites bindings, reviewer evidence, and launch decision |
| `reports/release.json`, `reports/sites-package.json`, `reports/sites-package.tar.gz` | Ignored lifecycle and exact-byte handoff outputs; never approval evidence and usable only when the final handoff verifier matches current clean HEAD |

No downstream plan may create a second authority for these values.

### Runtime-to-diagnostics seam

- Local event name: `site:scene-runtime`.
- Allowed statuses: `ready`, `failure`, `context-lost`, `rotation-health`.
- Allowed failure reasons: `fetch`, `decode`, `timeout`, `webgl2-unavailable`, `context-lost`, `unknown`.
- Ready mark: `scene-ready:<sceneId>`.
- Host attributes: `data-three-status` and `data-active-scene-id`.
- Section attribute: `data-scene-id`.
- Rotation surface: `data-testid="scene-rotation-area"`.
- The runtime only dispatches local events. `app/observability/report-operational.ts` is the sole browser operational sender.

## Shared-file ownership order

| Shared file | First owner | Later ownership and preservation rule |
| --- | --- | --- |
| `package.json`, `package-lock.json` | Foundation | Assets, runtime, then observability append exact dependencies/scripts. Never restore an earlier whole-file snapshot. |
| `vitest.config.ts`, `tests/setup.ts` | Foundation | Runtime installs the merged foundation/runtime WebGL setup. Observability tests continue through the merged include surface. |
| `content/site-content.ts` | Foundation | Runtime replaces temporary poster references with manifest-backed paths without changing copy/order. Observability adds typed telemetry disclosure and reuses it for Contact/footer copy. |
| `app/layout.tsx` | Foundation | Runtime adds the sole `SceneProvider` and `scene-runtime.css` import. Observability adds telemetry/beacon components without remounting or duplicating the provider. |
| `components/site-shell.tsx` | Foundation | Later plans preserve its navigation, semantic children, and footer. Canvas ownership never moves into this component. |
| Route pages and `components/page-hero.tsx` | Foundation | Runtime replaces inert scene seams with `SceneSection` while preserving server-rendered posters/content. Observability changes only disclosure rendering and acceptance coverage. |
| `app/globals.css` | Foundation | Runtime keeps scene mechanics in `app/three/scene-runtime.css`. Observability may change an exact color only through the source-bound contrast-decision workflow and must recapture affected posters afterward. |
| `lib/site-metadata.ts` | Foundation | Observability adds `no-referrer` and the validated production social image only in the production branch; preview stays noindex with no canonical/social absolute URL. |
| `lib/production-validation.ts`, `scripts/validate-production.ts` | Foundation | Runtime replaces the temporary asset stop with final manifest/poster/content checks. Observability calls this final executable from the strict runner. |
| `tests/rendered-html.test.mjs` | Foundation | Observability replaces it with complete preview and production branches while preserving semantic route/order/link assertions. |
| `public/posters`, `public/images`, `tests/public-assets.test.ts` | Foundation | Runtime publishes canonical posters, removes the five public source copies, and retains exact hash checks for the non-public root references. |
| `tests/starter-cleanup.test.ts` | Foundation | Assets updates package-script assertions only; starter-removal assertions remain. |
| `.env.example` | Foundation | Observability replaces the example with exact release, Sentry slug/numeric-ID, and configured Sites helper/Bash paths while preserving foundation identity keys and leaving every secret blank. |
| `.openai/hosting.json` | Starter baseline | Before final approval, exactly one Sites project is provisioned, with only the narrowly permitted failed-call retries; only its `project_id` is persisted, while source credentials, tokens, extra keys, and nonempty v1 D1/R2 bindings are rejected. |
| `worker/index.ts` | Foundation template | Observability routes `/__ops` before app/image handlers, enforces the bounded same-origin payload, and sanitizes Worker Sentry. |
| `vite.config.ts` | Foundation template | Observability enables hidden source maps only for the controlled production build and keeps upload plugins out of Vite; the post-build CLI uploader owns explicit browser/Worker scopes and removes maps only after both identity-bound receipts pass. |
| `.gitignore` | Foundation Task 0 | The baseline ignores `.pnpm-store/`, `tmp/`, `test-results/`, and `playwright-report/`; assets add local Blender/raw/cache exclusions; observability ignores report JSON/temp files and the verified Sites tarball. Canonical `.blend`, GLB, poster, baseline, and evidence files stay tracked where required. |

## Execution sequence

### Phase 0: Establish the boundary

- [ ] Read the approved specification and all four plans completely.
- [ ] Verify the approved specification and all five `docs/superpowers/plans/*.md` files are tracked and clean in the dedicated planning commit. If any is untracked or modified, finish that planning commit before Foundation Task 0; Task 0 must never absorb plan changes.
- [ ] Before creating any implementation worktree, execute Foundation Task 0 in the current workspace: add its exact ignore set, commit the starter plus all five root reference inputs, and pass the task's `git ls-files`/clean-baseline contract. Existing user files must not be stranded as untracked state.
- [ ] Run `git status --short`; preserve unrelated user changes and never stage outside the active plan's named files. Worktree creation is allowed only after the Task 0 baseline commit is clean.
- [ ] Confirm `C:\Code\Blender Models` and all five `ReferenceImages/` inputs are readable.
- [ ] Make Git available to both shell commands and Node child processes. In this Codex Windows runtime prepend `C:\Users\richa\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd` to `PATH` and set `GIT_EXECUTABLE` to its `git.exe`; elsewhere rely on `git` in `PATH` or set the equivalent absolute executable.
- [ ] Use npm and the existing `package-lock.json`; do not add pnpm/yarn lockfiles.
- [ ] Keep `.pnpm-store/`, `tmp/`, portable Blender, raw GLBs, caches, reports, and Blender backups out of commits unless a plan explicitly names a canonical artifact.
- [ ] Treat Richard's named visual inspections as human gates. Do not record an approval on his behalf.

### Phase 1: Foundation

- [ ] Treat the already-completed current-workspace Task 0 baseline as the first Foundation handoff, then execute Foundation Tasks 1-10 in order in the implementation worktree.
- [ ] Confirm the five root `ReferenceImages/` inputs remain tracked exactly as established by Task 0.
- [ ] Verify `npm test`, `npm run lint`, the four 200 responses, semantic HTML with JavaScript disabled, and preview `noindex, nofollow` behavior.
- [ ] Verify `npm run validate:production` fails only for the two owner-written Home fields and the documented not-yet-built model/poster artifacts.
- [ ] Review the foundation diff before Blender work.

### Phase 2: Asset pipeline

- [ ] Execute Asset Tasks 1-2 in order. Only after Task 2 creates `assets:bootstrap`, run it on Windows; on other systems set `BLENDER_BIN` to an exact Blender 3.6.23 executable. Pass `assets:preflight`, then execute Asset Tasks 3-8.
- [ ] Bootstrap and hash-check portable Blender 3.6.23 at that Task 2 boundary; inspect/copy sources without migrating originals.
- [ ] Render the two repository-owned League screens and deterministic Froggie crop; normal regeneration must not silently bless a new Froggie input.
- [ ] Have Richard inspect League on every visible surface, then record the approval bound to `CraneOnLeague.blend` and the two owned PNG hashes.
- [ ] Have Richard inspect every Rocket side for no NASA meatball, worm, seal, logotype, or other official logo, then record the approval bound to the canonical Rocket hash.
- [ ] Have Richard inspect the authored Froggie display before promotion.
- [ ] Export/optimize seven GLBs, write manifests, prove `assets:all` causes no canonical drift, and run `npm run test:assets` plus `npm run assets:validate`.
- [ ] Preserve the expected missing-poster failure. Figma exports are not final poster substitutes.
- [ ] Review the asset diff before installing Three.js.

### Phase 3: Persistent runtime

- [ ] Execute Runtime Tasks 1-17 in order.
- [ ] Preserve one fixed `100svh` Canvas across route navigation, demand rendering, capped DPR, WebGL 2 only, poster-first HTML, and static scene swaps.
- [ ] Keep temporary interaction to bounded pointer/touch yaw/pitch; vertical touch movement must still scroll and keyboard rotation remains out of scope.
- [ ] Verify 3D-off, Save-Data default, unsupported WebGL 2, fetch/decode failure, timeout, context loss, and late-first-frame paths keep posters/HTML complete.
- [ ] Capture all ten desktop/mobile poster pairs through the nonproduction route with pinned Chromium and SwiftShader.
- [ ] Run `npm run test:posters` and `npm run posters:check`; validate seven GLBs and 20 WebPs.
- [ ] Remove only the five temporary public source copies and confirm the root `ReferenceImages/` hashes still match.
- [ ] Verify one Canvas survives real navigation, the initial waterfall contains only the active model, and idle preload owns at most one adjacent live model.
- [ ] Review the runtime diff before any network sender is added.

### Phase 4: Observability and release infrastructure

- [ ] Execute Observability/Release Tasks 1-9 in order.
- [ ] Prove event parsing accepts only exact per-status keys and one visit-level sampling decision; query, fragment, referrer, preview, or nonproduction visits are ineligible.
- [ ] Keep browser operational fetches same-origin, `credentials: "omit"`, bounded, and failure-tolerant. Browser and Worker Sentry enable only for production plus an exact lowercase 40-hex release ID; keep error events strictly sanitized with no replay, tracing, breadcrumbs, client reports, or PII.
- [ ] Keep Worker `/__ops` payloads bounded UTF-8/same-origin and record only allowlisted release/event fields. Add separate browser and Worker uncaught-error alerts.
- [ ] Mount the disclosure from typed content, preserve `scene-runtime.css`, and recapture/check posters after any approved layout or contrast CSS change.
- [ ] Run advisory contrast/accessibility and repeatable performance work only after a fresh sanitized preview build. Route INP uses a state-verified preference-toggle click with explicit sub-16-ms handling; scene drag remains the separate rotation-FPS metric. Reports retain raw values; release thresholds are LCP <= 2500 ms, INP <= 200 ms, CLS <= 0.1, live-scene ready <= 4000 ms, and rotation health >= 30 fps.
- [ ] Implement deferred social generation with the outlined vector fixture. Preview validates the immutable resume and explicit pending state; final social SVG/PNG are generated only after both Home paragraphs and visual motifs are final.
- [ ] Add preview-safe semantic acceptance now. Defer the eight visual baselines until owner copy and poster inputs are stable.
- [ ] Provision exactly one Sites project before final approval. Retry `create_site` only for an explicit temporary failure or, after a slug conflict, one Richard-approved alternate; quota, permission, access, and other validation failures are terminal. Commit only the returned `project_id` in the credential-free, empty-binding `.openai/hosting.json` and bind its hash/evidence into release approval.
- [ ] Bind each Sentry DSN to the approved numeric organization/project IDs. Every upload target, receipt, reuse decision, and prior report includes organization slug/ID, project slug/ID, exact release, output scope, and manifest.
- [ ] Add the Git-targeted release approval and lifecycle-safe release runner. It preflights the exact configured Sites Bash, hashes both the root wrapper and inner hosting helper before production work, records distinct sanitized-preview and production-dist hashes, manifests and byte-verifies the entire extracted archive root, rejects any extra top-level file or symlink, rechecks clean Git identity before passing, and invalidates stale Sites outputs on a new run. Ignored `reports/*` files/tarballs are never approval inputs.

## Integrated command contract

### Asset and baseline mutation commands

These commands intentionally change canonical inputs or generated outputs. Run them only in their owning task, inspect the result, and commit the exact named files.

| Command | Purpose |
| --- | --- |
| `npm run assets:bootstrap` | Install/hash-check ignored portable Blender 3.6.23 |
| `npm run assets:preflight` | Validate the pinned Blender/runtime prerequisites |
| `npm run assets:textures` | Render owned League PNGs and verify the bound Froggie crop |
| `npm run assets:prepare` | Curate authorized canonical Blender sources |
| `npm run assets:froggie` | Build/verify the canonical Froggie display |
| `npm run assets:froggie:replace` | Explicitly replace a reviewed Froggie screenshot binding; never part of normal regeneration |
| `npm run assets:export` | Export immutable raw GLBs outside commits |
| `npm run assets:optimize` | Produce Meshopt/WebP runtime GLBs |
| `npm run assets:manifest` | Rewrite the deterministic model manifest |
| `npm run assets:all` | Run the full reproducible asset pipeline in its defined order |
| `npm run posters:capture` | Recapture all 20 canonical poster outputs and manifest |
| `npm run generate:social-card` | Promote the outlined source and generate the final card only after owner/motif approval |
| `npm run test:visual:update` | Create/update eight baselines from the already-built sanitized preview via the same external-server wrapper used by strict comparison |

### Preview-safe integrated proof

Run this after all four implementation plans are complete, with preview environment values and every production monitoring credential unset:

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run test:unit
npm run test:quality
npm run lint
npm run assets:preflight
npm run assets:validate
npm run assets:validate:release
npm run test:assets
npm run test:posters
npm run posters:check
npm run quality:contrast
npm run quality:public
npm run build
node --test tests/rendered-html.test.mjs
npm run test:preview-safe-browser
npm run quality:performance
git status --short
```

Expected: every command exits 0 without fabricated owner prose, social bytes, or visual baselines. `quality:contrast` is advisory and records unresolved exact-color decisions. `quality:public` accepts the explicit pending social state while always enforcing the resume. `test:preview-safe-browser` expands to runtime browser, accessibility, and semantic acceptance suites; it deliberately excludes visual baselines. Because `npm run build` already produced the sanitized artifact, `quality:performance` may safely serve that exact `dist/`; it uses a discrete toggle click for INP, drag only for rotation FPS, and writes an ignored report.

The following individual scripts remain addressable and must not be hidden inside broad test discovery:

| Script | Contract |
| --- | --- |
| `npm test` / `npm run test:html` | Foundation/runtime convenience path; each builds before rendered-HTML tests and is not used by the final runner |
| `npm run test:browser` | Runtime-owned `three-runtime.spec.ts` only |
| `npm run test:accessibility` | Axe non-color rules on all four routes; exact contrast remains in the dedicated gate |
| `npm run test:acceptance` | Four-route desktop/mobile preview acceptance |
| `npm run test:visual` | Eight approved screenshots; deferred until baselines exist |
| `npm run test:preview-browser` | Strict browser aggregate: runtime, accessibility, acceptance, visual, and performance against one server |
| `npm run quality:contrast:gate` | Strict source-bound contrast decisions; no blocking IDs or selector-wiring failures |
| `npm run quality:public:gate` | Strict deterministic resume and generated social artifact validation |
| `npm run quality:approval:bindings` | Print the exact Git/artifact/source hashes to review |
| `npm run quality:approval` | Validate all approvals and hashed evidence against the current Git target |
| `npm run upload:sentry` | Production-only debug-ID injection plus one explicit, identity-bound client/Worker source-map upload with resumable receipts |
| `npm run package:sites:validated` | Production-only, no-build call to configured root `scripts/package-site.sh`; hash-binds it and `skills/sites-hosting/scripts/package-site.sh`, then verifies post-upload dist and the complete archive-root manifest/hash |
| `npm run verify:sites:handoff` | Read-only final clean-HEAD/dist/archive/both-helper/hosting binding printed immediately before Sites save-version |
| `npm run validate:production` | Validate final owner content, HTTPS origin, models, posters, metadata, and production branch inputs |
| `npm run validate:release` | Run the complete clean-commit preview/production gate; never deploys |

### Deferred approval package

Before strict proof, commit all final content/artifacts/baselines/evidence except the approval record, then run `npm run quality:approval:bindings`. Populate `config/release-approval.json` with:

- `approvalTargetSha256`: the sorted Git index `mode blob path` digest excluding only `config/release-approval.json`;
- bindings for the immutable resume, social PNG, social motif inputs, canonical Rocket, canonical CraneOnLeague, `assets/brand-approvals.json`, the credential-free `.openai/hosting.json` hash, and persisted Sites `project_id`;
- only Git-tracked evidence entries: review notes under `docs/release-evidence/` plus the eight exact stable paths under `tests/browser/visual-regression.spec.ts-snapshots/`, each shaped as `{"path":"...","sha256":"..."}`; ignored reports, ad-hoc screenshots, and external-only links are invalid;
- Richard/date/status evidence for both Home paragraphs and final content;
- every contrast decision and its source-bound CSS/config result;
- social text and visual approval;
- Rocket/NASA no-official-logo inspection;
- CraneOnLeague/Riot no-official-art-or-logo inspection and the exact two owned screens;
- all four 1920-wide full-page desktop comparisons captured from a 1920x1080 viewport, each checked against its tracked reference's exact dimensions and hash;
- all four independently reviewed mobile compositions;
- resume/site role, title, date, claim, and contact consistency;
- Sites provisioning evidence with project ID/config hash, Richard/date, empty v1 D1/R2 bindings, and confirmation no source credential was stored;
- `monitoringConfiguration`: structured final hostname, Cloudflare manual JavaScript-Snippet-only setup, 5% clean/direct visit sample, automatic injection off, Worker Logs/free tier with invocation logs off, exact Sentry organization slug/numeric ID and distinct browser/Worker project slug/numeric-ID pairs bound to their DSNs, passed alert tests to Richard, and replay/tracing/paid overage off;
- Android smoke as either `passed` with the physical device name or `unavailable` with a concrete reason; silent omission is invalid.

Set every reviewer/date/status and top-level status, then commit only `config/release-approval.json`. Because its own blob is excluded from the target digest, that commit preserves the reviewed target. Any other tracked change invalidates approval and requires a new review.

### Strict production proof

Supply the final production environment outside Git:

- `SITE_ENV=production` and `NEXT_PUBLIC_SITE_ENV=production`;
- final HTTPS origin-only `SITE_URL`;
- `RELEASE_ID` and `NEXT_PUBLIC_RELEASE_ID` equal to the exact lowercase 40-hex clean `git rev-parse HEAD`;
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, numeric `SENTRY_ORG_ID`, distinct browser/Worker project slugs and numeric project IDs, `SENTRY_AUTH_TOKEN`, and `NEXT_PUBLIC_CF_BEACON_TOKEN`; swapped or mismatched DSNs fail;
- absolute `SITES_PLUGIN_ROOT` containing both exact files `scripts/package-site.sh` and `skills/sites-hosting/scripts/package-site.sh`, plus absolute `SITES_BASH_BIN`. Keep the upload token, Sentry organization/project upload values, and Sites tool paths in the controlled release environment only.

Then run from a clean checkout:

```bash
npm run validate:release
git status --short
```

The strict runner must execute these stages in order:

1. Delete stale Sites package report/archive, then validate Git availability, clean index/worktree, exact HEAD release IDs, production origin, DSN-to-numeric-project identities, monitoring values, persisted Sites project/config, approval target, bindings, and evidence.
2. Strip all production monitoring values and run the preview gates: typecheck, unit tests, quality contract tests, lint, pinned Blender preflight, release asset validation, asset tests, poster tests, deterministic poster check, strict contrast, strict public artifacts, and one preview build.
3. Run preview rendered-HTML tests and the strict browser aggregate against that artifact, record its deterministic hash, and keep its noindex/telemetry-off assertions separate from production.
4. Read-only preflight the actual Bash executable, both exact configured Sites helper paths/hashes (root wrapper and inner hosting helper), and credential-free hosting config/project ID before any production build or upload.
5. Restore the production environment, run production content validation, perform exactly one production build, inject debug IDs, upload `dist/client` once to the browser identity and `dist/server` once to the Worker identity, require two counted organization/project/release/scope receipts, remove maps only after both uploads, and run production rendered-HTML tests.
6. Compute the post-upload production dist manifest/hash, require it differs from the sanitized preview, invoke the exact root wrapper without inherited monitoring/release credentials, manifest the whole extraction root, reject symlinks or anything outside the expected `dist/` tree, byte-compare every file, and record project/commit/both-helper/hosting/dist/archive bindings.
7. Re-read Git immediately before `passed`; require clean unchanged HEAD and approval-target digest. Overwrite release/package lifecycle state so stale green output cannot survive. Any uncertain receipt or changed manifest for the same Sentry organization/project/release/scope requires manual reconciliation instead of an automatic duplicate.

Expected: the command exits 1 before a build while inputs remain unresolved. Once every gate exists, it exits 0 and records `passed` for the exact HEAD/hostname plus a verified production Sites tarball. It does not deploy or alter indexing by itself.

## Specification coverage

| Approved specification area | Owning plan |
| --- | --- |
| Intent, goals, non-goals, sources of truth | Foundation; runtime explicitly excludes transitions/custom controls; this index enforces order |
| Visual system and four route compositions | Foundation exact Figma colors/type; observability contrast and visual evidence |
| Global shell, content, links, resume, preview indexing | Foundation; observability final disclosure and production metadata proof |
| Blender/model pipeline and brand-safe source curation | Assets |
| Persistent Three.js architecture and poster resilience | Runtime |
| Web Vitals, byte budgets, scene readiness, and rotation health | Assets, runtime, observability performance gate |
| Accessibility and touch/scroll safety | Foundation semantics, runtime input boundary, observability axe/contrast gates |
| Privacy-bounded operational observability | Runtime local seam plus observability browser/Worker/Sentry boundary |
| Public artifacts and social metadata | Foundation resume/metadata plus observability deferred deterministic social generation |
| Production launch gates | Observability release approval/runner plus Sites hosting only after strict proof |
| Future transitions and custom interaction | Excluded from every v1 implementation task |

## Inputs that may remain unresolved in a complete preview

- Richard's final `home.nonWorkInterest` paragraph.
- Richard's final `home.technicalCuriosity` paragraph.
- Final generated/approved social SVG and PNG.
- Approved visual baselines and desktop Figma/mobile composition evidence.
- Completed source-bound exact-color decisions.
- Final HTTPS `SITE_URL`—an actual `create_site`/`get_site` connector-returned Sites URL or Richard-approved custom origin, never one derived from slug—and clean-HEAD release IDs. If no authoritative Sites URL is returned, require the custom origin; this v1 workflow has no pre-approval bootstrap deployment.
- Cloudflare and Sentry account configuration, numeric identity bindings, secrets, alert tests, recipients, and free-tier evidence.
- A provisioned/committed Sites `project_id`, credential-free hosting evidence, and configured release-machine Sites plugin/Bash paths.
- Resume/site consistency signoff and Android outcome evidence.
- A fully populated and committed `config/release-approval.json`.

These are strict release gates, not permission to weaken tests, invent prose, commit sentinel baselines, broaden telemetry, or publish an indexable preview.

## Final production rule

Provision exactly one Sites project with Richard-approved title/unique slug—ask rather than invent when absent—and commit its opaque `project_id` before final approval. Retry `create_site` only for an explicit temporary failure or a slug conflict after Richard approves an alternate; quota/permission/access/other validation failures are terminal. After `npm run validate:release` exits 0, run `npm run verify:sites:handoff` immediately before hosting; any tracked change or mismatch in clean HEAD, approval target, final `SITE_URL`, either helper hash/config, production dist, complete archive root, or archive bytes forces a full rerun. Reuse or refresh the source-write credential without storing it; push exact HEAD specifically to its returned `remote_url` and `branch` using returned `auth_mode`/token only as a per-command header, then verify that remote branch head. Save one version from the verified tarball with `source.commit_sha` equal to that HEAD. Record the returned project/version plus archive-storage content hash/size/file count; compare its content hash to local SHA-256 only when the connector states that algorithm.

Read existing Sites environment variables, remove all user keys outside the allowlist, set only `SITE_ENV`, exact handoff `SITE_URL`, exact handoff `RELEASE_ID`, and secret Worker `SENTRY_DSN`, verify the resulting key set, record the environment revision, privately deploy the saved production-baked version, and poll until its status succeeds with the same `env_set_revision`. This protected deployment is not the sanitized noindex review artifact; safety comes from access control until promotion. If `SITE_URL` is custom, add the domain, apply returned DNS validation records, and poll until active; otherwise record that the Sites URL is final. After Richard explicitly authorizes public launch and its baked indexing metadata, call `update_site_access(access_mode:"public")`, call `deploy_site_version` for the same project/version, poll `get_deployment_status`, verify unauthenticated reachability, then verify canonical/robots/sitemap behavior. Never rebuild or send upload credentials, organization/project upload values, source credentials, or local Sites tool paths to the runtime. Any source/config/environment mismatch blocks promotion.
