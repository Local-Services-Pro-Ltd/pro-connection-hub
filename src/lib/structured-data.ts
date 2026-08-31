/**
 * Shared schema.org builders so every public route emits consistent
 * Organization / BreadcrumbList JSON-LD.
 */
export const SITE_URL = "https://tradesmanfinder.org";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "TradesmanFinder",
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/favicon.ico`,
    description:
      "TradesmanFinder connects UK homeowners with vetted local tradespeople and free, no-obligation quotes.",
    areaServed: { "@type": "Country", name: "United Kingdom" },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "TradesmanFinder",
    url: `${SITE_URL}/`,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** Crumbs are ordered from the site root to the current page. */
export function breadcrumbSchema(crumbs: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}

/** Convenience: a JSON-LD script entry for a route `head()`. */
export function ldScript(schema: unknown) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(schema),
  };
}
