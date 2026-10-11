export default function omit(object, keys) {
  if (object == null) return {};
  const omitKeys = new Set(Array.isArray(keys) ? keys.flat() : [keys]);
  const result = {};
  for (const key of Object.keys(object)) {
    if (!omitKeys.has(key)) {
      result[key] = object[key];
    }
  }
  return result;
}
