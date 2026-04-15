/**
 * Multi-community: later you can drive this from env (e.g. COMMUNITY_SLUG) or subdomain.
 * Keep PII and exact addresses out of source; use admin/CMS or database.
 */
export const siteConfig = {
  name: "My Home",
  tagline: "Community info for your Summit at Lake Travis home",
  /** Used in meta + JSON-LD; swap per deploy or tenant. */
  communityLabel: "Summit at Lake Travis",
  /** Independent site — not run by the HOA or its management company. */
  hoaIndependenceNotice:
    "This site is not affiliated with the Summit at Lake Travis HOA or First Service Residential (HOA management).",
  ownwellReferralUrl: "https://www.ownwell.com/referral?owl=49A37ZF2F",
} as const;

export type NavItem = { href: string; label: string };

export const mainNav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/residents", label: "Residents" },
  { href: "/schools", label: "Schools" },
  { href: "/homes", label: "Homes" },
  { href: "/homes/map", label: "Map" },
  { href: "/businesses", label: "Local" },
];
