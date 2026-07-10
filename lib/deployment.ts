export type RuntimeEnvironment = {
  SITE_ENV?: string;
  SITE_URL?: string;
  [key: string]: string | undefined;
};

export type Deployment =
  | {
      kind: "preview";
      siteUrl: null;
    }
  | {
      kind: "production";
      siteUrl: URL;
    };

export function resolveDeployment(
  env: RuntimeEnvironment = process.env,
): Deployment {
  if (env.SITE_ENV !== "production") {
    return {
      kind: "preview",
      siteUrl: null,
    };
  }

  if (!env.SITE_URL) {
    throw new Error("SITE_URL is required when SITE_ENV is production.");
  }

  const rawSiteUrl = env.SITE_URL;
  let siteUrl: URL;
  try {
    siteUrl = new URL(rawSiteUrl);
  } catch {
    throw new Error("SITE_URL must be a valid absolute URL.");
  }

  if (siteUrl.protocol !== "https:") {
    throw new Error("Production SITE_URL must use https.");
  }

  const isExactOrigin =
    rawSiteUrl === siteUrl.origin || rawSiteUrl === `${siteUrl.origin}/`;

  if (
    !isExactOrigin ||
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    throw new Error(
      "Production SITE_URL must be an origin with no path, query, or hash.",
    );
  }

  return {
    kind: "production",
    siteUrl,
  };
}
