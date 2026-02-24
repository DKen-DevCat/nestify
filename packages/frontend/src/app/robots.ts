import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/login",
        disallow: "/",
      },
    ],
    sitemap: "https://nestify-frontend-57y3.vercel.app/sitemap.xml",
  };
}
