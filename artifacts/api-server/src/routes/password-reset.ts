import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { passwordResetTokens } from "../../../../lib/db/src/schema/password-reset-tokens.js";
import { eq, and, isNull, sql } from "drizzle-orm";

const router = Router();
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (!user) {
      return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(token, salt);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    const html = `
      <div style="font-family:Arial;max-width:480px;margin:0 auto;padding:24px;background:#0f0f0f;border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <span style="font-size:24px;font-weight:700;color:#fff">ViralFlows</span>
        </div>
        <div style="background:#1a1a1a;border-radius:8px;padding:24px;border:1px solid #2a2a2a">
          <h2 style="color:#fff;margin:0 0 8px;font-size:18px">Reset Your Password</h2>
          <p style="color:#a1a1aa;font-size:14px;line-height:1.5;margin:0 0 20px">
            Click the button below to reset your password. This link expires in 30 minutes.
          </p>
          <a href="${resetLink}"
             style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;
                    padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600">
            Reset Password
          </a>
          <p style="color:#52525b;font-size:12px;margin-top:20px">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    if (RESEND_API_KEY) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: user.email,
          subject: "Reset your ViralFlows password",
          html,
        }),
      });
      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        console.error("[PasswordReset] Resend error:", resendRes.status, errBody);
      }
    } else {
      console.log("[PasswordReset] No RESEND_API_KEY configured. Reset link:", resetLink);
    }

    res.json({ message: "If an account with that email exists, a password reset link has been sent." });
  } catch (err: any) {
    console.error("[PasswordReset] forgot-password error:", err.message);
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const now = new Date();
    const tokens = await db.select().from(passwordResetTokens)
      .where(and(
        isNull(passwordResetTokens.usedAt),
        sql`${passwordResetTokens.expiresAt} > ${now}`,
      ));

    let matchedToken: typeof passwordResetTokens.$inferSelect | null = null;
    for (const t of tokens) {
      const isValid = await bcrypt.compare(token, t.tokenHash);
      if (isValid) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await db.update(users).set({
      passwordHash,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: now,
    }).where(eq(users.id, matchedToken.userId));

    await db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, matchedToken.id));

    res.json({ message: "Password has been reset successfully. You can now login with your new password." });
  } catch (err: any) {
    console.error("[PasswordReset] reset-password error:", err.message);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
