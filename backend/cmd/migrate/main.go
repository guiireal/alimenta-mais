package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"alimenta-mais/backend/internal/database"
	"alimenta-mais/backend/migrations"

	"github.com/pressly/goose/v3"
)

func run(args []string) error {
	if len(args) != 1 || (args[0] != "up" && args[0] != "down" && args[0] != "status") {
		return errors.New("uso: go run ./cmd/migrate [up|down|status]")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	db, err := database.Open(ctx)
	if err != nil {
		return err
	}
	defer db.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, db, migrations.Files)
	if err != nil {
		return err
	}
	switch args[0] {
	case "up":
		_, err = provider.Up(ctx)
	case "down":
		_, err = provider.Down(ctx)
	case "status":
		var statuses []*goose.MigrationStatus
		statuses, err = provider.Status(ctx)
		if err == nil {
			for _, status := range statuses {
				fmt.Printf("%05d %s %s\n", status.Source.Version, status.State, status.Source.Path)
			}
		}
	}
	return err
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		log.Fatal(err)
	}
}
