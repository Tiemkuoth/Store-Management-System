export default function range(start, stop, step) {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }
  if (step === undefined) {
    step = start < stop ? 1 : -1;
  }
  const result = [];
  if (step > 0) {
    for (let i = start; i < stop; i += step) result.push(i);
  } else if (step < 0) {
    for (let i = start; i > stop; i += step) result.push(i);
  }
  return result;
}
