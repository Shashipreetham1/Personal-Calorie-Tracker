import { z } from 'zod';

/**
 * Emails are trimmed and lowercased before validation, so `Ada@Example.com `
 * and `ada@example.com` are the same account. The users table has a matching
 * CHECK constraint, so nothing can write a mixed-case address another way.
 */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(255));

/**
 * bcrypt silently ignores anything past 72 bytes, which would make a 100-
 * character password no stronger than its first 72. Rejecting the input is
 * honest; truncating it quietly is not.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately not `passwordSchema`: rejecting a 6-character password at the
  // login endpoint would reveal that the stored password is longer than that.
  password: z.string().min(1, 'Password is required'),
});

/** @typedef {z.infer<typeof signupSchema>} SignupInput */
/** @typedef {z.infer<typeof loginSchema>} LoginInput */
