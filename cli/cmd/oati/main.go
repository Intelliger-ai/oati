package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

const version = "0.2.0-dev"

var validKinds = map[string]string{
	"passport": "oati:agent:",
	"mandate":  "oati:mandate:",
	"envelope": "oati:tx:",
	"receipt":  "oati:receipt:",
}

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintf(os.Stderr, "oati: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) error {
	if len(args) == 0 {
		printHelp(stdout)
		return nil
	}

	switch args[0] {
	case "help", "--help", "-h":
		printHelp(stdout)
		return nil
	case "version", "--version", "-v":
		fmt.Fprintf(stdout, "oati %s\n", version)
		return nil
	case "validate":
		return runValidate(args[1:], stdout, stderr)
	case "canonicalize":
		return runCanonicalize(args[1:], stdout, stderr)
	case "lookup":
		return runLookup(args[1:], stdout, stderr)
	case "sign":
		return runSign(args[1:], stdout, stderr)
	case "verify":
		return runVerify(args[1:], stdout, stderr)
	case "commerce", "rwa":
		return runProfileCommand(args[0], args[1:], stdout, stderr)
	default:
		return fmt.Errorf("unknown command %q; run 'oati help'", args[0])
	}
}

func printHelp(w io.Writer) {
	fmt.Fprint(w, `OATI developer CLI

Usage:
  oati validate <passport|mandate|envelope|receipt> <file|->
  oati canonicalize <file|->
  oati lookup --type <type> --id <identifier> [--api <base-url>]
  oati sign --algorithm <EdDSA|ES256> --key <private.jwk> --verification-method <id> --audience <aud> --nonce <nonce> --expires <duration> <file|->
  oati verify --trust-bundle <bundle.json> --audience <aud> --replay-cache <file> <file|->
  oati commerce <validate-offer|validate-mandate|validate-receipt> [options] <file|->
  oati rwa <validate-asset|validate-state-claim|validate-mint-mandate|validate-receipt> [options] <file|->
  oati version

Commands:
  validate      Check the structure and core semantics of an OATI object
  canonicalize  Emit compact JSON with recursively sorted object keys
  lookup        Query an OATI-compatible public resolver
  sign          Add an OATI detached JWS proof to a JSON object
  verify        Verify signature, trust, revocation, time, audience, and replay
  commerce      Validate Commerce Profile objects and constraints
  rwa           Validate RWA Profile objects and controlled-mint constraints
  version       Print the CLI version
`)
}

func runProfileCommand(profile string, args []string, stdout, stderr io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: oati %s <validation-command> [options] <file|->", profile)
	}
	command := args[0]
	flags := flag.NewFlagSet(profile+" "+command, flag.ContinueOnError)
	flags.SetOutput(stderr)
	mandatePath := flags.String("mandate", "", "related Mandate for constraint validation")
	claimPath := flags.String("claim", "", "related Asset State Claim for constraint validation")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return fmt.Errorf("usage: oati %s %s [options] <file|->", profile, command)
	}
	value, err := readObject(flags.Arg(0))
	if err != nil {
		return err
	}

	var violations []string
	switch profile + "/" + command {
	case "commerce/validate-offer":
		violations = validateCommerceOffer(value)
	case "commerce/validate-mandate":
		violations = append(validateObject("mandate", "oati:mandate:", value), validateCommerceMandate(value)...)
	case "commerce/validate-receipt":
		violations = append(validateObject("receipt", "oati:receipt:", value), validateCommerceReceipt(value)...)
		if *mandatePath != "" {
			mandate, readErr := readObject(*mandatePath)
			if readErr != nil {
				return fmt.Errorf("read Mandate: %w", readErr)
			}
			violations = append(violations, compareCommerceReceipt(value, mandate)...)
		}
	case "rwa/validate-asset":
		violations = validateAssetProfile(value)
	case "rwa/validate-state-claim":
		violations = validateAssetStateClaim(value)
	case "rwa/validate-mint-mandate":
		violations = append(validateObject("mandate", "oati:mandate:", value), validateMintMandate(value)...)
		if *claimPath != "" {
			claim, readErr := readObject(*claimPath)
			if readErr != nil {
				return fmt.Errorf("read State Claim: %w", readErr)
			}
			violations = append(violations, compareMintMandate(value, claim)...)
		}
	case "rwa/validate-receipt":
		violations = append(validateObject("receipt", "oati:receipt:", value), validateRwaReceipt(value)...)
		if *mandatePath != "" {
			mandate, readErr := readObject(*mandatePath)
			if readErr != nil {
				return fmt.Errorf("read Mandate: %w", readErr)
			}
			violations = append(violations, compareRwaReceipt(value, mandate)...)
		}
	default:
		return fmt.Errorf("unsupported %s command %q", profile, command)
	}

	violations = uniqueStrings(violations)
	if len(violations) > 0 {
		for _, violation := range violations {
			fmt.Fprintf(stderr, "- %s\n", violation)
		}
		return fmt.Errorf("%s %s failed (%d violation(s))", profile, command, len(violations))
	}
	fmt.Fprintf(stdout, "valid %s object: %s\n", profile, stringValue(value, "id"))
	return nil
}

const commerceProfile = "https://specs.intelliger.ai/oati/profiles/commerce/v0.1"
const rwaProfile = "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"

func validateCommerceOffer(value map[string]any) []string {
	violations := requireFields(value, "oati_version", "profile", "id", "merchant_organisation_id", "name", "endpoint", "protocol", "actions", "offers", "status", "issued_at", "expires_at", "issuer", "proof")
	if stringValue(value, "profile") != commerceProfile {
		violations = append(violations, "unexpected Commerce profile URI")
	}
	if id := stringValue(value, "id"); id != "" && !strings.HasPrefix(id, "oati:service:") {
		violations = append(violations, `id must start with "oati:service:"`)
	}
	offers, ok := value["offers"].([]any)
	if !ok || len(offers) == 0 {
		violations = append(violations, "offers must contain at least one offer")
		return violations
	}
	for index, raw := range offers {
		offer, ok := raw.(map[string]any)
		if !ok {
			violations = append(violations, fmt.Sprintf("offers[%d] must be an object", index))
			continue
		}
		for _, issue := range requireFields(offer, "id", "currency", "unit", "unit_price", "billing_model", "terms_uri", "terms_digest") {
			violations = append(violations, fmt.Sprintf("offers[%d]: %s", index, issue))
		}
		if currency := stringValue(offer, "currency"); currency != "" && !validCurrency(currency) {
			violations = append(violations, fmt.Sprintf("offers[%d]: invalid currency", index))
		}
		if price := stringValue(offer, "unit_price"); price != "" && !validDecimal(price) {
			violations = append(violations, fmt.Sprintf("offers[%d]: invalid unit_price", index))
		}
	}
	return violations
}

func validateCommerceMandate(value map[string]any) []string {
	if stringValue(value, "profile") != commerceProfile {
		return []string{"unexpected Commerce profile URI"}
	}
	commerce, ok := extension(value, "commerce")
	if !ok {
		return []string{"missing extensions.commerce"}
	}
	violations := requireFields(commerce, "merchant_organisation_id", "service_id", "offer_id", "currency", "max_unit_price", "max_total", "max_quantity")
	if !validCurrency(stringValue(commerce, "currency")) {
		violations = append(violations, "invalid Commerce currency")
	}
	for _, field := range []string{"max_unit_price", "max_total"} {
		if !validDecimal(stringValue(commerce, field)) {
			violations = append(violations, field+" must be a non-negative decimal string")
		}
	}
	if quantity, ok := numberValue(commerce["max_quantity"]); !ok || quantity < 1 {
		violations = append(violations, "max_quantity must be at least 1")
	}
	return violations
}

func validateCommerceReceipt(value map[string]any) []string {
	if stringValue(value, "profile") != commerceProfile {
		return []string{"unexpected Commerce profile URI"}
	}
	commerce, ok := extension(value, "commerce")
	if !ok {
		return []string{"missing extensions.commerce"}
	}
	violations := requireFields(commerce, "merchant_organisation_id", "service_id", "offer_id", "currency", "quantity", "unit_price", "total_amount", "fulfilment_status", "terms_digest")
	if !validCurrency(stringValue(commerce, "currency")) {
		violations = append(violations, "invalid Commerce currency")
	}
	return violations
}

func compareCommerceReceipt(receipt, mandate map[string]any) []string {
	var violations []string
	r, rok := extension(receipt, "commerce")
	m, mok := extension(mandate, "commerce")
	if !rok || !mok {
		return []string{"Receipt and Mandate need Commerce extensions"}
	}
	for _, field := range []string{"merchant_organisation_id", "service_id", "offer_id", "currency"} {
		if stringValue(r, field) != stringValue(m, field) {
			violations = append(violations, field+" differs from Mandate")
		}
	}
	if exceeds(stringValue(r, "unit_price"), stringValue(m, "max_unit_price")) {
		violations = append(violations, "unit price exceeds Mandate")
	}
	if exceeds(stringValue(r, "total_amount"), stringValue(m, "max_total")) {
		violations = append(violations, "total amount exceeds Mandate")
	}
	rq, _ := numberValue(r["quantity"])
	mq, _ := numberValue(m["max_quantity"])
	if rq > mq {
		violations = append(violations, "quantity exceeds Mandate")
	}
	return violations
}

func validateAssetProfile(value map[string]any) []string {
	violations := requireFields(value, "oati_version", "profile", "id", "issuer_organisation_id", "name", "asset_class", "jurisdiction", "unit", "token", "authorised_roles", "status", "issued_at", "expires_at", "issuer", "proof")
	if stringValue(value, "profile") != rwaProfile {
		violations = append(violations, "unexpected RWA profile URI")
	}
	if id := stringValue(value, "id"); id != "" && !strings.HasPrefix(id, "oati:asset:") {
		violations = append(violations, `id must start with "oati:asset:"`)
	}
	token, ok := value["token"].(map[string]any)
	if !ok {
		violations = append(violations, "token must be an object")
	} else {
		violations = append(violations, requireFields(token, "network", "contract", "standard")...)
	}
	return violations
}

func validateAssetStateClaim(value map[string]any) []string {
	violations := requireFields(value, "oati_version", "profile", "id", "asset_id", "claim_type", "value", "unit", "observed_at", "valid_until", "issuer", "issuer_role", "evidence", "proof")
	if stringValue(value, "profile") != rwaProfile {
		violations = append(violations, "unexpected RWA profile URI")
	}
	if !validDecimal(stringValue(value, "value")) {
		violations = append(violations, "claim value must be a non-negative decimal string")
	}
	observed := parseTime(stringValue(value, "observed_at"))
	validUntil := parseTime(stringValue(value, "valid_until"))
	if observed.IsZero() || validUntil.IsZero() || !validUntil.After(observed) {
		violations = append(violations, "valid_until must be after observed_at")
	}
	return violations
}

func validateMintMandate(value map[string]any) []string {
	if stringValue(value, "profile") != rwaProfile {
		return []string{"unexpected RWA profile URI"}
	}
	rwa, ok := extension(value, "rwa")
	if !ok {
		return []string{"missing extensions.rwa"}
	}
	violations := requireFields(rwa, "asset_id", "state_claim_id", "network", "token_contract", "operation", "unit", "max_quantity", "one_time", "minimum_approvals")
	if stringValue(rwa, "operation") != "mint" {
		violations = append(violations, "controlled-mint operation must be mint")
	}
	if oneTime, ok := rwa["one_time"].(bool); !ok || !oneTime {
		violations = append(violations, "controlled-mint Mandate must be one-time")
	}
	if quantity := stringValue(rwa, "max_quantity"); !validDecimal(quantity) || !exceeds(quantity, "0") {
		violations = append(violations, "max_quantity must be greater than zero")
	}
	approvals, ok := numberValue(rwa["minimum_approvals"])
	if !ok || approvals < 1 {
		violations = append(violations, "minimum_approvals must be at least 1")
	}
	return violations
}

func compareMintMandate(mandate, claim map[string]any) []string {
	var violations []string
	rwa, ok := extension(mandate, "rwa")
	if !ok {
		return []string{"Mandate needs extensions.rwa"}
	}
	if stringValue(rwa, "asset_id") != stringValue(claim, "asset_id") {
		violations = append(violations, "State Claim asset differs from Mandate")
	}
	if stringValue(rwa, "state_claim_id") != stringValue(claim, "id") {
		violations = append(violations, "State Claim id differs from Mandate")
	}
	if stringValue(rwa, "unit") != stringValue(claim, "unit") {
		violations = append(violations, "State Claim unit differs from Mandate")
	}
	if exceeds(stringValue(rwa, "max_quantity"), stringValue(claim, "value")) {
		violations = append(violations, "mint authority exceeds claimed reserve")
	}
	return violations
}

func validateRwaReceipt(value map[string]any) []string {
	if stringValue(value, "profile") != rwaProfile {
		return []string{"unexpected RWA profile URI"}
	}
	rwa, ok := extension(value, "rwa")
	if !ok {
		return []string{"missing extensions.rwa"}
	}
	return requireFields(rwa, "asset_id", "state_claim_id", "operation", "network", "token_contract", "quantity", "unit", "chain_transaction_hash", "approval_count")
}

func compareRwaReceipt(receipt, mandate map[string]any) []string {
	var violations []string
	r, rok := extension(receipt, "rwa")
	m, mok := extension(mandate, "rwa")
	if !rok || !mok {
		return []string{"Receipt and Mandate need RWA extensions"}
	}
	for _, field := range []string{"asset_id", "state_claim_id", "operation", "network", "token_contract", "unit"} {
		if stringValue(r, field) != stringValue(m, field) {
			violations = append(violations, field+" differs from Mandate")
		}
	}
	if exceeds(stringValue(r, "quantity"), stringValue(m, "max_quantity")) {
		violations = append(violations, "receipt quantity exceeds Mandate")
	}
	ra, _ := numberValue(r["approval_count"])
	ma, _ := numberValue(m["minimum_approvals"])
	if ra < ma {
		violations = append(violations, "receipt has insufficient approvals")
	}
	return violations
}

func extension(value map[string]any, name string) (map[string]any, bool) {
	extensions, ok := value["extensions"].(map[string]any)
	if !ok {
		return nil, false
	}
	extension, ok := extensions[name].(map[string]any)
	return extension, ok
}

func requireFields(value map[string]any, fields ...string) []string {
	var violations []string
	for _, field := range fields {
		if missing(value[field]) {
			violations = append(violations, fmt.Sprintf("missing required field %q", field))
		}
	}
	return violations
}

func validCurrency(value string) bool {
	if len(value) != 3 {
		return false
	}
	for _, character := range value {
		if character < 'A' || character > 'Z' {
			return false
		}
	}
	return true
}

func validDecimal(value string) bool {
	return decimalPattern.MatchString(value)
}

func exceeds(left, right string) bool {
	if !validDecimal(left) || !validDecimal(right) {
		return false
	}
	a, okA := new(big.Rat).SetString(left)
	b, okB := new(big.Rat).SetString(right)
	return okA && okB && a.Cmp(b) > 0
}

var decimalPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)(\.[0-9]+)?$`)

func numberValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case float64:
		return typed, true
	default:
		return 0, false
	}
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}

func runValidate(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("validate", flag.ContinueOnError)
	flags.SetOutput(stderr)
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 2 {
		return errors.New("usage: oati validate <passport|mandate|envelope|receipt> <file|->")
	}
	kind := strings.ToLower(flags.Arg(0))
	prefix, ok := validKinds[kind]
	if !ok {
		return fmt.Errorf("unsupported object type %q", kind)
	}
	value, err := readObject(flags.Arg(1))
	if err != nil {
		return err
	}
	violations := validateObject(kind, prefix, value)
	if len(violations) > 0 {
		sort.Strings(violations)
		for _, violation := range violations {
			fmt.Fprintf(stderr, "- %s\n", violation)
		}
		return fmt.Errorf("%s is invalid (%d violation(s))", kind, len(violations))
	}
	fmt.Fprintf(stdout, "valid %s: %s\n", kind, stringValue(value, "id"))
	return nil
}

func validateObject(kind, prefix string, value map[string]any) []string {
	var violations []string
	required := map[string][]string{
		"passport": {"oati_version", "id", "organisation_id", "issuer", "status", "issued_at", "expires_at", "verification_methods"},
		"mandate":  {"oati_version", "id", "issuer", "subject", "purpose", "actions", "not_before", "expires_at", "status"},
		"envelope": {"oati_version", "id", "agent_id", "organisation_id", "mandate_id", "action", "resource", "issued_at", "nonce"},
		"receipt":  {"oati_version", "id", "transaction_id", "agent_id", "organisation_id", "mandate_id", "decision", "outcome", "occurred_at", "issuer", "proof"},
	}
	for _, field := range required[kind] {
		if missing(value[field]) {
			violations = append(violations, fmt.Sprintf("missing required field %q", field))
		}
	}
	if got := stringValue(value, "oati_version"); got != "" && got != "1.0" {
		violations = append(violations, `"oati_version" must be "1.0"`)
	}
	if id := stringValue(value, "id"); id != "" && !strings.HasPrefix(id, prefix) {
		violations = append(violations, fmt.Sprintf("id must start with %q", prefix))
	}

	for _, field := range []string{"issued_at", "not_before", "expires_at", "occurred_at"} {
		if raw := stringValue(value, field); raw != "" {
			if _, err := time.Parse(time.RFC3339, raw); err != nil {
				violations = append(violations, fmt.Sprintf("%s must be an RFC 3339 timestamp", field))
			}
		}
	}
	if start, end := firstTime(value, "issued_at", "not_before"), parseTime(stringValue(value, "expires_at")); !start.IsZero() && !end.IsZero() && !end.After(start) {
		violations = append(violations, "expires_at must be after issuance/not_before")
	}

	statuses := map[string]map[string]bool{
		"passport": {"active": true, "suspended": true, "revoked": true, "expired": true},
		"mandate":  {"active": true, "suspended": true, "revoked": true, "expired": true, "consumed": true},
	}
	if allowed := statuses[kind]; allowed != nil {
		status := stringValue(value, "status")
		if status != "" && !allowed[status] {
			violations = append(violations, fmt.Sprintf("unsupported %s status %q", kind, status))
		}
	}
	if kind == "mandate" {
		if subject := stringValue(value, "subject"); subject != "" && !strings.HasPrefix(subject, "oati:agent:") {
			violations = append(violations, `subject must start with "oati:agent:"`)
		}
		if items, ok := value["actions"].([]any); ok && len(items) == 0 {
			violations = append(violations, "actions must contain at least one action")
		}
	}
	return violations
}

func runCanonicalize(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("canonicalize", flag.ContinueOnError)
	flags.SetOutput(stderr)
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return errors.New("usage: oati canonicalize <file|->")
	}
	value, err := readAny(flags.Arg(0))
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(stdout)
	encoder.SetEscapeHTML(false)
	return encoder.Encode(value)
}

func runLookup(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("lookup", flag.ContinueOnError)
	flags.SetOutput(stderr)
	kind := flags.String("type", "", "record type")
	id := flags.String("id", "", "OATI identifier")
	api := flags.String("api", "https://api.intelliger.ai/oati/v1", "lookup API base URL")
	timeout := flags.Duration("timeout", 10*time.Second, "request timeout")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*kind) == "" || strings.TrimSpace(*id) == "" {
		return errors.New("lookup requires --type and --id")
	}
	base, err := url.Parse(strings.TrimRight(*api, "/") + "/lookup")
	if err != nil {
		return fmt.Errorf("invalid API URL: %w", err)
	}
	query := base.Query()
	query.Set("type", *kind)
	query.Set("id", *id)
	base.RawQuery = query.Encode()

	client := &http.Client{Timeout: *timeout}
	request, err := http.NewRequest(http.MethodGet, base.String(), nil)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "oati-cli/"+version)
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("lookup request failed: %w", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return fmt.Errorf("read lookup response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("lookup returned %s: %s", response.Status, strings.TrimSpace(string(body)))
	}
	var value any
	if err := json.Unmarshal(body, &value); err != nil {
		return fmt.Errorf("lookup returned invalid JSON: %w", err)
	}
	formatted, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(stdout, "%s\n", formatted)
	return err
}

func readObject(path string) (map[string]any, error) {
	value, err := readAny(path)
	if err != nil {
		return nil, err
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, errors.New("OATI object must be a JSON object")
	}
	return object, nil
}

func readAny(path string) (any, error) {
	var reader io.Reader
	if path == "-" {
		reader = os.Stdin
	} else {
		file, err := os.Open(path)
		if err != nil {
			return nil, err
		}
		defer file.Close()
		reader = file
	}
	decoder := json.NewDecoder(io.LimitReader(reader, 8<<20))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return nil, fmt.Errorf("decode JSON: %w", err)
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return nil, errors.New("input contains more than one JSON value")
	}
	return value, nil
}

func stringValue(value map[string]any, key string) string {
	text, _ := value[key].(string)
	return text
}

func missing(value any) bool {
	if value == nil {
		return true
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text) == ""
	}
	return false
}

func parseTime(value string) time.Time {
	parsed, _ := time.Parse(time.RFC3339, value)
	return parsed
}

func firstTime(value map[string]any, keys ...string) time.Time {
	for _, key := range keys {
		if parsed := parseTime(stringValue(value, key)); !parsed.IsZero() {
			return parsed
		}
	}
	return time.Time{}
}

func canonicalBytes(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSpace(buffer.Bytes()), nil
}
