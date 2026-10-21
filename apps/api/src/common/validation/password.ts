/**
 * Shared password rules. Every DTO that accepts a new password imports these values so staff
 * creation, password reset, and self-service password change cannot drift apart.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** At least one letter and one number. bcrypt only uses the first 72 bytes, hence the maximum. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_PATTERN_MESSAGE = 'password must contain at least one letter and one number';
