import pino from "pino";

// Structured JSON logs. Secrets are redacted by path in case they ever reach a log call.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "contestx" },
  redact: {
    paths: ["password", "passwordHash", "*.password", "*.passwordHash", "token", "*.token", "auth", "*.auth", "p256dh", "*.p256dh", "headers.authorization"],
    censor: "[redacted]",
  },
});
