import db from "../../../lib/db/src/index.js";
import { eq } from "drizzle-orm";
import { sources } from "../../../lib/db/src/schema/sources.js";
import { channels } from "../../../lib/db/src/schema/channels.js";
import { videoQueue } from "../../../lib/db/src/schema/video-queue.js";

async function main() {
  const [ch] = await db.select().from(channels).where(eq(channels.channelName, "Just_a_housewife79"));
  if (!ch) { console.log("Channel not found"); return; }
  console.log("Channel:", JSON.stringify({ id: ch.id, name: ch.channelName, authStatus: ch.authStatus }, null, 2));

  const [src] = await db.select().from(sources).where(eq(sources.linkedChannelId, ch.id));
  if (!src) { console.log("Source not found"); return; }
  console.log("Source filter:", JSON.stringify(src.contentFilter));
  console.log("Source status:", src.status);
  console.log("Source accountHandle:", src.accountHandle);

  const queue = await db.select({ id: videoQueue.id, title: videoQueue.title, status: videoQueue.status, sourceVideoId: videoQueue.sourceVideoId })
    .from(videoQueue).where(eq(videoQueue.sourceId, src.id)).orderBy(videoQueue.createdAt).limit(20);
  console.log("Queue:", queue.length, "items");
  queue.forEach((q: any) => console.log(JSON.stringify(q)));
}
main().catch(console.error);
