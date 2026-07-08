import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "viralflows-jwt-secret-dev-only";

function generateToken(user: { id: string; email: string; authProvider: string; tokenVersion?: number }): string {
  return jwt.sign(
    { userId: user.id, email: user.email, authProvider: user.authProvider, tokenVersion: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

// ─── Custom Registration ───
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, whatsappNumber, country, password, confirmPassword } = req.body;

    if (!name || !email || !whatsappNumber || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(whatsappNumber)) {
      return res.status(400).json({ error: "Invalid WhatsApp number. Include country code (e.g. +923001234567)" });
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [newUser] = await db.insert(users).values({
      name,
      email: email.toLowerCase(),
      whatsappNumber,
      country: country || null,
      passwordHash,
      authProvider: "email",
      accountSetupComplete: true,
      emailVerified: false,
    }).returning();

    const token = generateToken(newUser);

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        whatsappNumber: newUser.whatsappNumber,
        country: newUser.country,
        authProvider: newUser.authProvider,
        accountSetupComplete: newUser.accountSetupComplete,
        role: newUser.role,
      },
    });
  } catch (err: any) {
    console.error("[Auth Register]", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ─── Custom Login ───
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.isLocked) {
      return res.status(403).json({ error: "Account is locked. Please contact support." });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: "This account uses Google login. Please sign in with Google." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const newVersion = (user.tokenVersion || 0) + 1;
    await db.update(users).set({ tokenVersion: newVersion }).where(eq(users.id, user.id));

    const token = generateToken({ ...user, tokenVersion: newVersion });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        whatsappNumber: user.whatsappNumber,
        country: user.country,
        authProvider: user.authProvider,
        accountSetupComplete: user.accountSetupComplete,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("[Auth Login]", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── Google OAuth (Clerk Token Exchange) ───
router.post("/google", async (req: Request, res: Response) => {
  try {
    const { clerkToken } = req.body;
    if (!clerkToken) {
      return res.status(400).json({ error: "Clerk token is required" });
    }

    const jwt = await import("jsonwebtoken");
    const crypto = await import("crypto");

    let clerkPayload: any = null;
    try {
      const JWKS_URL = "https://striking-buck-94.clerk.accounts.dev/.well-known/jwks.json";
      const jwksRes = await fetch(JWKS_URL);
      const jwks = await jwksRes.json();
      const header = JSON.parse(Buffer.from(clerkToken.split(".")[0], "base64url").toString());
      const keyEntry = jwks.keys?.find((k: any) => k.kid === header.kid);
      if (keyEntry) {
        const publicKey = crypto.createPublicKey({ key: keyEntry, format: "jwk" });
        clerkPayload = jwt.default.verify(clerkToken, publicKey, { algorithms: ["RS256"] });
      }
    } catch (e: any) {
      console.error("[Auth Google] Clerk JWT verify failed:", e.message);
      return res.status(401).json({ error: "Invalid Google token" });
    }

    if (!clerkPayload?.sub) {
      return res.status(401).json({ error: "Invalid Google token payload" });
    }

    const clerkId = clerkPayload.sub;
    const email = clerkPayload.email || "";
    const name = clerkPayload.name || clerkPayload.given_name || "";
    const avatarUrl = clerkPayload.image_url || clerkPayload.picture || "";

    const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId));

    if (existing) {
      const newVersion = (existing.tokenVersion || 0) + 1;
      await db.update(users).set({ tokenVersion: newVersion }).where(eq(users.id, existing.id));
      const token = generateToken({ ...existing, tokenVersion: newVersion });
      return res.json({
        token,
        user: {
          id: existing.id, name: existing.name, email: existing.email,
          whatsappNumber: existing.whatsappNumber, country: existing.country,
          authProvider: existing.authProvider, accountSetupComplete: existing.accountSetupComplete,
          role: existing.role, plan: existing.plan,
        },
      });
    }

    const [newUser] = await db.insert(users).values({
      clerkId,
      email: email || `${clerkId}@clerk.local`,
      name: name || null,
      avatarUrl: avatarUrl || null,
      authProvider: "google",
      accountSetupComplete: false,
    }).returning();

    const token = generateToken(newUser);
    res.status(201).json({
      token,
      user: {
        id: newUser.id, name: newUser.name, email: newUser.email,
        whatsappNumber: newUser.whatsappNumber, country: newUser.country,
        authProvider: newUser.authProvider, accountSetupComplete: newUser.accountSetupComplete,
        role: newUser.role, plan: newUser.plan,
      },
    });
  } catch (err: any) {
    console.error("[Auth Google]", err.message);
    res.status(500).json({ error: "Google login failed" });
  }
});

// ─── Account Setup (for Google OAuth users) ───
router.post("/account-setup", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, whatsappNumber, country } = req.body;

    if (!name || !whatsappNumber || !country) {
      return res.status(400).json({ error: "Name, WhatsApp number, and country are required" });
    }

    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(whatsappNumber)) {
      return res.status(400).json({ error: "Invalid WhatsApp number. Include country code (e.g. +923001234567)" });
    }

    const [updated] = await db.update(users).set({
      name,
      whatsappNumber,
      country,
      accountSetupComplete: true,
      updatedAt: new Date(),
    }).where(eq(users.id, req.userId!)).returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        whatsappNumber: updated.whatsappNumber,
        country: updated.country,
        authProvider: updated.authProvider,
        accountSetupComplete: updated.accountSetupComplete,
      },
    });
  } catch (err: any) {
    console.error("[Auth Account Setup]", err.message);
    res.status(500).json({ error: "Account setup failed" });
  }
});

// ─── Get Current User ───
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let user;

    if (req.clerkId) {
      const [found] = await db.select().from(users).where(eq(users.clerkId, req.clerkId));
      user = found;
    } else if (req.userId) {
      const [found] = await db.select().from(users).where(eq(users.id, req.userId));
      user = found;
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        whatsappNumber: user.whatsappNumber,
        country: user.country,
        authProvider: user.authProvider,
        accountSetupComplete: user.accountSetupComplete,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("[Auth Me]", err.message);
    res.status(500).json({ error: "Failed to get user" });
  }
});

export default router;
