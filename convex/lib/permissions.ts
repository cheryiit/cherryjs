/**
 * Role-Based Access Control (RBAC).
 *
 * Central authority for "who can do what". Every permission check in the
 * entire backend flows through `canPerform()` or `assertPermission()`.
 *
 * ## Adding a new role
 * 1. Add to `Role` const + `users.schema.ts` role union (both must
 *    stay in sync — enforced by admin-security arch test).
 * 2. Add its row in `ROLE_PERMISSIONS`.
 * 3. Run `npm run test:arch`.
 *
 * ## Adding a new permission
 * 1. Add to `Permission` const (use `domain:action` naming).
 * 2. Assign to the correct role(s) in `ROLE_PERMISSIONS`.
 * 3. Guard the channel handler with `assertPermission(ctx.user, Permission.X)`.
 */

// ── Roles ────────────────────────────────────────────────────────────────────

export const Role = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ── Permissions ──────────────────────────────────────────────────────────────
//
// Naming convention: `domain:action`
//   domain = the business area (user, payment, content, notification, system)
//   action = the verb (read, create, update, delete, manage, view)

export const Permission = {
  // User management
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_BAN: "user:ban",
  USER_INVITE: "user:invite",

  // Payment / billing
  PAYMENT_VIEW: "payment:view",
  PAYMENT_MANAGE: "payment:manage",
  PAYMENT_REFUND: "payment:refund",

  // Content CMS
  CONTENT_READ: "content:read",
  CONTENT_CREATE: "content:create",
  CONTENT_UPDATE: "content:update",
  CONTENT_DELETE: "content:delete",
  CONTENT_PUBLISH: "content:publish",

  // Notifications
  NOTIFICATION_SEND: "notification:send",
  NOTIFICATION_BROADCAST: "notification:broadcast",

  // System / admin
  ADMIN_DASHBOARD: "admin:dashboard",
  ADMIN_MANAGE_USERS: "admin:manage_users",
  ADMIN_MANAGE_PARAMS: "admin:manage_params",
  ADMIN_VIEW_AUDIT: "admin:view_audit",
  ADMIN_MANAGE_CRONS: "admin:manage_crons",
  ADMIN_MANAGE_ROLES: "admin:manage_roles",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// ── Role → Permissions matrix ────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Admin has ALL permissions by default.
  [Role.ADMIN]: Object.values(Permission),

  // Regular user has a minimal set.
  [Role.USER]: [
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.PAYMENT_VIEW,
    Permission.CONTENT_READ,
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Check if a role has a specific permission. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Check if a user object (with `.role`) can perform an action. */
export function canPerform(
  user: { role: Role },
  permission: Permission,
): boolean {
  return hasPermission(user.role, permission);
}

/** Check if a user has ANY of the listed permissions. */
export function hasAnyPermission(
  user: { role: Role },
  permissions: Permission[],
): boolean {
  return permissions.some((p) => canPerform(user, p));
}

/** Check if a user has ALL of the listed permissions. */
export function hasAllPermissions(
  user: { role: Role },
  permissions: Permission[],
): boolean {
  return permissions.every((p) => canPerform(user, p));
}

/**
 * Assert that a user has a permission, throw if not.
 *
 * Use `errors.forbidden()` from `lib/errors.ts` instead if you want a
 * typed ConvexError (recommended in business layer). This helper is for
 * quick checks in channel handlers where you already have auth context.
 */
export function assertPermission(
  user: { role: Role },
  permission: Permission,
): void {
  if (!canPerform(user, permission)) {
    throw new Error(`Permission denied: ${permission}`); // cherry:allow
  }
}

/** Get all permissions for a role (useful for admin UI display). */
export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** List all defined roles. */
export function getAllRoles(): Role[] {
  return Object.values(Role);
}

/** List all defined permissions. */
export function getAllPermissions(): Permission[] {
  return Object.values(Permission);
}
