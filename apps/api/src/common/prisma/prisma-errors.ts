/**
 * Prisma error helpers shared by services that create users (staff, registration).
 */

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}
