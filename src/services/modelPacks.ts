import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { modelPacks, ModelPack } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Define Zod schema for input validation
const ModelConfigSchema = z.object({
  provider: z.string().min(1, 'Provider cannot be empty'),
  model: z.string().min(1, 'Model cannot be empty'),
  config: z.record(z.string(), z.unknown()).optional()
});

const CreateModelPackInputSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty'),
  description: z.string().optional(),
  models: z.array(ModelConfigSchema).min(1, 'Models array cannot be empty')
});

export class ModelPackService {
  constructor(private db: NeonHttpDatabase<Record<string, never>>) {}

  /**
   * Creates a new model pack.
   * @param data - The data for the new model pack.
   * @returns The created model pack.
   */
  public async createModelPack(data: z.infer<typeof CreateModelPackInputSchema>): Promise<ModelPack> {
    const validatedData = CreateModelPackInputSchema.parse(data);

    const [newPack] = await this.db.insert(modelPacks).values(validatedData).returning();
    if (!newPack) {
      throw new Error('Failed to create model pack');
    }
    return newPack;
  }

  /**
   * Retrieves a model pack by its ID.
   * @param id - The ID of the model pack.
   * @returns The model pack if found, otherwise null.
   */
  public async getModelPackById(id: string): Promise<ModelPack | null> {
    if (!z.string().uuid().safeParse(id).success) {
      return null;
    }
    const pack = await this.db.select().from(modelPacks).where(eq(modelPacks.id, id)).limit(1);
    return pack[0] || null;
  }
}
