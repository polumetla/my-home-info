import type { Metadata } from "next";
import { HomesMapClient } from "./homes-map-client";

export const metadata: Metadata = {
  title: "Homes map",
};

export default function HomesMapPage() {
  return <HomesMapClient />;
}
