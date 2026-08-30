export function createDeadlineBudget(
  initialBufferSeconds: number,
  now: () => number = Date.now,
): () => number {
  const startedAt = now();
  return () => {
    if (!Number.isFinite(initialBufferSeconds)) return Number.POSITIVE_INFINITY;
    const elapsedSeconds = Math.max(0, now() - startedAt) / 1_000;
    return Math.max(0, initialBufferSeconds - elapsedSeconds);
  };
}
