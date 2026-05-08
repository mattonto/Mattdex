import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { contextMapTable, filesTable, symbolsTable } from '../../db/schema';
import { and, eq, or } from 'drizzle-orm';

const app = new Hono<{ Bindings: { NEON_DB_CONNECTION_STRING: string } }>();

// Schema for query validation
const QuerySchema = z.object({
  symbol: z.string().optional(),
  path: z.string().optional(),
}).refine((data) => data.symbol || data.path, {
  message: 'Either symbol or path must be provided',
});

// Helper to get DB client
function getDbClient(connectionUrl: string) {
  const sql = neon(connectionUrl);
  return drizzle(sql);
}

// Handle query requests
app.get('/query', async (c) => {
  const env = c.env as { NEON_DB_CONNECTION_STRING: string };
  const db = getDbClient(env.NEON_DB_CONNECTION_STRING);

  // Parse and validate query params
  const queryParams = c.req.query();
  const result = QuerySchema.safeParse(queryParams);
  if (!result.success) {
    return c.json({ error: 'Invalid query parameters' }, 400);
  }

  const { symbol, path } = result.data;

  try {
    if (symbol) {
      // AC2: Find files that define or reference the symbol
      const symbolRecords = await db
        .select({
          fileId: symbolsTable.fileId,
          name: symbolsTable.name,
          type: symbolsTable.type,
          nodeType: symbolsTable.nodeType,
          startPosition: symbolsTable.startPosition,
          endPosition: symbolsTable.endPosition,
        })
        .from(symbolsTable)
        .where(eq(symbolsTable.name, symbol));

      const fileIds = symbolRecords.map((s) => s.fileId);
      const files = await db
        .select({
          id: filesTable.id,
          path: filesTable.path,
          language: filesTable.language,
        })
        .from(filesTable)
        .where(inArray(filesTable.id, fileIds));

      return c.json({
        files: files.map((file) => ({
          path: file.path,
          language: file.language,
          symbols: symbolRecords
            .filter((s) => s.fileId === file.id)
            .map(({ fileId, ...s }) => s),
        })),
      });
    }

    if (path) {
      // AC3: Find files that import or are imported by the given path
      const targetFile = await db
        .select({ id: filesTable.id })
        .from(filesTable)
        .where(eq(filesTable.path, path))
        .limit(1);

      if (targetFile.length === 0) {
        return c.json({ files: [] });
      }

      const fileId = targetFile[0].id;

      // Find dependencies to/from this file
      const dependencies = await db
        .select({
          fromFile: contextMapTable.fromFileId,
          toFile: contextMapTable.toFileId,
        })
        .from(contextMapTable)
        .where(
          or(
            eq(contextMapTable.fromFileId, fileId),
            eq(contextMapTable.toFileId, fileId)
          )
        );

      const relatedFileIds = new Set(
        dependencies.flatMap((d) => [d.fromFile, d.toFile])
      );

      const relatedFiles = await db
        .select({
          id: filesTable.id,
          path: filesTable.path,
          language: filesTable.language,
        })
        .from(filesTable)
        .where(inArray(filesTable.id, Array.from(relatedFileIds)));

      // Get symbols for each related file
      const allSymbols = await db
        .select({
          fileId: symbolsTable.fileId,
          name: symbolsTable.name,
          type: symbolsTable.type,
          nodeType: symbolsTable.nodeType,
          startPosition: symbolsTable.startPosition,
          endPosition: symbolsTable.endPosition,
        })
        .from(symbolsTable)
        .where(inArray(symbolsTable.fileId, Array.from(relatedFileIds)));

      return c.json({
        files: relatedFiles.map((file) => ({
          path: file.path,
          language: file.language,
          symbols: allSymbols
            .filter((s) => s.fileId === file.id)
            .map(({ fileId, ...s }) => s),
        })),
      });
    }

    // Should never reach here due to zod refine
    return c.json({ error: 'Invalid query' }, 400);
  } catch (error) {
    console.error('Query handler error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export const handleQuery = app.fetch;