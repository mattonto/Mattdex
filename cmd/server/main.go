package main

import (
	"log"
	"net/http"
	"os"

	"plan-state-server/src/config"
)

func main() {
	cfg := config.Load()

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	addr := ":" + cfg.Port
	log.Printf("Starting plan-state-server on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
		os.Exit(1)
	}
}
