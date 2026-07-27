package main

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type record struct {
	Type           string            `json:"type"`
	ID             string            `json:"id"`
	DisplayName    string            `json:"display_name"`
	Status         string            `json:"status"`
	Issuer         string            `json:"issuer"`
	OrganisationID string            `json:"organisation_id"`
	IssuedAt       string            `json:"issued_at"`
	ExpiresAt      string            `json:"expires_at"`
	Assurance      string            `json:"assurance_level"`
	Proof          string            `json:"proof_status"`
	Attributes     map[string]string `json:"public_attributes"`
}

type bucket struct {
	window time.Time
	count  int
}

type limiter struct {
	mu      sync.Mutex
	limit   int
	buckets map[string]bucket
}

func (l *limiter) allow(key string, now time.Time) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	b := l.buckets[key]
	if b.window.IsZero() || now.Sub(b.window) >= time.Minute {
		b = bucket{window: now}
	}
	if b.count >= l.limit {
		return false, 0
	}
	b.count++
	l.buckets[key] = b
	return true, l.limit - b.count
}

func main() {
	port := env("PORT", "8080")
	origin := env("OATI_ALLOWED_ORIGIN", "http://localhost:3000")
	limit, err := strconv.Atoi(env("OATI_RATE_LIMIT_PER_MINUTE", "60"))
	if err != nil || limit < 1 {
		log.Fatal("OATI_RATE_LIMIT_PER_MINUTE must be a positive integer")
	}

	store := map[string]record{
		"agent:oati:agent:intelliger:commerce-demo": {
			Type: "agent", ID: "oati:agent:intelliger:commerce-demo", DisplayName: "Commerce demo agent",
			Status: "active", Issuer: "https://intelliger.ai/oati/issuers/intelliger",
			OrganisationID: "oati:org:intelliger", IssuedAt: "2026-07-27T00:00:00Z",
			ExpiresAt: "2027-07-27T00:00:00Z", Assurance: "organisation-verified", Proof: "verified",
			Attributes: map[string]string{"protocols": "HTTP, MCP", "capabilities": "api.purchase, data.query"},
		},
	}

	rate := &limiter{limit: limit, buckets: make(map[string]bucket)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /oati/v1/lookup", func(w http.ResponseWriter, r *http.Request) {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		allowed, remaining := rate.allow(ip, time.Now())
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		if !allowed {
			w.Header().Set("Retry-After", "60")
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate_limit_exceeded"})
			return
		}

		kind := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if !validType(kind) || id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "type_and_id_required"})
			return
		}
		item, ok := store[kind+":"+id]
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "record_not_found"})
			return
		}
		writeJSON(w, http.StatusOK, item)
	})

	handler := cors(origin, securityHeaders(mux))
	server := &http.Server{Addr: ":" + port, Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("OATI lookup API listening on :%s", port)
	log.Fatal(server.ListenAndServe())
}

func validType(value string) bool {
	switch value {
	case "organisation", "agent", "passport", "mandate", "receipt", "issuer", "key", "revocation":
		return true
	default:
		return false
	}
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "public, max-age=30")
		next.ServeHTTP(w, r)
	})
}

func cors(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
