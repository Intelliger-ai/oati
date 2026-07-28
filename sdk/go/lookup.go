package oati

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

var RecordTypes = []string{"organisation", "agent", "passport", "mandate", "receipt", "issuer", "key", "revocation"}

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
	if !containsString(RecordTypes, kind) || id == "" {
		return LookupResult{}, fmt.Errorf("valid record type and id required")
	}
	key := kind + "\x00" + id
	c.mu.Lock()
	cached, ok := c.cache[key]
	c.mu.Unlock()
	if !reload && ok && cached.expires.After(time.Now()) {
		if cached.notFound {
			return LookupResult{}, &LookupError{Code: "LOOKUP_NOT_FOUND", Status: 404}
		}
		return LookupResult{Record: *cached.record, ResolverURL: cached.resolver, Cache: "hit"}, nil
	}
	var last error
	for _, resolver := range c.ResolverURLs {
		result, etag, rate, revalidated, err := c.retry(ctx, resolver, kind, id, cached)
		if err == nil {
			c.store(key, cacheEntry{record: &result, resolver: resolver, etag: etag, expires: time.Now().Add(c.ttl())})
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
			state = "not-found"
		}
		return LookupState{State: state, Err: err}
	}
	state := "found"
	if record.ProofStatus == "invalid" {
		state = "invalid-proof"
	} else if record.ProofStatus == "unknown" || record.ProofStatus == "unavailable" {
		state = "unknown"
	}
	return LookupState{State: state, Record: &record}
}
func (c *ResolverClient) ClearCache() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = map[string]cacheEntry{}
}
func (c *ResolverClient) retry(ctx context.Context, resolver, kind, id string, cached cacheEntry) (PublicRecord, string, RateLimit, bool, error) {
	var last error
	for attempt := 0; attempt <= c.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := c.BaseDelay * time.Duration(1<<(attempt-1))
			if lookup, ok := last.(*LookupError); ok && lookup.RetryAfter > 0 {
				delay = lookup.RetryAfter
			}
			select {
			case <-ctx.Done():
				return PublicRecord{}, "", RateLimit{}, false, ctx.Err()
			case <-time.After(delay):
			}
		}
		record, etag, rate, revalidated, err := c.request(ctx, resolver, kind, id, cached)
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
func (c *ResolverClient) request(ctx context.Context, resolver, kind, id string, cached cacheEntry) (PublicRecord, string, RateLimit, bool, error) {
	endpoint := strings.TrimSuffix(resolver, "/") + "/lookup?type=" + url.QueryEscape(kind) + "&id=" + url.QueryEscape(id)
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
			code = "LOOKUP_TIMEOUT"
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
	if record.Type != kind || record.ID != id {
		return PublicRecord{}, "", rate, false, &LookupError{Code: "LOOKUP_INVALID_RESPONSE"}
	}
	return record, response.Header.Get("ETag"), rate, false, nil
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
