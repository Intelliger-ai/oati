package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	oati "github.com/Intelliger-ai/oati/sdk/go"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type result struct {
	ID       string   `json:"id"`
	Category string   `json:"category"`
	Status   string   `json:"status"`
	Expected string   `json:"expected_outcome"`
	Observed string   `json:"observed_outcome"`
	Codes    []string `json:"codes"`
}

func main() {
	suitePath := flag.String("suite", "../../conformance/suite-v0.1.json", "")
	output := flag.String("output", "", "")
	version := flag.String("implementation-version", "0.1.0-dev.0", "")
	flag.Parse()
	absolute, _ := filepath.Abs(*suitePath)
	suite := load(absolute).(map[string]any)
	base := filepath.Dir(absolute)
	results := []result{}
	for _, raw := range suite["cases"].([]any) {
		c := raw.(map[string]any)
		observed, codes := execute(c, base)
		if codes == nil {
			codes = []string{}
		}
		expected := c["expected"].(map[string]any)
		wanted := stringsOf(expected["codes"])
		sort.Strings(codes)
		sort.Strings(wanted)
		status := "fail"
		if observed == expected["outcome"] && equal(codes, wanted) {
			status = "pass"
		}
		results = append(results, result{fmt.Sprint(c["id"]), fmt.Sprint(c["category"]), status, fmt.Sprint(expected["outcome"]), observed, codes})
	}
	passed := 0
	for _, r := range results {
		if r.Status == "pass" {
			passed++
		}
	}
	report := map[string]any{"report_version": "1.0", "suite_version": suite["suite_version"], "standard_version": suite["standard_version"], "implementation": map[string]any{"name": "github.com/Intelliger-ai/oati/sdk/go", "version": *version, "language": "go"}, "summary": map[string]any{"total": len(results), "passed": passed, "failed": len(results) - passed}, "results": results}
	encoded, _ := json.MarshalIndent(report, "", "  ")
	encoded = append(encoded, '\n')
	if *output != "" {
		_ = os.WriteFile(*output, encoded, 0644)
	} else {
		_, _ = os.Stdout.Write(encoded)
	}
	if passed != len(results) {
		os.Exit(1)
	}
}
func execute(c map[string]any, base string) (string, []string) {
	value := load(filepath.Join(base, fmt.Sprint(c["input"])))
	operation := fmt.Sprint(c["operation"])
	switch operation {
	case "schema":
		codes, err := oati.ValidateSchema(fmt.Sprint(c["schema"]), value, filepath.Clean(filepath.Join(base, "../schemas")))
		if err != nil {
			return "fail", []string{"RUNNER_ERROR", err.Error()}
		}
		if len(codes) > 0 {
			return "fail", codes
		}
		return "pass", nil
	case "canonicalize":
		actual, _ := oati.CanonicalJSON(value)
		expected, _ := os.ReadFile(filepath.Join(base, fmt.Sprint(c["auxiliary"])))
		if actual == strings.TrimSpace(string(expected)) {
			return "pass", nil
		}
		return "fail", []string{"CANONICALIZATION_MISMATCH"}
	case "verify", "verify-replay":
		bundle := load(filepath.Join(base, fmt.Sprint(c["auxiliary"]))).(map[string]any)
		options := c["options"].(map[string]any)
		now, _ := time.Parse(time.RFC3339, fmt.Sprint(options["now"]))
		cache := oati.NewReplayCache()
		if operation == "verify-replay" {
			if first := oati.VerifyDocument(value.(map[string]any), bundle, fmt.Sprint(options["audience"]), now, cache); len(first) > 0 {
				return "fail", first
			}
		}
		codes := oati.VerifyDocument(value.(map[string]any), bundle, fmt.Sprint(options["audience"]), now, cache)
		if len(codes) > 0 {
			return "fail", codes
		}
		return "pass", nil
	case "evaluate-suite":
		names := stringsOf(c["options"].(map[string]any)["case_names"])
		for _, raw := range value.(map[string]any)["cases"].([]any) {
			vector := raw.(map[string]any)
			if !has(names, fmt.Sprint(vector["name"])) {
				continue
			}
			actual, err := oati.EvaluateAuthority(vector["request"].(map[string]any))
			if err != nil {
				return "fail", []string{"RUNNER_ERROR", err.Error()}
			}
			expected := vector["expected"].(map[string]any)
			if fmt.Sprint(actual["decision"]) != fmt.Sprint(expected["decision"]) || !jsonEqual(actual["reason_codes"], expected["reason_codes"]) || (expected["next_usage"] != nil && !jsonEqual(actual["next_usage"], expected["next_usage"])) {
				return "fail", []string{"EVALUATOR_MISMATCH:" + fmt.Sprint(vector["name"])}
			}
		}
		return "pass", nil
	case "public-project":
		projected, err := oati.ProjectPublicRecord(value.(map[string]any))
		if err != nil {
			return "fail", []string{"PUBLIC_PROJECTION_INVALID"}
		}
		expected := load(filepath.Join(base, fmt.Sprint(c["auxiliary"])))
		if jsonEqual(projected, expected) {
			return "pass", nil
		}
		return "fail", []string{"PUBLIC_PROJECTION_MISMATCH"}
	}
	return "fail", []string{"RUNNER_ERROR"}
}
func load(path string) any {
	data, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		panic(err)
	}
	return value
}
func stringsOf(v any) []string {
	items, _ := v.([]any)
	r := []string{}
	for _, x := range items {
		r = append(r, fmt.Sprint(x))
	}
	return r
}
func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
func has(a []string, v string) bool {
	for _, x := range a {
		if x == v {
			return true
		}
	}
	return false
}
func jsonEqual(a, b any) bool {
	x, _ := oati.CanonicalJSON(a)
	y, _ := oati.CanonicalJSON(b)
	return x == y
}
