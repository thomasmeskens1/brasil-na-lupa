import type { MetadataRoute } from "next";
import { SITE } from "./site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/minha-conta", "/entrar"] },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
