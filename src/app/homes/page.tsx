import type { Metadata } from "next";
import { Suspense } from "react";
import { HomesTable } from "@/components/homes-table";
import { getHomes } from "@/lib/homes.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Homes",
};

export default function HomesPage() {
  const { homes } = getHomes();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Homes</h1>
      </header>
      <Suspense
        fallback={
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-ink-muted">
            Loading table…
          </div>
        }
      >
        <HomesTable homes={homes} />
      </Suspense>
    </div>
  );
}
