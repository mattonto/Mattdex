import { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { conversationHistories } from './schema';

/**
 * Defines the structure for conversation history data.
 * It includes messages, a timestamp, and allows for additional metadata.
 */
export interface ConversationHistory {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  timestamp: string;
  [key: string]: unknown; // Allows for flexible additional properties
}

/**
 * Custom error class for when a requested resource is not found.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Creates a new conversation history entry in the database.
 * @param db The D1 database instance.
 * @param id The unique ID for the conversation history.
 * @param data The conversation history data to store.
 */
export async function createConversationHistory(
  db: D1Database,
  id: string,
  data: ConversationHistory
): Promise<void> {
  const dbClient = drizzle(db);
  await dbClient.insert(conversationHistories).values({
    id,
    data: JSON.stringify(data)
  }).execute();
}

/**
 * Retrieves a conversation history entry by its ID.
 * Returns null if the ID does not exist.
 * @param db The D1 database instance.
 * @param id The unique ID of the conversation history.
 * @returns The conversation history data or null if not found.
 */
export async function getConversationHistory(
  db: D1Database,
  id: string
): Promise<ConversationHistory | null> {
  const dbClient = drizzle(db);
  const result = await dbClient.select()
    .from(conversationHistories)
    .where(eq(conversationHistories.id, id))
    .limit(1)
    .get();

  if (!result) {
    return null;
  }
  return JSON.parse(result.data) as ConversationHistory;
}

/**
 * Updates an existing conversation history entry.
 * Throws NotFoundError if the ID does not exist.
 * @param db The D1 database instance.
 * @param id The unique ID of the conversation history to update.
 * @param data The new conversation history data.
 */
export async function updateConversationHistory(
  db: D1Database,
  id: string,
  data: ConversationHistory
): Promise<void> {
  const dbClient = drizzle(db);
  const result = await dbClient.update(conversationHistories)
    .set({ data: JSON.stringify(data) })
    .where(eq(conversationHistories.id, id))
    .returning({ id: conversationHistories.id }) // Return ID to check if any row was affected
    .execute();

  if (result.length === 0) {
    throw new NotFoundError(`Conversation history with ID '${id}' not found.`);
  }
}

/**
 * Deletes a conversation history entry by its ID.
 * Handles non-existent IDs gracefully (does not throw an error if the ID is not found).
 * @param db The D1 database instance.
 * @param id The unique ID of the conversation history to delete.
 */
export async function deleteConversationHistory(
  db: D1Database,
  id: string
): Promise<void> {
  const dbClient = drizzle(db);
  await dbClient.delete(conversationHistories)
    .where(eq(conversationHistories.id, id))
    .execute();
}
