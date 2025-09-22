import { z } from 'zod';

// Environment validation
export const envSchema = z.object({
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Form validation schemas
export const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
});

export const passwordAuthSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Supabase API response schemas
export const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.literal('bearer').optional(),
  user: z
    .object({
      id: z.string(),
      email: z.string().email().optional(),
    })
    .optional(),
});

export const errorResponseSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
  msg: z.string().optional(),
  code: z.number().optional(),
});

export const otpResponseSchema = z.object({
  message: z.string().optional(),
  // Supabase OTP endpoint returns 200 on success, even for existing emails
});

// Validation helpers
export function validateEnv() {
  const result = envSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  });

  if (!result.success) {
    throw new Error(
      `Environment validation failed: ${result.error.issues
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ')}`
    );
  }

  return result.data;
}

export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  formData: FormData
) {
  const data = Object.fromEntries(formData.entries());
  const result = schema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.issues?.[0];
    if (!firstError) {
      throw new Error('Validation failed');
    }
    throw new Error(`${firstError.path.join('.')}: ${firstError.message}`);
  }

  return result.data;
}

export function validateApiResponse<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new Error('Invalid response from Supabase API');
  }

  return result.data;
}
