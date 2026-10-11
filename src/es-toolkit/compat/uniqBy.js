export default function uniqBy(array, iteratee) {
  if (!Array.isArray(array)) return [];
  const fn = typeof iteratee === 'function' ? iteratee : item => item?.[iteratee];
  const seen = new Set();
  const result = [];
  for (const item of array) {
    const val = fn(item);
    if (!seen.has(val)) {
      seen.add(val);
      result.push(item);
    }
  }
  return result;
}
