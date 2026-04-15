import type { Metadata } from "next";
import { getHomes } from "@/lib/homes.server";
import { HomesMapClient } from "./homes-map-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Homes map",
};

export default function HomesMapPage() {
  const { homes } = getHomes();
  return <HomesMapClient homes={homes} />;
}
