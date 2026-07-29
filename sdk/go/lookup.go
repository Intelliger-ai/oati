package oati

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

var RecordTypes = []string{"organisation", "agent", "passport", "mandate", "receipt", "issuer", "key", "revocation", "service", "profile"}

type OrganisationDiscovery struct {
	OrganisationID string             `json:"organisation_id"`
	Services       []DiscoveredRecord `json:"services"`
	Profiles       []DiscoveredRecord `json:"profiles"`
}
type DiscoveredRecord struct {
	Record   PublicRecord   `json:"record"`
	Document map[string]any `json:"document"`
}
type FederationDocument struct {
	OATIVersion   string   `json:"oati_version"`
	Organisations []string `json:"organisations"`
	Resolvers     []string `json:"resolvers"`
	ExpiresAt     string   `json:"expires_at,omitempty"`
}

type LookupError struct {
	Code       string
	Status     int
	RetryAfter time.Duration
	Err        error
}

func (e *LookupError) Error() string {
	if e.Err != nil {
		return e.Code + ": " + e.Err.Error()
	}
	return e.Code
}

type RateLimit struct {
	Limit, Remaining int
	ResetAt          string
	RetryAfter       time.Duration
}
type LookupResult struct {
	Record             PublicRecord
	ResolverURL, Cache string
	RateLimit          RateLimit
}
type LookupState struct {
	State  string
	Record *PublicRecord
	Err    error
}
type cacheEntry struct {
	record         *PublicRecord
	resolver, etag string
	rate           RateLimit
	expires        time.Time
	notFound       bool
}
type ResolverClient struct {
	ResolverURLs                     []string
	HTTPClient                       *http.Client
	MaxRetries                       int
	BaseDelay, CacheTTL, NegativeTTL time.Duration
	mu                               sync.Mutex
	cache                            map[string]cacheEntry
}

func NewResolverClient(urls ...string) *ResolverClient {
	if len(urls) == 0 {
		urls = []string{"https://api.intelliger.ai/oati/v1"}
	}
	return &ResolverClient{ResolverURLs: urls, HTTPClient: &http.Client{Timeout: 5 * time.Second}, MaxRetries: 2, BaseDelay: 200 * time.Millisecond, CacheTTL: time.Minute, NegativeTTL: 10 * time.Second, cache: map[string]cacheEntry{}}
}
func (c *ResolverClient) Lookup(ctx context.Context, kind, id string) (PublicRecord, error) {
	result, err := c.LookupDetailed(ctx, kind, id, false)
	return result.Record, err
}
func (c *ResolverClient) LookupDetailed(ctx context.Context, kind, id string, reload bool) (LookupResult, error) {
	return c.lookupSelectedDetailed(ctx, kind, "id", id, reload)
}
func (c *ResolverClient) LookupRevocationByTarget(ctx context.Context, target string) (PublicRecord, error) {
	result, err := c.LookupRevocationByTargetDetailed(ctx, target, false)
	return result.Record, err
}
func (c *ResolverClient) LookupRevocationByTargetDetailed(ctx context.Context, target string, reload bool) (LookupResult, error) {
	return c.lookupSelectedDetailed(ctx, "revocation", "target", target, reload)
}
func (c *ResolverClient) DiscoverOrganisation(ctx context.Context, organisationID string) (OrganisationDiscovery, error) {
	if !strings.HasPrefix(organisationID, "oati:org:") {
		return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_BAD_REQUEST", Err: fmt.Errorf("valid organisation id required")}
	}
	var last error
	for _, resolver := range c.ResolverURLs {
		endpoint := strings.TrimSuffix(resolver, "/") + "/discovery?organisation_id=" + url.QueryEscape(organisationID)
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return OrganisationDiscovery{}, err
		}
		request.Header.Set("Accept", "application/json")
		response, err := c.http().Do(request)
		if err != nil {
			last = &LookupError{Code: "LOOKUP_UNAVAILABLE", Err: err}
			continue
		}
		var payload struct {
			OrganisationID string         `json:"organisation_id"`
			Services       []PublicRecord `json:"services"`
			Profiles       []PublicRecord `json:"profiles"`
		}
		decodeErr := json.NewDecoder(response.Body).Decode(&payload)
		response.Body.Close()
		if response.StatusCode == http.StatusNotFound {
			return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_NOT_FOUND", Status: 404}
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			last = &LookupError{Code: "LOOKUP_UNAVAILABLE", Status: response.StatusCode}
			continue
		}
		if decodeErr != nil || payload.OrganisationID != organisationID {
			return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE", Err: decodeErr}
		}
		result := OrganisationDiscovery{OrganisationID: organisationID}
		for _, item := range payload.Services {
			decoded, decodeError := decodeDiscoveryRecord(item, "service", organisationID)
			if decodeError != nil {
				return OrganisationDiscovery{}, decodeError
			}
			result.Services = append(result.Services, decoded)
		}
		for _, item := range payload.Profiles {
			decoded, decodeError := decodeDiscoveryRecord(item, "profile", organisationID)
			if decodeError != nil {
				return OrganisationDiscovery{}, decodeError
			}
			result.Profiles = append(result.Profiles, decoded)
		}
		profiles := map[string]bool{}
		for _, item := range result.Profiles {
			profiles[item.Record.ID] = true
		}
		for _, item := range result.Services {
			for _, profile := range stringsFrom(item.Document["accepted_profiles"]) {
				if !profiles[profile] {
					return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE", Err: fmt.Errorf("service references unpublished profile %s", profile)}
				}
			}
		}
		return result, nil
	}
	return OrganisationDiscovery{}, last
}
func (c *ResolverClient) DiscoverFederated(ctx context.Context, domain, organisationID string) (OrganisationDiscovery, error) {
	candidate := domain
	if !strings.Contains(candidate, "://") {
		candidate = "https://" + candidate
	}
	origin, err := url.Parse(candidate)
	if err != nil || origin.Scheme != "https" || origin.Hostname() == "" || origin.User != nil || (origin.Path != "" && origin.Path != "/") || origin.RawQuery != "" || origin.Fragment != "" {
		return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_BAD_REQUEST", Err: fmt.Errorf("federation requires a bare HTTPS domain")}
	}
	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, origin.Scheme+"://"+origin.Host+"/.well-known/oati", nil)
	request.Header.Set("Accept", "application/json")
	response, err := c.http().Do(request)
	if err != nil {
		return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_UNAVAILABLE", Err: err}
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_NOT_FOUND", Status: 404}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_UNAVAILABLE", Status: response.StatusCode}
	}
	var document FederationDocument
	if json.NewDecoder(response.Body).Decode(&document) != nil || document.OATIVersion != "1.0" || !containsString(document.Organisations, organisationID) || len(document.Resolvers) == 0 || expired(document.ExpiresAt) {
		return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
	}
	for _, resolver := range document.Resolvers {
		parsed, parseErr := url.Parse(resolver)
		if parseErr != nil || parsed.Scheme != "https" || parsed.Hostname() == "" {
			return OrganisationDiscovery{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
		}
	}
	federated := NewResolverClient(document.Resolvers...)
	federated.HTTPClient = c.HTTPClient
	federated.MaxRetries = c.MaxRetries
	federated.BaseDelay = c.BaseDelay
	federated.CacheTTL = c.CacheTTL
	federated.NegativeTTL = c.NegativeTTL
	return federated.DiscoverOrganisation(ctx, organisationID)
}
func (c *ResolverClient) lookupSelectedDetailed(ctx context.Context, kind, selector, value string, reload bool) (LookupResult, error) {
	if !containsString(RecordTypes, kind) || value == "" {
		return LookupResult{}, fmt.Errorf("valid record type and selector value required")
	}
	key := kind + "\x00" + selector + "\x00" + value
	c.mu.Lock()
	cached, ok := c.cache[key]
	c.mu.Unlock()
	if !reload && ok && cached.expires.After(time.Now()) {
		if cached.notFound {
			return LookupResult{}, &LookupError{Code: "LOOKUP_NOT_FOUND", Status: 404}
		}
		return LookupResult{Record: *cached.record, ResolverURL: cached.resolver, Cache: "hit", RateLimit: cached.rate}, nil
	}
	var last error
	for _, resolver := range c.ResolverURLs {
		reusable := cacheEntry{}
		if ok && cached.resolver == resolver {
			reusable = cached
		}
		result, etag, rate, revalidated, err := c.retry(ctx, resolver, kind, selector, value, reusable)
		if err == nil {
			c.store(key, cacheEntry{record: &result, resolver: resolver, etag: etag, rate: rate, expires: time.Now().Add(c.ttl())})
			cacheState := "miss"
			if revalidated {
				cacheState = "revalidated"
			}
			return LookupResult{Record: result, ResolverURL: resolver, Cache: cacheState, RateLimit: rate}, nil
		}
		last = err
		if lookup, yes := err.(*LookupError); yes && lookup.Code == "LOOKUP_NOT_FOUND" {
			c.store(key, cacheEntry{resolver: resolver, expires: time.Now().Add(c.negativeTTL()), notFound: true})
			return LookupResult{}, err
		}
	}
	return LookupResult{}, last
}
func (c *ResolverClient) LookupState(ctx context.Context, kind, id string) LookupState {
	record, err := c.Lookup(ctx, kind, id)
	if err != nil {
		state := "unavailable"
		if e, ok := err.(*LookupError); ok && e.Code == "LOOKUP_NOT_FOUND" {
			state = "not_found"
		}
		return LookupState{State: state, Err: err}
	}
	state := "found"
	if record.ProofStatus == "invalid" {
		state = "invalid_proof"
	} else if record.ProofStatus == "unknown" {
		state = "unknown"
	} else if record.ProofStatus == "unavailable" {
		state = "unavailable"
	}
	return LookupState{State: state, Record: &record}
}
func (c *ResolverClient) ClearCache() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = map[string]cacheEntry{}
}
func (c *ResolverClient) retry(ctx context.Context, resolver, kind, selector, value string, cached cacheEntry) (PublicRecord, string, RateLimit, bool, error) {
	var last error
	for attempt := 0; attempt <= c.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := c.BaseDelay * time.Duration(1<<(attempt-1))
			if lookup, ok := last.(*LookupError); ok && lookup.RetryAfter > 0 {
				delay = lookup.RetryAfter
			}
			select {
			case <-ctx.Done():
				return PublicRecord{}, "", RateLimit{}, false, contextLookupError(ctx)
			case <-time.After(delay):
			}
		}
		record, etag, rate, revalidated, err := c.request(ctx, resolver, kind, selector, value, cached)
		if err == nil {
			return record, etag, rate, revalidated, nil
		}
		last = err
		lookup, ok := err.(*LookupError)
		if !ok || (lookup.Code != "LOOKUP_UNAVAILABLE" && lookup.Code != "LOOKUP_RATE_LIMITED" && lookup.Code != "LOOKUP_TIMEOUT") {
			break
		}
	}
	return PublicRecord{}, "", RateLimit{}, false, last
}
func (c *ResolverClient) request(ctx context.Context, resolver, kind, selector, value string, cached cacheEntry) (PublicRecord, string, RateLimit, bool, error) {
	endpoint := strings.TrimSuffix(resolver, "/") + "/lookup?type=" + url.QueryEscape(kind) + "&" + selector + "=" + url.QueryEscape(value)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return PublicRecord{}, "", RateLimit{}, false, err
	}
	request.Header.Set("Accept", "application/json")
	if cached.etag != "" {
		request.Header.Set("If-None-Match", cached.etag)
	}
	response, err := c.http().Do(request)
	if err != nil {
		code := "LOOKUP_UNAVAILABLE"
		if ctx.Err() != nil {
			return PublicRecord{}, "", RateLimit{}, false, contextLookupError(ctx)
		}
		return PublicRecord{}, "", RateLimit{}, false, &LookupError{Code: code, Err: err}
	}
	defer response.Body.Close()
	rate := rateLimit(response)
	if response.StatusCode == http.StatusNotModified && cached.record != nil {
		return *cached.record, cached.etag, rate, true, nil
	}
	if response.StatusCode == http.StatusNotFound {
		return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_NOT_FOUND", Status: 404}
	}
	if response.StatusCode == http.StatusTooManyRequests {
		return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_RATE_LIMITED", Status: 429, RetryAfter: rate.RetryAfter}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_UNAVAILABLE", Status: response.StatusCode}
	}
	var record PublicRecord
	if err := json.NewDecoder(response.Body).Decode(&record); err != nil {
		return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_INVALID_RESPONSE", Err: err}
	}
	selectorMatches := record.ID == value
	if selector == "target" {
		status := record.PublicAttributes["revocation_status"]
		selectorMatches = record.Type == "revocation" && record.PublicAttributes["target"] == value && containsString([]string{"good", "suspended", "revoked", "unknown"}, status)
	}
	if record.Type != kind || !selectorMatches {
		return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
	}
	if record.Status == "" || record.Issuer == "" || !containsString([]string{"verified", "invalid", "unavailable", "unknown"}, record.ProofStatus) || record.PublicAttributes == nil {
		return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
	}
	if record.Type == "key" {
		if record.IssuedAt == "" {
			record.IssuedAt = record.PublicAttributes["valid_from"]
		}
		if record.ExpiresAt == "" {
			record.ExpiresAt = record.PublicAttributes["valid_until"]
		}
		if record.IssuedAt == "" || record.ExpiresAt == "" || record.PublicAttributes["controller"] == "" || !containsString([]string{"EdDSA", "ES256"}, record.PublicAttributes["algorithm"]) || record.PublicAttributes["public_key_jwk"] == "" {
			return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
		}
	}
	if record.Type == "service" || record.Type == "profile" {
		if _, decodeErr := decodeDiscoveryRecord(record, record.Type, record.OrganisationID); decodeErr != nil {
			return PublicRecord{}, "", rate, false, decodeErr
		}
	}
	return record, response.Header.Get("ETag"), rate, false, nil
}
func contextLookupError(ctx context.Context) *LookupError {
	code := "LOOKUP_TIMEOUT"
	if errors.Is(ctx.Err(), context.Canceled) {
		code = "LOOKUP_CANCELLED"
	}
	return &LookupError{Code: code, Err: ctx.Err()}
}
func expired(value string) bool {
	if value == "" {
		return false
	}
	parsed, err := time.Parse(time.RFC3339, value)
	return err != nil || !parsed.After(time.Now())
}
func decodeDiscoveryRecord(record PublicRecord, kind, organisationID string) (DiscoveredRecord, error) {
	if record.Type != kind || record.OrganisationID != organisationID || record.Status != "active" || record.ProofStatus != "verified" {
		return DiscoveredRecord{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE", Err: fmt.Errorf("untrusted discovery record")}
	}
	raw := record.PublicAttributes["document"]
	var document map[string]any
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.UseNumber()
	if raw == "" || decoder.Decode(&document) != nil {
		return DiscoveredRecord{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE", Err: fmt.Errorf("invalid discovery document")}
	}
	if str(document["id"]) != record.ID || str(document["organisation_id"]) != organisationID || str(document["issuer"]) != record.Issuer || str(document["status"]) != "active" || expired(record.ExpiresAt) || expired(str(document["expires_at"])) {
		return DiscoveredRecord{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE", Err: fmt.Errorf("invalid, mismatched, or expired discovery document")}
	}
	if kind == "service" {
		if str(document["oati_version"]) != "1.0" || len(list(document["endpoints"])) == 0 || document["accepted_profiles"] == nil {
			return DiscoveredRecord{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
		}
	} else if str(document["oati_version"]) != "1.0" || str(document["schema_uri"]) == "" || str(document["digest"]) == "" {
		return DiscoveredRecord{}, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
	}
	return DiscoveredRecord{Record: record, Document: document}, nil
}
func (c *ResolverClient) store(key string, value cacheEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cache == nil {
		c.cache = map[string]cacheEntry{}
	}
	c.cache[key] = value
}
func (c *ResolverClient) http() *http.Client {
	if c.HTTPClient == nil {
		return &http.Client{Timeout: 5 * time.Second}
	}
	return c.HTTPClient
}
func (c *ResolverClient) ttl() time.Duration {
	if c.CacheTTL == 0 {
		return time.Minute
	}
	return c.CacheTTL
}
func (c *ResolverClient) negativeTTL() time.Duration {
	if c.NegativeTTL == 0 {
		return 10 * time.Second
	}
	return c.NegativeTTL
}
func rateLimit(r *http.Response) RateLimit {
	limit, _ := strconv.Atoi(r.Header.Get("X-RateLimit-Limit"))
	remaining, _ := strconv.Atoi(r.Header.Get("X-RateLimit-Remaining"))
	retry, _ := strconv.Atoi(r.Header.Get("Retry-After"))
	return RateLimit{Limit: limit, Remaining: remaining, ResetAt: r.Header.Get("X-RateLimit-Reset"), RetryAfter: time.Duration(retry) * time.Second}
}
