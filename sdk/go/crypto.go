package oati

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
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
	if len(privateKey) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("Ed25519 private key is required")
	}
	return signOatiDocument(document, "EdDSA", "eddsa-jcs-2022", options, func(message []byte) ([]byte, error) { return ed25519.Sign(privateKey, message), nil })
}

// SignDocumentES256 signs an OATI object with P-256 ECDSA and emits fixed-width JWS R || S bytes.
func SignDocumentES256(document map[string]any, privateKey *ecdsa.PrivateKey, options SigningOptions) (map[string]any, error) {
	if privateKey == nil || privateKey.Curve != elliptic.P256() || privateKey.D == nil || privateKey.D.Sign() <= 0 || privateKey.D.Cmp(elliptic.P256().Params().N) >= 0 || privateKey.X == nil || privateKey.Y == nil || !elliptic.P256().IsOnCurve(privateKey.X, privateKey.Y) {
		return nil, fmt.Errorf("valid P-256 private key is required")
	}
	wantX, wantY := elliptic.P256().ScalarBaseMult(privateKey.D.Bytes())
	if wantX.Cmp(privateKey.X) != 0 || wantY.Cmp(privateKey.Y) != 0 {
		return nil, fmt.Errorf("P-256 private and public key members do not match")
	}
	return signOatiDocument(document, "ES256", "ecdsa-jcs-2019", options, func(message []byte) ([]byte, error) {
		digest := sha256.Sum256(message)
		r, s, err := ecdsa.Sign(rand.Reader, privateKey, digest[:])
		if err != nil {
			return nil, err
		}
		return append(r.FillBytes(make([]byte, 32)), s.FillBytes(make([]byte, 32))...), nil
	})
}

func signOatiDocument(document map[string]any, algorithm, cryptosuite string, options SigningOptions, signer func([]byte) ([]byte, error)) (map[string]any, error) {
	if options.VerificationMethod == "" || options.Audience == "" || len(options.Nonce) < 16 || options.Created.IsZero() || !options.Expires.After(options.Created) {
		return nil, fmt.Errorf("verification method, audience, valid proof lifetime, and 16-character nonce are required")
	}
	header, err := CanonicalJSON(map[string]any{"alg": algorithm, "b64": false, "crit": []any{"b64"}, "kid": options.VerificationMethod, "typ": "oati+jws"})
	if err != nil {
		return nil, fmt.Errorf("canonicalize protected header: %w", err)
	}
	protected := base64.RawURLEncoding.EncodeToString([]byte(header))
	proof := map[string]any{"type": "OatiJwsProof2026", "cryptosuite": cryptosuite, "algorithm": algorithm, "created": options.Created.Format(time.RFC3339Nano), "expires": options.Expires.Format(time.RFC3339Nano), "verification_method": options.VerificationMethod, "proof_purpose": "assertionMethod", "audience": options.Audience, "nonce": options.Nonce}
	signed := cloneMap(document)
	signed["proof"] = proof
	payload, err := CanonicalJSON(signed)
	if err != nil {
		return nil, err
	}
	signature, err := signer(append([]byte(protected+"."), []byte(payload)...))
	if err != nil {
		return nil, fmt.Errorf("sign OATI proof: %w", err)
	}
	if len(signature) != 64 {
		return nil, fmt.Errorf("%s signer returned %d bytes, expected 64", algorithm, len(signature))
	}
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
	rawProof, present := document["proof"]
	if !present || rawProof == nil {
		return []string{"PROOF_MISSING"}
	}
	proof := object(rawProof)
	if !validConformanceProof(proof) {
		return []string{"PROOF_MALFORMED"}
	}
	reasons := map[string]bool{}
	created, createdErr := time.Parse(time.RFC3339Nano, str(proof["created"]))
	expires, expiresErr := time.Parse(time.RFC3339Nano, str(proof["expires"]))
	if createdErr != nil || expiresErr != nil || !expires.After(created) {
		return []string{"PROOF_MALFORMED"}
	}
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
		if !reasons["KEY_INVALID"] && !verifyConformanceSignature(document, proof, key) {
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
	if algorithm == "EdDSA" {
		public, err := base64.RawURLEncoding.DecodeString(str(jwk["x"]))
		if err != nil || !validEd25519PublicKey(public) {
			reasons["KEY_INVALID"] = true
		}
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
		if value, err := time.Parse(time.RFC3339Nano, revokedAt); err != nil {
			reasons["KEY_INVALID"] = true
		} else if !value.After(now) {
			reasons["KEY_REVOKED"] = true
		}
	}
}

func checkIssuerChain(start string, bundle map[string]any, now time.Time, skew time.Duration, reasons map[string]bool) {
	anchors, visited := stringsFrom(bundle["trust_anchors"]), map[string]bool{}
	current := start
	for depth := 0; depth <= 8; depth++ {
		if visited[current] {
			break
		}
		visited[current] = true
		checkBundleRevocations([]string{"", current, ""}, bundle, now, reasons)
		if containsString(anchors, current) {
			return
		}
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
		if value := str(issuer["revoked_at"]); value != "" {
			parsed, err := time.Parse(time.RFC3339Nano, value)
			if err != nil || !parsed.After(now) {
				reasons["ISSUER_REVOKED"] = true
				return
			}
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
	if json.Unmarshal(headerBytes, &header) != nil {
		return false
	}
	crit := stringsFrom(header["crit"])
	if str(header["alg"]) != str(proof["algorithm"]) || str(header["kid"]) != str(proof["verification_method"]) || header["b64"] != false || str(header["typ"]) != "oati+jws" || len(crit) != 1 || crit[0] != "b64" {
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
		return err == nil && validEd25519PublicKey(public) && validEd25519PublicKey(signature[:min(32, len(signature))]) && ed25519.Verify(public, message, signature)
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

type edwardsPoint struct{ x, y *big.Int }

func validEd25519PublicKey(encoded []byte) bool {
	if len(encoded) != 32 {
		return false
	}
	copyBytes := append([]byte(nil), encoded...)
	sign := copyBytes[31] >> 7
	copyBytes[31] &= 0x7f
	p := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 255), big.NewInt(19))
	y := littleEndianInteger(copyBytes)
	if y.Cmp(p) >= 0 {
		return false
	}
	d := modInt(new(big.Int).Mul(big.NewInt(-121665), new(big.Int).ModInverse(big.NewInt(121666), p)), p)
	y2 := modInt(new(big.Int).Mul(y, y), p)
	numerator := modInt(new(big.Int).Sub(y2, big.NewInt(1)), p)
	denominator := modInt(new(big.Int).Add(new(big.Int).Mul(d, y2), big.NewInt(1)), p)
	inverse := new(big.Int).ModInverse(denominator, p)
	if inverse == nil {
		return false
	}
	x2 := modInt(new(big.Int).Mul(numerator, inverse), p)
	exponent := new(big.Int).Rsh(new(big.Int).Add(p, big.NewInt(3)), 3)
	x := new(big.Int).Exp(x2, exponent, p)
	if modInt(new(big.Int).Sub(new(big.Int).Mul(x, x), x2), p).Sign() != 0 {
		i := new(big.Int).Exp(big.NewInt(2), new(big.Int).Rsh(new(big.Int).Sub(p, big.NewInt(1)), 2), p)
		x = modInt(new(big.Int).Mul(x, i), p)
	}
	if modInt(new(big.Int).Sub(new(big.Int).Mul(x, x), x2), p).Sign() != 0 {
		return false
	}
	if byte(x.Bit(0)) != sign {
		x.Sub(p, x)
	}
	if x.Sign() == 0 && sign == 1 {
		return false
	}
	point := edwardsPoint{new(big.Int).Set(x), new(big.Int).Set(y)}
	for index := 0; index < 3; index++ {
		var ok bool
		point, ok = addEdwards(point, point, d, p)
		if !ok {
			return false
		}
	}
	return point.x.Sign() != 0 || point.y.Cmp(big.NewInt(1)) != 0
}
func addEdwards(a, b edwardsPoint, d, p *big.Int) (edwardsPoint, bool) {
	factor := modInt(new(big.Int).Mul(d, new(big.Int).Mul(new(big.Int).Mul(a.x, b.x), new(big.Int).Mul(a.y, b.y))), p)
	denX := new(big.Int).ModInverse(modInt(new(big.Int).Add(big.NewInt(1), factor), p), p)
	denY := new(big.Int).ModInverse(modInt(new(big.Int).Sub(big.NewInt(1), factor), p), p)
	if denX == nil || denY == nil {
		return edwardsPoint{}, false
	}
	x := modInt(new(big.Int).Mul(new(big.Int).Add(new(big.Int).Mul(a.x, b.y), new(big.Int).Mul(a.y, b.x)), denX), p)
	y := modInt(new(big.Int).Mul(new(big.Int).Add(new(big.Int).Mul(a.y, b.y), new(big.Int).Mul(a.x, b.x)), denY), p)
	return edwardsPoint{x, y}, true
}
func littleEndianInteger(value []byte) *big.Int {
	reversed := append([]byte(nil), value...)
	for left, right := 0, len(reversed)-1; left < right; left, right = left+1, right-1 {
		reversed[left], reversed[right] = reversed[right], reversed[left]
	}
	return new(big.Int).SetBytes(reversed)
}
func modInt(value, modulus *big.Int) *big.Int { return new(big.Int).Mod(value, modulus) }

func validConformanceProof(proof map[string]any) bool {
	if proof == nil || str(proof["type"]) != "OatiJwsProof2026" || str(proof["verification_method"]) == "" || str(proof["proof_purpose"]) != "assertionMethod" || len(str(proof["nonce"])) < 16 {
		return false
	}
	algorithm := str(proof["algorithm"])
	if algorithm != "EdDSA" && algorithm != "ES256" || str(proof["cryptosuite"]) != map[string]string{"EdDSA": "eddsa-jcs-2022", "ES256": "ecdsa-jcs-2019"}[algorithm] {
		return false
	}
	audienceValid := str(proof["audience"]) != ""
	if raw, ok := proof["audience"].([]any); ok {
		audiences := stringsFrom(raw)
		audienceValid = len(raw) > 0 && len(audiences) == len(raw)
		for _, item := range audiences {
			audienceValid = audienceValid && item != ""
		}
	}
	if str(proof["created"]) == "" || str(proof["expires"]) == "" || str(proof["signature"]) == "" || !audienceValid {
		return false
	}
	parts := strings.Split(str(proof["signature"]), "..")
	return len(parts) == 2 && parts[0] != "" && parts[1] != ""
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
