package httpapi

import (
	"alimenta-mais/backend/internal/usecase"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSecureCookiePathsAndRemoval(t *testing.T) {
	options := CookieOptions{Secure: true}
	w := httptest.NewRecorder()
	options.set(w, usecase.LoginResult{Token: "access", RefreshToken: "refresh", CSRFToken: "csrf", ExpiresAt: time.Now().Add(time.Minute), RefreshExpiresAt: time.Now().Add(time.Hour)})
	paths := map[string]string{AccessCookie: "/api/v1", RefreshCookie: "/api/v1/auth", CSRFCookie: "/"}
	for _, c := range w.Result().Cookies() {
		if !c.Secure || c.Domain != "" || c.SameSite != http.SameSiteLaxMode || c.Path != paths[c.Name] || c.HttpOnly != (c.Name != CSRFCookie) {
			t.Fatalf("cookie attributes: %+v", c)
		}
	}
	w = httptest.NewRecorder()
	options.clear(w)
	for _, c := range w.Result().Cookies() {
		if !c.Secure || c.Path != paths[c.Name] || c.MaxAge != -1 || c.Value != "" {
			t.Fatalf("cookie removal: %+v", c)
		}
	}
}
