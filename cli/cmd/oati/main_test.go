package main

import (
	"bytes"
	"encoding/json"
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

func writeFixture(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fixture.json")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}
