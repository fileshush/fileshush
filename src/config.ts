/**
 * Set to true only when the site is ready to appear in search results.
 * While false, every page sends <meta name="robots" content="noindex, nofollow">.
 * Keep robots.txt open either way: crawlers must be able to see the noindex tag.
 */
export const SITE_INDEXABLE = false;

export const site = {
  name: "Fileshush",
  pitch:
    "Your files say more than you think. Fileshush quiets them down — right in your browser.",
  tagline: "Clean, shrink and check your files. Nothing leaves your device.",
  version: "v0.2",
  description:
    "Tools to see what's hidden in your photos and PDFs, then clean and shrink them in your browser. Your files never leave your device.",
  contactEmail: "hello@fileshush.com",
  maker: "Pulindu Vidmal",
  location: "Sri Lanka",
  githubUrl: "https://github.com/fileshush/fileshush",
  ads: {
    enabled: false,
    client: "",
    slot: "",
  },
  analytics: {
    cloudflareToken: "",
  },
} as const;

export type SiteConfig = typeof site;
