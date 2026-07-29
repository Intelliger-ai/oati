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
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
	"unicode/utf8"
)

var schemaFiles = map[string]string{"proof": "proof.schema.json", "verificationKey": "verification-key.schema.json", "issuer": "issuer.schema.json", "revocation": "revocation.schema.json", "evaluationRequest": "evaluation-request.schema.json", "evaluationResult": "evaluation-result.schema.json", "publicRecord": "public-record.schema.json", "serviceDiscovery": "service-discovery.schema.json", "profileDiscovery": "profile-discovery.schema.json", "wellKnown": "well-known.schema.json", "conformanceSuite": "conformance-suite.schema.json", "conformanceReport": "conformance-report.schema.json", "passport": "passport.schema.json", "mandate": "mandate.schema.json", "envelope": "transaction-envelope.schema.json", "decision": "decision.schema.json", "receipt": "receipt.schema.json", "commerceOffer": "commerce/merchant-service-profile.schema.json", "commerceMandate": "commerce/purchase-mandate.schema.json", "commerceReceipt": "commerce/commerce-receipt.schema.json", "rwaAsset": "rwa/asset-profile.schema.json", "rwaStateClaim": "rwa/asset-state-claim.schema.json", "rwaMandate": "rwa/asset-mandate.schema.json", "rwaReceipt": "rwa/rwa-receipt.schema.json"}
var publicFields = []string{"type", "id", "display_name", "status", "issuer", "organisation_id", "issued_at", "expires_at", "assurance_level", "proof_status", "public_attributes"}
var publicAttributesByType = map[string]map[string]bool{
	"organisation": {"environment": true, "website": true, "jurisdiction": true, "signed_document": true},
	"issuer":       {"environment": true, "parent": true, "revoked_at": true, "signed_document": true},
	"key":          {"controller": true, "algorithm": true, "public_key_jwk": true, "revoked_at": true, "signed_document": true},
	"agent":        {"protocol": true, "protocols": true, "signed_document": true},
	"passport":     {"subject": true, "signed_document": true},
	"mandate":      {"subject": true, "signed_document": true},
	"receipt":      {"transaction_id": true, "mandate_id": true, "outcome": true, "signed_document": true},
	"revocation":   {"target": true, "revocation_status": true, "effective_at": true, "signed_document": true},
	"service":      {"document": true, "signed_document": true},
	"profile":      {"document": true, "signed_document": true},
}
var sensitivePublicFields = map[string]bool{"access_token": true, "api_key": true, "credential": true, "internal_id": true, "kms_key": true, "operator_notes": true, "password": true, "private_attributes": true, "private_key": true, "refresh_token": true, "secret": true, "tenant_id": true}

func CanonicalJSON(value any) (string, error) {
	var output strings.Builder
	if err := writeCanonical(&output, value); err != nil {
		return "", err
	}
	return output.String(), nil
}
func writeCanonical(output *strings.Builder, value any) error {
	switch typed := value.(type) {
	case nil:
		output.WriteString("null")
	case bool:
		if typed {
			output.WriteString("true")
		} else {
			output.WriteString("false")
		}
	case string:
		return writeCanonicalString(output, typed)
	case json.Number:
		number, err := strconv.ParseFloat(string(typed), 64)
		if err != nil {
			return fmt.Errorf("invalid JSON number: %w", err)
		}
		return writeCanonicalNumber(output, number)
	case float64:
		return writeCanonicalNumber(output, typed)
	case float32:
		return writeCanonicalNumber(output, float64(typed))
	case int:
		return writeCanonicalNumber(output, float64(typed))
	case int8:
		return writeCanonicalNumber(output, float64(typed))
	case int16:
		return writeCanonicalNumber(output, float64(typed))
	case int32:
		return writeCanonicalNumber(output, float64(typed))
	case int64:
		return writeCanonicalNumber(output, float64(typed))
	case uint:
		return writeCanonicalNumber(output, float64(typed))
	case uint8:
		return writeCanonicalNumber(output, float64(typed))
	case uint16:
		return writeCanonicalNumber(output, float64(typed))
	case uint32:
		return writeCanonicalNumber(output, float64(typed))
	case uint64:
		return writeCanonicalNumber(output, float64(typed))
	case []any:
		output.WriteByte('[')
		for index, item := range typed {
			if index > 0 {
				output.WriteByte(',')
			}
			if err := writeCanonical(output, item); err != nil {
				return err
			}
		}
		output.WriteByte(']')
	case []string:
		output.WriteByte('[')
		for index, item := range typed {
			if index > 0 {
				output.WriteByte(',')
			}
			if err := writeCanonicalString(output, item); err != nil {
				return err
			}
		}
		output.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			if !utf8.ValidString(key) {
				return errors.New("invalid Unicode in JSON object key")
			}
			keys = append(keys, key)
		}
		sort.Slice(keys, func(i, j int) bool { return compareUTF16(keys[i], keys[j]) < 0 })
		output.WriteByte('{')
		for index, key := range keys {
			if index > 0 {
				output.WriteByte(',')
			}
			if err := writeCanonicalString(output, key); err != nil {
				return err
			}
			output.WriteByte(':')
			if err := writeCanonical(output, typed[key]); err != nil {
				return err
			}
		}
		output.WriteByte('}')
	case map[string]string:
		converted := make(map[string]any, len(typed))
		for key, item := range typed {
			converted[key] = item
		}
		return writeCanonical(output, converted)
	default:
		encoded, err := json.Marshal(value)
		if err != nil {
			return fmt.Errorf("unsupported canonical JSON value %T: %w", value, err)
		}
		var normalized any
		if err := decode(encoded, &normalized); err != nil {
			return fmt.Errorf("normalize canonical JSON value %T: %w", value, err)
		}
		return writeCanonical(output, normalized)
	}
	return nil
}
func writeCanonicalNumber(output *strings.Builder, value float64) error {
	if value != value || value > 1.7976931348623157e308 || value < -1.7976931348623157e308 {
		return errors.New("non-finite numbers are not valid JSON")
	}
	if value == 0 {
		output.WriteByte('0')
		return nil
	}
	abs := value
	if abs < 0 {
		abs = -abs
	}
	format := 'e'
	if abs >= 1e-6 && abs < 1e21 {
		format = 'f'
	}
	rendered := strconv.FormatFloat(value, byte(format), -1, 64)
	if format == 'e' {
		parts := strings.Split(rendered, "e")
		exponent, _ := strconv.Atoi(parts[1])
		rendered = parts[0] + "e"
		if exponent >= 0 {
			rendered += "+"
		}
		rendered += strconv.Itoa(exponent)
	}
	output.WriteString(rendered)
	return nil
}
func writeCanonicalString(output *strings.Builder, value string) error {
	if !utf8.ValidString(value) {
		return errors.New("invalid Unicode in JSON string")
	}
	output.WriteByte('"')
	for _, character := range value {
		switch character {
		case '"', '\\':
			output.WriteByte('\\')
			output.WriteRune(character)
		case '\b':
			output.WriteString("\\b")
		case '\t':
			output.WriteString("\\t")
		case '\n':
			output.WriteString("\\n")
		case '\f':
			output.WriteString("\\f")
		case '\r':
			output.WriteString("\\r")
		default:
			if character < 0x20 {
				output.WriteString(fmt.Sprintf("\\u%04x", character))
			} else {
				output.WriteRune(character)
			}
		}
	}
	output.WriteByte('"')
	return nil
}
func compareUTF16(left, right string) int {
	a := utf16.Encode([]rune(left))
	b := utf16.Encode([]rune(right))
	for index := 0; index < len(a) && index < len(b); index++ {
		if a[index] < b[index] {
			return -1
		}
		if a[index] > b[index] {
			return 1
		}
	}
	if len(a) < len(b) {
		return -1
	}
	if len(a) > len(b) {
		return 1
	}
	return 0
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
	recordType, _ := result["type"].(string)
	allowed, ok := publicAttributesByType[recordType]
	if !ok {
		return nil, fmt.Errorf("unsupported public record type")
	}
	attributes, ok := result["public_attributes"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("public_attributes must be an object")
	}
	filtered := map[string]any{}
	for name, value := range attributes {
		if !allowed[name] {
			continue
		}
		text, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("public attribute %s must be a string", name)
		}
		if name == "document" || name == "public_key_jwk" || name == "signed_document" {
			var document any
			if err := decode([]byte(text), &document); err != nil {
				return nil, fmt.Errorf("public attribute %s must contain valid JSON", name)
			}
			if err := inspectPublicJSON(document, name, 0); err != nil {
				return nil, err
			}
		}
		filtered[name] = text
	}
	result["public_attributes"] = filtered
	return result, nil
}

func inspectPublicJSON(value any, attribute string, depth int) error {
	if depth > 32 {
		return fmt.Errorf("public attribute %s exceeds the nesting limit", attribute)
	}
	switch current := value.(type) {
	case []any:
		for _, item := range current {
			if err := inspectPublicJSON(item, attribute, depth+1); err != nil {
				return err
			}
		}
	case map[string]any:
		for key, nested := range current {
			if sensitivePublicFields[strings.ToLower(key)] {
				return fmt.Errorf("public attribute %s contains forbidden field %s", attribute, key)
			}
			if err := inspectPublicJSON(nested, attribute, depth+1); err != nil {
				return err
			}
		}
		if _, isJWK := current["kty"].(string); isJWK {
			if _, private := current["d"]; private {
				return fmt.Errorf("public attribute %s contains private JWK material", attribute)
			}
		}
	}
	return nil
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
	if branches := list(schema["oneOf"]); branches != nil {
		matches := 0
		for _, branch := range branches {
			branchCodes := map[string]bool{}
			validate(value, object(branch), root, branchCodes, schemaRoot)
			if len(branchCodes) == 0 {
				matches++
			}
		}
		if matches != 1 {
			codes["SCHEMA_ONEOF"] = true
		}
	}
	if condition := object(schema["if"]); condition != nil {
		conditionCodes := map[string]bool{}
		validate(value, condition, root, conditionCodes, schemaRoot)
		if len(conditionCodes) == 0 {
			if then := object(schema["then"]); then != nil {
				validate(value, then, root, codes, schemaRoot)
			}
		}
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
		if maximum, ok := schema["maxLength"]; ok && utf8.RuneCountInString(typed) > integer(maximum) {
			codes["SCHEMA_MAXLENGTH"] = true
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
		if maximum, ok := schema["maxItems"]; ok && len(typed) > integer(maximum) {
			codes["SCHEMA_MAXITEMS"] = true
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
	if number, ok := numberValue(value); ok {
		if minimum, exists := numberValue(schema["minimum"]); exists && number < minimum {
			codes["SCHEMA_MINIMUM"] = true
		}
		if maximum, exists := numberValue(schema["maximum"]); exists && number > maximum {
			codes["SCHEMA_MAXIMUM"] = true
		}
	}
}
func numberValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case int32:
		return float64(typed), true
	}
	return 0, false
}

type PublicRecord struct {
	Type             string            `json:"type"`
	ID               string            `json:"id"`
	DisplayName      string            `json:"display_name"`
	Status           string            `json:"status"`
	Issuer           string            `json:"issuer"`
	OrganisationID   string            `json:"organisation_id,omitempty"`
	IssuedAt         string            `json:"issued_at,omitempty"`
	ExpiresAt        string            `json:"expires_at,omitempty"`
	AssuranceLevel   string            `json:"assurance_level,omitempty"`
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
