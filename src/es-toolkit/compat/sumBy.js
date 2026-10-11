export default function sumBy(array, iteratee) {
  if (!Array.isArray(array)) return 0;
  const fn = typeof iteratee === 'function' ? iteratee : item => item?.[iteratee];
  return array.reduce((sum, item) => sum + (Number(fn(item)) || 0), 0);
}
