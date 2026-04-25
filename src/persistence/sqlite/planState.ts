import { D1Database } from '@cloudflare/workers-types';

// Placeholder for PlanState type. This should ideally come from @autoengineering/shared/types
export type PlanState = {
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  steps: string[];
  currentStepIndex: number;
  metadata: Record<string, unknown>;
};

export async function createPlanState(db: D1Database, id: string, data: PlanState): Promise<void> {
  const serializedData = JSON.stringify(data);
  try {
    await db.prepare('INSERT INTO plan_states (id, data) VALUES (?, ?)')
      .bind(id, serializedData)
      .run();
  } catch (error: unknown) {
    // D1 throws if primary key constraint is violated
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Plan state with ID '${id}' already exists.`);
    }
    throw error;
  }
}

export async function getPlanState(db: D1Database, id: string): Promise<PlanState | null> {
  const { results } = await db.prepare('SELECT data FROM plan_states WHERE id = ?')
    .bind(id)
    .all<{ data: string }>();

  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  return JSON.parse(row.data) as PlanState;
}

export async function updatePlanState(db: D1Database, id: string, data: PlanState): Promise<void> {
  const serializedData = JSON.stringify(data);
  const { changes } = await db.prepare('UPDATE plan_states SET data = ? WHERE id = ?')
    .bind(serializedData, id)
    .run();

  if (changes === 0) {
    throw new Error(`Plan state with ID '${id}' not found for update.`);
  }
}

export async function deletePlanState(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM plan_states WHERE id = ?')
    .bind(id)
    .run();
}
