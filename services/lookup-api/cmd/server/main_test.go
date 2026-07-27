package main

import (
	"testing"
	"time"
)

func TestValidType(t *testing.T) {
	for _, kind := range []string{"organisation", "agent", "passport", "mandate", "receipt", "issuer", "key", "revocation"} {
		if !validType(kind) {
			t.Fatalf("expected %q to be valid", kind)
		}
	}
	if validType("private-evidence") {
		t.Fatal("private evidence must not be a public lookup type")
	}
}

func TestLimiter(t *testing.T) {
	l := &limiter{limit: 2, buckets: make(map[string]bucket)}
	now := time.Now()
	if ok, _ := l.allow("client", now); !ok {
		t.Fatal("first request should pass")
	}
	if ok, _ := l.allow("client", now); !ok {
		t.Fatal("second request should pass")
	}
	if ok, _ := l.allow("client", now); ok {
		t.Fatal("third request should be limited")
	}
}
