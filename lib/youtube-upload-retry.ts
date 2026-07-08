import { getErrorMessage } from "./errors.js";

const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000];
const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNABORTED"]);
const TRANSIENT_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

function isTransient(err: unknown): boolean {
  const e = err as any;
  if (e?.code && TRANSIENT_CODES.has(e.code)) return true;
  if (e?.message && /aborted/i.test(e.message)) return true;
  const status = e?.response?.status ?? e?.status;
  if (status && TRANSIENT_HTTP_STATUS.has(status)) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface UploadAttemptOptions<T> {
  attempt: () => Promise<T>;
  onRetry?: (attemptNumber: number, waitMs: number, err: unknown) => void;
  context?: string;
}

export async function withYoutubeUploadRetry<T>({
  attempt,
  onRetry,
  context = "",
}: UploadAttemptOptions<T>): Promise<T> {
  let lastErr: unknown;

  for (let i = 0; i <= BACKOFF_MS.length; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      const isLastAttempt = i === BACKOFF_MS.length;

      if (!isTransient(err) || isLastAttempt) {
        console.error(
          `[YouTube Upload] ${context} failed after ${i + 1} attempt(s): ${getErrorMessage(err)}`
        );
        throw err;
      }

      const waitMs = BACKOFF_MS[i];
      console.warn(
        `[YouTube Upload] ${context} attempt ${i + 1} failed (${getErrorMessage(err)}), retrying in ${waitMs / 1000}s...`
      );
      onRetry?.(i + 1, waitMs, err);
      await sleep(waitMs);
    }
  }

  throw lastErr;
}
