import { redirect } from "next/navigation";

/** Old /search links redirect to home with ?q= so the overlay can open without leaving the site shell. */
export default async function SearchRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const q = Array.isArray(raw) ? raw[0] : raw ?? "";
  const trimmed = q.trim();
  if (trimmed) redirect(`/?q=${encodeURIComponent(trimmed)}`);
  redirect("/");
}
