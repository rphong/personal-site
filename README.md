# Richard Phong Personal Site

Richard Phong's poster-first personal home, creative work showcase, and hiring
signal. The foundation has four server-rendered routes:

- `/`
- `/experience`
- `/projects`
- `/contact`

The site uses one persistent Three.js runtime with optimized GLBs and
deterministic poster fallbacks. Each live visual is mounted inside its owning
section so it moves naturally with that section instead of remaining fixed
behind scrolling content.

## Requirements

- Node.js 22.15.0 or newer (or Node.js 24+)
- npm using the committed `package-lock.json`

## Local preview

```powershell
npm ci
npm run dev
```

Vinext prints the local URL. All unspecified environments are safe previews:
they render `noindex, nofollow`, omit canonical URLs, disallow crawlers in
`robots.txt`, and publish no sitemap entries.

## Verification

```powershell
npm run typecheck
npm run test:unit
npm run lint
npm run test:html
npm run test:browser
npm run test:performance
npm run posters:check
```

`npm run test:html` creates the Cloudflare-compatible Vinext build and checks
the meaningful initial HTML for every route without relying on JavaScript or
WebGL. The browser UI lane covers mobile navigation, smooth scrolling, hero
layering, and poster/live modes. The performance lane is the production-build
lab budget.

## Production gate

```powershell
$env:SITE_ENV = "production"
$env:SITE_URL = "https://personal-site.richard-phong424.workers.dev"
npm run verify:release
```

The release gate regenerates every poster candidate and requires output within
the committed pixel-diff tolerance before validating the origin and assets,
rebuilding from source, and verifying that the generated Worker is a production
artifact with scene capture disabled and matching Sites metadata. The canonical
résumé is published unchanged at `/Richard-Phong-Resume.pdf`.

## Cloudflare deployment

The public production site is deployed from `main` to
`personal-site.richard-phong424.workers.dev`. Cloudflare Workers Builds runs:

```powershell
npm run build
npm run deploy:cloudflare
```

The deploy entrypoint rebuilds with the production origin before invoking
Wrangler, so both local releases and Cloudflare's Git-connected builds publish
indexable metadata, canonical URLs, `robots.txt`, and the sitemap consistently.

## Sites

`.openai/hosting.json` declares the existing private Sites project used as a
managed preview. The public Cloudflare Worker is the canonical release target.
The project uses Vinext and a Cloudflare Worker entry point, without D1, R2,
authentication, a CMS, or a contact form.

Worker health, production performance, dashboard locations, Wrangler commands,
and Cloudflare MCP options are documented in
[`docs/observability.md`](docs/observability.md).
