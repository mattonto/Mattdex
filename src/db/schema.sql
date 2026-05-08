-- src/db/schema.sql
-- Defines the PostgreSQL schema for storing indexed project context maps

-- Table: files
-- Stores metadata about each file in the project
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  projectId UUID NOT NULL,
  
  -- Index on path for fast lookups by file path
  CONSTRAINT idx_files_path UNIQUE (path),
  
  -- Index on projectId for fast project-scoped queries
  CONSTRAINT idx_files_project_id FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- Index on language for filtering by language
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);

-- Table: symbols
-- Stores symbols (functions, classes, imports, exports) extracted from each file
CREATE TABLE IF NOT EXISTS symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., 'function', 'class', 'import', 'export'
  fileId UUID NOT NULL,
  startLine INTEGER NOT NULL,
  endLine INTEGER NOT NULL,
  
  -- Composite index for efficient lookups by name and fileId
  CONSTRAINT idx_symbols_name_file_id UNIQUE (name, fileId),
  
  -- Foreign key constraint to ensure referential integrity
  CONSTRAINT fk_symbols_file_id FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
);

-- Index on name for fast symbol name searches across files
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);

-- Table: dependencies
-- Stores file-to-file dependencies (e.g., imports, requires)
CREATE TABLE IF NOT EXISTS dependencies (
  fromFileId UUID NOT NULL,
  toFileId UUID NOT NULL,
  type TEXT NOT NULL, -- e.g., 'import', 'require', 'include'
  
  -- Composite primary key to prevent duplicates
  CONSTRAINT dependencies_pkey PRIMARY KEY (fromFileId, toFileId),
  
  -- Foreign key constraints for referential integrity
  CONSTRAINT fk_dependencies_from_file_id FOREIGN KEY (fromFileId) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_dependencies_to_file_id FOREIGN KEY (toFileId) REFERENCES files(id) ON DELETE CASCADE
);

-- Index on fromFileId for fast dependency lookups from a given file
CREATE INDEX IF NOT EXISTS idx_dependencies_from_file_id ON dependencies(fromFileId);

-- Index on toFileId for fast reverse lookups (who depends on this file)
CREATE INDEX IF NOT EXISTS idx_dependencies_to_file_id ON dependencies(toFileId);
