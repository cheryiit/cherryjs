import type { config } from "./config";

type SeoInput = {
  title: string;
  description: string;
  url?: string;
  image?: string;
};

export function seoHead({ title, description, url, image }: SeoInput) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(url ? [{ property: "og:url", content: url }] : []),
    ...(image ? [{ property: "og:image", content: image }] : []),
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(image ? [{ name: "twitter:image", content: image }] : []),
  ];
}

export function organizationJsonLd(cfg: typeof config) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: cfg.metadata.siteName,
    url: cfg.metadata.siteUrl,
    logo: cfg.metadata.logo,
    description: cfg.metadata.siteDescription,
  };
}

export function websiteJsonLd(cfg: typeof config) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: cfg.metadata.siteName,
    url: cfg.metadata.siteUrl,
    description: cfg.metadata.siteDescription,
  };
}
