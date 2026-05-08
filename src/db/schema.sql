-- Context Index: stores indexed code context for the autoengineering system
-- This schema satisfies R3 (context indexing), AC4 (symbol resolution), AC5 (dependency tracking)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: files
-- Represents a source file in a project that has been indexed
-- ============================================================
CREATE TABLE IF NOT EXISTS files (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path        TEXT NOT NULL,
    language    TEXT NOT NULL,
    project_id  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A file path must be unique within a project
    UNIQUE (project_id, path)
);

-- Index for fast lookup by project
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files (project_id);

-- Index for path-based lookups within a project
CREATE INDEX IF NOT EXISTS idx_files_project_path ON files (project_id, path);

-- ============================================================
-- Table: symbols
-- Represents a named symbol (function, class, variable, type, etc.)
-- extracted from a file during indexing.
-- ============================================================
CREATE TABLE IF NOT EXISTS symbols (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,  -- e.g. 'function', 'class', 'variable', 'interface', 'type', 'const'
    file_id     UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    start_line  INTEGER NOT NULL,
    end_line    INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A symbol name should be unique within a file (two symbols with same name in same file is ambiguous)
    UNIQUE (file_id, name)
);

-- Index for resolving symbols by name across a project (AC4)
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols (name);

-- Index for finding all symbols in a file
CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols (file_id);

-- Index for finding symbols by type
CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols (type);

-- ============================================================
-- Table: dependencies
-- Represents a dependency (import, require, reference) from one
-- file to another within the same project.
-- ============================================================
CREATE TABLE IF NOT EXISTS dependencies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_file_id    UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    to_file_id      UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,  -- e.g. 'import', 'require', 'dynamic_import', 're-export'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate dependency records
    UNIQUE (from_file_id, to_file_id, type),

    -- A file should not depend on itself
    CONSTRAINT chk_no_self_dependency CHECK (from_file_id <> to_file_id)
);

-- Index for finding all dependencies FROM a file (outgoing edges)
CREATE INDEX IF NOT EXISTS idx_dependencies_from_file_id ON dependencies (from_file_id);

-- Index for finding all dependents OF a file (incoming edges) (AC5)
CREATE INDEX IF NOT EXISTS idx_dependencies_to_file_id ON dependencies (to_file_id);

-- Index for dependency type queries
CREATE INDEX IF NOT EXISTS idx_dependencies_type ON dependencies (type);

-- ============================================================
-- Helper: updated_at trigger for files table
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_files_updated_at ON files;
CREATE TRIGGER trg_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
