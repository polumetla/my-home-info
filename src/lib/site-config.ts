/**
 * Multi-community: later you can drive this from env (e.g. COMMUNITY_SLUG) or subdomain.
 * Keep PII and exact addresses out of source; use admin/CMS or database.
 */
export const siteConfig = {
  name: "Home Info",
  tagline: "Community resources, home context, and resident tools.",
  /** Used in meta + JSON-LD; swap per deploy or tenant. */
  communityLabel: "Your community",
  /** Disclosure copy for future affiliate / sponsored placements. */
  affiliateNotice:
    "Some links may be affiliate or sponsored. Placement does not imply endorsement by the community.",
  ownwellReferralUrl: "https://www.ownwell.com/referral?owl=49A37ZF2F",
} as const;

export type NavItem = { href: string; label: string };

export const mainNav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/residents", label: "Residents" },
  { href: "/homes", label: "Homes" },
  { href: "/homes/map", label: "Map" },
  { href: "/businesses", label: "Local" },
  { href: "/property", label: "Property" },
];
