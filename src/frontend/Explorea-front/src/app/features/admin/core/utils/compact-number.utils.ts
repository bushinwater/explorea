/**
 * Formats a number in a compact form with a "+" suffix once it crosses
 * the next magnitude threshold (e.g. 1234 -> "1k+", 1_500_000 -> "1M+").
 * Numbers under 1000 are shown as-is without the "+" suffix.
 */
export function formatCompactCount(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0';
  const n = Math.floor(value);
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k+`;
  if (n < 1_000_000_000) return `${Math.floor(n / 1_000_000)}M+`;
  return `${Math.floor(n / 1_000_000_000)}B+`;
}
