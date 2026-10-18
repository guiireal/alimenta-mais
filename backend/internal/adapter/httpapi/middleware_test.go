package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPBoundaries(t *testing.T) {
	h := New(Services{}, slog.New(slog.NewTextHandler(io.Discard, nil)), "http://localhost:5173", func(context.Context) error { return nil }, CookieOptions{Secure: false})
	for _, test := range []struct {
		name, body, contentType string
		want                    int
	}{{"null", "null", "application/json", 422}, {"array", "[]", "application/json", 422}, {"trailing", `{} {}`, "application/json", 422}, {"unknown", `{"admin":true}`, "application/json", 422}, {"content type", "{}", "text/plain", 422}, {"large", `{"name":"` + strings.Repeat("a", 1<<20) + `"}`, "application/json", 413}} {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/api/v1/auth/register", strings.NewReader(test.body))
			r.Header.Set("Content-Type", test.contentType)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != test.want {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
			if w.Header().Get("X-Request-ID") == "" {
				t.Fatal("request id ausente")
			}
		})
	}
	r := httptest.NewRequest("OPTIONS", "/api/v1/donors", nil)
	r.Header.Set("Origin", "http://localhost:5173")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 204 || w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" || w.Header().Get("Access-Control-Allow-Credentials") != "true" || !strings.Contains(w.Header().Get("Access-Control-Allow-Headers"), "X-CSRF-Token") {
		t.Fatal("preflight incorreto")
	}
}
func TestLoginRateLimit(t *testing.T) {
	h := New(Services{}, slog.New(slog.NewTextHandler(io.Discard, nil)), "http://localhost:5173", func(context.Context) error { return nil }, CookieOptions{Secure: false})
	for i := 0; i < 11; i++ {
		r := httptest.NewRequest("POST", "/api/v1/auth/login", strings.NewReader("null"))
		r.RemoteAddr = "127.0.0.9:1234"
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		want := 422
		if i == 10 {
			want = 429
		}
		if w.Code != want {
			t.Fatalf("tentativa %d: %d", i, w.Code)
		}
	}
}
func TestAuthenticationIsRequired(t *testing.T) {
	h := New(Services{}, slog.New(slog.NewTextHandler(io.Discard, nil)), "http://localhost:5173", func(context.Context) error { return nil }, CookieOptions{Secure: false})
	for _, path := range []string{"/api/v1/donors", "/api/v1/stock/movements", "/api/v1/audit", "/api/v1/auth/me"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != 401 {
			t.Fatal(path, w.Code)
		}
	}
}
