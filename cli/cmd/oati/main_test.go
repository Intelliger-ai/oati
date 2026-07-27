package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidatePassport(t *testing.T) {
	path := writeFixture(t, `{
  "oati_version":"1.0",
  "id":"oati:agent:example:assistant",
  "organisation_id":"oati:org:example",
  "issuer":"https://example.com/issuer",
  "status":"active",
  "issued_at":"2026-01-01T00:00:00Z",
  "expires_at":"2027-01-01T00:00:00Z",
  "verification_methods":[{"id":"key-1"}]
}`)
	var stdout, stderr bytes.Buffer
	if err := run([]string{"validate", "passport", path}, &stdout, &stderr); err != nil {
		t.Fatalf("validate: %v\n%s", err, stderr.String())
	}
	if !strings.Contains(stdout.String(), "valid passport") {
		t.Fatalf("unexpected output: %s", stdout.String())
	}
}

func TestRejectsAmplifiedShapeBasics(t *testing.T) {
	value := map[string]any{
		"oati_version": "1.0",
		"id":           "wrong-id",
		"subject":      "not-an-agent",
		"status":       "unbounded",
		"actions":      []any{},
	}
	violations := validateObject("mandate", "oati:mandate:", value)
	if len(violations) < 5 {
		t.Fatalf("expected multiple violations, got %v", violations)
	}
}

func TestCanonicalizeSortsKeys(t *testing.T) {
	path := writeFixture(t, `{"z":1,"a":{"y":2,"b":3}}`)
	var stdout, stderr bytes.Buffer
	if err := run([]string{"canonicalize", path}, &stdout, &stderr); err != nil {
		t.Fatal(err)
	}
	if got := strings.TrimSpace(stdout.String()); got != `{"a":{"b":3,"y":2},"z":1}` {
		t.Fatalf("unexpected canonical JSON: %s", got)
	}
}

func writeFixture(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fixture.json")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}
