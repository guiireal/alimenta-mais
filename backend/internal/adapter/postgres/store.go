package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"alimenta-mais/backend/internal/domain"
	"alimenta-mais/backend/internal/usecase"

	"github.com/jackc/pgx/v5/pgconn"
)

type executor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}
type Store struct {
	db    *sql.DB
	query executor
}

func New(db *sql.DB) *Store { return &Store{db: db, query: db} }
func (s *Store) Repositories() usecase.Repositories {
	return usecase.Repositories{Users: s, Sessions: s, Catalog: s, Donations: s, Stock: s, Deliveries: s, Audit: s, Queries: s}
}
func (s *Store) WithinTx(ctx context.Context, fn func(usecase.Repositories) error) error {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return translate(err)
	}
	defer tx.Rollback()
	repos := (&Store{query: tx}).Repositories()
	if err := fn(repos); err != nil {
		return translate(err)
	}
	return translate(tx.Commit())
}
func translate(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		switch pg.Code {
		case "23505":
			return fmt.Errorf("registro já existente: %w", domain.ErrConflict)
		case "23503":
			return fmt.Errorf("registro relacionado inexistente ou em uso: %w", domain.ErrConflict)
		case "23514", "23502", "22003", "22001", "22P02":
			return domain.ValidationError{"data": "dados incompatíveis com as regras do banco"}
		case "40P01", "40001":
			return fmt.Errorf("operação concorrente; tente novamente: %w", domain.ErrConflict)
		}
	}
	return err
}

type scanner interface{ Scan(...any) error }

func page[T any](ctx context.Context, s *Store, q domain.PageQuery, from, columns, where, order string, args []any, scan func(scanner) (T, error)) (domain.Page[T], error) {
	out := domain.Page[T]{Items: make([]T, 0), Page: q.Page, PageSize: q.PageSize}
	if err := s.query.QueryRowContext(ctx, "SELECT count(*) FROM "+from+" WHERE "+where, args...).Scan(&out.Total); err != nil {
		return out, translate(err)
	}
	args = append(args, q.PageSize, q.Offset())
	query := fmt.Sprintf("SELECT %s FROM %s WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d", columns, from, where, order, len(args)-1, len(args))
	rows, err := s.query.QueryContext(ctx, query, args...)
	if err != nil {
		return out, translate(err)
	}
	defer rows.Close()
	for rows.Next() {
		item, err := scan(rows)
		if err != nil {
			return out, translate(err)
		}
		out.Items = append(out.Items, item)
	}
	return out, translate(rows.Err())
}
func many[T any](ctx context.Context, s *Store, query string, args []any, scan func(scanner) (T, error)) ([]T, error) {
	items := make([]T, 0)
	rows, err := s.query.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, translate(err)
	}
	defer rows.Close()
	for rows.Next() {
		item, err := scan(rows)
		if err != nil {
			return nil, translate(err)
		}
		items = append(items, item)
	}
	return items, translate(rows.Err())
}
func lock(enabled bool) string {
	if enabled {
		return " FOR UPDATE"
	}
	return ""
}
func changed(result sql.Result, err error) error {
	if err != nil {
		return translate(err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}
