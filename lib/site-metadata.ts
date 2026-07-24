import type { Metadata, MetadataRoute } from "next";
import { routeByKey, routes, type RouteKey } from "../content/site-content";
import {
  resolveDeployment,
  type RuntimeEnvironment,
} from "./deployment";

function pageTitle(routeKey: RouteKey): string {
  return routeKey === "home"
    ? "Richard Phong"
    : `${routeByKey[routeKey].title} | Richard Phong`;
}

export function createPageMetadata(
  routeKey: RouteKey,
  env: RuntimeEnvironment = process.env,
): Metadata {
  const route = routeByKey[routeKey];
  const deployment = resolveDeployment(env);
  const title = pageTitle(routeKey);

  const base: Metadata = {
    title,
    description: route.description,
    robots:
      deployment.kind === "production"
        ? {
            index: true,
            follow: true,
          }
        : {
            index: false,
            follow: false,
            noarchive: true,
            googleBot: {
              index: false,
              follow: false,
              noimageindex: true,
            },
          },
  };

  if (deployment.kind === "preview") {
    return base;
  }

  const canonical = new URL(route.href, deployment.siteUrl);
  const socialImage = {
    url: "/og.png",
    width: 1200,
    height: 630,
    alt: "Richard Phong — Software developer",
  } as const;

  return {
    ...base,
    metadataBase: deployment.siteUrl,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      siteName: "Richard Phong",
      title,
      description: route.description,
      url: canonical,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: route.description,
      images: [socialImage],
    },
  };
}

export function createRobots(
  env: RuntimeEnvironment = process.env,
): MetadataRoute.Robots {
  const deployment = resolveDeployment(env);
  if (deployment.kind === "preview") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", deployment.siteUrl).toString(),
  };
}

export function createSitemap(
  env: RuntimeEnvironment = process.env,
): MetadataRoute.Sitemap {
  const deployment = resolveDeployment(env);
  if (deployment.kind === "preview") {
    return [];
  }

  return routes.map((route) => ({
    url: new URL(route.href, deployment.siteUrl).toString(),
    changeFrequency: route.key === "home" ? "monthly" : "yearly",
    priority: route.key === "home" ? 1 : 0.7,
  }));
}
