import { describe, it, expect } from 'vitest';
import { sandboxState, stagedDiffs } from '../db/schema';

describe('sandbox_state schema', () => {
  it('should have all required columns', () => {
    const columns = sandboxState.columns;
    expect(columns).toHaveProperty('id');
    expect(columns).toHaveProperty('createdAt');
    expect(columns).toHaveProperty('originalChecksum');
    expect(columns).toHaveProperty('cumulativeHash');
    expect(columns).toHaveProperty('checkpointBeforeApply');
  });

  it('should have id as text primary key', () => {
    expect(sandboxState.columns.id.dataType).toBe('text');
    expect(sandboxState.columns.id.primary).toBe(true);
    expect(sandboxState.columns.id.notNull).toBe(true);
  });

  it('should have createdAt as timestamp with default now', () => {
    expect(sandboxState.columns.createdAt.dataType).toBe('timestamp');
    expect(sandboxState.columns.createdAt.notNull).toBe(true);
    expect(sandboxState.columns.createdAt.default).toBeDefined();
  });

  it('should have originalChecksum as text not null', () => {
    expect(sandboxState.columns.originalChecksum.dataType).toBe('text');
    expect(sandboxState.columns.originalChecksum.notNull).toBe(true);
  });

  it('should have cumulativeHash as text not null', () => {
    expect(sandboxState.columns.cumulativeHash.dataType).toBe('text');
    expect(sandboxState.columns.cumulativeHash.notNull).toBe(true);
  });

  it('should have checkpointBeforeApply as text nullable', () => {
    expect(sandboxState.columns.checkpointBeforeApply.dataType).toBe('text');
    expect(sandboxState.columns.checkpointBeforeApply.notNull).toBe(false);
  });

  it('should be named sandbox_state in the database', () => {
    expect(sandboxState.dbName).toBe('sandbox_state');
  });
});

describe('staged_diffs schema', () => {
  it('should have all required columns', () => {
    const columns = stagedDiffs.columns;
    expect(columns).toHaveProperty('id');
    expect(columns).toHaveProperty('sandboxId');
    expect(columns).toHaveProperty('patchHash');
    expect(columns).toHaveProperty('diffText');
    expect(columns).toHaveProperty('appliedAt');
    expect(columns).toHaveProperty('r2Version');
  });

  it('should have id as text primary key', () => {
    expect(stagedDiffs.columns.id.dataType).toBe('text');
    expect(stagedDiffs.columns.id.primary).toBe(true);
    expect(stagedDiffs.columns.id.notNull).toBe(true);
  });

  it('should have sandboxId as text not null referencing sandbox_state', () => {
    expect(stagedDiffs.columns.sandboxId.dataType).toBe('text');
    expect(stagedDiffs.columns.sandboxId.notNull).toBe(true);
    expect(stagedDiffs.columns.sandboxId.references).toBeDefined();
    expect(stagedDiffs.columns.sandboxId.references?.table).toBe('sandbox_state');
    expect(stagedDiffs.columns.sandboxId.references?.column).toBe('id');
  });

  it('should have patchHash as text not null', () => {
    expect(stagedDiffs.columns.patchHash.dataType).toBe('text');
    expect(stagedDiffs.columns.patchHash.notNull).toBe(true);
  });

  it('should have diffText as text not null', () => {
    expect(stagedDiffs.columns.diffText.dataType).toBe('text');
    expect(stagedDiffs.columns.diffText.notNull).toBe(true);
  });

  it('should have appliedAt as timestamp with default now', () => {
    expect(stagedDiffs.columns.appliedAt.dataType).toBe('timestamp');
    expect(stagedDiffs.columns.appliedAt.notNull).toBe(true);
    expect(stagedDiffs.columns.appliedAt.default).toBeDefined();
  });

  it('should have r2Version as text nullable', () => {
    expect(stagedDiffs.columns.r2Version.dataType).toBe('text');
    expect(stagedDiffs.columns.r2Version.notNull).toBe(false);
  });

  it('should be named staged_diffs in the database', () => {
    expect(stagedDiffs.dbName).toBe('staged_diffs');
  });
});
