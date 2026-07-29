package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func FuzzCLIArgumentParser(f *testing.F) {
	for _, seed := range []string{"", "unknown", "validate", "--help", "lookup\x00--id", strings.Repeat("x", 4096)} {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, argument string) {
		var stdout, stderr bytes.Buffer
		_ = run([]string{argument}, &stdout, &stderr)
	})
}

func FuzzCanonicalJSON(f *testing.F) {
	for _, seed := range [][]byte{[]byte(`null`), []byte(`{"z":1,"a":[true,null]}`), []byte(`{"a":`), []byte("\xff"), []byte(`1 2`)} {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, encoded []byte) {
		if len(encoded) > 1<<20 {
			t.Skip()
		}
		decoder := json.NewDecoder(bytes.NewReader(encoded))
		decoder.UseNumber()
		var value any
		if decoder.Decode(&value) == nil {
			_, _ = canonicalBytes(value)
		}
	})
}

func FuzzEvaluatorStrings(f *testing.F) {
	for _, seed := range []string{"forecast.read", "", "\x00", strings.Repeat("a", 4096)} {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, action string) {
		if len(action) > 1<<20 {
			t.Skip()
		}
		request := evaluatorFuzzRequest(action)
		first, firstErr := evaluateAuthority(request)
		second, secondErr := evaluateAuthority(request)
		if (firstErr == nil) != (secondErr == nil) {
			t.Fatal("evaluator error is nondeterministic")
		}
		if firstErr == nil {
			left, _ := json.Marshal(first)
			right, _ := json.Marshal(second)
			if !bytes.Equal(left, right) {
				t.Fatal("evaluator result is nondeterministic")
			}
		}
	})
}

func TestBoundedAdversarialCLIInputs(t *testing.T) {
	if _, err := readLimited(bytes.NewReader(bytes.Repeat([]byte("x"), (8<<20)+1)), 8<<20); err == nil {
		t.Fatal("oversized input was accepted")
	}
	path := writeFixture(t, `{} {}`)
	if _, err := readAny(path); err == nil || !strings.Contains(err.Error(), "more than one JSON value") {
		t.Fatalf("trailing JSON was accepted: %v", err)
	}
	for _, argument := range []string{"\x00", strings.Repeat("x", 65_536), "lookup\r\n--id"} {
		var stdout, stderr bytes.Buffer
		if err := run([]string{argument}, &stdout, &stderr); err == nil {
			t.Fatalf("malformed command %q was accepted", argument[:min(len(argument), 32)])
		}
	}
}

func evaluatorFuzzRequest(action string) map[string]any {
	return map[string]any{
		"oati_version": "1.0", "evaluation_time": "2026-07-27T10:00:00Z",
		"mandate":  map[string]any{"id": "oati:mandate:fuzz", "subject": "oati:agent:fuzz", "purpose": "test", "actions": []any{"allowed"}, "resources": []any{"oati:resource:fuzz"}, "not_before": "2026-07-27T09:00:00Z", "expires_at": "2026-07-27T11:00:00Z", "status": "active"},
		"envelope": map[string]any{"id": "oati:tx:fuzz", "agent_id": "oati:agent:fuzz", "mandate_id": "oati:mandate:fuzz", "action": action, "resource": "oati:resource:fuzz", "purpose": "test"},
		"usage":    map[string]any{},
	}
}
