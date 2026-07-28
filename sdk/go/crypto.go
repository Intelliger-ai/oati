package oati

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

type SigningOptions struct {
	VerificationMethod, Audience, Nonce string
	Created, Expires                    time.Time
}

func SignDocument(document map[string]any, privateKey ed25519.PrivateKey, options SigningOptions) (map[string]any, error) {
	if len(privateKey) != ed25519.PrivateKeySize || len(options.Nonce) < 16 {
		return nil, fmt.Errorf("Ed25519 private key and 16-character nonce are required")
	}
	header, _ := CanonicalJSON(map[string]any{"alg": "EdDSA", "b64": false, "crit": []string{"b64"}, "kid": options.VerificationMethod, "typ": "oati+jws"})
	protected := base64.RawURLEncoding.EncodeToString([]byte(header))
	proof := map[string]any{"type": "OatiJwsProof2026", "cryptosuite": "eddsa-jcs-2022", "algorithm": "EdDSA", "created": options.Created.Format(time.RFC3339Nano), "expires": options.Expires.Format(time.RFC3339Nano), "verification_method": options.VerificationMethod, "proof_purpose": "assertionMethod", "audience": options.Audience, "nonce": options.Nonce}
	signed := cloneMap(document)
	signed["proof"] = proof
	payload, err := CanonicalJSON(signed)
	if err != nil {
		return nil, err
	}
	signature := ed25519.Sign(privateKey, append([]byte(protected+"."), []byte(payload)...))
	proof["signature"] = protected + ".." + base64.RawURLEncoding.EncodeToString(signature)
	return signed, nil
}

type ReplayCache struct{ values map[string]bool }

func NewReplayCache() *ReplayCache { return &ReplayCache{values: map[string]bool{}} }
func (cache *ReplayCache) Accept(key string) bool {
	if cache.values[key] {
		return false
	}
	cache.values[key] = true
	return true
}
func VerifyDocument(document, mapBundle map[string]any, audience string, now time.Time, replay *ReplayCache) []string {
	proof := object(document["proof"])
	reasons := map[string]bool{}
	created, _ := time.Parse(time.RFC3339Nano, str(proof["created"]))
	expires, _ := time.Parse(time.RFC3339Nano, str(proof["expires"]))
	if !expires.After(now) {
		reasons["PROOF_EXPIRED"] = true
	}
	if now.Sub(created) > 5*time.Minute {
		reasons["PROOF_TOO_OLD"] = true
	}
	audiences := stringsFrom(proof["audience"])
	if text := str(proof["audience"]); text != "" {
		audiences = []string{text}
	}
	if !containsString(audiences, audience) {
		reasons["AUDIENCE_MISMATCH"] = true
	}
	var key map[string]any
	for _, candidate := range list(mapBundle["keys"]) {
		item := object(candidate)
		if str(item["id"]) == str(proof["verification_method"]) {
			key = item
		}
	}
	if key == nil {
		reasons["KEY_NOT_FOUND"] = true
	} else {
		if str(key["status"]) == "revoked" {
			reasons["KEY_REVOKED"] = true
		}
		if !containsString(stringsFrom(mapBundle["trust_anchors"]), str(key["issuer"])) {
			reasons["ISSUER_NOT_TRUSTED"] = true
		}
		if !reasons["KEY_REVOKED"] {
			signatureParts := strings.Split(str(proof["signature"]), "..")
			valid := false
			if len(signatureParts) == 2 {
				public, _ := base64.RawURLEncoding.DecodeString(str(object(key["public_key_jwk"])["x"]))
				signature, _ := base64.RawURLEncoding.DecodeString(signatureParts[1])
				unsigned := cloneMap(document)
				delete(object(unsigned["proof"]), "signature")
				payload, _ := CanonicalJSON(unsigned)
				valid = ed25519.Verify(public, append([]byte(signatureParts[0]+"."), []byte(payload)...), signature)
			}
			if !valid {
				reasons["SIGNATURE_INVALID"] = true
			}
		}
	}
	if len(reasons) == 0 && replay != nil && !replay.Accept(str(proof["verification_method"])+"\x00"+audience+"\x00"+str(proof["nonce"])) {
		reasons["REPLAY_DETECTED"] = true
	}
	result := make([]string, 0, len(reasons))
	for code := range reasons {
		result = append(result, code)
	}
	sort.Strings(result)
	return result
}
func cloneMap(value map[string]any) map[string]any {
	encoded, _ := json.Marshal(value)
	var result map[string]any
	_ = decode(encoded, &result)
	return result
}
func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
