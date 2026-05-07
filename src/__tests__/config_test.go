package tests

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"plan-state-server/src/config"
)

func TestConfigLoadDefaults(t *testing.T) {
	// Unset env vars that might be set in the test environment
	os.Unsetenv("PORT")
	os.Unsetenv("DATABASE_PATH")
	os.Unsetenv("SANDBOX_PATH")

	cfg := config.Load()

	assert.Equal(t, "8080", cfg.Port)
	assert.Equal(t, "data/plans.db", cfg.DatabasePath)
	assert.Equal(t, "sandbox", cfg.SandboxPath)
}

func TestConfigLoadFromEnv(t *testing.T) {
	os.Setenv("PORT", "9090")
	os.Setenv("DATABASE_PATH", "/tmp/test.db")
	os.Setenv("SANDBOX_PATH", "/tmp/sandbox")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("DATABASE_PATH")
		os.Unsetenv("SANDBOX_PATH")
	}()

	cfg := config.Load()

	assert.Equal(t, "9090", cfg.Port)
	assert.Equal(t, "/tmp/test.db", cfg.DatabasePath)
	assert.Equal(t, "/tmp/sandbox", cfg.SandboxPath)
}
