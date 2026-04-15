"use client";

import type { HomeRecord } from "@/lib/homes";
import dynamic from "next/dynamic";

const HomesMap = dynamic(() => import("@/components/homes-map"), {
  ssr: false,
  loading: () => <div className="min-h-[50vh] bg-surface-muted" aria-hidden />,
});

export function HomesMapClient({ homes }: { homes: HomeRecord[] }) {
  return <HomesMap homes={homes} />;
}

