// How a day is printed in lists and tables: "Oct 1, 2026". Short enough for a column and
// unambiguous in any locale (10/01/2026 is January 10th elsewhere). Detail pages spell the
// month out ("October 1, 2026"; people.js formatDate).

const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "2026-10-01" (or an ISO timestamp) → "Oct 1, 2026"; anything else is returned as it is. */
export function shortDate(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return m ? SHORT.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) : String(value);
}
