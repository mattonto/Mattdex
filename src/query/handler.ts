import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Query parameter validation
// ---------------------------------------------------------------------------

const querySchema = z.object({
  symbol: z.string().min(1).max(256).optional(),
  path: z.string().min(1).max(1024).optional(),
}).refine(
  (data) => data.symbol !== undefined || data.path !== undefined,
  { message: 'Either "symbol" or "path" query parameter is required' },
);

type QueryParams = z.infer<typeof querySchema>;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface FileResult {
  file_path: string;
  content: string;
  language: string;
  updated_at: string;
}

export interface AstNodeResult {
  file_path: string;
  node_type: string;
  node_name: string;
  start_line: number;
  end_line: number;
  content: string;
}

export interface QueryResponse {
  files: FileResult[];
  ast_nodes: AstNodeResult[];
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

/**
 * Query files by symbol name (e.g. function/class/variable name).
 * Uses a parameterized query to prevent SQL injection.
 */
async function queryFilesBySymbol(
  sql: ReturnType<typeof neon>,
  symbol: string,
): Promise<FileResult[]> {
  const rows = await sql`
    SELECT DISTINCT
      f.file_path,
      f.content,
      f.language,
      f.updated_at
    FROM files f
    INNER JOIN ast_nodes n ON n.file_path = f.file_path
    WHERE n.node_name = ${symbol}
    ORDER BY f.file_path ASC
  `;
  return rows as unknown as FileResult[];
}

/**
 * Query AST nodes by symbol name.
 */
async function queryAstNodesBySymbol(
  sql: ReturnType<typeof neon>,
  symbol: string,
): Promise<AstNodeResult[]> {
  const rows = await sql`
    SELECT
      file_path,
      node_type,
      node_name,
      start_line,
      end_line,
      content
    FROM ast_nodes
    WHERE node_name = ${symbol}
    ORDER BY file_path ASC, start_line ASC
  `;
  return rows as unknown as AstNodeResult[];
}

/**
 * Query files by path pattern (LIKE match).
 * Uses parameterized query to prevent SQL injection.
 */
async function queryFilesByPath(
  sql: ReturnType<typeof neon>,
  path: string,
): Promise<FileResult[]> {
  const pattern = `%${path}%`;
  const rows = await sql`
    SELECT
      file_path,
      content,
      language,
      updated_at
    FROM files
    WHERE file_path LIKE ${pattern}
    ORDER BY file_path ASC
  `;
  return rows as unknown as FileResult[];
}

/**
 * Query AST nodes by file path pattern.
 */
async function queryAstNodesByPath(
  sql: ReturnType<typeof neon>,
  path: string,
): Promise<AstNodeResult[]> {
  const pattern = `%${path}%`;
  const rows = await sql`
    SELECT
      file_path,
      node_type,
      node_name,
      start_line,
      end_line,
      content
    FROM ast_nodes
    WHERE file_path LIKE ${pattern}
    ORDER BY file_path ASC, start_line ASC
  `;
  return rows as unknown as AstNodeResult[];
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

/**
 * handleQuery serves HTTP GET /query?symbol=... or /query?path=...
 *
 * Returns JSON with:
 *   - files: matching file records from the `files` table
 *   - ast_nodes: matching AST node records from the `ast_nodes` table
 *
 * All database queries use parameterized queries (P4) to prevent SQL injection.
 *
 * Acceptance criteria:
 *   AC2: Returns 400 with error message when neither symbol nor path is provided
 *   AC3: Returns 200 with matching files and AST nodes when valid query is provided
 *   R2:  Uses parameterized queries (no string interpolation in SQL)
 */
export async function handleQuery(request: Request): Promise<Response> {
  // -----------------------------------------------------------------------
  // 1. Parse and validate query parameters
  // -----------------------------------------------------------------------
  const url = new URL(request.url);
  const rawSymbol = url.searchParams.get('symbol') ?? undefined;
  const rawPath = url.searchParams.get('path') ?? undefined;

  const parsed = querySchema.safeParse({ symbol: rawSymbol, path: rawPath });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue?.message ?? 'Invalid query parameters';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { symbol, path } = parsed.data as QueryParams;

  // -----------------------------------------------------------------------
  // 2. Connect to database
  // -----------------------------------------------------------------------
  let sql: ReturnType<typeof neon>;
  try {
    const databaseUrl = getDatabaseUrl();
    sql = neon(databaseUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return new Response(JSON.stringify({ error: 'Database connection failed', detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // -----------------------------------------------------------------------
  // 3. Execute queries
  // -----------------------------------------------------------------------
  try {
    let files: FileResult[];
    let astNodes: AstNodeResult[];

    if (symbol !== undefined) {
      [files, astNodes] = await Promise.all([
        queryFilesBySymbol(sql, symbol),
        queryAstNodesBySymbol(sql, symbol),
      ]);
    } else {
      // path is guaranteed to be defined by the schema refinement
      [files, astNodes] = await Promise.all([
        queryFilesByPath(sql, path!),
        queryAstNodesByPath(sql, path!),
      ]);
    }

    // -----------------------------------------------------------------------
    // 4. Build and return response
    // -----------------------------------------------------------------------
    const body: QueryResponse = { files, ast_nodes: astNodes };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown query error';
    return new Response(JSON.stringify({ error: 'Query execution failed', detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
