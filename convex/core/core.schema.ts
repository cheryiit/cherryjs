import { defineTable } from "convex/server";
import { v } from "convex/values";

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const auditLogFields = {
  userId: v.optional(v.id("users")),
  action: v.string(),
  resourceType: v.optional(v.string()),
  resourceId: v.optional(v.string()),
  details: v.optional(v.any()),
  severity: v.union(
    v.literal("info"),
    v.literal("warn"),
    v.literal("critical"),
  ),
  userAgent: v.optional(v.string()),
  language: v.optional(v.string()),
  timezone: v.optional(v.string()),
  ip: v.optional(v.string()),
  timestamp: v.number(),
};

// ── Parameters ────────────────────────────────────────────────────────────────

export const parameterFields = {
  domain: v.optional(v.string()),
  key: v.string(),
  value: v.any(),
  description: v.optional(v.string()),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
};

// ── Scheduled Tasks Tracking ──────────────────────────────────────────────────

export const scheduledTaskFields = {
  name: v.string(),
  functionReference: v.string(),
  args: v.optional(v.any()),
  convexScheduleId: v.id("_scheduled_functions"),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("cancelled"),
  ),
  idempotencyKey: v.optional(v.string()),
  scheduledAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
};

// ── Cron Configs ──────────────────────────────────────────────────────────────

export const cronConfigFields = {
  name: v.string(),
  enabled: v.boolean(),
  consecutiveFailures: v.number(),
  maxFailuresBeforeDisable: v.number(),
  lastRunAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
  disabledAt: v.optional(v.number()),
  disabledReason: v.optional(v.string()),
};

// ── Webhook Events ────────────────────────────────────────────────────────────

export const webhookEventFields = {
  provider: v.string(),
  eventType: v.string(),
  externalId: v.string(),
  payload: v.any(),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  attempts: v.number(),
  lastError: v.optional(v.string()),
  receivedAt: v.number(),
  processedAt: v.optional(v.number()),
  ip: v.optional(v.string()),
};

// ── Table Definitions ─────────────────────────────────────────────────────────

export const coreTables = {
  auditLogs: defineTable(auditLogFields)
    .index("by_user", ["userId", "timestamp"])
    .index("by_action", ["action", "timestamp"])
    .index("by_severity", ["severity", "timestamp"])
    .index("by_resource", ["resourceType", "resourceId"]),

  parameters: defineTable(parameterFields)
    .index("by_domain_key", ["domain", "key"])
    .index("by_key", ["key"]),

  scheduledTasks: defineTable(scheduledTaskFields)
    .index("by_status", ["status"])
    .index("by_name", ["name", "status"])
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_convex_schedule", ["convexScheduleId"]),

  cronConfigs: defineTable(cronConfigFields)
    .index("by_name", ["name"])
    .index("by_enabled", ["enabled"]),

  webhookEvents: defineTable(webhookEventFields)
    .index("by_provider_external", ["provider", "externalId"])
    .index("by_status", ["status", "receivedAt"])
    .index("by_provider_type", ["provider", "eventType", "receivedAt"]),

  // Migrations tracking (used by convex-helpers/server/migrations)
  migrations: defineTable({
    name: v.string(),
    cursor: v.optional(v.any()),
    isDone: v.boolean(),
    workerId: v.optional(v.string()),
    latestStart: v.optional(v.number()),
    latestEnd: v.optional(v.number()),
    processed: v.optional(v.number()),
    next: v.optional(v.any()),
    dryRun: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }).index("by_name", ["name"]),
};
