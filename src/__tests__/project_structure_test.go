package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDirectoriesExist verifies that all required source directories exist and are directories.
func TestDirectoriesExist(t *testing.T) {
	// Determine project root relative to this test file.
	// The test file is at src/__tests__/project_structure_test.go
	// Project root is two levels up.
	_, filename, _, _ := runtimeCaller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(filename)))

	dirs := []string{
		"src/handlers",
		"src/services",
		"src/contracts",
		"src/config",
		"src/db",
		"src/sandbox",
		"src/llm",
		"src/integrations",
		"cmd/server",
		"cmd/migrate",
		"migrations",
	}

	for _, dir := range dirs {
		fullPath := filepath.Join(projectRoot, dir)
		t.Run(dir, func(t *testing.T) {
			info, err := os.Stat(fullPath)
			require.NoError(t, err, "Directory %s should exist", fullPath)
			assert.True(t, info.IsDir(), "%s should be a directory, not a file", fullPath)
		})
	}
}

// TestGoModExists verifies that go.mod exists at the project root.
func TestGoModExists(t *testing.T) {
	_, filename, _, _ := runtimeCaller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(filename)))
	goModPath := filepath.Join(projectRoot, "go.mod")

	info, err := os.Stat(goModPath)
	require.NoError(t, err, "go.mod should exist at project root")
	assert.False(t, info.IsDir(), "go.mod should be a file, not a directory")
}

// TestMakefileExists verifies that Makefile exists at the project root.
func TestMakefileExists(t *testing.T) {
	_, filename, _, _ := runtimeCaller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(filename)))
	makefilePath := filepath.Join(projectRoot, "Makefile")

	info, err := os.Stat(makefilePath)
	require.NoError(t, err, "Makefile should exist at project root")
	assert.False(t, info.IsDir(), "Makefile should be a file, not a directory")
}

// TestGitignoreExists verifies that .gitignore exists at the project root.
func TestGitignoreExists(t *testing.T) {
	_, filename, _, _ := runtimeCaller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(filename)))
	gitignorePath := filepath.Join(projectRoot, ".gitignore")

	info, err := os.Stat(gitignorePath)
	require.NoError(t, err, ".gitignore should exist at project root")
	assert.False(t, info.IsDir(), ".gitignore should be a file, not a directory")
}

// runtimeCaller is a helper to get the current file path at runtime.
// We use this instead of runtime.Caller directly for clarity.
func runtimeCaller(skip int) (uintptr, string, int, bool) {
	// Use the standard library runtime.Caller
	pc, file, line, ok := runtimeCallerImpl(skip + 1)
	return pc, file, line, ok
}

func runtimeCallerImpl(skip int) (uintptr, string, int, bool) {
	return uintptr(0), "", 0, false // placeholder — see init()
}

// We override runtimeCallerImpl in init to avoid import cycle issues.
// Actually, let's just use runtime.Caller directly.

import "runtime"

func init() {
	// Override the placeholder
	runtimeCallerImpl = runtime.Caller
}

var runtimeCallerImpl func(int) (uintptr, string, int, bool)
