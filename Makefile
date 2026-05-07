.PHONY: build test run migrate-up migrate-down clean

# Build the server binary
build:
	go build -o bin/plan-state-server ./cmd/server

# Run all tests
test:
	go test ./... -v -count=1

# Run the server (with optional port override)
run:
	go run ./cmd/server

# Apply all pending migrations
migrate-up:
	@echo "Running migrations up..."
	go run ./cmd/migrate up

# Roll back all migrations
migrate-down:
	@echo "Running migrations down..."
	go run ./cmd/migrate down

# Clean build artifacts
clean:
	rm -rf bin/ dist/ tmp/
	rm -f coverage.out coverage.html
