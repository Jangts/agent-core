/**
 * Small string helpers used for prompt accounting.
 *
 * Exports: `commonPrefixLength`.
 */
/**
 * Length of the longest common prefix of two strings.
 *
 * Implemented as a binary search over slice comparisons so long prompts stay on the
 * native string comparison path instead of running a JavaScript character loop.
 *
 * @param left - First string.
 * @param right - Second string.
 * @returns Number of leading characters both strings share, bounded by the shorter length.
 */
export function commonPrefixLength(left: string, right: string): number {
  let low = 0;
  let high = Math.min(left.length, right.length);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (left.slice(0, mid) === right.slice(0, mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}
