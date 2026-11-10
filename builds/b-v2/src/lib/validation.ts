import { z } from 'zod';

/**
 * Client-side validation mirrors the database constraints so users get instant
 * feedback. It is NOT a security boundary: the database re-checks everything.
 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f​-‏‪-‮⁠-⁩﻿]/;
const MULTILINE_BAD = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮]/;
const RESERVED_NAME = /\b(admin|administrator|moderator|staff|support|official|curio)\b/i;

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'At least 2 characters.')
  .max(40, 'At most 40 characters.')
  .refine((v) => !CONTROL_CHARS.test(v), 'Contains characters that aren’t allowed.')
  .refine((v) => !RESERVED_NAME.test(v), 'That name is reserved. Please choose another.');

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')).pipe(z.string().max(254));

// bcrypt (used by Supabase Auth) only considers the first 72 bytes.
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(72, 'Use at most 72 characters.')
  .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), 'Include at least one letter and one number.');

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw) || /password|qwerty|123456|letmein|curio/i.test(pw)) score = Math.min(score, 1);
  const s = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: s, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s]! };
}

export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'At least 3 characters.')
    .max(100, 'At most 100 characters.')
    .refine((v) => !CONTROL_CHARS.test(v), 'Contains characters that aren’t allowed.'),
  description: z
    .string()
    .trim()
    .min(10, 'Tell buyers a bit more (at least 10 characters).')
    .max(5000, 'At most 5,000 characters.')
    .refine((v) => !MULTILINE_BAD.test(v), 'Contains characters that aren’t allowed.'),
  price_cents: z
    .number({ error: 'Enter a price like 25 or 24.99.' })
    .int()
    .min(100, 'Minimum price is $1.00.')
    .max(10_000_000, 'Maximum price is $100,000.'),
  category: z.string().min(1, 'Choose a category.'),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']),
  location: z
    .string()
    .trim()
    .max(80, 'At most 80 characters.')
    .refine((v) => !CONTROL_CHARS.test(v), 'Contains characters that aren’t allowed.'),
});

export const profileSchema = z.object({
  display_name: displayNameSchema,
  location: z.string().trim().max(80, 'At most 80 characters.').refine((v) => !CONTROL_CHARS.test(v), 'Invalid characters.'),
  bio: z.string().trim().max(500, 'At most 500 characters.').refine((v) => !MULTILINE_BAD.test(v), 'Invalid characters.'),
});

export const shippingSchema = z.object({
  name: z.string().trim().min(2, 'Enter the recipient’s name.').max(100),
  line1: z.string().trim().min(3, 'Enter a street address.').max(200),
  line2: z.string().trim().max(200),
  city: z.string().trim().min(2, 'Enter a city.').max(100),
  region: z.string().trim().max(100),
  postal_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9 -]{1,10}$/, 'Enter a valid postal code.'),
  country: z.string().regex(/^[A-Z]{2}$/, 'Choose a country.'),
});
export type Shipping = z.infer<typeof shippingSchema>;

/** Collect zod issues into a { field: message } map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const MESSAGE_MAX = 2000;
export const totpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.');
