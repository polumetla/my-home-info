import Link from "next/link";
import { mainNav, siteConfig } from "@/lib/site-config";
import { SiteSearch } from "@/components/site-search";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="group">
          <p className="text-lg font-semibold tracking-tight text-ink group-hover:text-accent-dark">
            {siteConfig.name}
          </p>
          <p className="text-sm text-ink-muted">{siteConfig.communityLabel}</p>
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
          <SiteSearch className="w-full sm:w-[16rem]" />
          <nav aria-label="Main" className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink-muted transition hover:text-accent-dark"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
