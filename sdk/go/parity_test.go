package oati

import (
	"io"
	"net/http"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
)

func sameCodes(actual, expected []string) bool {
	if len(actual) != len(expected) {
		return false
	}
	for index := range actual {
		if actual[index] != expected[index] {
			return false
		}
	}
	return true
}

func fixture(t *testing.T, path string) any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var value any
	if err := decode(data, &value); err != nil {
		t.Fatal(err)
	}
	return value
}

func TestParityCoreBuildersCanonicalJSONAndPrivacy(t *testing.T) {
	input := map[string]any{"id": "oati:mandate:test:1", "actions": []any{"read"}, "nested": map[string]any{"z": 1, "a": 2}}
	built := BuildMandate(input)
	built["actions"].([]any)[0] = "write"
	if input["actions"].([]any)[0] != "read" || built["oati_version"] != "1.0" {
		t.Fatal("builder mutated input or omitted version")
	}
	builders := map[string]func(map[string]any) map[string]any{
		"passport": BuildPassport,
		"mandate":  BuildMandate,
		"envelope": BuildEnvelope,
		"decision": BuildDecision,
		"receipt":  BuildReceipt,
	}
	for name, builder := range builders {
		t.Run(name, func(t *testing.T) {
			value := map[string]any{"id": "oati:" + name + ":test"}
			if result := builder(value); result["oati_version"] != "1.0" || value["oati_version"] != nil {
				t.Fatalf("builder result=%v input=%v", result, value)
			}
		})
	}
	canonical, err := CanonicalJSON(map[string]any{"z": 1, "a": map[string]any{"y": 2, "b": 3}})
	if err != nil || canonical != `{"a":{"b":3,"y":2},"z":1}` {
		t.Fatalf("canonical JSON: %q %v", canonical, err)
	}
	private := fixture(t, "../../conformance/privacy/private-registry-record.json").(map[string]any)
	expected := fixture(t, "../../conformance/privacy/expected-public-record.json")
	projected, err := ProjectPublicRecord(private)
	if err != nil || !equal(projected, expected) {
		t.Fatalf("privacy projection mismatch: %v", err)
	}
	if _, leaked := projected["private_attributes"]; leaked {
		t.Fatal("private attributes leaked")
	}
}

func TestParityDiscoverySchemasAndStableCodes(t *testing.T) {
	cases := []struct {
		name, schema, path string
		codes              []string
	}{
		{"service-valid", "serviceDiscovery", "../../conformance/discovery/service-valid.json", nil},
		{"service-invalid", "serviceDiscovery", "../../conformance/discovery/service-invalid.json", []string{"SCHEMA_ADDITIONALPROPERTIES", "SCHEMA_ENUM", "SCHEMA_PATTERN", "SCHEMA_REQUIRED"}},
		{"profile-valid", "profileDiscovery", "../../conformance/discovery/profile-valid.json", nil},
		{"profile-invalid", "profileDiscovery", "../../conformance/discovery/profile-invalid.json", []string{"SCHEMA_ADDITIONALPROPERTIES", "SCHEMA_FORMAT", "SCHEMA_PATTERN"}},
		{"well-known-invalid", "wellKnown", "../../conformance/discovery/well-known-invalid.json", []string{"SCHEMA_ADDITIONALPROPERTIES", "SCHEMA_FORMAT", "SCHEMA_PATTERN", "SCHEMA_UNIQUEITEMS"}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			codes, err := ValidateSchema(test.schema, fixture(t, test.path), "../../schemas")
			if err != nil || !sameCodes(codes, test.codes) {
				t.Fatalf("codes=%v expected=%v err=%v", codes, test.codes, err)
			}
		})
	}
}

func TestParityAllPublishedExamplesValidate(t *testing.T) {
	examples := []struct {
		schema string
		path   string
	}{
		{"proof", "../../examples/proof.json"},
		{"issuer", "../../examples/issuer.json"},
		{"verificationKey", "../../examples/verification-key.json"},
		{"revocation", "../../examples/revocation.json"},
		{"passport", "../../examples/passport.json"},
		{"mandate", "../../examples/mandate.json"},
		{"receipt", "../../examples/receipt.json"},
		{"evaluationRequest", "../../examples/evaluation-request.json"},
		{"evaluationResult", "../../examples/evaluation-result.json"},
		{"publicRecord", "../../examples/public-record.json"},
		{"envelope", "../../examples/commerce/transaction-envelope.json"},
		{"decision", "../../examples/decision.json"},
		{"wellKnown", "../../examples/well-known-oati.json"},
		{"commerceOffer", "../../examples/commerce/merchant-service-profile.json"},
		{"commerceMandate", "../../examples/commerce/purchase-mandate.json"},
		{"commerceReceipt", "../../examples/commerce/commerce-receipt.json"},
		{"rwaAsset", "../../examples/rwa/asset-profile.json"},
		{"rwaStateClaim", "../../examples/rwa/asset-state-claim.json"},
		{"rwaMandate", "../../examples/rwa/mint-mandate.json"},
		{"rwaReceipt", "../../examples/rwa/rwa-receipt.json"},
	}
	for _, example := range examples {
		t.Run(example.schema, func(t *testing.T) {
			codes, err := ValidateSchema(example.schema, fixture(t, example.path), "../../schemas")
			if err != nil || len(codes) > 0 {
				t.Fatalf("codes=%v err=%v", codes, err)
			}
		})
	}
}

func TestParityCryptoLifecycleVectors(t *testing.T) {
	now := time.Date(2026, 7, 27, 12, 2, 0, 0, time.UTC)
	cases := []struct {
		name, document, bundle string
		expected               []string
	}{
		{"es256-valid", "es256-signed-envelope.json", "es256-trust-bundle.json", nil},
		{"es256-tampered", "es256-tampered-envelope.json", "es256-trust-bundle.json", []string{"SIGNATURE_INVALID"}},
		{"issuer-chain", "signed-envelope.json", "issuer-chain-trust-bundle.json", nil},
		{"issuer-missing", "signed-envelope.json", "issuer-chain-broken-bundle.json", []string{"ISSUER_NOT_TRUSTED"}},
		{"issuer-cycle", "signed-envelope.json", "issuer-chain-cycle-bundle.json", []string{"ISSUER_NOT_TRUSTED"}},
		{"issuer-suspended", "signed-envelope.json", "issuer-suspended-bundle.json", []string{"ISSUER_REVOKED"}},
		{"rotation-overlap", "signed-envelope.json", "rotation-retired-bundle.json", nil},
		{"rotation-no-expiry", "signed-envelope.json", "rotation-retired-without-expiry-bundle.json", []string{"KEY_INVALID"}},
		{"rotation-expired", "signed-envelope.json", "rotation-proof-after-key-expiry-bundle.json", []string{"KEY_INVALID"}},
		{"key-revoked", "signed-envelope.json", "revocation-key-target-bundle.json", []string{"KEY_REVOKED"}},
		{"issuer-revoked", "signed-envelope.json", "revocation-issuer-target-bundle.json", []string{"ISSUER_REVOKED"}},
		{"document-suspended", "signed-envelope.json", "revocation-document-suspended-bundle.json", []string{"DOCUMENT_REVOKED"}},
		{"future-revocation", "signed-envelope.json", "revocation-future-effective-bundle.json", nil},
		{"ambiguous-revocation", "signed-envelope.json", "revocation-ambiguous-bundle.json", []string{"REVOCATION_UNAVAILABLE"}},
		{"unavailable-revocation", "signed-envelope.json", "revocation-unavailable-bundle.json", []string{"REVOCATION_UNAVAILABLE"}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			document := fixture(t, "../../conformance/crypto/"+test.document).(map[string]any)
			bundle := fixture(t, "../../conformance/crypto/"+test.bundle).(map[string]any)
			codes := VerifyDocument(document, bundle, "https://merchant.example", now, NewReplayCache())
			if !sameCodes(codes, test.expected) {
				t.Fatalf("codes=%v expected=%v", codes, test.expected)
			}
		})
	}
	document := fixture(t, "../../conformance/crypto/signed-envelope.json").(map[string]any)
	bundle := fixture(t, "../../conformance/crypto/trust-bundle.json").(map[string]any)
	cache := NewReplayCache()
	if codes := VerifyDocument(document, bundle, "https://merchant.example", now, cache); len(codes) > 0 {
		t.Fatal(codes)
	}
	if codes := VerifyDocument(document, bundle, "https://merchant.example", now, cache); !reflect.DeepEqual(codes, []string{"REPLAY_DETECTED"}) {
		t.Fatalf("replay=%v", codes)
	}
}

func TestParityEvaluatorRunsEverySharedVector(t *testing.T) {
	suite := fixture(t, "../../conformance/evaluator/cases.json").(map[string]any)
	for _, raw := range suite["cases"].([]any) {
		vector := raw.(map[string]any)
		t.Run(str(vector["name"]), func(t *testing.T) {
			actual, err := EvaluateAuthority(vector["request"].(map[string]any))
			if err != nil {
				t.Fatal(err)
			}
			expected := vector["expected"].(map[string]any)
			if str(actual["decision"]) != str(expected["decision"]) || !equal(actual["reason_codes"], expected["reason_codes"]) || expected["next_usage"] != nil && !equal(actual["next_usage"], expected["next_usage"]) {
				t.Fatalf("actual=%v expected=%v", actual, expected)
			}
		})
	}
}

func TestParityLookupFailoverRateLimitStateAndDiscovery(t *testing.T) {
	calls := []string{}
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		calls = append(calls, request.URL.String())
		if request.URL.Host == "primary.test" {
			return &http.Response{StatusCode: 503, Body: io.NopCloser(strings.NewReader(`{}`)), Header: http.Header{}, Request: request}, nil
		}
		body := `{"type":"agent","id":"oati:agent:test","status":"active","issuer":"oati:issuer:test","proof_status":"verified","public_attributes":{}}`
		header := http.Header{}
		header.Set("X-RateLimit-Limit", "100")
		header.Set("X-RateLimit-Remaining", "73")
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: header, Request: request}, nil
	})
	client := NewResolverClient("https://primary.test/oati/v1", "https://secondary.test/oati/v1")
	client.HTTPClient = &http.Client{Transport: transport}
	client.MaxRetries = 0
	result, err := client.LookupDetailed(t.Context(), "agent", "oati:agent:test", false)
	if err != nil || result.ResolverURL != "https://secondary.test/oati/v1" || result.RateLimit.Remaining != 73 || len(calls) != 2 {
		t.Fatalf("failover=%#v calls=%v err=%v", result, calls, err)
	}
	invalidTransport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body := `{"type":"key","id":"oati:key:test","status":"active","issuer":"oati:issuer:test","issued_at":"2026-01-01T00:00:00Z","expires_at":"2027-01-01T00:00:00Z","proof_status":"invalid","public_attributes":{"controller":"oati:issuer:test","algorithm":"EdDSA","public_key_jwk":"{}"}}`
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}, Request: request}, nil
	})
	invalid := NewResolverClient("https://resolver.test/oati/v1")
	invalid.HTTPClient = &http.Client{Transport: invalidTransport}
	if state := invalid.LookupState(t.Context(), "key", "oati:key:test"); state.State != "invalid_proof" {
		t.Fatalf("state=%#v", state)
	}
	discoveryTransport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, _ := os.ReadFile("../../conformance/discovery/organisation-valid.json")
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body))), Header: http.Header{}, Request: request}, nil
	})
	discoveryClient := NewResolverClient("https://resolver.test/oati/v1")
	discoveryClient.HTTPClient = &http.Client{Transport: discoveryTransport}
	discovery, err := discoveryClient.DiscoverOrganisation(t.Context(), "oati:org:merchant-b")
	if err != nil || len(discovery.Services) != 1 || discovery.Services[0].Document["id"] != "oati:service:merchant-b:checkout" {
		t.Fatalf("discovery=%#v err=%v", discovery, err)
	}
	federatedTransport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path == "/.well-known/oati" {
			body := `{"oati_version":"1.0","organisations":["oati:org:merchant-b"],"resolvers":["https://resolver.test/oati/v1"]}`
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}, Request: request}, nil
		}
		body, _ := os.ReadFile("../../conformance/discovery/organisation-valid.json")
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body))), Header: http.Header{}, Request: request}, nil
	})
	federatedClient := NewResolverClient()
	federatedClient.HTTPClient = &http.Client{Transport: federatedTransport}
	federated, err := federatedClient.DiscoverFederated(t.Context(), "merchant.example", "oati:org:merchant-b")
	if err != nil || len(federated.Profiles) != 1 || federated.Profiles[0].Document["id"] != "oati:profile:merchant-b:commerce-1" {
		t.Fatalf("federated=%#v err=%v", federated, err)
	}
}
