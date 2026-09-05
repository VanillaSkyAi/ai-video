/** Bound optional work even when a provider ignores cancellation. */
export function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T> | T,
  timeoutMs: number,
  parent?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const timer = setTimeout(() => finish({ error: new DOMException("Optional work exceeded its deadline", "TimeoutError") }), timeoutMs);
    const finish = (result: { value: T } | { error: unknown }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      parent?.removeEventListener("abort", cancel);
      if ("error" in result) {
        reject(result.error);
        controller.abort(result.error);
      } else {
        resolve(result.value);
        controller.abort();
      }
    };
    const cancel = () => finish({ error: parent?.reason ?? new DOMException("Cancelled", "AbortError") });
    if (parent?.aborted) { cancel(); return; }
    parent?.addEventListener("abort", cancel, { once: true });
    // Observe late rejection even after cancellation wins. Invoke immediately
    // so callers retain synchronous request initiation semantics.
    try {
      const result = operation(controller.signal);
      Promise.resolve(result).then((value) => finish({ value }), (error: unknown) => finish({ error }));
    } catch (error) {
      finish({ error });
    }
  });
}
