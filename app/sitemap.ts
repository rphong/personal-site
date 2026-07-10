import type { MetadataRoute } from "next";
import { createSitemap } from "../lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return createSitemap();
}
