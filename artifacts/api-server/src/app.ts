import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

// Routes
import authRoutes from "./routes/auth.js";
import authCustomRoutes from "./routes/auth-custom.js";
import passwordResetRoutes from "./routes/password-reset.js";
import channelRoutes from "./routes/channels.js";
import queueRoutes from "./routes/queue.js";
import sourceRoutes from "./routes/sources.js";
import analyticsRoutes from "./routes/analytics.js";
import scheduleRoutes from "./routes/schedule.js";
import manageRoutes from "./routes/manage.js";
import operationRoutes from "./routes/operations.js";
import workspaceRoutes from "./routes/workspaces.js";
import proxyRoutes from "./routes/proxies.js";
import accountRoutes from "./routes/account.js";
import billingRoutes from "./routes/billing.js";
import referralRoutes from "./routes/referrals.js";
import notificationRoutes from "./routes/notifications.js";
import notificationPreferenceRoutes from "./routes/notification-preferences.js";
import supportRoutes from "./routes/support.js";
import healthRoutes from "./routes/health.js";
import webhookRoutes from "./routes/webhooks.js";
import discoverRoutes from "./routes/discover.js";
import adminRoutes from "./routes/admin.js";

const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Public routes
app.use("/api/health", healthRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/auth", passwordResetRoutes);

// Protected routes — naye custom auth routes pehle, phir purane (sirf /me, /logout)
app.use("/api/auth", authCustomRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/sources", sourceRoutes);
app.use("/api/discover", discoverRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/manage", manageRoutes);
app.use("/api/operations", operationRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/proxies", proxyRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notification-preferences", notificationPreferenceRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/admin", adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Error]", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;
