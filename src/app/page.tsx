import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {siteConfig.tagline}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-muted">
          A lightweight hub for utilities, trusted vendors, local services, and links to public
          property context. Built to grow from a single neighborhood to many—without rewriting
          your stack.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/residents"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark"
          >
            Resident resources
          </Link>
          <Link
            href="/property"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-slate-300"
          >
            Property &amp; values
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {[
          {
            title: "Low-cost hosting",
            body: "Static pages + a small API when you need it. Same React code can ship to the web first, then wrap in Capacitor for app stores.",
          },
          {
            title: "Monetization-ready",
            body: "Clear footer disclosure leaves room for affiliate links and sponsored listings without surprising neighbors.",
          },
          {
            title: "Claim-ready (later)",
            body: "Add auth and per-home notes—serials, warranties, paint colors—after you are happy with public content.",
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold text-ink">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{card.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
