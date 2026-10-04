/**
 * Shared term matching for the admin searches.
 *
 * Plain substring matching makes numbers useless: searching "unit 5" splits to
 * ["unit", "5"] and "5" is happily found inside "Unit 15", so a search for one
 * home returns a dozen. A number has to sit on its own, while words still match
 * loosely — typing "faucet" should find "faucets" and "Leaky Faucet Top".
 */
export function matchesTerms(haystack: string, terms: string[]): boolean {
  const hay = haystack.toLowerCase();
  return terms.every((raw) => {
    const term = raw.toLowerCase();
    if (!term) return true;
    if (!/^\d+$/.test(term)) return hay.includes(term);
    // A bare number must be a whole number in the text, not part of a longer one.
    return new RegExp(`(^|\\D)${term}(\\D|$)`).test(hay);
  });
}

export const splitTerms = (q: string): string[] =>
  q.trim().toLowerCase().split(/\s+/).filter(Boolean);
