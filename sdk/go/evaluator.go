package oati

import (
	"encoding/json"
	"fmt"
	"math/big"
	"sort"
	"strings"
	"time"
)

const commerceProfile = "https://specs.intelliger.ai/oati/profiles/commerce/v0.1"
const rwaProfile = "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"

func EvaluateAuthority(request map[string]any) (map[string]any, error) {
	m, e := object(request["mandate"]), object(request["envelope"])
	if m == nil || e == nil {
		return nil, fmt.Errorf("mandate and envelope required")
	}
	now, err := time.Parse(time.RFC3339, str(request["evaluation_time"]))
	if err != nil {
		return nil, err
	}
	r := map[string]bool{}
	if str(m["status"]) != "active" {
		r["MANDATE_NOT_ACTIVE"] = true
	}
	start, _ := time.Parse(time.RFC3339, str(m["not_before"]))
	end, _ := time.Parse(time.RFC3339, str(m["expires_at"]))
	if start.After(now) {
		r["MANDATE_NOT_YET_ACTIVE"] = true
	}
	if !end.After(now) {
		r["MANDATE_EXPIRED"] = true
	}
	if str(e["mandate_id"]) != str(m["id"]) {
		r["MANDATE_REFERENCE_MISMATCH"] = true
	}
	if str(e["agent_id"]) != str(m["subject"]) {
		r["SUBJECT_MISMATCH"] = true
	}
	if !containsString(stringsFrom(m["actions"]), str(e["action"])) {
		r["ACTION_NOT_ALLOWED"] = true
	}
	constraint(m, "resources", str(e["resource"]), "RESOURCE_NOT_ALLOWED", r)
	if str(e["purpose"]) != str(m["purpose"]) {
		r["PURPOSE_MISMATCH"] = true
	}
	constraint(m, "counterparties", str(e["counterparty"]), "COUNTERPARTY_NOT_ALLOWED", r)
	constraint(m, "destinations", str(e["destination"]), "DESTINATION_NOT_ALLOWED", r)
	if p := object(request["parent_mandate"]); p != nil {
		child(m, p, integerDefault(request["delegation_depth"], 1), now, r)
	} else if str(m["parent_mandate"]) != "" {
		r["PARENT_MANDATE_REQUIRED"] = true
	}
	usage := normalizeUsage(object(request["usage"]))
	delta := consumption(request, m)
	checkLimits(m, usage, delta, r)
	commerce := object(request["commerce"])
	if commerce != nil || str(m["profile"]) == commerceProfile {
		checkCommerce(m, commerce, usage, r)
	}
	rwa := object(request["rwa"])
	if rwa != nil || str(m["profile"]) == rwaProfile {
		_, has := object(request["usage"])["minted_supply"]
		checkRWA(m, rwa, usage, has, now, r)
	}
	codes := keys(r)
	decision := "deny"
	next := usage
	if len(codes) == 0 {
		decision = "allow"
		next = apply(usage, delta, rwa)
	}
	return map[string]any{"oati_version": "1.0", "decision": decision, "mandate_id": str(m["id"]), "transaction_id": str(e["id"]), "reason_codes": codes, "next_usage": next}, nil
}
func child(c, p map[string]any, depth int, now time.Time, r map[string]bool) {
	if str(c["parent_mandate"]) != str(p["id"]) {
		r["PARENT_MANDATE_MISMATCH"] = true
	}
	ps, _ := time.Parse(time.RFC3339, str(p["not_before"]))
	pe, _ := time.Parse(time.RFC3339, str(p["expires_at"]))
	if str(p["status"]) != "active" || ps.After(now) || !pe.After(now) {
		r["PARENT_MANDATE_NOT_ACTIVE"] = true
	}
	d := object(p["delegation"])
	if d == nil || !boolean(d["allowed"]) || depth > integer(d["max_depth"]) {
		r["DELEGATION_NOT_ALLOWED"] = true
	}
	if !subset(stringsFrom(c["actions"]), stringsFrom(p["actions"])) {
		r["CHILD_ACTION_AMPLIFICATION"] = true
	}
	for _, v := range [][2]string{{"resources", "CHILD_RESOURCE_AMPLIFICATION"}, {"counterparties", "CHILD_COUNTERPARTY_AMPLIFICATION"}, {"destinations", "CHILD_DESTINATION_AMPLIFICATION"}} {
		if _, ok := p[v[0]]; ok {
			if _, exists := c[v[0]]; !exists || !subset(stringsFrom(c[v[0]]), stringsFrom(p[v[0]])) {
				r[v[1]] = true
			}
		}
	}
	if str(c["purpose"]) != str(p["purpose"]) {
		r["CHILD_PURPOSE_AMPLIFICATION"] = true
	}
	cs, _ := time.Parse(time.RFC3339, str(c["not_before"]))
	ce, _ := time.Parse(time.RFC3339, str(c["expires_at"]))
	if cs.Before(ps) || ce.After(pe) {
		r["CHILD_TIME_AMPLIFICATION"] = true
	}
	if !narrow(object(c["limits"]), object(p["limits"])) {
		r["CHILD_LIMIT_AMPLIFICATION"] = true
	}
	if !narrow(object(c["data_use"]), object(p["data_use"])) {
		r["CHILD_DATA_USE_AMPLIFICATION"] = true
	}
	cd := object(c["delegation"])
	if cd != nil && boolean(cd["allowed"]) && integer(cd["max_depth"]) > max(0, integer(d["max_depth"])-depth) {
		r["CHILD_DELEGATION_AMPLIFICATION"] = true
	}
	if str(c["profile"]) != str(p["profile"]) {
		if str(c["profile"]) != "" || str(p["profile"]) != "" {
			r["CHILD_PROFILE_AMPLIFICATION"] = true
		}
		return
	}
	cx, px := object(c["extensions"]), object(p["extensions"])
	cc, pc := object(cx["commerce"]), object(px["commerce"])
	if pc != nil && (cc == nil || !same(cc, pc, []string{"merchant_organisation_id", "service_id", "offer_id", "currency", "billing_model", "terms_digest"}) || decimalCompare(str(cc["max_unit_price"]), str(pc["max_unit_price"])) > 0 || decimalCompare(str(cc["max_total"]), str(pc["max_total"])) > 0 || integer(cc["max_quantity"]) > integer(pc["max_quantity"])) {
		r["CHILD_COMMERCE_AMPLIFICATION"] = true
	}
	cr, pr := object(cx["rwa"]), object(px["rwa"])
	if pr != nil && (cr == nil || !same(cr, pr, []string{"asset_id", "state_claim_id", "network", "token_contract", "operation", "unit"}) || decimalCompare(str(cr["max_quantity"]), str(pr["max_quantity"])) > 0 || integer(cr["minimum_approvals"]) < integer(pr["minimum_approvals"]) || !subset(stringsFrom(pr["required_roles"]), stringsFrom(cr["required_roles"])) || boolean(pr["one_time"]) && !boolean(cr["one_time"])) {
		r["CHILD_RWA_AMPLIFICATION"] = true
	}
}
func checkLimits(m, u, d map[string]any, r map[string]bool) {
	if boolean(u["consumed"]) {
		r["MANDATE_ALREADY_CONSUMED"] = true
	}
	if key := str(d["idempotency_key"]); key != "" && containsString(stringsFrom(u["idempotency_keys"]), key) {
		r["IDEMPOTENCY_REPLAY"] = true
	}
	l := object(m["limits"])
	if l == nil {
		return
	}
	if _, ok := l["max_calls"]; ok && integer(u["calls"])+integer(d["calls"]) > integer(l["max_calls"]) {
		r["CALL_LIMIT_EXCEEDED"] = true
	}
	if str(l["max_total"]) != "" && str(d["amount"]) != "0" {
		currency := str(l["currency"])
		if currency != "" && (str(d["currency"]) != currency || str(u["amount"]) != "0" && str(u["currency"]) != currency) {
			r["BUDGET_CURRENCY_MISMATCH"] = true
		}
		if decimalCompare(decimalAdd(str(u["amount"]), str(d["amount"])), str(l["max_total"])) > 0 {
			r["BUDGET_EXCEEDED"] = true
		}
	}
}
func checkCommerce(m, c, u map[string]any, r map[string]bool) {
	l := object(object(m["extensions"])["commerce"])
	if c == nil || l == nil {
		r["COMMERCE_CONTEXT_REQUIRED"] = true
		return
	}
	for _, v := range [][2]string{{"merchant_organisation_id", "COMMERCE_MERCHANT_NOT_ALLOWED"}, {"service_id", "COMMERCE_SERVICE_NOT_ALLOWED"}, {"offer_id", "COMMERCE_OFFER_NOT_ALLOWED"}} {
		if str(c[v[0]]) != str(l[v[0]]) {
			r[v[1]] = true
		}
	}
	if str(c["currency"]) != str(l["currency"]) || str(u["amount"]) != "0" && str(u["currency"]) != str(c["currency"]) {
		r["COMMERCE_CURRENCY_MISMATCH"] = true
	}
	if decimalCompare(str(c["unit_price"]), str(l["max_unit_price"])) > 0 {
		r["COMMERCE_UNIT_PRICE_EXCEEDED"] = true
	}
	if decimalCompare(str(c["total_amount"]), decimalMultiply(str(c["unit_price"]), integer(c["quantity"]))) != 0 {
		r["COMMERCE_TOTAL_INVALID"] = true
	}
	if decimalCompare(decimalAdd(str(u["amount"]), str(c["total_amount"])), str(l["max_total"])) > 0 {
		r["COMMERCE_BUDGET_EXCEEDED"] = true
	}
	if integer(c["quantity"]) > integer(l["max_quantity"]) {
		r["COMMERCE_QUANTITY_EXCEEDED"] = true
	}
	if str(l["terms_digest"]) != "" && str(c["terms_digest"]) != str(l["terms_digest"]) {
		r["COMMERCE_TERMS_MISMATCH"] = true
	}
	if containsString(stringsFrom(u["idempotency_keys"]), str(c["idempotency_key"])) {
		r["IDEMPOTENCY_REPLAY"] = true
	}
}
func checkRWA(m, c, u map[string]any, has bool, now time.Time, r map[string]bool) {
	l := object(object(m["extensions"])["rwa"])
	if c == nil || l == nil {
		r["RWA_CONTEXT_REQUIRED"] = true
		return
	}
	if !same(c, l, []string{"asset_id", "state_claim_id", "network", "token_contract", "operation", "unit"}) {
		r["RWA_TARGET_MISMATCH"] = true
	}
	end, _ := time.Parse(time.RFC3339, str(c["claim_valid_until"]))
	if !end.After(now) {
		r["RWA_STATE_CLAIM_EXPIRED"] = true
	}
	if decimalCompare(decimalAdd(str(u["quantity"]), str(c["quantity"])), str(l["max_quantity"])) > 0 {
		r["RWA_QUANTITY_EXCEEDED"] = true
	}
	supply := decimalAdd(str(c["current_supply"]), str(c["quantity"]))
	if decimalCompare(supply, str(c["reserve"])) > 0 {
		r["RWA_RESERVE_EXCEEDED"] = true
	}
	if str(c["maximum_supply"]) != "" && decimalCompare(supply, str(c["maximum_supply"])) > 0 {
		r["RWA_MAXIMUM_SUPPLY_EXCEEDED"] = true
	}
	if has && decimalCompare(str(u["minted_supply"]), str(c["current_supply"])) != 0 {
		r["RWA_SUPPLY_STATE_MISMATCH"] = true
	}
	if integer(c["approval_count"]) < integer(l["minimum_approvals"]) {
		r["RWA_APPROVAL_THRESHOLD_NOT_MET"] = true
	}
	for _, role := range stringsFrom(l["required_roles"]) {
		if !containsString(stringsFrom(c["approval_roles"]), role) {
			r["RWA_REQUIRED_ROLE_MISSING"] = true
		}
	}
	if boolean(l["one_time"]) && boolean(u["consumed"]) {
		r["MANDATE_ALREADY_CONSUMED"] = true
	}
}
func consumption(req, m map[string]any) map[string]any {
	c, w := object(req["commerce"]), object(req["rwa"])
	d := map[string]any{"calls": 1, "amount": "0", "currency": "", "quantity": "0", "idempotency_key": "", "consume": false}
	if c != nil {
		d["amount"], d["currency"], d["quantity"], d["idempotency_key"] = str(c["total_amount"]), str(c["currency"]), fmt.Sprint(integer(c["quantity"])), str(c["idempotency_key"])
	} else if w != nil {
		d["quantity"] = str(w["quantity"])
	}
	d["consume"] = boolean(object(object(m["extensions"])["rwa"])["one_time"]) || boolean(object(m["limits"])["one_time"])
	for k, v := range object(req["consumption"]) {
		d[k] = v
	}
	return d
}
func normalizeUsage(v map[string]any) map[string]any {
	if v == nil {
		v = map[string]any{}
	}
	ids := stringsFrom(v["idempotency_keys"])
	sort.Strings(ids)
	return map[string]any{"calls": integer(v["calls"]), "amount": fallback(str(v["amount"]), "0"), "currency": str(v["currency"]), "quantity": fallback(str(v["quantity"]), "0"), "consumed": boolean(v["consumed"]), "idempotency_keys": ids, "minted_supply": fallback(str(v["minted_supply"]), "0")}
}
func apply(u, d, w map[string]any) map[string]any {
	ids := append([]string{}, stringsFrom(u["idempotency_keys"])...)
	if key := str(d["idempotency_key"]); key != "" {
		ids = append(ids, key)
	}
	sort.Strings(ids)
	supply := str(u["minted_supply"])
	if w != nil {
		supply = decimalAdd(str(w["current_supply"]), str(w["quantity"]))
	}
	return map[string]any{"calls": integer(u["calls"]) + integer(d["calls"]), "amount": decimalAdd(str(u["amount"]), str(d["amount"])), "currency": fallback(str(d["currency"]), str(u["currency"])), "quantity": decimalAdd(str(u["quantity"]), str(d["quantity"])), "consumed": boolean(u["consumed"]) || boolean(d["consume"]), "idempotency_keys": ids, "minted_supply": supply}
}
func constraint(o map[string]any, f, a, code string, r map[string]bool) {
	if _, ok := o[f]; ok && !containsString(stringsFrom(o[f]), a) {
		r[code] = true
	}
}
func subset(a, b []string) bool {
	for _, x := range a {
		if !containsString(b, x) {
			return false
		}
	}
	return true
}
func same(a, b map[string]any, fields []string) bool {
	for _, f := range fields {
		if fmt.Sprint(a[f]) != fmt.Sprint(b[f]) {
			return false
		}
	}
	return true
}
func narrow(c, p map[string]any) bool {
	if p == nil {
		return true
	}
	if c == nil {
		return false
	}
	for k, v := range p {
		x, ok := c[k]
		if !ok {
			return false
		}
		switch t := v.(type) {
		case json.Number:
			if numberCompare(x, t) > 0 {
				return false
			}
		case string:
			if decimalValid(t) {
				if decimalCompare(str(x), t) > 0 {
					return false
				}
			} else if str(x) != t {
				return false
			}
		case []any:
			if !subset(stringsFrom(x), stringsFrom(t)) {
				return false
			}
		case map[string]any:
			if !narrow(object(x), t) {
				return false
			}
		default:
			if fmt.Sprint(x) != fmt.Sprint(v) {
				return false
			}
		}
	}
	return true
}

type decimal struct {
	n     *big.Int
	scale int
}

func parseDecimal(v string) decimal {
	parts := strings.Split(v, ".")
	fraction := ""
	if len(parts) == 2 {
		fraction = parts[1]
	}
	n, _ := new(big.Int).SetString(parts[0]+fraction, 10)
	return decimal{n, len(fraction)}
}
func decimalAlign(a, b decimal) (*big.Int, *big.Int, int) {
	scale := max(a.scale, b.scale)
	return new(big.Int).Mul(a.n, pow10(scale-a.scale)), new(big.Int).Mul(b.n, pow10(scale-b.scale)), scale
}
func decimalCompare(a, b string) int {
	x, y, _ := decimalAlign(parseDecimal(a), parseDecimal(b))
	return x.Cmp(y)
}
func decimalAdd(a, b string) string {
	x, y, scale := decimalAlign(parseDecimal(a), parseDecimal(b))
	return formatDecimal(new(big.Int).Add(x, y), scale)
}
func decimalMultiply(v string, n int) string {
	d := parseDecimal(v)
	return formatDecimal(new(big.Int).Mul(d.n, big.NewInt(int64(n))), d.scale)
}
func formatDecimal(n *big.Int, scale int) string {
	digits := n.String()
	if scale == 0 {
		return digits
	}
	for len(digits) <= scale {
		digits = "0" + digits
	}
	return digits[:len(digits)-scale] + "." + digits[len(digits)-scale:]
}
func pow10(n int) *big.Int { return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil) }
func decimalValid(v string) bool {
	if v == "" {
		return false
	}
	for i, c := range v {
		if c == '.' {
			if i == 0 || i == len(v)-1 {
				return false
			}
			continue
		}
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
func numberCompare(a, b any) int { return decimalCompare(fmt.Sprint(a), fmt.Sprint(b)) }
func boolean(v any) bool         { x, _ := v.(bool); return x }
func integerDefault(v any, d int) int {
	if v == nil {
		return d
	}
	return integer(v)
}
func fallback(v, d string) string {
	if v == "" {
		return d
	}
	return v
}
func keys(m map[string]bool) []string {
	r := make([]string, 0, len(m))
	for k := range m {
		r = append(r, k)
	}
	sort.Strings(r)
	return r
}
