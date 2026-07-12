# Production Web Vitals Lab Baseline

Recorded 2026-07-12 from the dedicated Chromium production-build lab on
Windows. The hosted Worker artifact and its real committed posters and GLBs
were served through Wrangler. Chromium used SwiftShader for deterministic
correctness; these numbers are regression evidence, not a physical-GPU or
field-RUM benchmark.

| Path | Viewport / device DPR | LCP | CLS | Raw route shift | Drag-to-paint proxy | TBT / longest task | Idle frames | Renderer DPR / buffer |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 3D enabled | 1440×900 / 1 | 84 ms | 0 | 0.0155 | 68.4 ms mouse | 0 / 0 ms | 7 → 7 over 500 ms | 1 / 1440×900 |
| Save-Data | 1440×900 / 1 | 76 ms | 0 | 0.0155 | n/a | n/a | n/a | no renderer |
| 3D enabled | 390×844 / 3 | 72 ms | 0 | 0.0241 | 92.2 ms touch | 0 / 0 ms | 8 → 8 over 500 ms | 1.5 / 585×1266 |
| Save-Data | 390×844 / 3 | 76 ms | 0 | 0.0241 | n/a | n/a | n/a | no renderer |

The enabled cases requested WebGL 2 with `antialias: true` and
`powerPreference: "high-performance"`; Chromium negotiated alpha and
antialiasing successfully. The Save-Data cases created no connected Canvas,
made no GLB request, and wrote no explicit local preference.

## Method and limits

- The real home GLB was held only after Meshopt decode. LCP was observed while
  the canonical poster remained visible, then the model was released for the
  first Canvas frame. The first trusted route click finalized initial-navigation
  LCP, and the gate evaluated that final latest candidate. This proves LCP does
  not depend on delayed WebGL or an earlier provisional candidate.
- CLS uses the Web Vitals session-window algorithm. Raw layout-shift values are
  also summed across trusted Home → Experience → Projects navigation so route
  swaps cannot hide behind the recent-input exclusion.
- TBT measures the intersection of each long task's over-50 ms blocking region
  with the first connected WebGL 2 request through the first ready frame.
- Drag latency is a trusted-input, renderer-frame, next-paint proxy. It is not
  standardized field INP.
- Loopback LCP excludes CDN and real-network variance. Production RUM should be
  added only after choosing a privacy-compatible provider and consent policy.

Every lab run attaches the full JSON measurements to its Playwright result.
Run it with `pnpm test:performance`.
