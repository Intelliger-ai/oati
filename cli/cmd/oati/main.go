package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

const version = "0.1.0-dev"

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
  oati version

Commands:
  validate      Check the structure and core semantics of an OATI object
  canonicalize  Emit compact JSON with recursively sorted object keys
  lookup        Query an OATI-compatible public resolver
  version       Print the CLI version
`)
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
