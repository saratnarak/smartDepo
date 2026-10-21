/**
 * Roles an owner may assign through staff management. PLATFORM_ADMIN and OWNER are deliberately
 * excluded: platform admins are created by the platform, and a depot has exactly one owner.
 */
export const STAFF_ROLES = ['SALES', 'STOCK_KEEPER', 'DELIVERY'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}
