import Link from "next/link";

export default function HomeNotFound() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">Home not found</h1>
      <p className="text-ink-muted">That address is not in this community list.</p>
      <Link href="/homes" className="font-medium text-accent-dark underline hover:underline">
        Back to homes
      </Link>
    </div>
  );
}
