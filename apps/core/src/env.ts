import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3301),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3300')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
});

export const env = envSchema.parse(process.env);
