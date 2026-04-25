import { z } from 'zod';

export const CreateModelPackSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).min(1, 'Config cannot be empty'),
});

export type CreateModelPackInput = z.infer<typeof CreateModelPackSchema>;
