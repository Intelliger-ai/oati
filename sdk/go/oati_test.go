package oati

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestCommerceReplayVector(t *testing.T) {
	data, err := os.ReadFile("../../conformance/evaluator/cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var suite map[string]any
	if err := decode(data, &suite); err != nil {
		t.Fatal(err)
	}
	for _, raw := range suite["cases"].([]any) {
		vector := raw.(map[string]any)
		if str(vector["name"]) != "commerce-price-and-replay" {
			continue
		}
		actual, err := EvaluateAuthority(vector["request"].(map[string]any))
		if err != nil {
			t.Fatal(err)
		}
		encoded, _ := json.Marshal(actual)
		if str(actual["decision"]) != "deny" || !equal(actual["reason_codes"], vector["expected"].(map[string]any)["reason_codes"]) {
			t.Fatalf("unexpected result: %s", encoded)
		}
		return
	}
	t.Fatal("vector missing")
}

func TestSignAndVerifyDocument(t *testing.T) {
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC)
	document := map[string]any{"oati_version": "1.0", "id": "oati:tx:test", "agent_id": "oati:agent:test", "organisation_id": "oati:org:test", "mandate_id": "oati:mandate:test", "action": "read", "resource": "test", "issued_at": now.Format(time.RFC3339), "nonce": "transaction-nonce-0001"}
	signed, err := SignDocument(document, private, SigningOptions{VerificationMethod: "oati:key:test", Audience: "https://example.test", Nonce: "proof-nonce-0000001", Created: now, Expires: now.Add(5 * time.Minute)})
	if err != nil {
		t.Fatal(err)
	}
	bundle := map[string]any{"trust_anchors": []any{"oati:issuer:test"}, "keys": []any{map[string]any{"id": "oati:key:test", "issuer": "oati:issuer:test", "status": "active", "public_key_jwk": map[string]any{"x": base64.RawURLEncoding.EncodeToString(public)}}}}
	if codes := VerifyDocument(signed, bundle, "https://example.test", now.Add(time.Minute), NewReplayCache()); len(codes) > 0 {
		t.Fatalf("verification failed: %v", codes)
	}
}
