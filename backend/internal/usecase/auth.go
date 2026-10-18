package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"alimenta-mais/backend/internal/domain"
)

type Auth struct {
	Users     UserRepository
	Sessions  SessionRepository
	Tx        UnitOfWork
	Passwords Passwords
	DummyHash string
	Tokens    AccessTokens
}
type Credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type RegisterInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

const AccessLifetime = 15 * time.Minute
const RefreshLifetime = 30 * 24 * time.Hour

type LoginResult struct {
	User             domain.User `json:"user"`
	ExpiresAt        time.Time   `json:"expires_at"`
	RefreshExpiresAt time.Time   `json:"-"`
	Token            string      `json:"-"`
	RefreshToken     string      `json:"-"`
	CSRFToken        string      `json:"-"`
}

func randomToken() (string, error) {
	value := make([]byte, 32)
	_, err := rand.Read(value)
	return hex.EncodeToString(value), err
}
func ValidCSRF(value, hash string) bool {
	return len(value) == 64 && len(hash) == 64 && subtle.ConstantTimeCompare([]byte(TokenHash(value)), []byte(hash)) == 1
}

func TokenHash(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func (s *Auth) Register(ctx context.Context, in RegisterInput, ip string) (domain.User, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	v := validation{}
	v.text("name", in.Name, 150, true)
	v.email("email", in.Email)
	v.password(in.Password)
	if err := v.err(); err != nil {
		return domain.User{}, err
	}
	hash, err := s.Passwords.Hash(in.Password)
	if err != nil {
		return domain.User{}, err
	}
	now := time.Now().UTC()
	u := domain.User{Name: in.Name, Email: in.Email, PasswordHash: hash, Role: domain.UserRoleOperator, IsActive: true, CreatedAt: now, UpdatedAt: now}
	err = s.Tx.WithinTx(ctx, func(r Repositories) error {
		if err := r.Users.CreateUser(ctx, &u); err != nil {
			return err
		}
		return r.Audit.Record(ctx, domain.Actor{User: u, IPAddress: ip}, "user.register", "users", u.ID, nil, u)
	})
	return u, err
}
func (s *Auth) Login(ctx context.Context, in Credentials, ip string) (LoginResult, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if len(in.Password) > 72 || len(in.Email) > 254 {
		return LoginResult{}, domain.ErrUnauthenticated
	}
	u, err := s.Users.UserByEmail(ctx, in.Email)
	if err != nil {
		if !errors.Is(err, domain.ErrNotFound) {
			return LoginResult{}, err
		}
		s.Passwords.Compare(s.DummyHash, in.Password)
		return LoginResult{}, domain.ErrUnauthenticated
	}
	if !s.Passwords.Compare(u.PasswordHash, in.Password) || !u.IsActive {
		return LoginResult{}, domain.ErrUnauthenticated
	}
	sessionID, err := randomToken()
	if err != nil {
		return LoginResult{}, err
	}
	refresh, err := randomToken()
	if err != nil {
		return LoginResult{}, err
	}
	csrf, err := randomToken()
	if err != nil {
		return LoginResult{}, err
	}
	now := time.Now().UTC()
	expires := now.Add(AccessLifetime)
	refreshExpires := now.Add(RefreshLifetime)
	token, err := s.Tokens.Issue(u.ID, sessionID, expires)
	if err != nil {
		return LoginResult{}, err
	}
	err = s.Tx.WithinTx(ctx, func(r Repositories) error {
		current, e := r.Users.User(ctx, u.ID, true)
		if e != nil {
			return e
		}
		if !current.IsActive || current.PasswordHash != u.PasswordHash {
			return domain.ErrUnauthenticated
		}
		current.LastLoginAt = &now
		current.UpdatedAt = now
		if e := r.Users.UpdateUser(ctx, current); e != nil {
			return e
		}
		if e := r.Sessions.CreateSession(ctx, domain.Session{ID: sessionID, UserID: u.ID, CSRFHash: TokenHash(csrf), ExpiresAt: refreshExpires}); e != nil {
			return e
		}
		if e := r.Sessions.CreateRefreshToken(ctx, domain.RefreshToken{TokenHash: TokenHash(refresh), SessionID: sessionID, ExpiresAt: refreshExpires}); e != nil {
			return e
		}
		u = current
		return r.Audit.Record(ctx, domain.Actor{User: u, IPAddress: ip}, "user.login", "users", u.ID, nil, nil)
	})
	return LoginResult{User: u, Token: token, RefreshToken: refresh, CSRFToken: csrf, ExpiresAt: expires, RefreshExpiresAt: refreshExpires}, err
}
func (s *Auth) Authenticate(ctx context.Context, token string) (domain.Actor, error) {
	identity, err := s.Tokens.Verify(token)
	if err != nil {
		return domain.Actor{}, domain.ErrUnauthenticated
	}
	a, err := s.Sessions.SessionUser(ctx, identity.SessionID)
	if err != nil {
		return domain.Actor{}, err
	}
	if a.User.ID != identity.UserID {
		return domain.Actor{}, domain.ErrUnauthenticated
	}
	return a, nil
}
func (s *Auth) Refresh(ctx context.Context, token, csrf, ip string) (LoginResult, error) {
	if len(token) != 64 {
		return LoginResult{}, domain.ErrUnauthenticated
	}
	if _, err := hex.DecodeString(token); err != nil {
		return LoginResult{}, domain.ErrUnauthenticated
	}
	var out LoginResult
	reused := false
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		stored, err := r.Sessions.RefreshToken(ctx, TokenHash(token))
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.ErrUnauthenticated
			}
			return err
		}
		a, err := r.Sessions.SessionUser(ctx, stored.SessionID)
		if err != nil {
			return err
		}
		a.IPAddress = ip
		if !ValidCSRF(csrf, a.CSRFHash) {
			return domain.ErrForbidden
		}
		if stored.UsedAt != nil {
			reused = true
			if err := r.Sessions.DeleteSession(ctx, stored.SessionID); err != nil {
				return err
			}
			return r.Audit.Record(ctx, a, "user.refresh_reused", "users", a.User.ID, nil, nil)
		}
		if !stored.ExpiresAt.After(time.Now().UTC()) {
			return domain.ErrUnauthenticated
		}
		next, err := randomToken()
		if err != nil {
			return err
		}
		expires := time.Now().UTC().Add(AccessLifetime)
		if expires.After(a.SessionExpiresAt) {
			expires = a.SessionExpiresAt
		}
		access, err := s.Tokens.Issue(a.User.ID, a.SessionID, expires)
		if err != nil {
			return err
		}
		if err := r.Sessions.UseRefreshToken(ctx, stored.TokenHash); err != nil {
			return err
		}
		if err := r.Sessions.CreateRefreshToken(ctx, domain.RefreshToken{TokenHash: TokenHash(next), SessionID: a.SessionID, ExpiresAt: a.SessionExpiresAt}); err != nil {
			return err
		}
		out = LoginResult{User: a.User, Token: access, RefreshToken: next, CSRFToken: csrf, ExpiresAt: expires, RefreshExpiresAt: a.SessionExpiresAt}
		return nil
	})
	if err == nil && reused {
		return LoginResult{}, domain.ErrUnauthenticated
	}
	return out, err
}
func (s *Auth) Logout(ctx context.Context, a domain.Actor) error {
	return s.Tx.WithinTx(ctx, func(r Repositories) error {
		if err := r.Sessions.DeleteSession(ctx, a.SessionID); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "user.logout", "users", a.User.ID, nil, nil)
	})
}

func (s *Auth) ChangePassword(ctx context.Context, a domain.Actor, current, password string) error {
	v := validation{}
	v.password(password)
	if err := v.err(); err != nil {
		return err
	}
	hash, err := s.Passwords.Hash(password)
	if err != nil {
		return err
	}
	return s.Tx.WithinTx(ctx, func(r Repositories) error {
		u, err := r.Users.User(ctx, a.User.ID, true)
		if err != nil {
			return err
		}
		if len(current) > 72 || !s.Passwords.Compare(u.PasswordHash, current) {
			return domain.ValidationError{"current_password": "senha atual incorreta"}
		}
		u.PasswordHash = hash
		u.UpdatedAt = time.Now().UTC()
		if err := r.Users.UpdateUser(ctx, u); err != nil {
			return err
		}
		if err := r.Sessions.DeleteUserSessions(ctx, u.ID); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "user.password_changed", "users", u.ID, nil, nil)
	})
}
func (s *Auth) Bootstrap(ctx context.Context, in RegisterInput) error {
	v := validation{}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Name = strings.TrimSpace(in.Name)
	v.email("email", in.Email)
	v.text("name", in.Name, 150, true)
	v.password(in.Password)
	if err := v.err(); err != nil {
		return err
	}
	hash, err := s.Passwords.Hash(in.Password)
	if err != nil {
		return err
	}
	return s.Tx.WithinTx(ctx, func(r Repositories) error {
		if err := r.Users.LockAdministrators(ctx); err != nil {
			return err
		}
		n, err := r.Users.ActiveAdministrators(ctx)
		if err != nil {
			return err
		}
		if n > 0 {
			return conflict("já existe um administrador ativo")
		}
		now := time.Now().UTC()
		u := domain.User{Name: in.Name, Email: in.Email, PasswordHash: hash, Role: domain.UserRoleAdministrator, IsActive: true, CreatedAt: now, UpdatedAt: now}
		if err := r.Users.CreateUser(ctx, &u); err != nil {
			return err
		}
		return r.Audit.Record(ctx, domain.Actor{User: u}, "user.bootstrap", "users", u.ID, nil, u)
	})
}

type Access struct{ Tx UnitOfWork }
type UserAccessInput struct {
	Role     domain.UserRole `json:"role"`
	IsActive bool            `json:"is_active"`
}

func (s *Access) Update(ctx context.Context, a domain.Actor, id int64, in UserAccessInput) (domain.User, error) {
	if err := domain.Require(a, domain.WriteAccess); err != nil {
		return domain.User{}, err
	}
	if id == a.User.ID {
		return domain.User{}, conflict("você não pode alterar o próprio acesso")
	}
	if in.Role != domain.UserRoleAdministrator && in.Role != domain.UserRoleManager && in.Role != domain.UserRoleOperator {
		return domain.User{}, domain.ValidationError{"role": "perfil inválido"}
	}
	var result domain.User
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		if err := r.Users.LockAdministrators(ctx); err != nil {
			return err
		}
		u, err := r.Users.User(ctx, id, true)
		if err != nil {
			return err
		}
		before := u
		u.Role = in.Role
		u.IsActive = in.IsActive
		u.UpdatedAt = time.Now().UTC()
		if err := r.Users.UpdateUser(ctx, u); err != nil {
			return err
		}
		n, err := r.Users.ActiveAdministrators(ctx)
		if err != nil {
			return err
		}
		if n == 0 {
			return conflict("é necessário manter um administrador ativo")
		}
		if err := r.Sessions.DeleteUserSessions(ctx, id); err != nil {
			return err
		}
		result = u
		return r.Audit.Record(ctx, a, "user.access_changed", "users", id, before, u)
	})
	return result, err
}
