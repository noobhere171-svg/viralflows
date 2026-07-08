import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: string;
  sessionId?: string;
  clerkId?: string;
  role?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "viralflows-jwt-secret-dev-only";

let cachedKey: crypto.KeyObject | null = null;

function getPublicKey(): crypto.KeyObject | null {
  const raw = process.env.CLERK_JWKS_PUBLIC_KEY;
  if (!raw) return null;
  try {
    if (cachedKey) return cachedKey;
    const pem = raw.replace(/\\n/g, "\n");
    cachedKey = crypto.createPublicKey(pem);
    return cachedKey;
  } catch {
    return null;
  }
}

function getClerkIssuer(): string {
  return process.env.CLERK_FRONTEND_API || "https://striking-buck-94.clerk.accounts.dev";
}

async function findOrCreateUser(clerkId: string): Promise<string | null> {
  try {
    const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId));
    if (existing) return existing.id;

    const [created] = await db.insert(users).values({ clerkId, email: "", authProvider: "google" }).returning();
    return created.id;
  } catch (err: any) {
    console.error("[Auth] DB lookup failed:", err.message);
    return null;
  }
}

async function tryClerkJWT(token: string, req: AuthRequest): Promise<boolean> {
  const publicKey = getPublicKey();
  if (!publicKey) return false;

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: getClerkIssuer(),
    }) as jwt.JwtPayload;

    req.clerkId = decoded.sub;
    req.sessionId = decoded.sid as string | undefined;

    if (req.clerkId) {
      const userId = await findOrCreateUser(req.clerkId);
      if (userId) req.userId = userId;
    }

    return true;
  } catch {
    return false;
  }
}

function tryCustomJWT(token: string, req: AuthRequest): { valid: boolean; tokenVersion?: number } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;

    req.userId = decoded.userId;
    return { valid: true, tokenVersion: decoded.tokenVersion };
  } catch {
    return { valid: false };
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  // Try Clerk JWT first, then Custom JWT
  const isClerk = await tryClerkJWT(token, req);
  if (!isClerk) {
    const { valid, tokenVersion } = tryCustomJWT(token, req);
    if (!valid) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    if (req.userId && tokenVersion !== undefined) {
      try {
        const [user] = await db.select({ tokenVersion: users.tokenVersion }).from(users).where(eq(users.id, req.userId));
        if (user && user.tokenVersion !== tokenVersion) {
          return res.status(401).json({ error: "Session expired. Please login again." });
        }
      } catch {}
    }
  }

  // Fetch role from DB
  if (req.userId) {
    try {
      const [user] = await db.select({ role: users.role, isLocked: users.isLocked }).from(users).where(eq(users.id, req.userId));
      if (user) {
        req.role = user.role || "user";
        if (user.isLocked) {
          return res.status(403).json({ error: "Account is locked. Please contact support." });
        }
      }
    } catch {}
  }

  next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  // requireAuth must run first
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const isClerk = await tryClerkJWT(token, req);
    if (!isClerk) {
      tryCustomJWT(token, req);
    }
  }
  next();
}
