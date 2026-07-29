package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
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

func TestLookupRevocationByTarget(t *testing.T) {
	previousClientFactory := newLookupHTTPClient
	newLookupHTTPClient = func(time.Duration) *http.Client {
		return &http.Client{Transport: lookupRoundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Query().Get("type") != "revocation" || r.URL.Query().Get("target") != "oati:issuer:test" || r.URL.Query().Has("id") {
				t.Fatalf("unexpected lookup query: %s", r.URL.RawQuery)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"type":"revocation","id":"oati:revocation:test:1","status":"active","issuer":"oati:issuer:root","proof_status":"verified","public_attributes":{"target":"oati:issuer:test","revocation_status":"good"}}`)),
				Request:    r,
			}, nil
		})}
	}
	defer func() { newLookupHTTPClient = previousClientFactory }()
	var stdout, stderr bytes.Buffer
	if err := runLookup([]string{"--api", "https://resolver.test/oati/v1", "--type", "revocation", "--target", "oati:issuer:test"}, &stdout, &stderr); err != nil {
		t.Fatalf("lookup: %v\n%s", err, stderr.String())
	}
	if !strings.Contains(stdout.String(), "oati:revocation:test:1") {
		t.Fatalf("unexpected lookup output: %s", stdout.String())
	}
}

func TestDiscoverOrganisation(t *testing.T) {
	previousClientFactory := newLookupHTTPClient
	newLookupHTTPClient = func(time.Duration) *http.Client {
		return &http.Client{Transport: lookupRoundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path != "/oati/v1/discovery" || r.URL.Query().Get("organisation_id") != "oati:org:merchant-b" {
				t.Fatalf("unexpected discovery request: %s", r.URL.String())
			}
			body := `{"organisation_id":"oati:org:merchant-b","services":[{"type":"service","id":"oati:service:merchant-b:checkout","organisation_id":"oati:org:merchant-b","status":"active","issuer":"oati:issuer:merchant-b","proof_status":"verified","public_attributes":{"document":"{}"}}],"profiles":[]}`
			return &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(body)), Request: r}, nil
		})}
	}
	defer func() { newLookupHTTPClient = previousClientFactory }()
	var stdout, stderr bytes.Buffer
	if err := runDiscover([]string{"--api", "https://resolver.test/oati/v1", "--organisation", "oati:org:merchant-b"}, &stdout, &stderr); err != nil {
		t.Fatalf("discover: %v", err)
	}
	if !strings.Contains(stdout.String(), "oati:service:merchant-b:checkout") {
		t.Fatalf("unexpected output: %s", stdout.String())
	}
}

type lookupRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn lookupRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
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

func TestCommerceReceiptRejectsAmountAboveMandate(t *testing.T) {
	mandate := map[string]any{
		"extensions": map[string]any{"commerce": map[string]any{
			"merchant_organisation_id": "oati:org:seller",
			"service_id":               "oati:service:seller:api",
			"offer_id":                 "offer-1",
			"currency":                 "EUR",
			"max_unit_price":           "1.00",
			"max_total":                "2.00",
			"max_quantity":             json.Number("2"),
		}},
	}
	receipt := map[string]any{
		"extensions": map[string]any{"commerce": map[string]any{
			"merchant_organisation_id": "oati:org:seller",
			"service_id":               "oati:service:seller:api",
			"offer_id":                 "offer-1",
			"currency":                 "EUR",
			"unit_price":               "1.50",
			"total_amount":             "3.00",
			"quantity":                 json.Number("2"),
		}},
	}
	issues := compareCommerceReceipt(receipt, mandate)
	if len(issues) != 2 {
		t.Fatalf("expected price violations, got %v", issues)
	}
}

func TestMintMandateRejectsReserveAmplification(t *testing.T) {
	mandate := map[string]any{
		"extensions": map[string]any{"rwa": map[string]any{
			"asset_id":       "oati:asset:test:one",
			"state_claim_id": "oati:claim:test:one",
			"unit":           "EUR",
			"max_quantity":   "1001.00",
		}},
	}
	claim := map[string]any{
		"id":       "oati:claim:test:one",
		"asset_id": "oati:asset:test:one",
		"unit":     "EUR",
		"value":    "1000.00",
	}
	issues := compareMintMandate(mandate, claim)
	if len(issues) != 1 || issues[0] != "mint authority exceeds claimed reserve" {
		t.Fatalf("expected reserve violation, got %v", issues)
	}
}

func TestCommerceReceiptRejectsInconsistentArithmeticAndTerms(t *testing.T) {
	receipt := map[string]any{"profile": commerceProfile, "mandate_id": "oati:mandate:test", "extensions": map[string]any{"commerce": map[string]any{
		"merchant_organisation_id": "oati:org:seller", "service_id": "oati:service:seller:data", "offer_id": "offer-1",
		"currency": "EUR", "quantity": json.Number("2"), "unit_price": "1.00", "total_amount": "1.00", "terms_digest": "sha256:changed",
	}}}
	mandate := map[string]any{"id": "oati:mandate:test", "extensions": map[string]any{"commerce": map[string]any{
		"merchant_organisation_id": "oati:org:seller", "service_id": "oati:service:seller:data", "offer_id": "offer-1",
		"currency": "EUR", "max_quantity": json.Number("2"), "max_unit_price": "1.00", "max_total": "2.00", "terms_digest": "sha256:terms",
	}}}
	issues := append(validateCommerceReceipt(receipt), compareCommerceReceipt(receipt, mandate)...)
	if !contains(issues, "total amount must equal unit price multiplied by quantity") || !contains(issues, "terms digest differs from Mandate") {
		t.Fatalf("expected arithmetic and terms violations, got %v", issues)
	}
}

func TestRwaControlledMintRejectsWrongEvidenceAndReceiptBindings(t *testing.T) {
	mandate := map[string]any{"id": "oati:mandate:test", "extensions": map[string]any{"rwa": map[string]any{
		"asset_id": "oati:asset:test", "state_claim_id": "oati:claim:test", "operation": "mint", "network": "eip155:1",
		"token_contract": "0x1", "unit": "EUR", "max_quantity": "10", "minimum_approvals": json.Number("2"),
	}}}
	claim := map[string]any{"id": "oati:claim:test", "asset_id": "oati:asset:test", "claim_type": "nav", "unit": "EUR", "value": "10"}
	if issues := compareMintMandate(mandate, claim); !contains(issues, "controlled mint requires a reserve_balance State Claim") {
		t.Fatalf("expected reserve claim violation, got %v", issues)
	}
	receipt := map[string]any{"mandate_id": "oati:mandate:test", "extensions": map[string]any{"rwa": map[string]any{
		"asset_id": "oati:asset:test", "state_claim_id": "oati:claim:test", "operation": "burn", "network": "eip155:1",
		"token_contract": "0x1", "quantity": "1", "unit": "USD", "chain_transaction_hash": "0x2", "approval_count": json.Number("2"), "resulting_supply": "9",
	}}}
	issues := compareRwaReceipt(receipt, mandate)
	if !contains(issues, "operation differs from Mandate") || !contains(issues, "unit differs from Mandate") {
		t.Fatalf("expected operation and unit violations, got %v", issues)
	}
}

func TestCryptographicConformanceVectorAndReplay(t *testing.T) {
	root := filepath.Join("..", "..", "..", "conformance", "crypto")
	var signed, stderr bytes.Buffer
	err := run([]string{"sign", "--algorithm", "EdDSA", "--key", filepath.Join(root, "ed25519-private.jwk"),
		"--verification-method", "oati:key:conformance:ed25519-1", "--audience", "https://merchant.example",
		"--nonce", "proof-nonce-000000000001", "--created", "2026-07-27T12:00:00Z", "--expires", "5m",
		filepath.Join(root, "unsigned-envelope.json")}, &signed, &stderr)
	if err != nil {
		t.Fatalf("sign: %v\n%s", err, stderr.String())
	}
	want, err := os.ReadFile(filepath.Join(root, "signed-envelope.json"))
	if err != nil {
		t.Fatal(err)
	}
	var gotObject, wantObject any
	if json.Unmarshal(signed.Bytes(), &gotObject) != nil || json.Unmarshal(want, &wantObject) != nil || !objectsEqual(gotObject, wantObject) {
		t.Fatalf("signed vector differs:\n%s", signed.String())
	}

	replay := filepath.Join(t.TempDir(), "replay.json")
	args := []string{"verify", "--trust-bundle", filepath.Join(root, "trust-bundle.json"), "--audience", "https://merchant.example", "--replay-cache", replay, "--now", "2026-07-27T12:01:00Z", filepath.Join(root, "signed-envelope.json")}
	var verified bytes.Buffer
	if err := run(args, &verified, &stderr); err != nil {
		t.Fatalf("verify: %v\n%s", err, verified.String())
	}
	if !strings.Contains(verified.String(), `"verified": true`) {
		t.Fatalf("unexpected report: %s", verified.String())
	}
	verified.Reset()
	if err := run(args, &verified, &stderr); err == nil || !strings.Contains(verified.String(), "REPLAY_DETECTED") {
		t.Fatalf("expected replay rejection: %v %s", err, verified.String())
	}
}

func TestCryptographicVerificationRejectsTampering(t *testing.T) {
	root := filepath.Join("..", "..", "..", "conformance", "crypto")
	var stdout, stderr bytes.Buffer
	err := run([]string{"verify", "--trust-bundle", filepath.Join(root, "trust-bundle.json"), "--audience", "https://merchant.example", "--replay-cache", filepath.Join(t.TempDir(), "replay.json"), "--now", "2026-07-27T12:01:00Z", filepath.Join(root, "tampered-envelope.json")}, &stdout, &stderr)
	if err == nil || !strings.Contains(stdout.String(), "SIGNATURE_INVALID") {
		t.Fatalf("expected signature rejection: %v %s", err, stdout.String())
	}
}

func TestCryptographicPolicyChecksFailClosed(t *testing.T) {
	root := filepath.Join("..", "..", "..", "conformance", "crypto")
	value, err := readObject(filepath.Join(root, "signed-envelope.json"))
	if err != nil {
		t.Fatal(err)
	}
	var bundle trustBundle
	if err := readJSONFile(filepath.Join(root, "trust-bundle.json"), &bundle); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 7, 27, 12, 1, 0, 0, time.UTC)

	revoked := bundle
	revoked.Keys = append([]verificationKey(nil), bundle.Keys...)
	revoked.Keys[0].Status = "revoked"
	if report := verifyObject(value, revoked, "https://merchant.example", now, 5*time.Minute, 30*time.Second); !reportHas(report, "KEY_REVOKED") {
		t.Fatalf("expected revoked key failure: %#v", report)
	}

	if report := verifyObject(value, bundle, "https://other.example", now, 5*time.Minute, 30*time.Second); !reportHas(report, "AUDIENCE_MISMATCH") {
		t.Fatalf("expected audience failure: %#v", report)
	}

	untrusted := bundle
	untrusted.TrustAnchors = []string{"oati:issuer:other-root"}
	if report := verifyObject(value, untrusted, "https://merchant.example", now, 5*time.Minute, 30*time.Second); !reportHas(report, "ISSUER_NOT_TRUSTED") {
		t.Fatalf("expected issuer trust failure: %#v", report)
	}

	late := time.Date(2026, 7, 27, 12, 10, 0, 0, time.UTC)
	if report := verifyObject(value, bundle, "https://merchant.example", late, 5*time.Minute, 30*time.Second); !reportHas(report, "PROOF_EXPIRED") {
		t.Fatalf("expected expiry failure: %#v", report)
	}
}

func TestCryptographicLifecycleAndMalformedProofVectors(t *testing.T) {
	root := filepath.Join("..", "..", "..", "conformance", "crypto")
	now := time.Date(2026, 7, 27, 12, 2, 0, 0, time.UTC)
	cases := []struct {
		document, bundle, code string
	}{
		{"missing-proof-envelope.json", "trust-bundle.json", "PROOF_MISSING"},
		{"malformed-proof-envelope.json", "trust-bundle.json", "PROOF_MALFORMED"},
		{"protected-header-mismatch-envelope.json", "trust-bundle.json", "SIGNATURE_INVALID"},
		{"ed25519-small-order-forgery-envelope.json", "ed25519-small-order-trust-bundle.json", "KEY_INVALID"},
		{"signed-envelope.json", "invalid-key-time-bundle.json", "KEY_INVALID"},
		{"signed-envelope.json", "invalid-issuer-time-bundle.json", "ISSUER_REVOKED"},
		{"signed-envelope.json", "revocation-intermediate-target-bundle.json", "ISSUER_REVOKED"},
	}
	for _, test := range cases {
		t.Run(test.code+"/"+test.bundle, func(t *testing.T) {
			value, err := readObject(filepath.Join(root, test.document))
			if err != nil {
				t.Fatal(err)
			}
			var bundle trustBundle
			if err := readJSONFile(filepath.Join(root, test.bundle), &bundle); err != nil {
				t.Fatal(err)
			}
			if report := verifyObject(value, bundle, "https://merchant.example", now, 5*time.Minute, 30*time.Second); !reportHas(report, test.code) {
				t.Fatalf("expected %s: %#v", test.code, report)
			}
		})
	}
}

func TestES256PrimitiveRoundTrip(t *testing.T) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	encode := func(value []byte) string { return base64.RawURLEncoding.EncodeToString(value) }
	key := jwk{Kty: "EC", Crv: "P-256", X: encode(private.X.FillBytes(make([]byte, 32))), Y: encode(private.Y.FillBytes(make([]byte, 32))), D: encode(private.D.FillBytes(make([]byte, 32)))}
	message := []byte("OATI ES256 conformance")
	signature, err := signBytes("ES256", key, message)
	if err != nil {
		t.Fatal(err)
	}
	if err := verifyBytes("ES256", key, message, signature); err != nil {
		t.Fatal(err)
	}
}

func TestEvaluatorConformanceVectors(t *testing.T) {
	path := filepath.Join("..", "..", "..", "conformance", "evaluator", "cases.json")
	suite, err := readObject(path)
	if err != nil {
		t.Fatal(err)
	}
	cases, ok := suite["cases"].([]any)
	if !ok || len(cases) == 0 {
		t.Fatal("missing evaluator cases")
	}
	for _, raw := range cases {
		vector := objectFromAny(raw)
		t.Run(stringValue(vector, "name"), func(t *testing.T) {
			result, err := evaluateAuthority(objectValue(vector, "request"))
			if err != nil {
				t.Fatal(err)
			}
			expected := objectValue(vector, "expected")
			if result["decision"] != expected["decision"] || !objectsEqual(result["reason_codes"], expected["reason_codes"]) {
				t.Fatalf("unexpected decision: %#v expected %#v", result, expected)
			}
			if expectedUsage := objectValue(expected, "next_usage"); expectedUsage != nil && !objectsEqual(result["next_usage"], expectedUsage) {
				t.Fatalf("unexpected usage: %#v expected %#v", result["next_usage"], expectedUsage)
			}
		})
	}
}

func TestEvaluateCommandReturnsDeterministicJSON(t *testing.T) {
	path := filepath.Join("..", "..", "..", "conformance", "evaluator", "cases.json")
	suite, err := readObject(path)
	if err != nil {
		t.Fatal(err)
	}
	vector := objectFromAny(suite["cases"].([]any)[0])
	request, _ := json.Marshal(vector["request"])
	requestPath := writeFixture(t, string(request))
	var stdout, stderr bytes.Buffer
	if err := run([]string{"evaluate", requestPath}, &stdout, &stderr); err != nil {
		t.Fatalf("evaluate: %v %s", err, stderr.String())
	}
	if !strings.Contains(stdout.String(), `"decision": "allow"`) || !strings.Contains(stdout.String(), `"next_usage"`) {
		t.Fatalf("unexpected output: %s", stdout.String())
	}
}

func TestEvaluatorBindsMandateSubjectToEnvelopeAgent(t *testing.T) {
	path := filepath.Join("..", "..", "..", "conformance", "evaluator", "cases.json")
	suite, err := readObject(path)
	if err != nil {
		t.Fatal(err)
	}
	vector := objectFromAny(suite["cases"].([]any)[7])
	request := objectValue(vector, "request")
	objectValue(request, "envelope")["agent_id"] = "oati:agent:attacker:one"
	result, err := evaluateAuthority(request)
	if err != nil {
		t.Fatal(err)
	}
	if !contains(stringList(result["reason_codes"]), "SUBJECT_MISMATCH") {
		t.Fatalf("expected SUBJECT_MISMATCH: %#v", result)
	}
}

func objectsEqual(left, right any) bool {
	a, _ := json.Marshal(left)
	b, _ := json.Marshal(right)
	return bytes.Equal(a, b)
}

func reportHas(report verificationReport, code string) bool {
	for _, issue := range report.Issues {
		if issue.Code == code {
			return true
		}
	}
	return false
}

func writeFixture(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fixture.json")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}
