# Observability and performance

The site uses two complementary layers:

- `npm run test:performance` is the repeatable pre-release lab gate.
- Cloudflare dashboards provide production traffic, Worker health, and (once
  enabled) real-user Core Web Vitals.

## Current state

Wrangler authentication has been verified locally against Richard's Cloudflare
account and its separate `personal-site` Worker, including deployment-history
access. That Worker is not the managed Worker serving the Sites production URL.
Do not use its Wrangler metrics, deployments, or tail output as production
evidence for this site.

The production Sites Worker logs are available through the Sites connector.
The source package requests built-in observability with logs enabled at a 100%
head sampling rate, automatic invocation logs disabled, and traces disabled.
The hosting platform can still retain operational request events, so this is a
Worker logging policy rather than a guarantee that no request metadata exists.

Cloudflare Web Analytics is not enabled by this change. The site's current
privacy disclosure therefore remains accurate.

## Dashboards

Do not embed an admin dashboard in the public site. For the current managed
Sites deployment:

1. Use the **Sites production log connector** for request outcomes, Worker
   errors, CPU time, and wall time.
2. Enable **Cloudflare Web Analytics → Core Web Vitals** for p75 LCP, INP,
   and CLS by page, browser, operating system, country, and element. The Core
   Web Vitals view currently covers Chromium browsers.
3. Use **Workers & Pages → Worker → Metrics/Observability** only for Workers
   deployed into Richard's own Cloudflare account; it does not represent the
   managed Sites runtime.

An in-site performance dashboard would require authentication and privileged
API access while duplicating Cloudflare's UI. It is intentionally out of scope.

## Local and CLI checks

```powershell
npx wrangler whoami
npx wrangler deployments list --config dist/server/wrangler.json
npm run test:performance
```

The Wrangler deployment command above proves access to the separate
personal-account Worker only. It is useful for local Cloudflare development,
not for production Sites telemetry. Use the Sites connector for the production
Worker instead.

## Recommended real-user monitoring rollout

Enable Cloudflare Web Analytics for 100% of production page views with SPA
navigation tracking. This portfolio has low traffic, so sampling would make p75
data unnecessarily sparse. Enable Cloudflare's weekly Web Analytics summary and
review LCP, INP, and CLS manually; Web Analytics does not provide configurable
regression-threshold alerts.

Before enabling the beacon, update the privacy copy to name anonymous
performance analytics. Do not add contact-click tracking or session replay.

## MCP options

Cloudflare publishes narrow remote MCP servers that are a better fit than a
custom integration:

- Observability: `https://observability.mcp.cloudflare.com/mcp`
- GraphQL: `https://graphql.mcp.cloudflare.com/mcp`
- Broad Code Mode: `https://mcp.cloudflare.com/mcp`

These MCP servers are not connected to this Codex workspace today. Prefer the
read-oriented Observability and GraphQL servers over the broad server for
resources in Richard's Cloudflare account. Their OAuth connection would not
automatically grant access to the separately managed Sites Worker, so the Sites
connector remains the production log source for this deployment.

Official references:

- https://developers.cloudflare.com/web-analytics/
- https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/
- https://developers.cloudflare.com/web-analytics/get-started/notifications/
- https://developers.cloudflare.com/workers/observability/metrics-and-analytics/
- https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/
