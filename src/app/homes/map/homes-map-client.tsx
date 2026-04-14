"use client";

import dynamic from "next/dynamic";

const HomesMap = dynamic(() => import("@/components/homes-map"), {
  ssr: false,
  loading: () => <div className="min-h-[50vh] bg-surface-muted" aria-hidden />,
});

export function HomesMapClient() {
  return <HomesMap />;
}

