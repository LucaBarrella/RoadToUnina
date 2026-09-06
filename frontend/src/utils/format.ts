/**
 * Formats a duration in seconds into a standard MM:SS string representation.
 *
 * @param totalSeconds - Non-negative integer count of elapsed seconds.
 * @returns Standardized "MM:SS" time string (e.g. "01:42").
 *
 * @example
 * ```typescript
 * formatSeconds(102); // returns "01:42"
 * ```
 */
export function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
