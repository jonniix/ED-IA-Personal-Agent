// src/lib/format.js
export function formatDate(d, locale = 'it-CH') {
  if (!d) return '—';
  const dt = (d instanceof Date) ? d : new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString(locale);
}
export const dateFormat = formatDate; // alias
export default formatDate;            // default export
