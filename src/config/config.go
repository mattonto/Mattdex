package config

import "os"

// Config holds all configuration for the plan-state-server.
type Config struct {
	Port        string
	DatabasePath string
	SandboxPath  string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabasePath: getEnv("DATABASE_PATH", "data/plans.db"),
		SandboxPath:  getEnv("SANDBOX_PATH", "sandbox"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
