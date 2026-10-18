package migrations

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"alimenta-mais/backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func TestMigrationsPostgres(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("defina TEST_DATABASE_URL para testar as migrations no PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	config, err := pgx.ParseConfig(dsn)
	if err != nil {
		t.Fatal("TEST_DATABASE_URL inválida")
	}
	admin := stdlib.OpenDB(*config)
	defer admin.Close()
	schema := fmt.Sprintf("test_migrations_%d", time.Now().UnixNano())
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()
		if _, err := admin.ExecContext(cleanupCtx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("limpar schema de teste: %v", err)
		}
	}()
	config.RuntimeParams["search_path"] = schema
	db := stdlib.OpenDB(*config)
	defer db.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, db, Files)
	if err != nil {
		t.Fatal(err)
	}
	if results, err := provider.Up(ctx); err != nil || len(results) != 3 {
		t.Fatalf("aplicar migration: results=%v err=%v", results, err)
	}
	if results, err := provider.Up(ctx); err != nil || len(results) != 0 {
		t.Fatalf("reaplicação deve ser inócua: results=%v err=%v", results, err)
	}
	for _, check := range []struct {
		name  string
		query string
		want  int
	}{
		{"tables", `SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'goose_db_version'`, 16},
		{"enums", `SELECT count(*) FROM pg_type WHERE typnamespace = current_schema()::regnamespace AND typtype = 'e'`, 7},
		{"checks", `SELECT count(*) FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND contype = 'c'`, 34},
		{"foreign keys", `SELECT count(*) FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND contype = 'f'`, 25},
	} {
		var got int
		if err := db.QueryRowContext(ctx, check.query).Scan(&got); err != nil || got != check.want {
			t.Fatalf("%s: got=%d want=%d err=%v", check.name, got, check.want, err)
		}
	}
	if _, err := db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
		VALUES (1, 'Test', 'test@example.com', 'test-hash', now(), now());
		INSERT INTO donors (id, type, name, created_at, updated_at)
		VALUES (1, 'individual', 'Donor', now(), now());
		INSERT INTO product_categories (id, name) VALUES (1, 'Food');
		INSERT INTO products (id, category_id, name, unit, created_at, updated_at)
		VALUES (1, 1, 'Rice', 'kg', now(), now());
		INSERT INTO warehouses (id, name) VALUES (1, 'Central'), (2, 'Secondary');
		INSERT INTO donations (id, donor_id, created_by, created_at, updated_at)
		VALUES (1, 1, 1, now(), now());
		INSERT INTO inventory_batches (id, donation_id, product_id, batch_code, received_quantity, unit_weight_kg, created_at, updated_at)
		VALUES (1, 1, 1, 'B1', 1.234, 0.123456, now(), now()), (2, NULL, 1, 'B2', 5, 1, now(), now());
		INSERT INTO families (id, reference_code, contact_name, household_size, address, neighborhood, city, state, created_at, updated_at)
		VALUES (1, 'F1', 'Family', 2, 'Street', 'Center', 'City', 'SP', now(), now());
		INSERT INTO partner_organizations (id, name, address, created_at, updated_at)
		VALUES (1, 'Partner', 'Street', now(), now());
		INSERT INTO delivery_routes (id, reference_code, origin_warehouse_id, scheduled_on, created_by, created_at, updated_at)
		VALUES (1, 'R1', 1, current_date, 1, now(), now());
		INSERT INTO deliveries (id, family_id, route_id, stop_sequence, destination_address, created_by, created_at, updated_at)
		VALUES (1, 1, 1, 1, 'Street', 1, now(), now());
		INSERT INTO delivery_items (id, delivery_id, batch_id, quantity) VALUES (1, 1, 1, 1);
		INSERT INTO stock_movements (batch_id, type, quantity, to_warehouse_id, moved_at, recorded_by, created_at)
		VALUES (1, 'receipt', 1.234, 1, now(), 1, now());
		INSERT INTO stock_movements (batch_id, type, quantity, from_warehouse_id, delivery_item_id, moved_at, recorded_by, created_at)
		VALUES (1, 'distribution', 1, 1, 1, now(), 1, now());
		INSERT INTO audit_logs (actor_id, action, occurred_at) VALUES (1, 'test', now());
	`); err != nil {
		t.Fatal(err)
	}
	var batch domain.InventoryBatch
	if err := db.QueryRowContext(ctx, `SELECT received_quantity, unit_weight_kg, expires_on, triage_status FROM inventory_batches WHERE id = 1`).Scan(
		&batch.ReceivedQuantity, &batch.UnitWeightKg, &batch.ExpiresOn, &batch.TriageStatus,
	); err != nil {
		t.Fatal(err)
	}
	quantity := string(batch.ReceivedQuantity)
	weight := string(batch.UnitWeightKg)
	if quantity != "1.234" || weight != "0.123456" || batch.ExpiresOn != nil || batch.TriageStatus != domain.TriageStatusPending {
		t.Fatalf("precisão, NULL ou enum incorreto: %+v", batch)
	}
	for _, test := range []struct {
		name string
		sql  string
		code string
	}{
		{"invalid enum", `UPDATE users SET role = 'invalid' WHERE id = 1`, "22P02"},
		{"unique email", `INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (2, 'Other', 'test@example.com', 'hash', now(), now())`, "23505"},
		{"missing parent", `UPDATE products SET category_id = 999 WHERE id = 1`, "23503"},
		{"positive received quantity", `UPDATE inventory_batches SET received_quantity = 0 WHERE id = 1`, "23514"},
		{"positive weight", `UPDATE inventory_batches SET unit_weight_kg = 0 WHERE id = 1`, "23514"},
		{"warehouse coordinates pair", `UPDATE warehouses SET latitude = 10 WHERE id = 1`, "23514"},
		{"coordinates range", `UPDATE warehouses SET latitude = 91, longitude = 0 WHERE id = 1`, "23514"},
		{"received donation date", `UPDATE donations SET status = 'received' WHERE id = 1`, "23514"},
		{"confirmation pair", `UPDATE donations SET confirmed_by = 1 WHERE id = 1`, "23514"},
		{"triage actor and date", `UPDATE inventory_batches SET triage_status = 'approved' WHERE id = 1`, "23514"},
		{"household size", `UPDATE families SET household_size = 0 WHERE id = 1`, "23514"},
		{"consent version", `UPDATE families SET consent_granted_at = now() WHERE id = 1`, "23514"},
		{"consent revocation", `UPDATE families SET consent_revoked_at = now() WHERE id = 1`, "23514"},
		{"completed route dates", `UPDATE delivery_routes SET status = 'completed' WHERE id = 1`, "23514"},
		{"route chronology", `UPDATE delivery_routes SET started_at = now(), completed_at = now() - interval '1 day' WHERE id = 1`, "23514"},
		{"exclusive recipient", `UPDATE deliveries SET partner_organization_id = 1 WHERE id = 1`, "23514"},
		{"required recipient", `UPDATE deliveries SET family_id = NULL WHERE id = 1`, "23514"},
		{"route stop pair", `UPDATE deliveries SET stop_sequence = NULL WHERE id = 1`, "23514"},
		{"destination coordinates pair", `UPDATE deliveries SET destination_latitude = 10 WHERE id = 1`, "23514"},
		{"delivery date", `UPDATE deliveries SET status = 'delivered' WHERE id = 1`, "23514"},
		{"delivery chronology", `UPDATE deliveries SET delivered_at = created_at - interval '1 day' WHERE id = 1`, "23514"},
		{"positive delivery item", `UPDATE delivery_items SET quantity = 0 WHERE id = 1`, "23514"},
		{"positive movement", `UPDATE stock_movements SET quantity = 0`, "23514"},
		{"receipt direction", `UPDATE stock_movements SET from_warehouse_id = 1 WHERE type = 'receipt'`, "23514"},
		{"transfer distinct warehouses", `UPDATE stock_movements SET type = 'transfer', from_warehouse_id = 1 WHERE type = 'receipt'`, "23514"},
		{"distribution item", `UPDATE stock_movements SET delivery_item_id = NULL WHERE type = 'distribution'`, "23514"},
		{"receipt without item", `UPDATE stock_movements SET delivery_item_id = 1 WHERE type = 'receipt'`, "23514"},
		{"loss reason", `UPDATE stock_movements SET type = 'other_loss', delivery_item_id = NULL WHERE type = 'distribution'`, "23514"},
		{"same batch composite foreign key", `UPDATE stock_movements SET batch_id = 2 WHERE type = 'distribution'`, "23503"},
		{"restrict delete linked item", `DELETE FROM delivery_items WHERE id = 1`, "23503"},
	} {
		t.Run(test.name, func(t *testing.T) {
			tx, err := db.BeginTx(ctx, nil)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback()
			_, err = tx.ExecContext(ctx, test.sql)
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != test.code {
				t.Fatalf("esperava SQLSTATE %s: %v", test.code, err)
			}
		})
	}
	if _, err := provider.DownTo(ctx, 0); err != nil {
		t.Fatalf("rollback: %v", err)
	}
	var remaining int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'goose_db_version'`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("rollback deixou tabelas: count=%d err=%v", remaining, err)
	}
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM pg_type WHERE typnamespace = current_schema()::regnamespace AND typtype = 'e'`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("rollback deixou enums: count=%d err=%v", remaining, err)
	}
	if _, err := provider.Up(ctx); err != nil {
		t.Fatalf("recriar após rollback: %v", err)
	}
}
