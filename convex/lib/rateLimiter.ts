import { RateLimiter, MINUTE, HOUR, SECOND } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export { SECOND, MINUTE, HOUR } from "@convex-dev/rate-limiter";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // ── General Mutation Tiers ──────────────────────────────────────────────────

  // STRICT: Critical ops — payment, order, account changes (5 req/min/user)
  strict: {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },

  // NORMAL: Standard CRUD (30 req/min/user)
  normal: {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },

  // RELAXED: Low-risk reads/updates (100 req/min/user)
  relaxed: {
    kind: "fixed window",
    rate: 100,
    period: MINUTE,
  },

  // BURST: Token bucket for bulk ops — max 20 burst, 2/sec refill
  burst: {
    kind: "token bucket",
    rate: 2,
    capacity: 20,
    period: SECOND,
  },

  // ── Domain-Specific Tiers ──────────────────────────────────────────────────

  // AUTH: Login/register/password reset (10 req/15min/IP)
  "auth-ops": {
    kind: "fixed window",
    rate: 10,
    period: 15 * MINUTE,
  },

  // SEARCH: Search operations (60 req/min/user)
  "search-ops": {
    kind: "fixed window",
    rate: 60,
    period: MINUTE,
  },

  // FILE-UPLOAD: Storage upload URL generation (10 req/min/user)
  "file-upload": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },

  // ADMIN: Admin panel operations (200 req/min/admin)
  "admin-ops": {
    kind: "fixed window",
    rate: 200,
    period: MINUTE,
  },

  // WEBHOOK: Webhook ingest (500 req/min/IP)
  "webhook-ingest": {
    kind: "fixed window",
    rate: 500,
    period: MINUTE,
  },
});
