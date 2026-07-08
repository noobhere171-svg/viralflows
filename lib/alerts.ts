import { eq } from "drizzle-orm";
import { getErrorMessage } from "./errors.js";

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const MAX_RETRIES_BEFORE_DEAD_LETTER = Number(process.env.MAX_RETRIES_BEFORE_DEAD_LETTER ?? 5);

export async function sendAlert(context: string, err: unknown) {
  const message = `[ViralFlows Alert] ${context}: ${getErrorMessage(err)}`;
  console.error(`[Alert] ${message}`);

  if (!ALERT_WEBHOOK_URL) return;

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message.slice(0, 1900) }),
    });
  } catch (webhookErr) {
    console.error(`[Alert] Webhook delivery failed: ${getErrorMessage(webhookErr)}`);
  }
}

export async function handleQueueItemFailure(
  db: any,
  videoQueueTable: any,
  queueItemId: string,
  currentRetryCount: number,
  err: unknown,
  context: string
) {
  const nextRetryCount = (currentRetryCount ?? 0) + 1;
  const errorMessage = getErrorMessage(err);
  const isDead = nextRetryCount >= MAX_RETRIES_BEFORE_DEAD_LETTER;

  // Duplicate key constraint = same video already uploaded to this channel → cancel, don't retry
  const isDuplicateKey = errorMessage?.includes("duplicate key value violates unique constraint");

  await db
    .update(videoQueueTable)
    .set({
      status: isDuplicateKey ? "cancelled" : isDead ? "dead_letter" : "failed",
      retryCount: nextRetryCount,
      errorMessage: errorMessage,
    })
    .where(eq(videoQueueTable.id, queueItemId));

  if (isDuplicateKey) {
    console.log(`[Alert] Item ${queueItemId} cancelled: duplicate already uploaded (${context})`);
    return;
  }

  if (isDead) {
    await sendAlert(
      `Item ${queueItemId} dead-lettered after ${nextRetryCount} attempts (${context})`,
      err
    );
  }
}
