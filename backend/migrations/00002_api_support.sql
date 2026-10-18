-- +goose Up
ALTER TABLE product_categories ADD COLUMN is_perishable boolean NOT NULL DEFAULT false;
ALTER TABLE warehouses ADD COLUMN is_cold_storage boolean NOT NULL DEFAULT false;
ALTER TABLE deliveries ADD COLUMN source_warehouse_id bigint REFERENCES warehouses(id);
UPDATE deliveries d SET source_warehouse_id = r.origin_warehouse_id FROM delivery_routes r WHERE d.route_id = r.id;

CREATE UNIQUE INDEX users_email_normalized_key ON users (lower(email));
CREATE UNIQUE INDEX inventory_batches_receipt_key ON stock_movements (batch_id) WHERE type = 'receipt';
CREATE INDEX deliveries_source_warehouse_idx ON deliveries(source_warehouse_id);

CREATE TABLE sessions (
  token_hash char(64) PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE VIEW stock_balances AS
SELECT batch_id, warehouse_id, sum(quantity) AS quantity
FROM (
  SELECT batch_id, to_warehouse_id AS warehouse_id, quantity FROM stock_movements WHERE to_warehouse_id IS NOT NULL
  UNION ALL
  SELECT batch_id, from_warehouse_id AS warehouse_id, -quantity FROM stock_movements WHERE from_warehouse_id IS NOT NULL
) movements
GROUP BY batch_id, warehouse_id;

-- +goose Down
DROP VIEW stock_balances;
DROP TABLE sessions;
DROP INDEX deliveries_source_warehouse_idx;
DROP INDEX inventory_batches_receipt_key;
DROP INDEX users_email_normalized_key;
ALTER TABLE deliveries DROP COLUMN source_warehouse_id;
ALTER TABLE warehouses DROP COLUMN is_cold_storage;
ALTER TABLE product_categories DROP COLUMN is_perishable;
