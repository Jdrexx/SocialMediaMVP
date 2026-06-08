import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
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

export const profileSchema = z.object({
  bio: z.string().trim().max(240).optional(),
  avatar_url: z.string().trim().url().optional().or(z.literal('')),
  cover_url: z.string().trim().url().optional().or(z.literal(''))
});
