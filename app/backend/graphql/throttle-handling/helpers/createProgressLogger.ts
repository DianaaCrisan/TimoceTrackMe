export function createProgressLogger(label: string, total: number) {
  let started = 0;
  let finished = 0;

  const logStart = (key: string, idx: number) => {
    const inFlight = started - finished;
    const remainingApprox = total - started;
    console.log(
      `[${label}] ▶ START ${idx}/${total} | key=${key} | in-flight=${inFlight} | remaining≈${remainingApprox}`
    );
  };

  const logDone = (key: string, doneCount: number) => {
    const inFlight = started - finished;
    const remaining = total - doneCount;
    console.log(
      `[${label}] ✓ DONE  ${doneCount}/${total} | key=${key} | in-flight=${inFlight} | left=${remaining}`
    );
  };

  async function track<T>(key: string, task: () => Promise<T>): Promise<T> {
    const idx = ++started;
    logStart(key, idx);
    try {
      return await task();
    } finally {
      const done = ++finished;
      logDone(key, done);
    }
  }

  return { track };
}