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

- Node.js 22.13.0 or newer
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
npm run test:unit
npm run lint
npm run test:html
```

`npm run test:html` creates the Cloudflare-compatible Vinext build and checks
the meaningful initial HTML for every route without relying on JavaScript or
WebGL.

## Production gate

```powershell
$env:SITE_ENV = "production"
$env:SITE_URL = "https://richardphong.example"
npm run validate:production
```

The foundation intentionally fails this gate until Richard supplies the two
owner-written Home details and the 3D asset slice replaces reference exports
with deterministic posters and validated required GLBs. The canonical résumé is
published unchanged at `/Richard-Phong-Resume.pdf`.

## Sites

`.openai/hosting.json` remains the Sites capability declaration. The project
uses the existing Vinext Vite plugin and Cloudflare Worker entry point; it does
not use D1, R2, authentication, a CMS, or a contact form.
