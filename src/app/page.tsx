import Link from "next/link";
import { HomeCommunityStats } from "@/components/home-community-stats";
import { HomeLakeTravis } from "@/components/home-lake-travis";
import { HomeTrashDayWidget } from "@/components/home-trash-day";
import { HomeWeather } from "@/components/home-weather";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1 space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {siteConfig.tagline}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-ink-muted">
              Utilities, trusted vendors, local services, and links to public property context—organized
              for Summit at Lake Travis neighbors. Start with resident resources or browse homes and
              values around the community.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/residents"
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark"
              >
                Resident resources
              </Link>
              <Link
                href="/homes"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-slate-300"
              >
                Homes
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 justify-end sm:pt-1">
            <HomeTrashDayWidget />
          </div>
        </div>
      </section>

      <HomeCommunityStats />

      <HomeWeather />

      <HomeLakeTravis />
    </div>
  );
}
