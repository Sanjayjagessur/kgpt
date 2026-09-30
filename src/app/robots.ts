import type { MetadataRoute } from "next";

/** Only the public pages are for search engines; everything else needs a sign-in. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/privacy", "/sign-in", "/sign-up"],
      disallow: ["/"],
    },
  };
}
