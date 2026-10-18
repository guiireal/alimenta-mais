package security

import (
	"crypto/rand"
	"errors"
	"strconv"
	"time"

	"alimenta-mais/backend/internal/domain"

	"github.com/golang-jwt/jwt/v5"
)

type Tokens struct{ secret []byte }
type accessClaims struct {
	SessionID string `json:"sid"`
	jwt.RegisteredClaims
}

func NewTokens(secret string) (*Tokens, error) {
	if len(secret) < 32 {
		return nil, errors.New("JWT_SECRET deve conter ao menos 32 bytes aleatórios")
	}
	return &Tokens{secret: []byte(secret)}, nil
}
func (s *Tokens) Issue(userID int64, sessionID string, expires time.Time) (string, error) {
	now := time.Now().UTC()
	claims := accessClaims{SessionID: sessionID, RegisteredClaims: jwt.RegisteredClaims{Issuer: "alimenta-mais", Audience: jwt.ClaimStrings{"alimenta-mais-app"}, Subject: strconv.FormatInt(userID, 10), ID: rand.Text(), ExpiresAt: jwt.NewNumericDate(expires), IssuedAt: jwt.NewNumericDate(now), NotBefore: jwt.NewNumericDate(now)}}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["typ"] = "at+jwt"
	return token.SignedString(s.secret)
}
func (s *Tokens) Verify(raw string) (domain.TokenIdentity, error) {
	claims := new(accessClaims)
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) {
		if token.Header["typ"] != "at+jwt" {
			return nil, domain.ErrUnauthenticated
		}
		return s.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("alimenta-mais"), jwt.WithAudience("alimenta-mais-app"), jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil || !token.Valid || len(claims.SessionID) != 64 || claims.ID == "" || claims.IssuedAt == nil || claims.NotBefore == nil {
		return domain.TokenIdentity{}, domain.ErrUnauthenticated
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || id <= 0 {
		return domain.TokenIdentity{}, domain.ErrUnauthenticated
	}
	return domain.TokenIdentity{UserID: id, SessionID: claims.SessionID}, nil
}
