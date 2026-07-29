package oati

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
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

func TestPublicProjectionAllTypesAndNestedSecrets(t *testing.T) {
	allowed := map[string]string{"organisation": "environment", "issuer": "parent", "key": "algorithm", "agent": "protocols", "passport": "subject", "mandate": "subject", "receipt": "outcome", "revocation": "target", "service": "document", "profile": "document"}
	for recordType, attribute := range allowed {
		value := "public"
		if attribute == "document" {
			value = "{}"
		}
		source := map[string]any{"type": recordType, "id": "oati:" + recordType + ":privacy", "display_name": recordType, "status": "active", "issuer": "oati:issuer:privacy", "proof_status": "verified", "public_attributes": map[string]any{attribute: value, "customer_payload": "secret"}}
		projected, err := ProjectPublicRecord(source)
		if err != nil {
			t.Fatalf("%s: %v", recordType, err)
		}
		attributes := projected["public_attributes"].(map[string]any)
		if len(attributes) != 1 || attributes[attribute] != value {
			t.Fatalf("%s leaked or omitted attributes: %v", recordType, attributes)
		}
	}
	base := map[string]any{"type": "service", "id": "oati:service:privacy", "display_name": "service", "status": "active", "issuer": "oati:issuer:privacy", "proof_status": "verified"}
	base["public_attributes"] = map[string]any{"document": `{"metadata":{"api_key":"must-not-leak"}}`}
	if _, err := ProjectPublicRecord(base); err == nil || !strings.Contains(err.Error(), "forbidden field api_key") {
		t.Fatalf("nested secret accepted: %v", err)
	}
	base["public_attributes"] = map[string]any{"document": `{"key":{"kty":"OKP","d":"private"}}`}
	if _, err := ProjectPublicRecord(base); err == nil || !strings.Contains(err.Error(), "private JWK material") {
		t.Fatalf("private JWK accepted: %v", err)
	}
}

func TestCanonicalJSONRFC8785Edges(t *testing.T) {
	actual, err := CanonicalJSON(map[string]any{"one": 1.0, "negative": -0.0, "fixed": 1e20, "scientific": 1e21})
	if err != nil || actual != `{"fixed":100000000000000000000,"negative":0,"one":1,"scientific":1e+21}` {
		t.Fatalf("canonical numbers: %q %v", actual, err)
	}
	actual, err = CanonicalJSON(map[string]any{"דּ": 7, "😀": 6, "€": 5})
	if err != nil || actual != `{"€":5,"😀":6,"דּ":7}` {
		t.Fatalf("UTF-16 ordering: %q %v", actual, err)
	}
	actual, err = CanonicalJSON([]int{1, 2, 3})
	if err != nil || actual != `[1,2,3]` {
		t.Fatalf("typed JSON array: %q %v", actual, err)
	}
}

func TestSchemaValidationEnforcesNumericSizeAndOneOf(t *testing.T) {
	proof := map[string]any{"type": "OatiJwsProof2026", "cryptosuite": "eddsa-jcs-2022", "algorithm": "EdDSA", "created": "2026-07-27T12:00:00Z", "expires": "2026-07-27T12:05:00Z", "verification_method": "oati:key:test:1", "proof_purpose": "assertionMethod", "audience": []any{}, "nonce": "proof-nonce-00001", "signature": "abc..def"}
	codes, err := ValidateSchema("proof", proof, "../../schemas")
	if err != nil || !containsCode(codes, "SCHEMA_ONEOF") {
		t.Fatalf("oneOf: %v %v", codes, err)
	}
	data, _ := os.ReadFile("../../conformance/discovery/service-valid.json")
	var service any
	_ = decode(data, &service)
	service.(map[string]any)["endpoints"].([]any)[0].(map[string]any)["priority"] = json.Number("65536")
	codes, err = ValidateSchema("serviceDiscovery", service, "../../schemas")
	if err != nil || !containsCode(codes, "SCHEMA_MAXIMUM") {
		t.Fatalf("maximum: %v %v", codes, err)
	}
}
func containsCode(codes []string, want string) bool {
	for _, code := range codes {
		if code == want {
			return true
		}
	}
	return false
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
	bundle := map[string]any{"trust_anchors": []any{"oati:issuer:test"}, "keys": []any{map[string]any{"id": "oati:key:test", "controller": "oati:agent:test", "issuer": "oati:issuer:test", "algorithm": "EdDSA", "status": "active", "valid_from": now.Add(-time.Hour).Format(time.RFC3339), "valid_until": now.Add(time.Hour).Format(time.RFC3339), "proof_status": "verified", "public_key_jwk": map[string]any{"kty": "OKP", "crv": "Ed25519", "x": base64.RawURLEncoding.EncodeToString(public)}}}}
	if codes := VerifyDocument(signed, bundle, "https://example.test", now.Add(time.Minute), NewReplayCache()); len(codes) > 0 {
		t.Fatalf("verification failed: %v", codes)
	}
}

func TestSignAndVerifyDocumentES256(t *testing.T) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC)
	document := map[string]any{"oati_version": "1.0", "id": "oati:tx:test:es256", "agent_id": "oati:agent:test", "issued_at": now.Format(time.RFC3339)}
	signed, err := SignDocumentES256(document, private, SigningOptions{VerificationMethod: "oati:key:test:es256", Audience: "https://example.test", Nonce: "es256-proof-nonce-001", Created: now, Expires: now.Add(5 * time.Minute)})
	if err != nil {
		t.Fatal(err)
	}
	proof := object(signed["proof"])
	parts := strings.Split(str(proof["signature"]), "..")
	if len(parts) != 2 {
		t.Fatalf("not detached JWS: %v", proof["signature"])
	}
	rawSignature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || len(rawSignature) != 64 {
		t.Fatalf("ES256 signature must be fixed-width R || S: %d %v", len(rawSignature), err)
	}
	bundle := map[string]any{"trust_anchors": []any{"oati:issuer:test"}, "keys": []any{map[string]any{"id": "oati:key:test:es256", "controller": "oati:agent:test", "issuer": "oati:issuer:test", "algorithm": "ES256", "status": "active", "valid_from": now.Add(-time.Hour).Format(time.RFC3339), "valid_until": now.Add(time.Hour).Format(time.RFC3339), "proof_status": "verified", "public_key_jwk": map[string]any{"kty": "EC", "crv": "P-256", "x": base64.RawURLEncoding.EncodeToString(private.X.FillBytes(make([]byte, 32))), "y": base64.RawURLEncoding.EncodeToString(private.Y.FillBytes(make([]byte, 32)))}}}}
	if codes := VerifyDocument(signed, bundle, "https://example.test", now.Add(time.Minute), NewReplayCache()); len(codes) > 0 {
		t.Fatalf("verification failed: %v", codes)
	}
	mismatched := *private
	mismatched.PublicKey = private.PublicKey
	mismatched.X = new(big.Int).Add(private.X, big.NewInt(1))
	if _, err := SignDocumentES256(document, &mismatched, SigningOptions{VerificationMethod: "oati:key:test:es256", Audience: "https://example.test", Nonce: "es256-proof-nonce-002", Created: now, Expires: now.Add(time.Minute)}); err == nil {
		t.Fatal("expected mismatched P-256 key rejection")
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
