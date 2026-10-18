package httpapi_test

import (
	"alimenta-mais/backend/internal/adapter/httpapi"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func (a *apiTest) browser(method, path string, body any, cookies []*http.Cookie, csrf string) *httptest.ResponseRecorder {
	a.t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		a.t.Fatal(err)
	}
	r := httptest.NewRequest(method, "/api"+path, bytes.NewReader(data))
	r.RemoteAddr = "127.0.0.1:12345"
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", "http://localhost:5173")
	r.Header.Set("X-CSRF-Token", csrf)
	for _, cookie := range cookies {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	a.handler.ServeHTTP(w, r)
	return w
}
func cookieNamed(cookies []*http.Cookie, name string) string {
	for _, c := range cookies {
		if c.Name == name {
			return c.Value
		}
	}
	return ""
}
func TestCookieSessionRotationCSRFAndRevocation(t *testing.T) {
	a := setup(t)
	login := a.browser("POST", "/auth/login", map[string]string{"email": "admin@example.test", "password": "Secret1234"}, nil, "")
	if login.Code != 200 {
		t.Fatal(login.Code, login.Body.String())
	}
	cookies := login.Result().Cookies()
	if len(cookies) != 3 {
		t.Fatalf("expected three cookies: %v", cookies)
	}
	for _, c := range cookies {
		if c.SameSite != http.SameSiteLaxMode || c.Domain != "" || c.MaxAge <= 0 || c.Expires.IsZero() {
			t.Fatalf("bad cookie attributes: %v", c)
		}
		if c.Name != httpapi.CSRFCookie && !c.HttpOnly {
			t.Fatal("credential cookie accessible to JavaScript")
		}
		if c.Name == httpapi.CSRFCookie && (c.HttpOnly || c.Path != "/") {
			t.Fatal("CSRF cookie must be readable at app path")
		}
	}
	if strings.Contains(login.Body.String(), "token") || strings.Contains(login.Body.String(), cookieNamed(cookies, httpapi.AccessCookie)) {
		t.Fatal("credentials leaked in JSON")
	}
	csrf := cookieNamed(cookies, httpapi.CSRFCookie)
	var exposed int
	if err := a.db.QueryRow(`SELECT (SELECT count(*) FROM refresh_tokens WHERE token_hash=$1)+(SELECT count(*) FROM sessions WHERE csrf_hash=$2)`, cookieNamed(cookies, httpapi.RefreshCookie), csrf).Scan(&exposed); err != nil || exposed != 0 {
		t.Fatalf("plaintext credential stored: %d %v", exposed, err)
	}
	if got := a.browser("GET", "/auth/me", nil, cookies, ""); got.Code != 200 {
		t.Fatal("cookie auth failed", got.Code)
	}
	for _, path := range []string{"/auth/logout", "/auth/refresh"} {
		if got := a.browser("POST", path, nil, cookies, ""); got.Code != 403 {
			t.Fatal("missing CSRF accepted", path, got.Code)
		}
		if got := a.browser("POST", path, nil, cookies, strings.Repeat("x", 64)); got.Code != 403 {
			t.Fatal("incorrect CSRF accepted", path, got.Code)
		}
	}
	refreshOnly := []*http.Cookie{{Name: httpapi.RefreshCookie, Value: cookieNamed(cookies, httpapi.RefreshCookie)}}
	refreshed := a.browser("POST", "/auth/refresh", nil, refreshOnly, csrf)
	if refreshed.Code != 200 {
		t.Fatal("refresh without access failed", refreshed.Code, refreshed.Body.String())
	}
	next := refreshed.Result().Cookies()
	if cookieNamed(next, httpapi.RefreshCookie) == cookieNamed(cookies, httpapi.RefreshCookie) {
		t.Fatal("refresh was not rotated")
	}
	if cookieNamed(next, httpapi.AccessCookie) == cookieNamed(cookies, httpapi.AccessCookie) {
		t.Fatal("JWT not renewed")
	}
	if got := a.browser("GET", "/auth/me", nil, next, ""); got.Code != 200 {
		t.Fatal("new JWT invalid", got.Code)
	}
	replay := a.browser("POST", "/auth/refresh", nil, refreshOnly, csrf)
	if replay.Code != 401 {
		t.Fatal("used refresh accepted", replay.Code)
	}
	if got := a.browser("GET", "/auth/me", nil, next, ""); got.Code != 401 {
		t.Fatal("replay did not revoke entire session", got.Code)
	}
	if got := a.browser("POST", "/auth/refresh", nil, next, csrf); got.Code != 401 {
		t.Fatal("replay did not revoke successor", got.Code)
	}
	var count int
	if err := a.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE action='user.refresh_reused'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("reuse revocation was rolled back: %d %v", count, err)
	}
}
func TestCookieLogoutRevokesAndClears(t *testing.T) {
	a := setup(t)
	login := a.browser("POST", "/auth/login", map[string]string{"email": "admin@example.test", "password": "Secret1234"}, nil, "")
	cookies := login.Result().Cookies()
	csrf := cookieNamed(cookies, httpapi.CSRFCookie)
	out := a.browser("POST", "/auth/logout", nil, cookies, csrf)
	if out.Code != 204 {
		t.Fatal(out.Code, out.Body.String())
	}
	for _, c := range out.Result().Cookies() {
		if c.MaxAge != -1 || c.Value != "" {
			t.Fatal("logout cookie not cleared", c)
		}
	}
	if len(out.Result().Cookies()) != 3 {
		t.Fatal("not all cookies cleared")
	}
	if got := a.browser("GET", "/auth/me", nil, cookies, ""); got.Code != 401 {
		t.Fatal("JWT works after logout", got.Code)
	}
	if got := a.browser("POST", "/auth/refresh", nil, cookies, csrf); got.Code != 401 {
		t.Fatal("refresh works after logout", got.Code)
	}
}

func TestConcurrentRefreshCannotForkSession(t *testing.T) {
	a := setup(t)
	login := a.browser("POST", "/auth/login", map[string]string{"email": "admin@example.test", "password": "Secret1234"}, nil, "")
	cookies := login.Result().Cookies()
	csrf := cookieNamed(cookies, httpapi.CSRFCookie)
	responses := make(chan *httptest.ResponseRecorder, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() { defer wg.Done(); responses <- a.browser("POST", "/auth/refresh", nil, cookies, csrf) }()
	}
	wg.Wait()
	close(responses)
	counts := map[int]int{}
	var next []*http.Cookie
	for r := range responses {
		counts[r.Code]++
		if r.Code == 200 {
			next = r.Result().Cookies()
		}
	}
	if counts[200] != 1 || counts[401] != 1 {
		t.Fatalf("refresh forked or failed: %v", counts)
	}
	if got := a.browser("GET", "/auth/me", nil, next, ""); got.Code != 401 {
		t.Fatal("reuse did not revoke rotated session", got.Code)
	}
}
