package postgres

import (
	"context"

	"alimenta-mais/backend/internal/domain"
)

const userColumns = `id,name,email,password_hash,role,is_active,last_login_at,created_at,updated_at`

func scanUser(row scanner) (domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	return u, translate(err)
}
func (s *Store) User(ctx context.Context, id int64, forUpdate bool) (domain.User, error) {
	return scanUser(s.query.QueryRowContext(ctx, "SELECT "+userColumns+" FROM users WHERE id=$1"+lock(forUpdate), id))
}
func (s *Store) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	return scanUser(s.query.QueryRowContext(ctx, "SELECT "+userColumns+" FROM users WHERE lower(email)=lower($1)", email))
}
func (s *Store) Users(ctx context.Context, q domain.PageQuery) (domain.Page[domain.User], error) {
	return page(ctx, s, q, "users", userColumns, `($1='' OR strpos(lower(name),lower($1))>0 OR strpos(lower(email),lower($1))>0) AND ($2='' OR ($2='active' AND is_active) OR ($2='inactive' AND NOT is_active))`, "id", []any{q.Q, q.Status}, scanUser)
}
func (s *Store) CreateUser(ctx context.Context, u *domain.User) error {
	return translate(s.query.QueryRowContext(ctx, `INSERT INTO users(name,email,password_hash,role,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, u.Name, u.Email, u.PasswordHash, u.Role, u.IsActive, u.CreatedAt, u.UpdatedAt).Scan(&u.ID))
}
func (s *Store) UpdateUser(ctx context.Context, u domain.User) error {
	return changed(s.query.ExecContext(ctx, `UPDATE users SET name=$1,email=$2,password_hash=$3,role=$4,is_active=$5,last_login_at=$6,updated_at=$7 WHERE id=$8`, u.Name, u.Email, u.PasswordHash, u.Role, u.IsActive, u.LastLoginAt, u.UpdatedAt, u.ID))
}
func (s *Store) LockAdministrators(ctx context.Context) error {
	_, err := s.query.ExecContext(ctx, `SELECT pg_advisory_xact_lock(731920261017)`)
	return translate(err)
}
func (s *Store) ActiveAdministrators(ctx context.Context) (int, error) {
	var n int
	err := s.query.QueryRowContext(ctx, `SELECT count(*) FROM users WHERE role='administrator' AND is_active`).Scan(&n)
	return n, translate(err)
}
func (s *Store) CreateSession(ctx context.Context, session domain.Session) error {
	if _, err := s.query.ExecContext(ctx, `DELETE FROM sessions WHERE user_id=$1 AND expires_at<=now()`, session.UserID); err != nil {
		return translate(err)
	}
	_, err := s.query.ExecContext(ctx, `INSERT INTO sessions(id,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)`, session.ID, session.UserID, session.CSRFHash, session.ExpiresAt)
	return translate(err)
}
func (s *Store) SessionUser(ctx context.Context, id string) (domain.Actor, error) {
	var a domain.Actor
	u := &a.User
	err := s.query.QueryRowContext(ctx, `SELECT u.id,u.name,u.email,u.password_hash,u.role,u.is_active,u.last_login_at,u.created_at,u.updated_at,s.id,s.csrf_hash,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>now() AND u.is_active`, id).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt, &a.SessionID, &a.CSRFHash, &a.SessionExpiresAt)
	if err != nil {
		if translate(err) == domain.ErrNotFound {
			return a, domain.ErrUnauthenticated
		}
		return a, translate(err)
	}
	return a, nil
}
func (s *Store) DeleteSession(ctx context.Context, id string) error {
	_, err := s.query.ExecContext(ctx, `DELETE FROM sessions WHERE id=$1`, id)
	return translate(err)
}
func (s *Store) CreateRefreshToken(ctx context.Context, t domain.RefreshToken) error {
	_, err := s.query.ExecContext(ctx, `INSERT INTO refresh_tokens(token_hash,session_id,expires_at) VALUES($1,$2,$3)`, t.TokenHash, t.SessionID, t.ExpiresAt)
	return translate(err)
}
func (s *Store) RefreshToken(ctx context.Context, hash string) (domain.RefreshToken, error) {
	var t domain.RefreshToken
	err := s.query.QueryRowContext(ctx, `SELECT token_hash,session_id,expires_at,used_at FROM refresh_tokens WHERE token_hash=$1 FOR UPDATE`, hash).Scan(&t.TokenHash, &t.SessionID, &t.ExpiresAt, &t.UsedAt)
	return t, translate(err)
}
func (s *Store) UseRefreshToken(ctx context.Context, hash string) error {
	return changed(s.query.ExecContext(ctx, `UPDATE refresh_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL`, hash))
}
func (s *Store) DeleteUserSessions(ctx context.Context, id int64) error {
	_, err := s.query.ExecContext(ctx, `DELETE FROM sessions WHERE user_id=$1`, id)
	return translate(err)
}
