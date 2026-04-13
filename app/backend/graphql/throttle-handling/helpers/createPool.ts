export function createPool(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (active >= limit) return;
    const fn = queue.shift();
    if (!fn) return;
    active++;
    fn();
  };

  const schedule = <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const runner = () => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            runNext();
          });
      };
      queue.push(runner);
      runNext();
    });

  return { schedule };
}
