export function randomBelow(max: number) {
  const limit = Math.floor(0x100000000 / max) * max;
  const a = new Uint32Array(1);
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= limit);
  return a[0] % max;
}
// Rejection sampling gives every valid derangement the same probability.
export function draw(count: number): number[] {
  if (!Number.isInteger(count) || count < 2 || count > 100)
    throw new Error("Invalid participant count");
  for (;;) {
    const targets = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = randomBelow(i + 1);
      [targets[i], targets[j]] = [targets[j], targets[i]];
    }
    if (targets.every((target, i) => target !== i)) return targets;
  }
}
