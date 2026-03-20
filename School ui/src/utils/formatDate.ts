/**
 * Formats a date value into a human-readable string.
 * @example formatDate(new Date()) // "March 16, 2026"
 */
export function formatDate(date: Date | string | number, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}
