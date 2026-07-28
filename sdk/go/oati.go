package oati

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

var schemaFiles = map[string]string{"proof": "proof.schema.json", "verificationKey": "verification-key.schema.json", "issuer": "issuer.schema.json", "revocation": "revocation.schema.json", "evaluationRequest": "evaluation-request.schema.json", "evaluationResult": "evaluation-result.schema.json", "publicRecord": "public-record.schema.json", "serviceDiscovery": "service-discovery.schema.json", "profileDiscovery": "profile-discovery.schema.json", "wellKnown": "well-known.schema.json", "conformanceSuite": "conformance-suite.schema.json", "conformanceReport": "conformance-report.schema.json", "passport": "passport.schema.json", "mandate": "mandate.schema.json", "envelope": "transaction-envelope.schema.json", "decision": "decision.schema.json", "receipt": "receipt.schema.json", "commerceOffer": "commerce/merchant-service-profile.schema.json", "commerceMandate": "commerce/purchase-mandate.schema.json", "commerceReceipt": "commerce/commerce-receipt.schema.json", "rwaAsset": "rwa/asset-profile.schema.json", "rwaStateClaim": "rwa/asset-state-claim.schema.json", "rwaMandate": "rwa/asset-mandate.schema.json", "rwaReceipt": "rwa/rwa-receipt.schema.json"}
var publicFields = []string{"type", "id", "display_name", "status", "issuer", "organisation_id", "issued_at", "expires_at", "assurance_level", "proof_status", "public_attributes"}

func CanonicalJSON(value any) (string, error) {
	var output bytes.Buffer
	encoder := json.NewEncoder(&output)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	return strings.TrimSuffix(output.String(), "\n"), nil
}
func BuildPassport(value map[string]any) map[string]any { return build(value) }
func BuildMandate(value map[string]any) map[string]any  { return build(value) }
func BuildEnvelope(value map[string]any) map[string]any { return build(value) }
func BuildDecision(value map[string]any) map[string]any { return build(value) }
func BuildReceipt(value map[string]any) map[string]any  { return build(value) }
func build(value map[string]any) map[string]any {
	encoded, _ := json.Marshal(value)
	var result map[string]any
	_ = decode(encoded, &result)
	result["oati_version"] = "1.0"
	return result
}
func ProjectPublicRecord(source map[string]any) (map[string]any, error) {
	result := map[string]any{}
	for _, key := range publicFields {
		if value, ok := source[key]; ok {
			result[key] = value
		}
	}
	for _, key := range []string{"type", "id", "display_name", "status", "issuer", "proof_status", "public_attributes"} {
		if _, ok := result[key]; !ok {
			return nil, fmt.Errorf("required public field %s is missing", key)
		}
	}
	return result, nil
}

func ValidateSchema(name string, value any, schemaRoot string) ([]string, error) {
	file, ok := schemaFiles[name]
	if !ok {
		return nil, fmt.Errorf("unknown schema %s", name)
	}
	data, err := os.ReadFile(schemaRoot + "/" + file)
	if err != nil {
		return nil, err
	}
	var schema map[string]any
	if err := decode(data, &schema); err != nil {
		return nil, err
	}
	codes := map[string]bool{}
	validate(value, schema, schema, codes, schemaRoot)
	result := make([]string, 0, len(codes))
	for code := range codes {
		result = append(result, code)
	}
	sort.Strings(result)
	return result, nil
}
func validate(value any, schema, root map[string]any, codes map[string]bool, schemaRoot string) {
	if reference := str(schema["$ref"]); reference != "" {
		if strings.HasPrefix(reference, "#/") {
			target := any(root)
			for _, part := range strings.Split(strings.TrimPrefix(reference, "#/"), "/") {
				target = target.(map[string]any)[part]
			}
			validate(value, target.(map[string]any), root, codes, schemaRoot)
		} else {
			data, err := os.ReadFile(schemaRoot + "/" + reference[strings.LastIndex(reference, "/")+1:])
			if err != nil {
				codes["SCHEMA_REFERENCE"] = true
				return
			}
			var external map[string]any
			if decode(data, &external) != nil {
				codes["SCHEMA_REFERENCE"] = true
				return
			}
			validate(value, external, external, codes, schemaRoot)
		}
		return
	}
	for _, branch := range list(schema["allOf"]) {
		validate(value, object(branch), root, codes, schemaRoot)
	}
	if kind := str(schema["type"]); kind != "" && !matchesType(value, kind) {
		codes["SCHEMA_TYPE"] = true
		return
	}
	if expected, ok := schema["const"]; ok && !equal(value, expected) {
		codes["SCHEMA_CONST"] = true
	}
	if values := list(schema["enum"]); values != nil && !containsAny(values, value) {
		codes["SCHEMA_ENUM"] = true
	}
	switch typed := value.(type) {
	case string:
		if len(typed) < integer(schema["minLength"]) {
			codes["SCHEMA_MINLENGTH"] = true
		}
		if pattern := str(schema["pattern"]); pattern != "" {
			if matched, _ := regexp.MatchString(pattern, typed); !matched {
				codes["SCHEMA_PATTERN"] = true
			}
		}
		if format := str(schema["format"]); format == "date-time" {
			if _, err := time.Parse(time.RFC3339Nano, typed); err != nil {
				codes["SCHEMA_FORMAT"] = true
			}
		} else if format == "uri" {
			if parsed, err := url.ParseRequestURI(typed); err != nil || parsed.Scheme == "" {
				codes["SCHEMA_FORMAT"] = true
			}
		}
	case []any:
		if len(typed) < integer(schema["minItems"]) {
			codes["SCHEMA_MINITEMS"] = true
		}
		if unique, _ := schema["uniqueItems"].(bool); unique {
			for index := range typed {
				for previous := 0; previous < index; previous++ {
					if equal(typed[index], typed[previous]) {
						codes["SCHEMA_UNIQUEITEMS"] = true
					}
				}
			}
		}
		if items := object(schema["items"]); items != nil {
			for _, item := range typed {
				validate(item, items, root, codes, schemaRoot)
			}
		}
	case map[string]any:
		properties := object(schema["properties"])
		for _, required := range stringsFrom(schema["required"]) {
			if _, ok := typed[required]; !ok {
				codes["SCHEMA_REQUIRED"] = true
			}
		}
		if additional, ok := schema["additionalProperties"].(bool); ok && !additional {
			for key := range typed {
				if _, ok := properties[key]; !ok {
					codes["SCHEMA_ADDITIONALPROPERTIES"] = true
				}
			}
		}
		for key, item := range typed {
			if child := object(properties[key]); child != nil {
				validate(item, child, root, codes, schemaRoot)
			} else if child := object(schema["additionalProperties"]); child != nil {
				validate(item, child, root, codes, schemaRoot)
			}
		}
	}
}

type PublicRecord struct {
	Type             string            `json:"type"`
	ID               string            `json:"id"`
	DisplayName      string            `json:"display_name"`
	Status           string            `json:"status"`
	Issuer           string            `json:"issuer"`
	OrganisationID   string            `json:"organisation_id,omitempty"`
	ProofStatus      string            `json:"proof_status"`
	PublicAttributes map[string]string `json:"public_attributes"`
}
type LookupClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

func (client LookupClient) Lookup(ctx context.Context, kind, id string) (PublicRecord, error) {
	if client.HTTPClient == nil {
		client.HTTPClient = &http.Client{Timeout: 5 * time.Second}
	}
	endpoint := strings.TrimSuffix(client.BaseURL, "/") + "/lookup?type=" + url.QueryEscape(kind) + "&id=" + url.QueryEscape(id)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return PublicRecord{}, err
	}
	response, err := client.HTTPClient.Do(request)
	if err != nil {
		return PublicRecord{}, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return PublicRecord{}, errors.New("LOOKUP_NOT_FOUND")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return PublicRecord{}, fmt.Errorf("LOOKUP_UNAVAILABLE: HTTP %d", response.StatusCode)
	}
	var record PublicRecord
	if err := json.NewDecoder(response.Body).Decode(&record); err != nil {
		return PublicRecord{}, fmt.Errorf("LOOKUP_INVALID_RESPONSE: %w", err)
	}
	return record, nil
}

func decode(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	return decoder.Decode(target)
}
func object(v any) map[string]any { result, _ := v.(map[string]any); return result }
func list(v any) []any            { result, _ := v.([]any); return result }
func str(v any) string            { result, _ := v.(string); return result }
func integer(v any) int {
	switch n := v.(type) {
	case json.Number:
		i, _ := n.Int64()
		return int(i)
	case float64:
		return int(n)
	case int:
		return n
	}
	return 0
}
func stringsFrom(v any) []string {
	if values, ok := v.([]string); ok {
		return append([]string{}, values...)
	}
	items := list(v)
	result := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok {
			result = append(result, text)
		}
	}
	return result
}
func matchesType(v any, k string) bool {
	switch k {
	case "object":
		_, ok := v.(map[string]any)
		return ok
	case "array":
		_, ok := v.([]any)
		return ok
	case "string":
		_, ok := v.(string)
		return ok
	case "boolean":
		_, ok := v.(bool)
		return ok
	case "integer":
		n, ok := v.(json.Number)
		if ok {
			_, e := n.Int64()
			return e == nil
		}
		_, ok = v.(int)
		return ok
	case "number":
		switch v.(type) {
		case json.Number, float64, int:
			return true
		}
	}
	return false
}
func containsAny(values []any, target any) bool {
	for _, v := range values {
		if equal(v, target) {
			return true
		}
	}
	return false
}
func equal(a, b any) bool {
	left, _ := CanonicalJSON(a)
	right, _ := CanonicalJSON(b)
	return left == right
}
