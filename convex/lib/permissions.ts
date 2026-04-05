export const Role = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  // User management
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_BAN: "user:ban",

  // Admin
  ADMIN_DASHBOARD: "admin:dashboard",
  ADMIN_MANAGE_USERS: "admin:manage_users",
  ADMIN_MANAGE_PARAMS: "admin:manage_params",
  ADMIN_VIEW_AUDIT: "admin:view_audit",
  ADMIN_MANAGE_CRONS: "admin:manage_crons",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.USER]: [Permission.USER_READ, Permission.USER_UPDATE],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canPerform(
  user: { role: Role },
  permission: Permission,
): boolean {
  return hasPermission(user.role, permission);
}

export function assertPermission(
  user: { role: Role },
  permission: Permission,
): void {
  if (!canPerform(user, permission)) {
    throw new Error(`Permission denied: ${permission}`); // cherry:allow
  }
}
