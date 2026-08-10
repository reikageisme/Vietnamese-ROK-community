import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const passwordSchema = z
  .string()
  .min(10, "Mật khẩu phải có ít nhất 10 ký tự.")
  .max(128, "Mật khẩu không được dài quá 128 ký tự.")
  .regex(/\p{L}/u, "Mật khẩu phải có ít nhất một chữ cái.")
  .regex(/\p{N}/u, "Mật khẩu phải có ít nhất một chữ số.");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(100),
  acceptedTerms: z.literal(true),
});

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(32).max(256) });
export const setPasswordSchema = z.object({
  password: passwordSchema,
  currentPassword: z.string().min(1).max(128).optional(),
});

