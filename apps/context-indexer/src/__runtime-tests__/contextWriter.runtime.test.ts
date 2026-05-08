import { Client } from 'pg';
import { ProjectContext } from '@autoengineering/shared';
import { writeContextToNeon } from '../../db/contextWriter';
import { makeTestDb, testSql } from '../../../../test/runtime/seed.js';
import { vi } from 'vitest';

describe.skipIf(!process.env.NEON_TEST_BRANCH_URL)('writeContextToNeon (runtime)', () => {
  let db: ReturnType<typeof makeTestDb>;

  beforeAll(async () => {
    db = makeTestDb();
  });

  it('should insert parsed AST metadata and dependencies without circular references', async () => {
    // Arrange
    const context: ProjectContext = {
      files: [
        {
          path: 'src/api/routes.ts',
          language: 'typescript',
          symbols: {
            functions: ['handleRequest'],
            classes: [],
            imports: ['../services/userService'],
            exports: ['handleRequest']
          }
        },
        {
          path: 'src/services/userService.ts',
          language: 'typescript',
          symbols: {
            functions: ['createUser', 'getUser'],
            classes: ['UserService'],
            imports: [],
            exports: ['UserService']
          }
        }
      ],
      dependencies: {
        'src/api/routes.ts': ['src/services/userService.ts'],
        'src/services/userService.ts': []
      }
    };

    // Mock pg Client to verify queries
    const querySpy = vi.fn();
    vi.spyOn(Client.prototype, 'connect').mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, 'query').mockImplementation(async (text) => {
      if (text === 'BEGIN') return { rows: [], command: 'BEGIN' };
      if (text === 'COMMIT') return { rows: [], command: 'COMMIT' };
      if (text === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
      return { rows: [], command: 'INSERT' };
    });
    vi.spyOn(Client.prototype, 'end').mockResolvedValue(undefined);

    // Act
    await writeContextToNeon(context);

    // Assert: Verify transaction flow
    expect(Client.prototype.connect).toHaveBeenCalled();
    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining('BEGIN'));
    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining('COMMIT'));
    expect(Client.prototype.end).toHaveBeenCalled();

    // Assert: Data written correctly
    const filesResult = await testSql()`
      SELECT path, language, symbols
      FROM project_files
      ORDER BY path
    `;
    expect(filesResult.rows).toHaveLength(2);
    expect(filesResult.rows[0].path).toBe('src/api/routes.ts');
    expect(JSON.parse(filesResult.rows[0].symbols).functions).toEqual(['handleRequest']);

    const depsResult = await testSql()`
      SELECT from_file, to_file
      FROM dependencies
    `;
    expect(depsResult.rows).toHaveLength(1);
    expect(depsResult.rows[0]).toEqual({
      from_file: 'src/api/routes.ts',
      to_file: 'src/services/userService.ts'
    });
  });

  it('should handle empty dependencies and symbols safely', async () => {
    // Arrange
    const context: ProjectContext = {
      files: [
        {
          path: 'src/empty.ts',
          language: 'typescript',
          symbols: { functions: [], classes: [], imports: [], exports: [] }
        }
      ],
      dependencies: { 'src/empty.ts': [] }
    };

    vi.spyOn(Client.prototype, 'connect').mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, 'query').mockResolvedValue({ rows: [], command: 'INSERT' });
    vi.spyOn(Client.prototype, 'end').mockResolvedValue(undefined);

    // Act
    await writeContextToNeon(context);

    // Assert
    const result = await testSql()`
      SELECT path, symbols
      FROM project_files
      WHERE path = 'src/empty.ts'
    `;
    expect(result.rows).toHaveLength(1);
    expect(JSON.parse(result.rows[0].symbols).imports).toEqual([]);
  });

  it('should rollback transaction on error', async () => {
    // Arrange
    const context: ProjectContext = {
      files: [
        {
          path: 'src/api/routes.ts',
          language: 'typescript',
          symbols: { functions: ['handleRequest'], classes: [], imports: [], exports: [] }
        }
      ],
      dependencies: {}
    };

    vi.spyOn(Client.prototype, 'connect').mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, 'query').mockImplementation(async (text) => {
      if (text === 'BEGIN') return { rows: [], command: 'BEGIN' };
      if (text === 'INSERT INTO project_files') throw new Error('DB error');
      return { rows: [], command: 'INSERT' };
    });
    vi.spyOn(Client.prototype, 'end').mockResolvedValue(undefined);

    // Act & Assert
    await expect(writeContextToNeon(context)).rejects.toThrow('DB error');
    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining('ROLLBACK'));
  });
});