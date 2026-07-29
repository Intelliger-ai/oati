package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

const proofType = "OatiJwsProof2026"

type jwk struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y,omitempty"`
	D   string `json:"d,omitempty"`
}

type proof struct {
	Type               string `json:"type"`
	Cryptosuite        string `json:"cryptosuite"`
	Algorithm          string `json:"algorithm"`
	Created            string `json:"created"`
	Expires            string `json:"expires"`
	VerificationMethod string `json:"verification_method"`
	ProofPurpose       string `json:"proof_purpose"`
	Audience           any    `json:"audience"`
	Nonce              string `json:"nonce"`
	Signature          string `json:"signature,omitempty"`
}

type verificationKey struct {
	ID           string `json:"id"`
	Controller   string `json:"controller"`
	Issuer       string `json:"issuer"`
	Algorithm    string `json:"algorithm"`
	PublicKeyJWK jwk    `json:"public_key_jwk"`
	Status       string `json:"status"`
	ValidFrom    string `json:"valid_from"`
	ValidUntil   string `json:"valid_until,omitempty"`
	RevokedAt    string `json:"revoked_at,omitempty"`
	ProofStatus  string `json:"proof_status,omitempty"`
}

type trustedIssuer struct {
	ID          string `json:"id"`
	Parent      string `json:"parent,omitempty"`
	Status      string `json:"status"`
	ValidFrom   string `json:"valid_from,omitempty"`
	ValidUntil  string `json:"valid_until,omitempty"`
	RevokedAt   string `json:"revoked_at,omitempty"`
	ProofStatus string `json:"proof_status,omitempty"`
}

type revocationStatus struct {
	Target      string `json:"target"`
	Status      string `json:"status"`
	EffectiveAt string `json:"effective_at,omitempty"`
}

type trustBundle struct {
	TrustAnchors []string           `json:"trust_anchors"`
	Keys         []verificationKey  `json:"keys"`
	Issuers      []trustedIssuer    `json:"issuers"`
	Revocations  []revocationStatus `json:"revocations"`
}

type verificationIssue struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type verificationReport struct {
	Verified           bool                `json:"verified"`
	Algorithm          string              `json:"algorithm,omitempty"`
	VerificationMethod string              `json:"verification_method,omitempty"`
	Issuer             string              `json:"issuer,omitempty"`
	Issues             []verificationIssue `json:"issues"`
}

func runSign(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("sign", flag.ContinueOnError)
	flags.SetOutput(stderr)
	algorithm := flags.String("algorithm", "EdDSA", "JWS algorithm: EdDSA or ES256")
	keyPath := flags.String("key", "", "private JWK file")
	method := flags.String("verification-method", "", "oati:key identifier")
	audience := flags.String("audience", "", "intended verifier audience")
	nonce := flags.String("nonce", "", "unique nonce of at least 16 characters")
	expires := flags.Duration("expires", 5*time.Minute, "proof lifetime")
	createdRaw := flags.String("created", "", "proof creation time (RFC 3339; defaults to now)")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 || *keyPath == "" || *method == "" || *audience == "" || len(*nonce) < 16 {
		return errors.New("usage: oati sign --algorithm <EdDSA|ES256> --key <private.jwk> --verification-method <id> --audience <aud> --nonce <16+ chars> [--created RFC3339] [--expires 5m] <file|->")
	}
	if *expires <= 0 {
		return errors.New("--expires must be positive")
	}
	created := time.Now().UTC()
	if *createdRaw != "" {
		var err error
		created, err = time.Parse(time.RFC3339, *createdRaw)
		if err != nil {
			return fmt.Errorf("invalid --created: %w", err)
		}
	}
	value, err := readObject(flags.Arg(0))
	if err != nil {
		return err
	}
	key, err := readJWK(*keyPath)
	if err != nil {
		return err
	}
	p := proof{Type: proofType, Cryptosuite: cryptosuite(*algorithm), Algorithm: *algorithm, Created: created.Format(time.RFC3339), Expires: created.Add(*expires).Format(time.RFC3339), VerificationMethod: *method, ProofPurpose: "assertionMethod", Audience: *audience, Nonce: *nonce}
	if p.Cryptosuite == "" {
		return fmt.Errorf("unsupported algorithm %q", *algorithm)
	}
	value["proof"] = proofMap(p, false)
	protected, err := protectedHeader(*algorithm, *method)
	if err != nil {
		return err
	}
	payload, err := canonicalJSON(value)
	if err != nil {
		return err
	}
	signature, err := signBytes(*algorithm, key, signingInput(protected, payload))
	if err != nil {
		return err
	}
	p.Signature = protected + ".." + base64.RawURLEncoding.EncodeToString(signature)
	value["proof"] = proofMap(p, true)
	formatted, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(stdout, "%s\n", formatted)
	return err
}

func runVerify(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("verify", flag.ContinueOnError)
	flags.SetOutput(stderr)
	bundlePath := flags.String("trust-bundle", "", "trusted keys, issuers, anchors, and revocations")
	audience := flags.String("audience", "", "expected local audience")
	replayPath := flags.String("replay-cache", "", "persistent local replay cache")
	nowRaw := flags.String("now", "", "verification time for deterministic testing")
	maxAge := flags.Duration("max-proof-age", 5*time.Minute, "maximum proof age")
	clockSkew := flags.Duration("clock-skew", 30*time.Second, "accepted clock skew")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 || *bundlePath == "" || *audience == "" || *replayPath == "" {
		return errors.New("usage: oati verify --trust-bundle <bundle.json> --audience <aud> --replay-cache <file> <file|->")
	}
	now := time.Now().UTC()
	if *nowRaw != "" {
		var err error
		now, err = time.Parse(time.RFC3339, *nowRaw)
		if err != nil {
			return fmt.Errorf("invalid --now: %w", err)
		}
	}
	value, err := readObject(flags.Arg(0))
	if err != nil {
		return err
	}
	var bundle trustBundle
	if err := readJSONFile(*bundlePath, &bundle); err != nil {
		return fmt.Errorf("read trust bundle: %w", err)
	}
	report := verifyObject(value, bundle, *audience, now, *maxAge, *clockSkew)
	if report.Verified {
		p, _ := parseProof(value["proof"])
		replayKey := p.VerificationMethod + "\x00" + *audience + "\x00" + p.Nonce
		accepted, replayErr := consumeReplay(*replayPath, replayKey, p.Expires, now)
		if replayErr != nil {
			return fmt.Errorf("replay cache: %w", replayErr)
		}
		if !accepted {
			report.Issues = append(report.Issues, verificationIssue{Code: "REPLAY_DETECTED", Message: "proof nonce has already been accepted"})
			report.Verified = false
		}
	}
	encoded, _ := json.MarshalIndent(report, "", "  ")
	fmt.Fprintf(stdout, "%s\n", encoded)
	if !report.Verified {
		return fmt.Errorf("cryptographic verification failed (%d issue(s))", len(report.Issues))
	}
	return nil
}

func verifyObject(value map[string]any, bundle trustBundle, audience string, now time.Time, maxAge, skew time.Duration) verificationReport {
	report := verificationReport{Issues: []verificationIssue{}}
	rawProof, present := value["proof"]
	if !present || rawProof == nil {
		addIssue(&report, "PROOF_MISSING", "OATI proof is required")
		return report
	}
	p, err := parseProof(rawProof)
	if err != nil {
		addIssue(&report, "PROOF_MALFORMED", err.Error())
		return report
	}
	report.Algorithm, report.VerificationMethod = p.Algorithm, p.VerificationMethod
	if p.Algorithm != "EdDSA" && p.Algorithm != "ES256" {
		addIssue(&report, "ALGORITHM_NOT_ALLOWED", "proof algorithm is not allowed")
	}
	created, createdErr := time.Parse(time.RFC3339, p.Created)
	expires, expiresErr := time.Parse(time.RFC3339, p.Expires)
	if createdErr != nil || expiresErr != nil || !expires.After(created) {
		addIssue(&report, "PROOF_MALFORMED", "proof timestamps are invalid")
	} else {
		if created.After(now.Add(skew)) {
			addIssue(&report, "PROOF_NOT_YET_VALID", "proof creation time is in the future")
		}
		if !expires.After(now.Add(-skew)) {
			addIssue(&report, "PROOF_EXPIRED", "proof has expired")
		}
		if now.Sub(created) > maxAge+skew {
			addIssue(&report, "PROOF_TOO_OLD", "proof exceeds maximum accepted age")
		}
	}
	if !audienceContains(p.Audience, audience) {
		addIssue(&report, "AUDIENCE_MISMATCH", "proof does not contain the expected audience")
	}
	checkDocumentTimes(value, now, skew, &report)
	key, ok := findKey(bundle.Keys, p.VerificationMethod)
	if !ok {
		addIssue(&report, "KEY_NOT_FOUND", "verification key was not found")
		return report
	}
	if key.ID != p.VerificationMethod || key.Algorithm != p.Algorithm || key.ProofStatus != "" && key.ProofStatus != "verified" {
		addIssue(&report, "KEY_INVALID", "resolved key metadata does not match proof")
	}
	if key.Algorithm == "EdDSA" {
		public, decodeErr := base64.RawURLEncoding.DecodeString(key.PublicKeyJWK.X)
		if decodeErr != nil || !validEd25519PublicKey(public) {
			addIssue(&report, "KEY_INVALID", "Ed25519 public key is invalid or has small order")
		}
	}
	if key.Status != "active" && key.Status != "retired" && key.Status != "revoked" {
		addIssue(&report, "KEY_INVALID", "verification key has an unsupported status")
	}
	if key.Status == "retired" && key.ValidUntil == "" {
		addIssue(&report, "KEY_INVALID", "retired verification keys require valid_until")
	}
	checkKeyLifecycle(key, created, now, skew, &report)
	report.Issuer = validateIssuerChain(key.Issuer, bundle, now, skew, &report)
	checkRevocations(value, key, bundle.Revocations, now, &report)
	claimed := stringValue(value, "issuer")
	if claimed == "" {
		claimed = stringValue(value, "agent_id")
	}
	if claimed != "" && claimed != key.Controller && claimed != key.Issuer {
		addIssue(&report, "KEY_INVALID", "key is not bound to the document signer")
	}
	if !hasIssue(report, "KEY_INVALID") {
		if err := verifySignature(value, p, key.PublicKeyJWK); err != nil {
			addIssue(&report, "SIGNATURE_INVALID", err.Error())
		}
	}
	report.Verified = len(report.Issues) == 0
	return report
}

func verifySignature(value map[string]any, p proof, key jwk) error {
	parts := strings.Split(p.Signature, ".")
	if len(parts) != 3 || parts[0] == "" || parts[1] != "" || parts[2] == "" {
		return errors.New("invalid detached JWS")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return errors.New("invalid protected header")
	}
	var header map[string]any
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return errors.New("invalid protected header")
	}
	crit, _ := header["crit"].([]any)
	if header["alg"] != p.Algorithm || header["kid"] != p.VerificationMethod || header["b64"] != false || header["typ"] != "oati+jws" || len(crit) != 1 || crit[0] != "b64" {
		return errors.New("protected header does not match proof")
	}
	unsigned := cloneMap(value)
	unsigned["proof"] = proofMap(p, false)
	payload, err := canonicalJSON(unsigned)
	if err != nil {
		return err
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return errors.New("invalid signature encoding")
	}
	return verifyBytes(p.Algorithm, key, signingInput(parts[0], payload), signature)
}

func signBytes(algorithm string, key jwk, message []byte) ([]byte, error) {
	switch algorithm {
	case "EdDSA":
		if key.Kty != "OKP" || key.Crv != "Ed25519" {
			return nil, errors.New("EdDSA requires an OKP Ed25519 JWK")
		}
		seed, err := decodeExact(key.D, ed25519.SeedSize)
		if err != nil {
			return nil, fmt.Errorf("private Ed25519 JWK: %w", err)
		}
		return ed25519.Sign(ed25519.NewKeyFromSeed(seed), message), nil
	case "ES256":
		if key.Kty != "EC" || key.Crv != "P-256" {
			return nil, errors.New("ES256 requires an EC P-256 JWK")
		}
		private, err := p256Private(key)
		if err != nil {
			return nil, err
		}
		digest := sha256.Sum256(message)
		r, s, err := ecdsa.Sign(rand.Reader, private, digest[:])
		if err != nil {
			return nil, err
		}
		return append(r.FillBytes(make([]byte, 32)), s.FillBytes(make([]byte, 32))...), nil
	default:
		return nil, fmt.Errorf("unsupported algorithm %q", algorithm)
	}
}

func verifyBytes(algorithm string, key jwk, message, signature []byte) error {
	switch algorithm {
	case "EdDSA":
		if key.Kty != "OKP" || key.Crv != "Ed25519" {
			return errors.New("EdDSA requires an OKP Ed25519 JWK")
		}
		public, err := decodeExact(key.X, ed25519.PublicKeySize)
		if err != nil {
			return fmt.Errorf("public Ed25519 JWK: %w", err)
		}
		if !validEd25519PublicKey(public) || !validEd25519PublicKey(signature[:min(32, len(signature))]) || !ed25519.Verify(public, message, signature) {
			return errors.New("detached JWS signature is invalid")
		}
	case "ES256":
		if key.Kty != "EC" || key.Crv != "P-256" {
			return errors.New("ES256 requires an EC P-256 JWK")
		}
		if len(signature) != 64 {
			return errors.New("ES256 signature must be 64 bytes")
		}
		public, err := p256Public(key)
		if err != nil {
			return err
		}
		digest := sha256.Sum256(message)
		if !ecdsa.Verify(public, digest[:], new(big.Int).SetBytes(signature[:32]), new(big.Int).SetBytes(signature[32:])) {
			return errors.New("detached JWS signature is invalid")
		}
	default:
		return fmt.Errorf("unsupported algorithm %q", algorithm)
	}
	return nil
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

func p256Private(key jwk) (*ecdsa.PrivateKey, error) {
	d, err := decodeExact(key.D, 32)
	if err != nil {
		return nil, fmt.Errorf("private P-256 JWK: %w", err)
	}
	public, err := p256Public(key)
	if err != nil {
		return nil, err
	}
	return &ecdsa.PrivateKey{PublicKey: *public, D: new(big.Int).SetBytes(d)}, nil
}
func p256Public(key jwk) (*ecdsa.PublicKey, error) {
	x, err := decodeExact(key.X, 32)
	if err != nil {
		return nil, fmt.Errorf("P-256 x: %w", err)
	}
	y, err := decodeExact(key.Y, 32)
	if err != nil {
		return nil, fmt.Errorf("P-256 y: %w", err)
	}
	point := &ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(x), Y: new(big.Int).SetBytes(y)}
	if !point.Curve.IsOnCurve(point.X, point.Y) {
		return nil, errors.New("P-256 point is not on curve")
	}
	return point, nil
}

func protectedHeader(algorithm, method string) (string, error) {
	value := map[string]any{"alg": algorithm, "b64": false, "crit": []any{"b64"}, "kid": method, "typ": "oati+jws"}
	encoded, err := canonicalJSON(value)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(encoded), nil
}
func signingInput(protected string, payload []byte) []byte {
	result := make([]byte, 0, len(protected)+1+len(payload))
	result = append(result, protected...)
	result = append(result, '.')
	return append(result, payload...)
}
func cryptosuite(algorithm string) string {
	if algorithm == "EdDSA" {
		return "eddsa-jcs-2022"
	}
	if algorithm == "ES256" {
		return "ecdsa-jcs-2019"
	}
	return ""
}
func canonicalJSON(value any) ([]byte, error) {
	var output strings.Builder
	encoder := json.NewEncoder(&output)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return []byte(strings.TrimSuffix(output.String(), "\n")), nil
}
func proofMap(p proof, includeSignature bool) map[string]any {
	value := map[string]any{"type": p.Type, "cryptosuite": p.Cryptosuite, "algorithm": p.Algorithm, "created": p.Created, "expires": p.Expires, "verification_method": p.VerificationMethod, "proof_purpose": p.ProofPurpose, "audience": p.Audience, "nonce": p.Nonce}
	if includeSignature {
		value["signature"] = p.Signature
	}
	return value
}
func parseProof(value any) (proof, error) {
	raw, ok := value.(map[string]any)
	if !ok {
		return proof{}, errors.New("OATI proof is required")
	}
	encoded, _ := json.Marshal(raw)
	var p proof
	if json.Unmarshal(encoded, &p) != nil || p.Type != proofType || p.Cryptosuite != cryptosuite(p.Algorithm) || p.Created == "" || p.Expires == "" || p.VerificationMethod == "" || p.ProofPurpose != "assertionMethod" || len(p.Nonce) < 16 || p.Signature == "" || !validAudience(p.Audience) {
		return proof{}, errors.New("proof does not conform to the OATI JWS profile")
	}
	return p, nil
}
func validAudience(value any) bool {
	if single, ok := value.(string); ok {
		return single != ""
	}
	items, ok := value.([]any)
	if !ok || len(items) == 0 {
		return false
	}
	for _, item := range items {
		if text, ok := item.(string); !ok || text == "" {
			return false
		}
	}
	return true
}
func audienceContains(value any, expected string) bool {
	if single, ok := value.(string); ok {
		return single == expected
	}
	if list, ok := value.([]any); ok {
		for _, item := range list {
			if item == expected {
				return true
			}
		}
	}
	return false
}
func readJWK(path string) (jwk, error) {
	var key jwk
	if err := readJSONFile(path, &key); err != nil {
		return key, fmt.Errorf("read JWK: %w", err)
	}
	return key, nil
}
func readJSONFile(path string, target any) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	encoded, err := readLimited(file, 8<<20)
	if err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return errors.New("input contains more than one JSON value")
	}
	return nil
}
func decodeExact(value string, size int) ([]byte, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(decoded) != size {
		return nil, fmt.Errorf("expected %d base64url bytes", size)
	}
	return decoded, nil
}
func cloneMap(value map[string]any) map[string]any {
	result := make(map[string]any, len(value))
	for key, item := range value {
		result[key] = item
	}
	return result
}
func findKey(keys []verificationKey, id string) (verificationKey, bool) {
	for _, key := range keys {
		if key.ID == id {
			return key, true
		}
	}
	return verificationKey{}, false
}
func addIssue(report *verificationReport, code, message string) {
	for _, existing := range report.Issues {
		if existing.Code == code && existing.Message == message {
			return
		}
	}
	report.Issues = append(report.Issues, verificationIssue{Code: code, Message: message})
}
func hasIssue(report verificationReport, code string) bool {
	for _, existing := range report.Issues {
		if existing.Code == code {
			return true
		}
	}
	return false
}
func parseOptionalTime(value string) (time.Time, bool) {
	if value == "" {
		return time.Time{}, false
	}
	parsed, err := time.Parse(time.RFC3339, value)
	return parsed, err == nil
}

func checkDocumentTimes(value map[string]any, now time.Time, skew time.Duration, report *verificationReport) {
	start := stringValue(value, "not_before")
	if start == "" {
		start = stringValue(value, "issued_at")
	}
	if start != "" {
		parsed, err := time.Parse(time.RFC3339, start)
		if err != nil || parsed.After(now.Add(skew)) {
			addIssue(report, "DOCUMENT_NOT_YET_VALID", "document is not active yet")
		}
	}
	if end := stringValue(value, "expires_at"); end != "" {
		parsed, err := time.Parse(time.RFC3339, end)
		if err != nil || !parsed.After(now.Add(-skew)) {
			addIssue(report, "DOCUMENT_EXPIRED", "document has expired")
		}
	}
}
func checkKeyLifecycle(key verificationKey, created, now time.Time, skew time.Duration, report *verificationReport) {
	from, err := time.Parse(time.RFC3339, key.ValidFrom)
	if err != nil || created.Before(from.Add(-skew)) {
		addIssue(report, "KEY_INVALID", "key was not valid when proof was created")
	}
	if key.ValidUntil != "" {
		until, ok := parseOptionalTime(key.ValidUntil)
		if !ok || !created.Before(until.Add(skew)) {
			addIssue(report, "KEY_INVALID", "key was not valid when proof was created")
		}
	}
	if key.Status == "revoked" {
		addIssue(report, "KEY_REVOKED", "verification key is revoked")
	}
	if key.RevokedAt != "" {
		revoked, ok := parseOptionalTime(key.RevokedAt)
		if !ok {
			addIssue(report, "KEY_INVALID", "verification key has an invalid revocation timestamp")
		} else if !revoked.After(now) {
			addIssue(report, "KEY_REVOKED", "verification key is revoked")
		}
	}
}
func validateIssuerChain(start string, bundle trustBundle, now time.Time, skew time.Duration, report *verificationReport) string {
	current := start
	visited := map[string]bool{}
	for depth := 0; depth <= 8; depth++ {
		checkRevocationTarget(current, "ISSUER_REVOKED", bundle.Revocations, now, report)
		if slices.Contains(bundle.TrustAnchors, current) {
			return current
		}
		if visited[current] {
			break
		}
		visited[current] = true
		var found *trustedIssuer
		for i := range bundle.Issuers {
			if bundle.Issuers[i].ID == current {
				found = &bundle.Issuers[i]
				break
			}
		}
		if found == nil || found.ProofStatus != "" && found.ProofStatus != "verified" {
			break
		}
		if found.Status != "active" {
			addIssue(report, "ISSUER_REVOKED", "issuer is not active")
			return ""
		}
		if found.RevokedAt != "" {
			revoked, ok := parseOptionalTime(found.RevokedAt)
			if !ok || !revoked.After(now) {
				addIssue(report, "ISSUER_REVOKED", "issuer has invalid or effective revocation metadata")
				return ""
			}
		}
		if found.ValidFrom != "" {
			from, ok := parseOptionalTime(found.ValidFrom)
			if !ok || from.After(now.Add(skew)) {
				addIssue(report, "ISSUER_REVOKED", "issuer is outside validity period")
				return ""
			}
		}
		if found.ValidUntil != "" {
			until, ok := parseOptionalTime(found.ValidUntil)
			if !ok || !until.After(now.Add(-skew)) {
				addIssue(report, "ISSUER_REVOKED", "issuer is outside validity period")
				return ""
			}
		}
		if found.Parent == "" {
			break
		}
		current = found.Parent
	}
	addIssue(report, "ISSUER_NOT_TRUSTED", "issuer chain does not reach a configured trust anchor")
	return ""
}
func checkRevocations(value map[string]any, key verificationKey, statuses []revocationStatus, now time.Time, report *verificationReport) {
	targets := []struct{ value, code string }{{key.ID, "KEY_REVOKED"}, {key.Issuer, "ISSUER_REVOKED"}, {stringValue(value, "id"), "DOCUMENT_REVOKED"}}
	for _, target := range targets {
		checkRevocationTarget(target.value, target.code, statuses, now, report)
	}
}
func checkRevocationTarget(target, code string, statuses []revocationStatus, now time.Time, report *verificationReport) {
	if target == "" {
		return
	}
	matches := []revocationStatus{}
	for _, status := range statuses {
		if status.Target == target {
			matches = append(matches, status)
		}
	}
	if len(matches) > 1 {
		addIssue(report, "REVOCATION_UNAVAILABLE", "revocation status is ambiguous for "+target)
		return
	}
	if len(matches) == 0 || matches[0].Status == "good" {
		return
	}
	if matches[0].Status != "revoked" && matches[0].Status != "suspended" {
		addIssue(report, "REVOCATION_UNAVAILABLE", "revocation status is invalid for "+target)
		return
	}
	if matches[0].EffectiveAt != "" {
		effective, ok := parseOptionalTime(matches[0].EffectiveAt)
		if !ok {
			addIssue(report, "REVOCATION_UNAVAILABLE", "revocation effective time is invalid for "+target)
			return
		}
		if effective.After(now) {
			return
		}
	}
	addIssue(report, code, target+" is "+matches[0].Status)
}

func consumeReplay(path, key, expires string, now time.Time) (bool, error) {
	entries := map[string]string{}
	if data, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(data, &entries); err != nil {
			return false, err
		}
	} else if !os.IsNotExist(err) {
		return false, err
	}
	if raw, ok := entries[key]; ok {
		if expiry, err := time.Parse(time.RFC3339, raw); err == nil && expiry.After(now) {
			return false, nil
		}
	}
	for candidate, raw := range entries {
		expiry, err := time.Parse(time.RFC3339, raw)
		if err != nil || !expiry.After(now) {
			delete(entries, candidate)
		}
	}
	entries[key] = expires
	data, err := json.Marshal(entries)
	if err != nil {
		return false, err
	}
	directory := filepath.Dir(path)
	temp, err := os.CreateTemp(directory, ".oati-replay-*")
	if err != nil {
		return false, err
	}
	name := temp.Name()
	defer os.Remove(name)
	if err := temp.Chmod(0o600); err != nil {
		temp.Close()
		return false, err
	}
	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return false, err
	}
	if err := temp.Close(); err != nil {
		return false, err
	}
	if err := os.Rename(name, path); err != nil {
		return false, err
	}
	return true, nil
}
