package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
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
