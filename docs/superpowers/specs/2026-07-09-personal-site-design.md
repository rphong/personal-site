# Personal Site V1 Design Specification

Date: 2026-07-09

Status: Approved design, pending owner review of this written specification

## 1. Product intent

Build Richard Phong's personal website as a personal home first, a creative work showcase second, and a hiring signal third. The site should preserve the pastel, low-poly personality of the Figma file while replacing placeholder copy with accurate, first-person content and making Blender-authored scenes interactive through Three.js.

The v1 experience has four real routes:

1. `/` - Home
2. `/experience` - Experience
3. `/projects` - Projects
4. `/contact` - Contact

The pages navigate independently in v1. The architecture preserves route ordering and direction metadata for a future left/right transition system, but v1 installs no animation library and ships no dormant route-transition code.

## 2. Goals

- Reproduce the Figma's light pastel art direction, large editorial typography, generous spacing, and layered low-poly scenes.
- Use a single persistent Three.js canvas across routes and scrolling sections.
- Integrate Blender-authored GLBs with limited v1 interaction: constrained pointer/touch rotation of the complete scene root.
- Present experience as personal narrative rather than a duplicate resume.
- Present League Ban Site and Froggie Adventures as creative personality pieces rather than current flagship work.
- Keep all meaningful content and actions available as semantic HTML without JavaScript or WebGL.
- Meet explicit performance, resilience, privacy, accessibility-review, and observability gates.
- Deploy through Sites with non-indexed previews and an indexable production hostname only after launch validation.

## 3. Non-goals for v1

- No left/right page animation.
- No model travel, morphing, fades, camera easing, or scroll choreography between scenes.
- No model-specific custom interactions beyond rotation.
- No keyboard control for the temporary decorative rotation interaction.
- No embedded Froggie Unity WebGL build.
- No database, CMS, authentication, uploads, or contact form.
- No dark theme.
- No engagement analytics, user identity tracking, session replay, or behavioral event collection.
- No separate Privacy route.
- No official NASA, EOG Resources, or Paycom logo assets.

## 4. Sources of truth

### Visual design

- Figma file: `Personal Website Version 3`
- Figma key: `klk5sIGyfyWkawWyWdzcLX`
- Primary linked frame: `473:85` (`Projects - Blue`)
- Local exports under `ReferenceImages/`

### Content

- Canonical resume artifact: owner-maintained `PhongRichard.pdf`
- GitHub profile: `https://github.com/rphong`
- Project repositories:
  - `https://github.com/rphong/LeagueBanSite`
  - `https://github.com/rphong/Froggie`
- Froggie gameplay reference: `ReferenceImages/Froggie Gameplay.png`

### Blender sources

The current external source library is `C:\Code\Blender Models`. Selected canonical `.blend` files will be copied into `assets/blender/`. Every `.blend1` backup is excluded.

Source files relevant to v1:

- `Crane.blend`
- `CraneWorkout.blend`
- `CraneMakingTable.blend`
- `CraneOnLeague.blend`
- `CraneThrowingPlane.blend`
- `Rocket.blend`

`RocketExportParticle.blend`, `CraneIntepreter.blend`, and `CubeAnimation.blend` are excluded from v1 source import and production export.

## 5. Visual system

### Route palettes

Use the exact Figma colors in the first implementation pass:

| Route | Background | Accent | Pale heading |
| --- | --- | --- | --- |
| Home | `#9ECCC0` | `#135946` | `#FFFFFF` |
| Experience | `#DFA9B5` | `#722939` | `#FBE5EA` |
| Projects | `#AFD4E1` | `#285D71` | `#EDF7FB` |
| Contact | `#C9BAE4` | `#4B2E7E` | `#EDE6FA` |

Shared content surface: `#EEEEEE`.

Shared initial text/nav color: `#505050`.

Exact palette values remain unchanged during initial implementation. Automated and manual contrast checks must report failures. Any failure is advisory during implementation but blocks production launch until Richard approves either the original or the smallest compliant adjustment.

### Typography

- UI, body, navigation, and rounded hero headings: Nunito Sans.
- Editorial display names and project headings: Fraunces.
- Do not copy Gotham Rounded or San Louis font binaries without verified webfont redistribution rights.
- Self-host optimized font subsets through the framework so the site has no runtime font request.

### Theme

- V1 is intentionally light-only.
- Declare a light color scheme explicitly.
- Remove the starter's automatic dark-mode override.

## 6. Global shell and navigation

- A shared root layout owns the persistent scene provider, fixed canvas, fixed navigation, 3D preference control, footer, and route metadata.
- Navigation order is Home, Experience, Projects, Contact.
- Navigation remains fixed and visible while scrolling.
- It uses an opaque route-colored surface with reserved layout height. No blur, hide/reveal, or motion behavior.
- The active route uses the Figma accent color and thin underline.
- On mobile, all four links remain visible; do not hide them behind a menu.
- Preview/staging deployments use `noindex, nofollow` and no canonical URL. Only the verified production hostname receives canonical metadata, sitemap inclusion, and indexing.

## 7. Page designs and content

### 7.1 Home

Hero:

- Mint full-viewport composition.
- Large `Richard Phong` display name.
- Live `Crane.blend` scene when 3D is enabled and supported.
- Deterministic scene poster otherwise.

Below the hero:

- One short first-person introduction, not a professional pitch.
- One quiet current-role line: Software Developer at EOG Resources.
- Selected links to Experience, Projects, GitHub, and Contact.
- No skill grid and no resume bullets.

Two owner-supplied content fields remain intentionally deferred:

- `home.nonWorkInterest`
- `home.technicalCuriosity`

Local and non-indexed previews may render explicit draft sentinels. Production validation fails while either field is empty or still contains its sentinel.

### 7.2 Experience

Hero:

- Pink full-viewport composition with oversized `Experience` text.
- Live `CraneWorkout.blend` scene when 3D is enabled and WebGL 2 is supported; deterministic poster otherwise.
- Existing animation clips are exported and wired for future use but remain paused in v1.

The page uses three company chapters in this order:

1. NASA
2. EOG Resources
3. Paycom

Company names are styled HTML typography, not official logo files. Copy uses concise first-person paragraphs rather than resume bullets. Humor may appear as a small accent, but the old `Who let the intern out` framing is retired.

NASA includes two nested role/date entries:

- Software Developer Intern, 2023-2024
- Software Developer Intern, 2022-2023

NASA narrative may reference only verified resume outcomes: redesigning an ISS crew calendar interface used during Artemis III preparation; automating On-Board Training feedback; building a Razor Pages coordination tool; reducing training-simulator file size by 60 percent; and improving script speed by more than 5x. The company introduction uses `CraneThrowingPlane.blend`, followed by the required live `Rocket.blend` scene for the NASA chapter.

EOG Resources includes two nested role/date entries:

- Software Developer, 2025-Present
- Software Developer Intern, 2024

EOG narrative may reference only verified resume outcomes: reducing reservoir proxy run time from 40-50 seconds to 1-2 seconds; surfacing more than 100,000 data points through visualization components; establishing automated quality gates; leading cross-team visualization integration; and building a real-time anomaly detection/escalation pipeline. EOG uses an intentional deterministic poster in v1.

Paycom includes one entry:

- Software Developer Intern, 2023

Paycom narrative may reference only verified resume outcomes: building an ASP.NET/React Web API using FedEx APIs for more than 15,000 weekly packages and establishing a 90 percent coverage test suite. Paycom uses an intentional deterministic poster in v1.

The page includes a clearly labeled resume download using the unchanged canonical PDF.

### 7.3 Projects

Hero:

- Blue full-viewport composition with oversized `Projects` text.
- Live `CraneMakingTable.blend` scene when 3D is enabled and WebGL 2 is supported; deterministic poster otherwise.

Projects are creative personality pieces, not flagship/current case studies. Do not display their years. Use one personal reflection paragraph plus one compact technical line for each.

League Ban Site appears first:

- Required live scene from `CraneOnLeague.blend`.
- Preserve the Figma League workstation/ban-list visual language without shipping Riot-owned champion or item art.
- Technical facts: Node.js, Express, EJS, node-fetch, and Riot APIs. The application accepts a summoner name, reads recent ranked matches, and derives playful opponent/ban recommendations from match data.
- Reflection focus: connecting coding to a game Richard already played deepened his interest in building software.
- Repository link: `https://github.com/rphong/LeagueBanSite`.

Froggie Adventures appears second:

- Required live placeholder scene: a rotating low-poly display/arcade object with the authentic gameplay screenshot on its screen.
- The placeholder must be authored as a canonical Blender scene and exported as GLB; do not substitute a CSS-only or Three.js-primitive-only object for the required live asset.
- Technical facts: Unity, C#, a three-person team, and procedural difficulty-scaled level generation.
- Reflection focus: teamwork, leading/collaborating in a small team, and shipping something the group could demonstrate publicly.
- The game is not embedded in v1.
- Repository link: `https://github.com/rphong/Froggie`.

### 7.4 Contact

Hero:

- Lavender full-viewport composition with oversized `Contact` text.
- Reuse the validated workout-crane live scene when 3D is enabled and WebGL 2 is supported; deterministic poster otherwise.

Public contact actions:

- Email: `mailto:richard.phong424@gmail.com`
- LinkedIn: `https://linkedin.com/in/richard-phong/`
- GitHub: `https://github.com/rphong`
- Phone: `tel:+12817776437`, displayed as `281-777-6437`
- Resume download: stable path `/Richard-Phong-Resume.pdf`

Contact expands the site's telemetry disclosure. There is no contact form.

## 8. Persistent Three.js architecture

### 8.1 Runtime boundary

- Pages and meaningful copy remain server-rendered semantic HTML.
- A small client boundary dynamically imports the Three.js runtime with SSR disabled.
- Use one persistent fixed canvas in the shared root layout.
- The canvas is exactly one browser viewport (`100svh`) and remains behind scrolling HTML. The document, not the canvas, owns full scroll height.
- Opaque section surfaces cover the canvas wherever models must not appear behind body copy.

Approved dependency line:

- `three@0.185.1`
- `@react-three/fiber@9.6.1`
- `@react-three/drei@10.7.7`
- `@react-three/test-renderer@9.1.0` for tests

V1 targets WebGL 2 on current evergreen desktop and mobile browsers. Unsupported devices receive the complete poster-and-HTML experience.

### 8.2 Scene activation

- Each hero or feature section registers a stable scene ID, poster, model URL, camera, lighting, safe zones, and rotation limits.
- IntersectionObserver activates the section crossing a shared viewport activation line.
- A route change clears stale registrations and activates the destination hero.
- Scene swaps are immediate/static in v1. There is no fade, morph, model travel, or camera easing.
- If the next model is not ready, its poster remains until the model's first rendered frame is available; then the canvas replaces the poster without authored transition choreography.
- Only the current and likely next model may preload. Do not eagerly load every scene.

### 8.3 Interaction contract

- Pointer/touch input rotates one normalized root containing the complete authored diorama.
- Default limits: yaw plus/minus 25 degrees, pitch plus/minus 8 degrees, with per-scene overrides only when visually reviewed.
- No zoom, pan, physics, selection, or mesh-specific control.
- Rotation is temporary and decorative, so the canvas is not keyboard-focusable and exposes no keyboard rotation control.
- All meaningful information and actions remain in HTML.
- A bounded transparent DOM hit area forwards horizontal drag deltas to the active scene while preserving vertical page scrolling (`touch-action: pan-y`). The full viewport must never become a scroll trap.
- Scene rotation resets to the registered default pose when the active scene changes.

### 8.4 Mobile composition

- Hero scenes retain oversized model/heading overlap.
- Each mobile scene is reframed into the upper viewport.
- Body copy and actions live in opaque model-free zones.
- Models never drift behind paragraph text or link hit areas.

### 8.5 3D preference

- Default 3D on when WebGL 2 is available.
- Provide a small persistent `3D on/off` control.
- Store the preference only on-device in local storage; do not send telemetry for it.
- When `saveData` is available and the visitor has not explicitly chosen, default to posters.
- Poster mode leaves every page complete and functional.

## 9. Blender and asset pipeline

- Canonical sources live under `assets/blender/`.
- Exclude every `.blend1` file, local Blender binary, cache, temporary render, and unoptimized intermediate export from version control. Commit selected canonical `.blend` sources, optimized runtime GLBs, final posters, and their manifests intentionally.
- Pin a portable Blender 3.6 LTS command-line exporter for v1.
- Automated export opens source files read-only and must not resave or migrate canonical `.blend` files.
- Blender exports meshes, materials, rigs, and clips. Embedded Blender cameras and lights are not authoritative for the website.
- The web scene registry owns runtime camera and lighting. Blender compositions serve as desktop visual references.
- Export one normalized scene root per GLB.
- Post-process with glTF Transform. Start with Meshopt geometry compression; use KTX2 only for scenes with material textures where it measurably reduces transfer/GPU memory.
- Self-host required decoders.
- Hard Cloudflare limit: less than 25 MiB per file.
- Preferred budget: less than 5 MiB per scene GLB and less than 2 MiB for the first required Home scene.
- A validation command fails for malformed GLBs, missing required scenes, missing posters, source/manifest mismatches, or files above hard limits.

Registered live scenes for v1:

- Home: `Crane.blend`.
- Experience hero and Contact hero: shared `CraneWorkout.blend` export.
- Experience introduction: `CraneThrowingPlane.blend`.
- NASA: `Rocket.blend`.
- Projects hero: `CraneMakingTable.blend`.
- League Ban Site: `CraneOnLeague.blend`.
- Froggie Adventures: new canonical `FroggieDisplay.blend` using `ReferenceImages/Froggie Gameplay.png` as the screen texture.

Every registered live scene must pass the same asset and performance gates. EOG and Paycom are the only intentional poster-only feature scenes in v1.

## 10. Poster generation and resilience

- Figma exports are visual references, not long-term runtime posters.
- After each GLB passes validation, generate and commit a deterministic poster from the web scene registry using the exact default pose, web camera, web lighting, background, and desktop/mobile framing.
- Use pinned browser/render settings so poster captures are reproducible.
- The poster is present before canvas initialization and remains beneath the canvas until the first successful rendered frame.
- On model fetch failure, decode failure, WebGL 2 absence, context loss, timeout, 3D-off preference, or reduced-data default, keep the poster and semantic content.
- A scene failure never blocks navigation, copy, contact actions, or the resume.

## 11. Performance budgets

The verified production release must meet:

- LCP at or below 2.5 seconds.
- INP at or below 200 milliseconds.
- CLS at or below 0.1.
- First rotatable scene available within 4 seconds on the repeatable mobile lab profile.
- At least 30 FPS during constrained rotation on the repeatable mobile lab profile.
- No unused route models in the initial network waterfall.

Runtime defaults:

- `frameloop="demand"`.
- Render only during rotation, scene activation, loading completion, resize, or context recovery.
- Device pixel ratio capped at `[1, 1.5]` by default.
- One shadow-casting light at most; prefer baked lighting or a cheap blob/contact shadow.
- Reuse geometry/materials where safe and explicitly dispose route-only GPU resources.
- No large post-processing stack in v1.

Prelaunch lab checks gate release where measurable. Cloudflare real-user data verifies field Core Web Vitals after production launch; a regression triggers a poster fallback or model simplification decision.

The repeatable mobile lab profile is Chromium at 390x844 CSS pixels, DPR 1.5, 4x CPU slowdown, and Fast 4G network shaping. FPS is measured from animation-frame intervals during a scripted constrained rotation under this profile. A physical mid-range Android smoke test is added when such a device is available, but the repeatable lab profile remains the release gate.

## 12. Accessibility and contrast review

- All content, links, headings, company history, project descriptions, contact actions, and resume access are semantic HTML.
- The decorative canvas is hidden from assistive technology.
- Loading/error information is not required to understand page content.
- Preserve native focus behavior on real links and controls.
- The 3D toggle is keyboard-accessible even though model rotation is not.
- Respect `prefers-reduced-motion`: no automatic scene/camera/route motion, and immediate static scene changes.
- Exact Figma colors are implemented first, then contrast is measured.
- Any WCAG contrast failure blocks production launch until Richard reviews the exact color beside the smallest compliant adjustment and approves a final value.

## 13. Observability and privacy

Keep the zero-cost baseline:

- Cloudflare Web Analytics for privacy-first real-user Web Vitals.
- Cloudflare Workers logs/traces for server diagnostics within the free quota.
- Sentry Developer for client exception grouping and alerts.
- Sanitized uncaught Worker exceptions also go to Sentry for active alerts; Cloudflare Logs remain the server source of truth.

Telemetry is operational only:

- Core Web Vitals.
- Route and scene load timing.
- GLB failure and poster-fallback reasons.
- WebGL context loss.
- Rotation frame health.
- Worker exceptions.
- Release identifiers.

Do not collect:

- Scroll depth.
- Rotation/model interactions as engagement events.
- Outbound link or contact-action usage.
- User identity.
- Session replay.

Use sampling, strip sensitive query/referrer/user fields, disable automatic paid usage, and treat free-tier exhaustion as a monitoring gap. Use no generic server performance tracing and no duplicate browser page tracing; narrowly sampled scene-load diagnostics are allowed.

The global footer contains a concise telemetry disclosure. Contact expands it: Cloudflare and Sentry process sampled performance/error diagnostics, contact information is never attached to telemetry, and the 3D preference stays on-device.

## 14. Metadata and public artifacts

- Site title and description describe Richard Phong's personal home and interactive work.
- Production robots, sitemap, canonicals, and Open Graph metadata use the final production URL.
- Previews omit canonical/sitemap publication and use `noindex, nofollow`.
- Generate one bespoke social preview only after final content and visual motifs are stable; validate its text before shipping.
- Publish the canonical resume unchanged as `/Richard-Phong-Resume.pdf`.
- Run a prelaunch consistency check across resume, site titles/dates, email, phone, LinkedIn, and GitHub.

## 15. Testing and verification

Implementation follows strict red-green-refactor TDD.

Required test layers:

1. Content tests for routes, navigation order, company/role order, project links, contact values, resume path, and required owner fields.
2. Scene-registry tests for model/poster presence, camera/light definitions, safe zones, rotation bounds, required-live flags, and adjacent-only preload behavior.
3. Asset-pipeline tests for source selection, excluded `.blend1` backups, pinned exporter, GLB validity, byte limits, poster presence, and deterministic manifests.
4. Component tests for active navigation, fixed shell, 3D preference, loading poster, WebGL fallback, error boundary, noindex previews, and reduced-motion/reduced-data behavior.
5. Three.js tests for normalized-root rotation, yaw/pitch clamping, reset on activation, no zoom/pan, demand invalidation, and static scene swaps.
6. Rendered-HTML tests proving meaningful page content works without JavaScript or WebGL.
7. Browser tests covering all routes, desktop/mobile layouts, fixed navigation, horizontal drag versus vertical touch scroll, 3D toggle persistence, forced GLB failure, context fallback, public links, resume download, and preview indexing rules.
8. Visual comparison against Figma at desktop and approved mobile compositions.
9. Contrast report with user approval for every release-blocking failure.
10. Production build plus Cloudflare-compatible output verification.

## 16. Production launch gates

Production deployment/indexing is blocked until all of the following are true:

- Required live scenes exist and pass asset/performance validation.
- Deterministic posters exist for every registered scene.
- Home owner fields are completed.
- Public resume is present and consistency-checked.
- All automated tests and production build pass.
- Core lab performance gates pass and mobile rotation meets the approved threshold.
- Contrast findings are resolved with Richard's approval.
- Cloudflare Analytics/observability and Sentry free-tier configuration are present.
- Preview indexing is disabled and production metadata uses the final hostname.
- Browser and visual QA pass at desktop and mobile sizes.

## 17. Remaining implementation inputs, not design decisions

- Richard supplies final values for `home.nonWorkInterest` and `home.technicalCuriosity` before production.
- Richard supplies or creates the Cloudflare and Sentry account/project values required at deployment.
- The final production hostname is supplied before canonical metadata and indexing activate.
- Blender sources are exported, optimized, visually checked, and committed through the approved pipeline.
- Richard approves any contrast-driven palette adjustment before launch.

These inputs do not reopen the approved architecture. They are tracked as explicit validation gates.

## 18. Future work

- Smooth direction-aware left/right route transitions.
- Model travel/morph/camera choreography.
- Custom scene-specific interactions and animation clips.
- Optional richer EOG and Paycom 3D scenes.
- Optional separately launched Froggie playable demo.
- Blender-version migration after visual review.
- A genuinely art-directed dark theme, if desired.
