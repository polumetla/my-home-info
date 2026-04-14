import type { Metadata } from "next";
import { HomesTable } from "@/components/homes-table";
import { getHomes } from "@/lib/homes";

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
      <HomesTable homes={homes} />
    </div>
  );
}
