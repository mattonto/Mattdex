import { writeContextToNeon } from '../../db/contextWriter';
import { makeTestDb, seedProject, testSql } from '../../../../test/runtime/seed.js';
import { pollUntil } from '../../../../test/e2e/polling-harness.js';
import { vi } from 'vitest';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('writeContextToNeon (e2e)', () => {
  let db: ReturnType<typeof makeTestDb>;
  const createdProjects: string[] = [];

  beforeAll(async () => {
    db = makeTestDb();
  });

  afterEach(async () => {
    for (const pid of createdProjects.splice(0)) {
      await cleanupProject(pid).catch(() => {});
    }
  });

  it('should persist context and allow cross-query validation via DB', async () => {
    // Seed project
    const { projectId, correlationId } = await seedProject(db, { correlationId: 'corr-123' });
    createdProjects.push(projectId);

    const context = {
      files: [
        {
          path: `projects/${projectId}/src/api/routes.ts`,
          language: 'typescript',
          symbols: {
            functions: ['handleRequest'],
            classes: [],
            imports: [`projects/${projectId}/src/services/userService.ts`],
            exports: ['handleRequest']
          }
        },
        {
          path: `projects/${projectId}/src/services/userService.ts`,
          language: 'typescript',
          symbols: {
            functions: ['createUser'],
            classes: ['UserService'],
            imports: [],
            exports: ['UserService']
          }
        }
      ],
      dependencies: {
        [`projects/${projectId}/src/api/routes.ts`]: [`projects/${projectId}/src/services/userService.ts`]
      }
    };

    // Act: Write context
    await writeContextToNeon(context);

    // Use pollUntil to wait for DB consistency
    await pollUntil(async () => {
      const result = await testSql()`
        SELECT count(*)::int as count
        FROM project_files
        WHERE path LIKE ${`%${projectId}%`}
      `;
      return result.rows[0].count === 2;
    }, { label: 'two files written' });

    // Validate query interface can find by symbol
    const bySymbol = await testSql()`
      SELECT path
      FROM project_files
      WHERE symbols::text LIKE '%handleRequest%'
    `;
    expect(bySymbol.rows).toHaveLength(1);
    expect(bySymbol.rows[0].path).toContain('routes.ts');

    // Validate dependency resolution
    const deps = await testSql()`
      SELECT to_file
      FROM dependencies
      WHERE from_file = ${`projects/${projectId}/src/api/routes.ts`}
    `;
    expect(deps.rows).toHaveLength(1);
    expect(deps.rows[0].to_file).toContain('userService.ts');
  });
});