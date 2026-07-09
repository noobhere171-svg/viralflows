import { Router, Request, Response } from "express";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq } from "drizzle-orm";

const router = Router();

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}

// Clerk webhook — user created/updated
router.post("/clerk", async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (webhookSecret && webhookSecret !== "whsec_placeholder") {
      const { Webhook } = await import("svix");
      const wh = new Webhook(webhookSecret);
      const body = (req as any).rawBody || JSON.stringify(req.body);
      const headers = req.headers as Record<string, string>;
      wh.verify(body, headers);
    }

    const { type, data } = req.body;

    if (type === "user.created") {
      const existing = await db.select().from(users).where(eq(users.clerkId, data.id));
      if (existing.length === 0) {
        await db.insert(users).values({
          clerkId: data.id,
          email: data.email_addresses?.[0]?.email_address || "",
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          avatarUrl: data.image_url,
          authProvider: "google",
        });
      }
    }

    if (type === "user.updated") {
      const [user] = await db.select().from(users).where(eq(users.clerkId, data.id));
      if (user) {
        await db.update(users).set({
          email: data.email_addresses?.[0]?.email_address || user.email,
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || user.name,
          avatarUrl: data.image_url || user.avatarUrl,
        }).where(eq(users.clerkId, data.id));
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Webhook] Clerk error:", err.message);
    res.status(200).json({ success: true });
  }
});

// Stripe webhook — subscription updates
router.post("/stripe", async (req: Request, res: Response) => {
  try {
    const sig = req.headers["stripe-signature"] as string | undefined;
    const stripe = await getStripe();
    let event: any;

    if (stripe && sig && process.env.STRIPE_WEBHOOK_SECRET) {
      const raw = (req as any).rawBody || JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = req.body;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const clerkId = session.client_reference_id;
      if (clerkId) {
        await db.update(users).set({ plan: "pro", stripeCustomerId: session.customer }).where(eq(users.clerkId, clerkId));
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(200).json({ success: true });
  }
});

export default router;
