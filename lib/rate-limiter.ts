type QueuedTask<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

class TokenBucketLimiter {
  private queue: QueuedTask<any>[] = [];
  private running = false;
  private lastRunAt = 0;

  constructor(private minIntervalMs: number) {}

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.drain();
    });
  }

  private async drain() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const elapsed = Date.now() - this.lastRunAt;
      const wait = Math.max(0, this.minIntervalMs - elapsed);
      if (wait > 0) await sleep(wait);

      const task = this.queue.shift()!;
      this.lastRunAt = Date.now();

      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      }

      await sleep(jitter(150, 400));
    }

    this.running = false;
  }

  get pending() {
    return this.queue.length;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(min: number, max: number) {
  return min + Math.random() * (max - min);
}

const MIN_INTERVAL_MS = Number(process.env.TIKWM_MIN_INTERVAL_MS ?? 5000);

export const tikwmLimiter = new TokenBucketLimiter(MIN_INTERVAL_MS);

export function withTikwmRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return tikwmLimiter.schedule(fn);
}

const TIKWM_MAX_RETRIES = Number(process.env.TIKWM_MAX_RETRIES ?? 10);

const REAL_ERROR_PATTERNS = [
  "not found", "private", "banned", "does not exist",
  "inactive", "removed", "user not found", "account",
  "no such user", "invalid user", "could not find",
  "unique_id is invalid", "unique_id",
  "unable to extract secondary user id",
];

export function isRealTikError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return REAL_ERROR_PATTERNS.some(p => lower.includes(p));
}

export async function withTikwmRetry<T>(fn: () => Promise<T>, options?: { maxRetries?: number }): Promise<T> {
  const maxRetries = options?.maxRetries ?? TIKWM_MAX_RETRIES;
  let lastErr: any;
  let delay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await tikwmLimiter.schedule(fn);
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || "";
      if (isRealTikError(msg)) {
        throw err;
      }
      if (attempt >= maxRetries) break;
      const jittered = delay + Math.random() * 1000;
      console.warn(`[TikWM] Attempt ${attempt}/${maxRetries} failed (${err.message}), retrying in ${Math.round(jittered)}ms...`);
      await sleep(jittered);
      delay = Math.min(delay * 2, 180_000);
    }
  }
  throw lastErr;
}
