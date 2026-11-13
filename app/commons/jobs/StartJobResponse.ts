export type StartJobResponse =
  | { ok: true; jobId: string; orderCount: number }
  | { ok: false; error: string };
