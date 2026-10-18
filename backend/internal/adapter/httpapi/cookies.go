package httpapi

import (
	"net/http"
	"time"

	"alimenta-mais/backend/internal/usecase"
)

const AccessCookie = "alimenta_access"
const RefreshCookie = "alimenta_refresh"
const CSRFCookie = "alimenta_csrf"

type CookieOptions struct{ Secure bool }

func (c CookieOptions) set(w http.ResponseWriter, out usecase.LoginResult) {
	for _, cookie := range []*http.Cookie{
		{Name: AccessCookie, Value: out.Token, Path: "/api/v1", HttpOnly: true, Expires: out.ExpiresAt},
		{Name: RefreshCookie, Value: out.RefreshToken, Path: "/api/v1/auth", HttpOnly: true, Expires: out.RefreshExpiresAt},
		{Name: CSRFCookie, Value: out.CSRFToken, Path: "/", Expires: out.RefreshExpiresAt},
	} {
		cookie.Secure = c.Secure
		cookie.SameSite = http.SameSiteLaxMode
		cookie.MaxAge = max(1, int(time.Until(cookie.Expires).Seconds()))
		http.SetCookie(w, cookie)
	}
}
func (c CookieOptions) clear(w http.ResponseWriter) {
	for _, v := range []struct {
		name, path string
		httpOnly   bool
	}{{AccessCookie, "/api/v1", true}, {RefreshCookie, "/api/v1/auth", true}, {CSRFCookie, "/", false}} {
		http.SetCookie(w, &http.Cookie{Name: v.name, Path: v.path, HttpOnly: v.httpOnly, Secure: c.Secure, SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(1, 0)})
	}
}
func cookieValue(r *http.Request, name string) string {
	c, err := r.Cookie(name)
	if err != nil {
		return ""
	}
	return c.Value
}
func unsafeMethod(method string) bool {
	return method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions
}
