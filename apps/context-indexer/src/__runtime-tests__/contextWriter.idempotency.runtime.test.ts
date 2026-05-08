import { writeContextToNeon } from '../../db/contextWriter';
import { makeTestDb, cleanupProject } from '../../../../test/runtime/seed.js';
import { vi } from 'vitest';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('writeContextToNeon idempotency', () => {
  let db: ReturnType<typeof makeTestDb>;
  const projectId = 'test-project-123';

  beforeAll(async () => {
    db = makeTestDb();
  });

  beforeEach(async () => {
    await cleanupProject(projectId).catch(() => {});
  });

  it('should be idempotent when called multiple times with same context', async () => {
    // Arrange
    const context = {
      files: [
        {
          path: `projects/${projectId}/src/index.ts`,
          language: 'typescript',
          symbols: {
            functions: ['main'],
            classes: [],
            imports: [],
            exports: ['main']
          }
        }
      ],
      dependencies: {}
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act: First call
    await writeContextToNeon(context);

    // Assert first write
    const afterFirst = await db.select().from(db.schema.project_files).where(
      db.sql`path LIKE ${`%${projectId}%`}`
    );
    expect(afterFirst).toHaveLength(1);

    // Act: Second call with same context
    await writeContextToNeon(context);

    // Assert no duplicates
    const afterSecond = await db.select().from(db.schema.project_files).where(
      db.sql`path LIKE ${`%${projectId}%`}`
    );
    expect(afterSecond).toHaveLength(1); // Still only one
  });
});