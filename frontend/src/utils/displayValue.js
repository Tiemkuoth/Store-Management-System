export function sanitizeText(value, fallback = 'Not available') {
  if (value === null || value === undefined) return fallback;
  const text = `${value}`.trim();
  return text ? text : fallback;
}

export function sanitizeNumber(value, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return numericValue < 0 ? fallback : numericValue;
}

export function formatDisplayDate(value, fallback = 'Date not available') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
