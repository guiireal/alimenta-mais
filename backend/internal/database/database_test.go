package database

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestOpenRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	if _, err := Open(context.Background()); err == nil {
		t.Fatal("esperava erro sem DATABASE_URL")
	}
}

func TestOpenDoesNotExposeInvalidCredentials(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://postgres:secret-password@localhost:invalid/database")
	_, err := Open(context.Background())
	if err == nil || strings.Contains(err.Error(), "secret-password") {
		t.Fatalf("esperava erro sem expor a senha: %v", err)
	}
}

func TestOpenRespectsCancellation(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/alimenta_mais?sslmode=disable")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Open(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("esperava cancelamento: %v", err)
	}
}
