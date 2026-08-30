export function createReplayableStream<T>(
  source: AsyncIterable<T>,
  onError: (cause: unknown) => void,
): AsyncIterable<T> {
  const buffered: T[] = [];
  const waiters = new Set<() => void>();
  let done = false;
  let streamError: unknown;
  const notify = () => {
    for (const waiter of waiters) waiter();
    waiters.clear();
  };

  void (async () => {
    try {
      for await (const item of source) {
        buffered.push(item);
        notify();
      }
    } catch (cause) {
      streamError = cause;
      onError(cause);
    } finally {
      done = true;
      notify();
    }
  })();

  return {
    async *[Symbol.asyncIterator]() {
      let index = 0;
      while (true) {
        while (index < buffered.length) yield buffered[index++];
        if (done) {
          if (streamError) throw streamError;
          return;
        }
        await new Promise<void>((resolve) => waiters.add(resolve));
      }
    },
  };
}
