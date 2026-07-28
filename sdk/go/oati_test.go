package oati

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
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

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}
func TestResolverClientCachesTypedRecord(t *testing.T) {
	calls := 0
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		calls++
		body := `{"type":"agent","id":"oati:agent:test","display_name":"Test","status":"active","issuer":"oati:issuer:test","proof_status":"verified","public_attributes":{}}`
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{"ETag": []string{"test-v1"}}}, nil
	})
	client := NewResolverClient("https://resolver.test/oati/v1")
	client.HTTPClient = &http.Client{Transport: transport}
	first, err := client.LookupDetailed(t.Context(), "agent", "oati:agent:test", false)
	if err != nil || first.Cache != "miss" {
		t.Fatalf("first lookup: %#v %v", first, err)
	}
	second, err := client.LookupDetailed(t.Context(), "agent", "oati:agent:test", false)
	if err != nil || second.Cache != "hit" || calls != 1 {
		t.Fatalf("cached lookup: %#v %v calls=%d", second, err, calls)
	}
}

func TestResolverClientLooksUpRevocationByTarget(t *testing.T) {
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.Query().Get("type") != "revocation" || request.URL.Query().Get("target") != "oati:issuer:test" || request.URL.Query().Has("id") {
			t.Fatalf("unexpected revocation target request: %s", request.URL)
		}
		body := `{"type":"revocation","id":"oati:revocation:test:1","status":"active","issuer":"oati:issuer:root","proof_status":"verified","public_attributes":{"target":"oati:issuer:test","revocation_status":"good"}}`
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
	})
	client := NewResolverClient("https://resolver.test/oati/v1")
	client.HTTPClient = &http.Client{Transport: transport}
	record, err := client.LookupRevocationByTarget(t.Context(), "oati:issuer:test")
	if err != nil || record.ID != "oati:revocation:test:1" || record.PublicAttributes["target"] != "oati:issuer:test" {
		t.Fatalf("target lookup: %#v %v", record, err)
	}
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

func TestProfileSchemasResolveSharedCoreReferences(t *testing.T) {
	fixtures := map[string]string{"commerceMandate": "../../examples/commerce/purchase-mandate.json", "rwaReceipt": "../../examples/rwa/rwa-receipt.json"}
	for schema, path := range fixtures {
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var value any
		if err := decode(data, &value); err != nil {
			t.Fatal(err)
		}
		codes, err := ValidateSchema(schema, value, "../../schemas")
		if err != nil || len(codes) > 0 {
			t.Fatalf("%s: %v %v", schema, codes, err)
		}
	}
}
