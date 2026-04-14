import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-ink-muted">
        <p className="max-w-2xl leading-relaxed">{siteConfig.affiliateNotice}</p>
        <p className="mt-4 text-xs text-slate-500">
          Information may be unofficial or sourced from public records—verify with providers and
          officials.
        </p>
      </div>
    </footer>
  );
}
