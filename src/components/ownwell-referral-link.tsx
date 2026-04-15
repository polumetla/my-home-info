import { siteConfig } from "@/lib/site-config";

type Props = {
  className?: string;
};

/** Referral link for [Ownwell](https://www.ownwell.com) property tax appeals. */
export function OwnwellReferralLink({ className }: Props) {
  return (
    <a
      href={siteConfig.ownwellReferralUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
    >
      Protest property taxes · Ownwell
    </a>
  );
}
