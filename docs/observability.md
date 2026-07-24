# Observability and performance

The site uses two complementary layers:

- `npm run test:performance` is the repeatable pre-release lab gate.
- Cloudflare dashboards provide production traffic, Worker health, and (once
  enabled) real-user Core Web Vitals.

## Current state

Wrangler authentication has been verified locally against the `personal-site`
Worker, including deployment-history access. Worker observability is explicit
in `vite.config.ts`: built-in metrics and custom/error logs are enabled,
automatic per-request invocation logs are disabled, and traces are disabled.
This keeps the useful server signal without collecting noisy request metadata.

Cloudflare Web Analytics is not enabled by this change. The site's current
privacy disclosure therefore remains accurate.

## Dashboards

Use the Cloudflare dashboard rather than embedding an admin dashboard in the
public site:

1. **Workers & Pages → personal-site → Metrics** for requests, errors, CPU time,
   wall time, and invocation status.
2. **Workers & Pages → personal-site → Logs** for retained Worker errors and
   application logs.
3. **Web Analytics → Core Web Vitals** for p75 LCP, INP, and CLS by page,
   browser, operating system, country, and element after Web Analytics is
   enabled.

An in-site performance dashboard would require authentication and privileged
API access while duplicating Cloudflare's UI. It is intentionally out of scope.

## Local and CLI checks

```powershell
npx wrangler whoami
npx wrangler deployments list --config dist/server/wrangler.json
npx wrangler tail personal-site
npm run test:performance
```

`wrangler tail` is for live logs; it is not a historical metrics or Core Web
Vitals query interface.

## Recommended real-user monitoring rollout

Enable Cloudflare Web Analytics for 100% of production page views with SPA
navigation tracking. This portfolio has low traffic, so sampling would make p75
data unnecessarily sparse. Review LCP, INP, and CLS weekly at first and add
Cloudflare notifications for material regressions.

Before enabling the beacon, update the privacy copy to name anonymous
performance analytics. Do not add contact-click tracking or session replay.

## MCP options

Cloudflare publishes narrow remote MCP servers that are a better fit than a
custom integration:

- Observability: `https://observability.mcp.cloudflare.com/mcp`
- GraphQL: `https://graphql.mcp.cloudflare.com/mcp`
- Broad Code Mode: `https://mcp.cloudflare.com/mcp`

These MCP servers are not connected to this Codex workspace today. Prefer the
read-oriented Observability and GraphQL servers over the broad server, and keep
Wrangler as the deployment/log-tail fallback.

Official references:

- https://developers.cloudflare.com/web-analytics/
- https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/
- https://developers.cloudflare.com/workers/observability/metrics-and-analytics/
- https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/
