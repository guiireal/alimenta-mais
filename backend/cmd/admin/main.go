package main

import (
	"context"
	"log"
	"os"
	"time"

	"alimenta-mais/backend/internal/adapter/postgres"
	"alimenta-mais/backend/internal/adapter/security"
	"alimenta-mais/backend/internal/database"
	"alimenta-mais/backend/internal/usecase"
)

func run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := database.Open(ctx)
	if err != nil {
		return err
	}
	defer db.Close()
	auth := usecase.Auth{Tx: postgres.New(db), Passwords: security.Passwords{}}
	return auth.Bootstrap(ctx, usecase.RegisterInput{Name: os.Getenv("ADMIN_NAME"), Email: os.Getenv("ADMIN_EMAIL"), Password: os.Getenv("ADMIN_PASSWORD")})
}
func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
	log.Println("Administrador inicial criado")
}
