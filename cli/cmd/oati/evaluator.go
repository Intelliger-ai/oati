package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"time"
)

func runEvaluate(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("evaluate", flag.ContinueOnError)
	flags.SetOutput(stderr)
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return errors.New("usage: oati evaluate <evaluation-request.json|->")
	}
	request, err := readObject(flags.Arg(0))
	if err != nil {
		return err
	}
	result, err := evaluateAuthority(request)
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(stdout, "%s\n", encoded)
	return err
}

func evaluateAuthority(request map[string]any) (map[string]any, error) {
	mandate := objectValue(request, "mandate")
	envelope := objectValue(request, "envelope")
	if mandate == nil || envelope == nil {
		return nil, errors.New("evaluation request requires mandate and envelope objects")
	}
	now, err := time.Parse(time.RFC3339, stringValue(request, "evaluation_time"))
	if err != nil {
		return nil, fmt.Errorf("evaluation_time must be RFC 3339: %w", err)
	}
	reasons := map[string]bool{}
	if stringValue(mandate, "status") != "active" {
		reasons["MANDATE_NOT_ACTIVE"] = true
	}
	start, startErr := time.Parse(time.RFC3339, stringValue(mandate, "not_before"))
	end, endErr := time.Parse(time.RFC3339, stringValue(mandate, "expires_at"))
	if startErr != nil || start.After(now) {
		reasons["MANDATE_NOT_YET_ACTIVE"] = true
	}
	if endErr != nil || !end.After(now) {
		reasons["MANDATE_EXPIRED"] = true
	}
	if stringValue(envelope, "mandate_id") != stringValue(mandate, "id") {
		reasons["MANDATE_REFERENCE_MISMATCH"] = true
	}
	if stringValue(envelope, "agent_id") != stringValue(mandate, "subject") {
		reasons["SUBJECT_MISMATCH"] = true
	}
	if !contains(stringList(mandate["actions"]), stringValue(envelope, "action")) {
		reasons["ACTION_NOT_ALLOWED"] = true
	}
	checkSetConstraint(mandate, "resources", stringValue(envelope, "resource"), "RESOURCE_NOT_ALLOWED", reasons)
	if stringValue(envelope, "purpose") != stringValue(mandate, "purpose") {
		reasons["PURPOSE_MISMATCH"] = true
	}
	checkSetConstraint(mandate, "counterparties", stringValue(envelope, "counterparty"), "COUNTERPARTY_NOT_ALLOWED", reasons)
	checkSetConstraint(mandate, "destinations", stringValue(envelope, "destination"), "DESTINATION_NOT_ALLOWED", reasons)
	if parent := objectValue(request, "parent_mandate"); parent != nil {
		checkChildMandate(mandate, parent, intValue(request["delegation_depth"], 1), now, reasons)
	} else if stringValue(mandate, "parent_mandate") != "" {
		reasons["PARENT_MANDATE_REQUIRED"] = true
	}

	usage := normalizeUsage(objectValue(request, "usage"))
	delta := effectiveConsumption(request, mandate)
	checkConsumption(mandate, usage, delta, reasons)
	commerce := objectValue(request, "commerce")
	if commerce != nil || stringValue(mandate, "profile") == commerceProfile {
		checkCommerce(mandate, commerce, usage, reasons)
	}
	rwa := objectValue(request, "rwa")
	if rwa != nil || stringValue(mandate, "profile") == rwaProfile {
		_, hasMintedSupply := objectValue(request, "usage")["minted_supply"]
		checkRWA(mandate, rwa, usage, hasMintedSupply, now, reasons)
	}

	codes := make([]string, 0, len(reasons))
	for code := range reasons {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	next := usage
	decision := "deny"
	if len(codes) == 0 {
		decision = "allow"
		next = applyConsumption(usage, delta, rwa)
	}
	return map[string]any{
		"oati_version":   "1.0",
		"decision":       decision,
		"mandate_id":     stringValue(mandate, "id"),
		"transaction_id": stringValue(envelope, "id"),
		"reason_codes":   codes,
		"next_usage":     next,
	}, nil
}

func checkChildMandate(child, parent map[string]any, depth int, now time.Time, reasons map[string]bool) {
	if stringValue(child, "parent_mandate") != stringValue(parent, "id") {
		reasons["PARENT_MANDATE_MISMATCH"] = true
	}
	parentStart, parentStartErr := time.Parse(time.RFC3339, stringValue(parent, "not_before"))
	parentEnd, parentEndErr := time.Parse(time.RFC3339, stringValue(parent, "expires_at"))
	if stringValue(parent, "status") != "active" || parentStartErr != nil || parentEndErr != nil || parentStart.After(now) || !parentEnd.After(now) {
		reasons["PARENT_MANDATE_NOT_ACTIVE"] = true
	}
	delegation := objectValue(parent, "delegation")
	if delegation == nil || !boolValue(delegation["allowed"]) || depth > intValue(delegation["max_depth"], 0) {
		reasons["DELEGATION_NOT_ALLOWED"] = true
	}
	if !stringSubset(stringList(child["actions"]), stringList(parent["actions"])) {
		reasons["CHILD_ACTION_AMPLIFICATION"] = true
	}
	checkChildSet(child, parent, "resources", "CHILD_RESOURCE_AMPLIFICATION", reasons)
	checkChildSet(child, parent, "counterparties", "CHILD_COUNTERPARTY_AMPLIFICATION", reasons)
	checkChildSet(child, parent, "destinations", "CHILD_DESTINATION_AMPLIFICATION", reasons)
	if stringValue(child, "purpose") != stringValue(parent, "purpose") {
		reasons["CHILD_PURPOSE_AMPLIFICATION"] = true
	}
	childStart, childStartErr := time.Parse(time.RFC3339, stringValue(child, "not_before"))
	parentStart, parentStartErr = time.Parse(time.RFC3339, stringValue(parent, "not_before"))
	childEnd, childEndErr := time.Parse(time.RFC3339, stringValue(child, "expires_at"))
	parentEnd, parentEndErr = time.Parse(time.RFC3339, stringValue(parent, "expires_at"))
	if childStartErr != nil || parentStartErr != nil || childEndErr != nil || parentEndErr != nil || childStart.Before(parentStart) || childEnd.After(parentEnd) {
		reasons["CHILD_TIME_AMPLIFICATION"] = true
	}
	if !narrowerObject(objectValue(child, "limits"), objectValue(parent, "limits")) {
		reasons["CHILD_LIMIT_AMPLIFICATION"] = true
	}
	if !narrowerObject(objectValue(child, "data_use"), objectValue(parent, "data_use")) {
		reasons["CHILD_DATA_USE_AMPLIFICATION"] = true
	}
	childDelegation := objectValue(child, "delegation")
	if childDelegation != nil && boolValue(childDelegation["allowed"]) {
		remaining := max(0, intValue(delegation["max_depth"], 0)-depth)
		if intValue(childDelegation["max_depth"], 0) > remaining {
			reasons["CHILD_DELEGATION_AMPLIFICATION"] = true
		}
	}
	checkProfileSubset(child, parent, reasons)
}

func checkProfileSubset(child, parent map[string]any, reasons map[string]bool) {
	if stringValue(child, "profile") != stringValue(parent, "profile") {
		if stringValue(child, "profile") != "" || stringValue(parent, "profile") != "" {
			reasons["CHILD_PROFILE_AMPLIFICATION"] = true
		}
		return
	}
	childExtensions, parentExtensions := objectValue(child, "extensions"), objectValue(parent, "extensions")
	childCommerce, parentCommerce := objectValue(childExtensions, "commerce"), objectValue(parentExtensions, "commerce")
	if parentCommerce != nil && (childCommerce == nil || !sameFields(childCommerce, parentCommerce, []string{"merchant_organisation_id", "service_id", "offer_id", "currency", "billing_model", "terms_digest"}) || !decimalAtMost(childCommerce["max_unit_price"], parentCommerce["max_unit_price"]) || !decimalAtMost(childCommerce["max_total"], parentCommerce["max_total"]) || intValue(childCommerce["max_quantity"], -1) > intValue(parentCommerce["max_quantity"], -1)) {
		reasons["CHILD_COMMERCE_AMPLIFICATION"] = true
	}
	childRWA, parentRWA := objectValue(childExtensions, "rwa"), objectValue(parentExtensions, "rwa")
	if parentRWA != nil && (childRWA == nil || !sameFields(childRWA, parentRWA, []string{"asset_id", "state_claim_id", "network", "token_contract", "operation", "unit"}) || !decimalAtMost(childRWA["max_quantity"], parentRWA["max_quantity"]) || intValue(childRWA["minimum_approvals"], -1) < intValue(parentRWA["minimum_approvals"], -1) || !stringSubset(stringList(parentRWA["required_roles"]), stringList(childRWA["required_roles"])) || boolValue(parentRWA["one_time"]) && !boolValue(childRWA["one_time"])) {
		reasons["CHILD_RWA_AMPLIFICATION"] = true
	}
}

func checkConsumption(mandate, usage, delta map[string]any, reasons map[string]bool) {
	if boolValue(usage["consumed"]) {
		reasons["MANDATE_ALREADY_CONSUMED"] = true
	}
	idempotency := stringValue(delta, "idempotency_key")
	if idempotency != "" && contains(stringList(usage["idempotency_keys"]), idempotency) {
		reasons["IDEMPOTENCY_REPLAY"] = true
	}
	limits := objectValue(mandate, "limits")
	if limits == nil {
		return
	}
	if _, ok := limits["max_calls"]; ok && intValue(usage["calls"], 0)+intValue(delta["calls"], 0) > intValue(limits["max_calls"], 0) {
		reasons["CALL_LIMIT_EXCEEDED"] = true
	}
	maxTotal := stringValue(limits, "max_total")
	amount := stringValue(delta, "amount")
	if maxTotal != "" && amount != "0" {
		currency := stringValue(limits, "currency")
		if currency != "" && (stringValue(delta, "currency") != currency || stringValue(usage, "amount") != "0" && stringValue(usage, "currency") != currency) {
			reasons["BUDGET_CURRENCY_MISMATCH"] = true
		}
		if decimalCompare(decimalAdd(stringValue(usage, "amount"), amount), maxTotal) > 0 {
			reasons["BUDGET_EXCEEDED"] = true
		}
	}
}

func checkCommerce(mandate, context, usage map[string]any, reasons map[string]bool) {
	limits := objectValue(objectValue(mandate, "extensions"), "commerce")
	if context == nil || limits == nil {
		reasons["COMMERCE_CONTEXT_REQUIRED"] = true
		return
	}
	comparisons := []struct{ field, code string }{{"merchant_organisation_id", "COMMERCE_MERCHANT_NOT_ALLOWED"}, {"service_id", "COMMERCE_SERVICE_NOT_ALLOWED"}, {"offer_id", "COMMERCE_OFFER_NOT_ALLOWED"}}
	for _, check := range comparisons {
		if stringValue(context, check.field) != stringValue(limits, check.field) {
			reasons[check.code] = true
		}
	}
	if stringValue(context, "currency") != stringValue(limits, "currency") || stringValue(usage, "amount") != "0" && stringValue(usage, "currency") != stringValue(context, "currency") {
		reasons["COMMERCE_CURRENCY_MISMATCH"] = true
	}
	if decimalCompare(stringValue(context, "unit_price"), stringValue(limits, "max_unit_price")) > 0 {
		reasons["COMMERCE_UNIT_PRICE_EXCEEDED"] = true
	}
	if decimalCompare(stringValue(context, "total_amount"), decimalMultiply(stringValue(context, "unit_price"), intValue(context["quantity"], 0))) != 0 {
		reasons["COMMERCE_TOTAL_INVALID"] = true
	}
	if decimalCompare(decimalAdd(stringValue(usage, "amount"), stringValue(context, "total_amount")), stringValue(limits, "max_total")) > 0 {
		reasons["COMMERCE_BUDGET_EXCEEDED"] = true
	}
	if decimalCompare(strconv.Itoa(intValue(context["quantity"], 0)), numberString(limits["max_quantity"])) > 0 {
		reasons["COMMERCE_QUANTITY_EXCEEDED"] = true
	}
	if stringValue(limits, "terms_digest") != "" && stringValue(context, "terms_digest") != stringValue(limits, "terms_digest") {
		reasons["COMMERCE_TERMS_MISMATCH"] = true
	}
	if contains(stringList(usage["idempotency_keys"]), stringValue(context, "idempotency_key")) {
		reasons["IDEMPOTENCY_REPLAY"] = true
	}
}

func checkRWA(mandate, context, usage map[string]any, hasMintedSupply bool, now time.Time, reasons map[string]bool) {
	limits := objectValue(objectValue(mandate, "extensions"), "rwa")
	if context == nil || limits == nil {
		reasons["RWA_CONTEXT_REQUIRED"] = true
		return
	}
	if !sameFields(context, limits, []string{"asset_id", "state_claim_id", "network", "token_contract", "operation", "unit"}) {
		reasons["RWA_TARGET_MISMATCH"] = true
	}
	claimEnd, err := time.Parse(time.RFC3339, stringValue(context, "claim_valid_until"))
	if err != nil || !claimEnd.After(now) {
		reasons["RWA_STATE_CLAIM_EXPIRED"] = true
	}
	if decimalCompare(decimalAdd(stringValue(usage, "quantity"), stringValue(context, "quantity")), stringValue(limits, "max_quantity")) > 0 {
		reasons["RWA_QUANTITY_EXCEEDED"] = true
	}
	resultingSupply := decimalAdd(stringValue(context, "current_supply"), stringValue(context, "quantity"))
	if decimalCompare(resultingSupply, stringValue(context, "reserve")) > 0 {
		reasons["RWA_RESERVE_EXCEEDED"] = true
	}
	if maximum := stringValue(context, "maximum_supply"); maximum != "" && decimalCompare(resultingSupply, maximum) > 0 {
		reasons["RWA_MAXIMUM_SUPPLY_EXCEEDED"] = true
	}
	if hasMintedSupply && decimalCompare(stringValue(usage, "minted_supply"), stringValue(context, "current_supply")) != 0 {
		reasons["RWA_SUPPLY_STATE_MISMATCH"] = true
	}
	if intValue(context["approval_count"], 0) < intValue(limits["minimum_approvals"], 0) {
		reasons["RWA_APPROVAL_THRESHOLD_NOT_MET"] = true
	}
	roles := stringList(context["approval_roles"])
	for _, required := range stringList(limits["required_roles"]) {
		if !contains(roles, required) {
			reasons["RWA_REQUIRED_ROLE_MISSING"] = true
		}
	}
	if boolValue(limits["one_time"]) && boolValue(usage["consumed"]) {
		reasons["MANDATE_ALREADY_CONSUMED"] = true
	}
}

func effectiveConsumption(request, mandate map[string]any) map[string]any {
	supplied, commerce, rwa := objectValue(request, "consumption"), objectValue(request, "commerce"), objectValue(request, "rwa")
	result := map[string]any{"calls": json.Number("1"), "amount": "0", "currency": "", "quantity": "0", "idempotency_key": "", "consume": false}
	if commerce != nil {
		result["amount"], result["currency"], result["quantity"], result["idempotency_key"] = stringValue(commerce, "total_amount"), stringValue(commerce, "currency"), numberString(commerce["quantity"]), stringValue(commerce, "idempotency_key")
	} else if rwa != nil {
		result["quantity"] = stringValue(rwa, "quantity")
	}
	if rwaLimits := objectValue(objectValue(mandate, "extensions"), "rwa"); rwaLimits != nil && boolValue(rwaLimits["one_time"]) {
		result["consume"] = true
	}
	if limits := objectValue(mandate, "limits"); limits != nil && boolValue(limits["one_time"]) {
		result["consume"] = true
	}
	for key, value := range supplied {
		result[key] = value
	}
	return result
}

func applyConsumption(usage, delta, rwa map[string]any) map[string]any {
	next := map[string]any{
		"calls":            intValue(usage["calls"], 0) + intValue(delta["calls"], 0),
		"amount":           decimalAdd(stringValue(usage, "amount"), stringValue(delta, "amount")),
		"currency":         firstNonEmpty(stringValue(delta, "currency"), stringValue(usage, "currency")),
		"quantity":         decimalAdd(stringValue(usage, "quantity"), stringValue(delta, "quantity")),
		"consumed":         boolValue(usage["consumed"]) || boolValue(delta["consume"]),
		"idempotency_keys": append([]string{}, stringList(usage["idempotency_keys"])...),
		"minted_supply":    stringValue(usage, "minted_supply"),
	}
	if key := stringValue(delta, "idempotency_key"); key != "" {
		next["idempotency_keys"] = append(next["idempotency_keys"].([]string), key)
	}
	sort.Strings(next["idempotency_keys"].([]string))
	if rwa != nil {
		next["minted_supply"] = decimalAdd(stringValue(rwa, "current_supply"), stringValue(rwa, "quantity"))
	}
	return next
}

func normalizeUsage(value map[string]any) map[string]any {
	if value == nil {
		value = map[string]any{}
	}
	keys := append([]string{}, stringList(value["idempotency_keys"])...)
	sort.Strings(keys)
	return map[string]any{
		"calls":            intValue(value["calls"], 0),
		"amount":           defaultString(stringValue(value, "amount"), "0"),
		"currency":         stringValue(value, "currency"),
		"quantity":         defaultString(stringValue(value, "quantity"), "0"),
		"consumed":         boolValue(value["consumed"]),
		"idempotency_keys": keys,
		"minted_supply":    defaultString(stringValue(value, "minted_supply"), "0"),
	}
}

func checkSetConstraint(object map[string]any, field, actual, code string, reasons map[string]bool) {
	if _, present := object[field]; present && !contains(stringList(object[field]), actual) {
		reasons[code] = true
	}
}
func checkChildSet(child, parent map[string]any, field, code string, reasons map[string]bool) {
	if _, constrained := parent[field]; constrained {
		if _, present := child[field]; !present || !stringSubset(stringList(child[field]), stringList(parent[field])) {
			reasons[code] = true
		}
	}
}
func narrowerObject(child, parent map[string]any) bool {
	if parent == nil {
		return true
	}
	if child == nil {
		return false
	}
	for key, parentValue := range parent {
		childValue, ok := child[key]
		if !ok {
			return false
		}
		switch typed := parentValue.(type) {
		case json.Number:
			if numberCompare(childValue, typed) > 0 {
				return false
			}
		case string:
			if isDecimalString(typed) {
				if !isDecimalString(numberString(childValue)) || decimalCompare(numberString(childValue), typed) > 0 {
					return false
				}
			} else if childValue != typed {
				return false
			}
		case []any:
			if !stringSubset(stringList(childValue), stringList(typed)) {
				return false
			}
		case map[string]any:
			if !narrowerObject(objectFromAny(childValue), typed) {
				return false
			}
		default:
			if fmt.Sprint(childValue) != fmt.Sprint(parentValue) {
				return false
			}
		}
	}
	return true
}

type decimalNumber struct {
	coefficient *big.Int
	scale       int
}

func parseDecimalNumber(value string) decimalNumber {
	parts := strings.Split(value, ".")
	fraction := ""
	if len(parts) == 2 {
		fraction = parts[1]
	}
	coefficient, ok := new(big.Int).SetString(parts[0]+fraction, 10)
	if !ok {
		panic("invalid decimal: " + value)
	}
	return decimalNumber{coefficient: coefficient, scale: len(fraction)}
}
func alignDecimals(left, right decimalNumber) (*big.Int, *big.Int, int) {
	scale := max(left.scale, right.scale)
	a := new(big.Int).Mul(left.coefficient, pow10(scale-left.scale))
	b := new(big.Int).Mul(right.coefficient, pow10(scale-right.scale))
	return a, b, scale
}
func decimalCompare(left, right string) int {
	a, b, _ := alignDecimals(parseDecimalNumber(left), parseDecimalNumber(right))
	return a.Cmp(b)
}
func decimalAdd(left, right string) string {
	a, b, scale := alignDecimals(parseDecimalNumber(left), parseDecimalNumber(right))
	return formatDecimalNumber(new(big.Int).Add(a, b), scale)
}
func decimalMultiply(value string, multiplier int) string {
	parsed := parseDecimalNumber(value)
	return formatDecimalNumber(new(big.Int).Mul(parsed.coefficient, big.NewInt(int64(multiplier))), parsed.scale)
}
func formatDecimalNumber(value *big.Int, scale int) string {
	if scale == 0 {
		return value.String()
	}
	digits := value.String()
	if len(digits) <= scale {
		digits = strings.Repeat("0", scale-len(digits)+1) + digits
	}
	return digits[:len(digits)-scale] + "." + digits[len(digits)-scale:]
}
func pow10(power int) *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(power)), nil)
}
func isDecimalString(value string) bool {
	_, ok := new(big.Rat).SetString(value)
	return ok && !strings.HasPrefix(value, "-")
}
func decimalAtMost(child, parent any) bool {
	a, b := numberString(child), numberString(parent)
	return isDecimalString(a) && isDecimalString(b) && decimalCompare(a, b) <= 0
}
func numberCompare(left any, right json.Number) int {
	a, okA := new(big.Rat).SetString(numberString(left))
	b, okB := new(big.Rat).SetString(right.String())
	if !okA || !okB {
		return 1
	}
	return a.Cmp(b)
}
func objectValue(value map[string]any, key string) map[string]any {
	if value == nil {
		return nil
	}
	return objectFromAny(value[key])
}
func objectFromAny(value any) map[string]any { object, _ := value.(map[string]any); return object }
func stringList(value any) []string {
	list, ok := value.([]any)
	if !ok {
		if typed, ok := value.([]string); ok {
			return typed
		}
		return nil
	}
	result := make([]string, 0, len(list))
	for _, item := range list {
		if text, ok := item.(string); ok {
			result = append(result, text)
		}
	}
	return result
}
func stringSubset(child, parent []string) bool {
	for _, value := range child {
		if !contains(parent, value) {
			return false
		}
	}
	return true
}
func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
func boolValue(value any) bool { result, _ := value.(bool); return result }
func intValue(value any, fallback int) int {
	switch typed := value.(type) {
	case json.Number:
		parsed, err := strconv.Atoi(typed.String())
		if err == nil {
			return parsed
		}
	case float64:
		return int(typed)
	case int:
		return typed
	}
	return fallback
}
func numberString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case int:
		return strconv.Itoa(typed)
	}
	return ""
}
func sameFields(child, parent map[string]any, fields []string) bool {
	for _, field := range fields {
		if fmt.Sprint(child[field]) != fmt.Sprint(parent[field]) {
			return false
		}
	}
	return true
}
func firstNonEmpty(first, second string) string {
	if first != "" {
		return first
	}
	return second
}
func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
