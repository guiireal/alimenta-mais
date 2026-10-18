package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
)

func Open(ctx context.Context) (*sql.DB, error) {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("carregar .env: %w", err)
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, errors.New("DATABASE_URL é obrigatória")
	}
	config, err := pgx.ParseConfig(dsn)
	if err != nil {
		return nil, errors.New("DATABASE_URL inválida")
	}
	config.RuntimeParams["timezone"] = "UTC"
	db := stdlib.OpenDB(*config)
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("conectar ao PostgreSQL: %w", err)
	}
	return db, nil
}
