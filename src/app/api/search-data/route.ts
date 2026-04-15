import { NextResponse } from "next/server";
import { summitAreaSchools } from "@/data/schools";
import { getHomes } from "@/lib/homes.server";
import { getUtilities } from "@/lib/utilities.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { homes } = getHomes();
  const { utilities } = getUtilities();
  return NextResponse.json({ homes, utilities, schools: summitAreaSchools });
}
