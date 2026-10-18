package security

import (
	"github.com/golang-jwt/jwt/v5"
	"strings"
	"testing"
	"time"
)

func TestAccessJWTValidation(t *testing.T) {
	key := strings.Repeat("k", 32)
	s, err := NewTokens(key)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewTokens("short"); err == nil {
		t.Fatal("short signing key accepted")
	}
	raw, err := s.Issue(42, strings.Repeat("a", 64), time.Now().Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	identity, err := s.Verify(raw)
	if err != nil || identity.UserID != 42 || identity.SessionID != strings.Repeat("a", 64) {
		t.Fatalf("valid token rejected: %+v %v", identity, err)
	}
	for _, tc := range []struct {
		name   string
		change func(*accessClaims, *jwt.Token)
	}{
		{"expired", func(c *accessClaims, _ *jwt.Token) { c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute)) }},
		{"no expiry", func(c *accessClaims, _ *jwt.Token) { c.ExpiresAt = nil }},
		{"wrong issuer", func(c *accessClaims, _ *jwt.Token) { c.Issuer = "other" }},
		{"wrong audience", func(c *accessClaims, _ *jwt.Token) { c.Audience = jwt.ClaimStrings{"other"} }},
		{"future issued", func(c *accessClaims, _ *jwt.Token) { c.IssuedAt = jwt.NewNumericDate(time.Now().Add(time.Hour)) }},
		{"missing session", func(c *accessClaims, _ *jwt.Token) { c.SessionID = "" }},
		{"invalid subject", func(c *accessClaims, _ *jwt.Token) { c.Subject = "0" }},
		{"wrong type", func(_ *accessClaims, t *jwt.Token) { t.Header["typ"] = "JWT" }},
		{"wrong algorithm", func(_ *accessClaims, t *jwt.Token) { t.Method = jwt.SigningMethodHS384 }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := new(accessClaims)
			_, _, _ = jwt.NewParser().ParseUnverified(raw, c)
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
			token.Header["typ"] = "at+jwt"
			tc.change(c, token)
			bad, err := token.SignedString([]byte(key))
			if err != nil {
				t.Fatal(err)
			}
			if _, err := s.Verify(bad); err == nil {
				t.Fatal("invalid token accepted")
			}
		})
	}
	other, _ := NewTokens(strings.Repeat("z", 32))
	if _, err := other.Verify(raw); err == nil {
		t.Fatal("incorrect signature accepted")
	}
}
