import { z } from 'zod';
import { CONNECTION_INTENTS, EXPERIENCE_TAGS, PRESENCE_STATUSES, RELATIONSHIP_STATUSES } from './membership';

const relationshipStatus = z.enum(RELATIONSHIP_STATUSES);
const connectionIntent = z.enum(CONNECTION_INTENTS);
const experienceTag = z.enum(EXPERIENCE_TAGS);

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  relationship_status: relationshipStatus,
  connection_intents: z.array(connectionIntent).min(1).max(CONNECTION_INTENTS.length),
  experience_tags: z.array(experienceTag).max(EXPERIENCE_TAGS.length).default([]),
  city: z.string().trim().max(100).default(''),
  region: z.string().trim().max(100).default(''),
  age_18_plus: z.literal(true, { errorMap: () => ({ message: 'You must confirm that you are 18 or older' }) }),
  recovery_one_year: z.literal(true, { errorMap: () => ({ message: 'MySazz currently requires at least one year of self-attested recovery progress' }) }),
  member_confidentiality: z.literal(true, { errorMap: () => ({ message: 'You must agree to protect member privacy and confidentiality' }) }),
  terms_accepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Service' }) }),
  privacy_accepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Privacy Policy' }) }),
  not_medical_care: z.literal(true, { errorMap: () => ({ message: 'You must acknowledge that MySazz does not replace professional care' }) })
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  mfa_code: z.string().trim().regex(/^\d{6}$/).optional()
});

export const emailSchema = z.object({ email: z.string().trim().email() });
export const tokenSchema = z.object({ token: z.string().min(8) });
export const resetConfirmSchema = z.object({ token: z.string().min(8), password: z.string().min(8).max(128) });

export const postSchema = z.object({
  body: z.string().trim().min(1).max(500),
  image_url: z.string().trim().url().optional().or(z.literal('')),
  media_id: z.coerce.number().int().positive().optional()
});

export const commentSchema = z.object({ body: z.string().trim().min(1).max(240) });
export const messageSchema = z.object({ body: z.string().trim().min(1).max(1000) });
export const reportSchema = z.object({ reason: z.string().trim().min(3).max(240) });

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128)
});

export const profileSchema = z.object({
  bio: z.string().trim().max(240).optional(),
  avatar_url: z.string().trim().url().optional().or(z.literal('')),
  cover_url: z.string().trim().url().optional().or(z.literal('')),
  relationship_status: relationshipStatus.optional(),
  connection_intents: z.array(connectionIntent).min(1).max(CONNECTION_INTENTS.length).optional(),
  experience_tags: z.array(experienceTag).max(EXPERIENCE_TAGS.length).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(16).regex(/^[a-zA-Z0-9 -]*$/).optional(),
  search_radius_miles: z.coerce.number().int().min(1).max(100).optional(),
  discoverable: z.boolean().optional(),
  show_relationship_status: z.boolean().optional(),
  show_experience_tags: z.boolean().optional(),
  presence_status: z.enum(PRESENCE_STATUSES).optional()
});

export const onboardingSchema = registerSchema.pick({
  relationship_status: true,
  connection_intents: true,
  experience_tags: true,
  city: true,
  region: true,
  age_18_plus: true,
  recovery_one_year: true,
  member_confidentiality: true,
  terms_accepted: true,
  privacy_accepted: true,
  not_medical_care: true
});

export const connectionResponseSchema = z.object({ action: z.enum(['accept', 'decline']) });
export const deleteAccountSchema = z.object({ password: z.string().min(1), confirmation: z.literal('DELETE') });
export const mfaCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter a six-digit authenticator code') });
export const disableMfaSchema = mfaCodeSchema.extend({ password: z.string().min(1) });
