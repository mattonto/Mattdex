import { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateModelPackSchema } from '../validators/modelPacks';
import { modelPacks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Env } from '../types';

export const createModelPack = zValidator('json', CreateModelPackSchema, async (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.errors }, 422);
  }

  const { name, description, config } = result.data;
  const db = c.get('drizzle');

  try {
    const [newModelPack] = await db.insert(modelPacks).values({
      name,
      description,
      config,
    }).returning();

    if (!newModelPack) {
      return c.json({ error: 'Failed to create model pack' }, 500);
    }

    return c.json(newModelPack, 201);
  } catch (error) {
    console.error('Error creating model pack:', error);
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
      return c.json({ error: 'Model pack with this name already exists' }, 409);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export const getModelPack = async (c: Context<{ Bindings: Env }>) => {
  const { modelPackId } = c.req.param();
  const db = c.get('drizzle');

  try {
    const modelPack = await db.select().from(modelPacks).where(eq(modelPacks.id, modelPackId)).limit(1);

    if (modelPack.length === 0) {
      return c.json({ error: 'Model pack not found' }, 404);
    }

    return c.json(modelPack[0], 200);
  } catch (error) {
    console.error('Error retrieving model pack:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};
