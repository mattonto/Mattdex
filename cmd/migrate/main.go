package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: migrate [up|down]")
	}

	direction := os.Args[1]

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "data/plans.db"
	}

	// Ensure data directory exists
	dataDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	migrationsPath := "file://migrations"
	databaseURL := fmt.Sprintf("sqlite3://%s", dbPath)

	m, err := migrate.New(migrationsPath, databaseURL)
	if err != nil {
		log.Fatalf("Failed to create migrator: %v", err)
	}

	switch direction {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("Migration up failed: %v", err)
		}
		log.Println("Migrations applied successfully")
	case "down":
		if err := m.Down(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("Migration down failed: %v", err)
		}
		log.Println("Migrations rolled back successfully")
	default:
		log.Fatalf("Unknown direction: %s (use 'up' or 'down')", direction)
	}
}
