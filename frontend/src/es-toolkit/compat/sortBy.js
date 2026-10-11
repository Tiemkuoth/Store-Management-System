export default function sortBy(collection, ...iteratees) {
  if (!Array.isArray(collection)) return [];
  const fns = iteratees.flat().map(it => (typeof it === 'function' ? it : item => item?.[it]));
  return [...collection].sort((a, b) => {
    for (const fn of fns) {
      const valA = fn(a);
      const valB = fn(b);
      if (valA < valB) return -1;
      if (valA > valB) return 1;
    }
    return 0;
  });
}
