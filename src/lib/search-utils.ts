export function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function termsFrom(q: string): string[] {
  const t = norm(q);
  return t ? t.split(/\s+/).filter(Boolean) : [];
}

export function includesAll(haystack: string, needles: string[]): boolean {
  const h = norm(haystack);
  return needles.every((n) => h.includes(n));
}
