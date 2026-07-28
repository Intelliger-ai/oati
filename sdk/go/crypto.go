package oati

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
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
	skew := 30 * time.Second
	if !expires.After(now.Add(-skew)) {
		reasons["PROOF_EXPIRED"] = true
	}
	if now.Sub(created) > 5*time.Minute+skew {
		reasons["PROOF_TOO_OLD"] = true
	}
	if created.After(now.Add(skew)) {
		reasons["PROOF_NOT_YET_VALID"] = true
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
		checkKeyConformance(key, proof, created, now, skew, reasons)
		checkIssuerChain(str(key["issuer"]), mapBundle, now, skew, reasons)
		checkBundleRevocations([]string{str(key["id"]), str(key["issuer"]), str(document["id"])}, mapBundle, now, reasons)
		claimed := str(document["issuer"])
		if claimed == "" {
			claimed = str(document["agent_id"])
		}
		if claimed != "" && claimed != str(key["controller"]) && claimed != str(key["issuer"]) {
			reasons["KEY_INVALID"] = true
		}
		if !verifyConformanceSignature(document, proof, key) {
			reasons["SIGNATURE_INVALID"] = true
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

func checkKeyConformance(key, proof map[string]any, created, now time.Time, skew time.Duration, reasons map[string]bool) {
	algorithm, status := str(key["algorithm"]), str(key["status"])
	if algorithm != str(proof["algorithm"]) || str(key["id"]) != str(proof["verification_method"]) || (str(key["proof_status"]) != "" && str(key["proof_status"]) != "verified") {
		reasons["KEY_INVALID"] = true
	}
	jwk := object(key["public_key_jwk"])
	if algorithm == "EdDSA" && (str(jwk["kty"]) != "OKP" || str(jwk["crv"]) != "Ed25519") || algorithm == "ES256" && (str(jwk["kty"]) != "EC" || str(jwk["crv"]) != "P-256") || algorithm != "EdDSA" && algorithm != "ES256" {
		reasons["KEY_INVALID"] = true
	}
	if status != "active" && status != "retired" && status != "revoked" {
		reasons["KEY_INVALID"] = true
	}
	validFrom, fromErr := time.Parse(time.RFC3339Nano, str(key["valid_from"]))
	validUntilText := str(key["valid_until"])
	if status == "retired" && validUntilText == "" {
		reasons["KEY_INVALID"] = true
	}
	if fromErr != nil || created.Before(validFrom.Add(-skew)) {
		reasons["KEY_INVALID"] = true
	}
	if validUntilText != "" {
		validUntil, err := time.Parse(time.RFC3339Nano, validUntilText)
		if err != nil || !created.Before(validUntil.Add(skew)) {
			reasons["KEY_INVALID"] = true
		}
	}
	if status == "revoked" {
		reasons["KEY_REVOKED"] = true
	}
	if revokedAt := str(key["revoked_at"]); revokedAt != "" {
		if value, err := time.Parse(time.RFC3339Nano, revokedAt); err == nil && !value.After(now) {
			reasons["KEY_REVOKED"] = true
		}
	}
}

func checkIssuerChain(start string, bundle map[string]any, now time.Time, skew time.Duration, reasons map[string]bool) {
	anchors, visited := stringsFrom(bundle["trust_anchors"]), map[string]bool{}
	current := start
	for depth := 0; depth <= 8; depth++ {
		if containsString(anchors, current) {
			return
		}
		if visited[current] {
			break
		}
		visited[current] = true
		var issuer map[string]any
		for _, raw := range list(bundle["issuers"]) {
			candidate := object(raw)
			if str(candidate["id"]) == current {
				issuer = candidate
				break
			}
		}
		if issuer == nil || (str(issuer["proof_status"]) != "" && str(issuer["proof_status"]) != "verified") {
			break
		}
		if str(issuer["status"]) != "active" {
			reasons["ISSUER_REVOKED"] = true
			return
		}
		if value := str(issuer["valid_from"]); value != "" {
			parsed, err := time.Parse(time.RFC3339Nano, value)
			if err != nil || parsed.After(now.Add(skew)) {
				reasons["ISSUER_REVOKED"] = true
				return
			}
		}
		if value := str(issuer["valid_until"]); value != "" {
			parsed, err := time.Parse(time.RFC3339Nano, value)
			if err != nil || !parsed.After(now.Add(-skew)) {
				reasons["ISSUER_REVOKED"] = true
				return
			}
		}
		current = str(issuer["parent"])
		if current == "" {
			break
		}
	}
	reasons["ISSUER_NOT_TRUSTED"] = true
}

func checkBundleRevocations(targets []string, bundle map[string]any, now time.Time, reasons map[string]bool) {
	unavailable := stringsFrom(bundle["unavailable_targets"])
	for index, target := range targets {
		if target == "" {
			continue
		}
		if containsString(unavailable, target) {
			reasons["REVOCATION_UNAVAILABLE"] = true
			continue
		}
		matches := []map[string]any{}
		for _, raw := range list(bundle["revocations"]) {
			candidate := object(raw)
			if str(candidate["target"]) == target {
				matches = append(matches, candidate)
			}
		}
		if len(matches) > 1 {
			reasons["REVOCATION_UNAVAILABLE"] = true
			continue
		}
		if len(matches) == 0 || str(matches[0]["status"]) == "good" {
			continue
		}
		effective := str(matches[0]["effective_at"])
		if effective != "" {
			parsed, err := time.Parse(time.RFC3339Nano, effective)
			if err == nil && parsed.After(now) {
				continue
			}
		}
		codes := []string{"KEY_REVOKED", "ISSUER_REVOKED", "DOCUMENT_REVOKED"}
		reasons[codes[index]] = true
	}
}

func verifyConformanceSignature(document, proof, key map[string]any) bool {
	parts := strings.Split(str(proof["signature"]), "..")
	if len(parts) != 2 {
		return false
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	var header map[string]any
	if json.Unmarshal(headerBytes, &header) != nil || str(header["alg"]) != str(proof["algorithm"]) || str(header["kid"]) != str(proof["verification_method"]) {
		return false
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}
	unsigned := cloneMap(document)
	delete(object(unsigned["proof"]), "signature")
	payload, err := CanonicalJSON(unsigned)
	if err != nil {
		return false
	}
	message := append([]byte(parts[0]+"."), []byte(payload)...)
	jwk := object(key["public_key_jwk"])
	if str(proof["algorithm"]) == "EdDSA" {
		public, err := base64.RawURLEncoding.DecodeString(str(jwk["x"]))
		return err == nil && ed25519.Verify(public, message, signature)
	}
	if str(proof["algorithm"]) == "ES256" && len(signature) == 64 {
		xBytes, xErr := base64.RawURLEncoding.DecodeString(str(jwk["x"]))
		yBytes, yErr := base64.RawURLEncoding.DecodeString(str(jwk["y"]))
		if xErr != nil || yErr != nil {
			return false
		}
		digest := sha256.Sum256(message)
		return ecdsa.Verify(&ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(xBytes), Y: new(big.Int).SetBytes(yBytes)}, digest[:], new(big.Int).SetBytes(signature[:32]), new(big.Int).SetBytes(signature[32:]))
	}
	return false
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
