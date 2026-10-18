package postgres

import (
	"context"

	"alimenta-mais/backend/internal/domain"
)

const batchColumns = `b.id,b.donation_id,b.product_id,b.batch_code,b.received_quantity,b.unit_weight_kg,to_char(b.expires_on,'YYYY-MM-DD'),b.triage_status,b.triaged_by,b.triaged_at,b.triage_notes,b.created_at,b.updated_at`

func scanBatch(row scanner) (domain.InventoryBatch, error) {
	var b domain.InventoryBatch
	err := row.Scan(&b.ID, &b.DonationID, &b.ProductID, &b.BatchCode, &b.ReceivedQuantity, &b.UnitWeightKg, &b.ExpiresOn, &b.TriageStatus, &b.TriagedBy, &b.TriagedAt, &b.TriageNotes, &b.CreatedAt, &b.UpdatedAt)
	return b, translate(err)
}
func (s *Store) Batch(ctx context.Context, id int64, forUpdate bool) (domain.InventoryBatch, error) {
	return scanBatch(s.query.QueryRowContext(ctx, "SELECT "+batchColumns+" FROM inventory_batches b WHERE b.id=$1"+lock(forUpdate), id))
}
func (s *Store) Batches(ctx context.Context, q domain.PageQuery) (domain.Page[domain.InventoryBatch], error) {
	return page(ctx, s, q, "inventory_batches b JOIN products p ON p.id=b.product_id", batchColumns, `($1='' OR strpos(lower(b.batch_code),lower($1))>0 OR strpos(lower(p.name),lower($1))>0 OR b.id::text=$1) AND ($2='' OR b.triage_status::text=$2 OR ($2='expired' AND b.expires_on<current_date) OR ($2='critical' AND b.expires_on BETWEEN current_date AND current_date+2) OR ($2='warning' AND b.expires_on BETWEEN current_date+3 AND current_date+7) OR ($2='ok' AND b.expires_on>current_date+7) OR ($2='none' AND b.expires_on IS NULL)) AND ($2 NOT IN ('expired','critical','warning','ok','none') OR EXISTS(SELECT 1 FROM stock_balances current_balance WHERE current_balance.batch_id=b.id AND current_balance.quantity>0)) AND ($3::bigint=0 OR b.product_id=$3) AND ($4::bigint=0 OR b.donation_id=$4) AND ($5::bigint=0 OR EXISTS(SELECT 1 FROM stock_balances bal WHERE bal.batch_id=b.id AND bal.warehouse_id=$5 AND bal.quantity>0)) AND ($6::bigint=0 OR p.category_id=$6)`, "b.expires_on NULLS LAST,b.id", []any{q.Q, q.Status, q.ProductID, q.DonationID, q.WarehouseID, q.CategoryID}, scanBatch)
}
func (s *Store) SaveBatch(ctx context.Context, b *domain.InventoryBatch) error {
	if b.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO inventory_batches(donation_id,product_id,batch_code,received_quantity,unit_weight_kg,expires_on,triage_status,triaged_by,triaged_at,triage_notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, b.DonationID, b.ProductID, b.BatchCode, b.ReceivedQuantity, b.UnitWeightKg, b.ExpiresOn, b.TriageStatus, b.TriagedBy, b.TriagedAt, b.TriageNotes, b.CreatedAt, b.UpdatedAt).Scan(&b.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE inventory_batches SET expires_on=$1,triage_status=$2,triaged_by=$3,triaged_at=$4,triage_notes=$5,updated_at=$6 WHERE id=$7`, b.ExpiresOn, b.TriageStatus, b.TriagedBy, b.TriagedAt, b.TriageNotes, b.UpdatedAt, b.ID))
}
func (s *Store) Balance(ctx context.Context, batchID, warehouseID int64) (domain.Decimal, error) {
	var d domain.Decimal
	err := s.query.QueryRowContext(ctx, `SELECT coalesce((SELECT quantity FROM stock_balances WHERE batch_id=$1 AND warehouse_id=$2),0)::numeric(12,3)`, batchID, warehouseID).Scan(&d)
	return d, translate(err)
}
func (s *Store) Balances(ctx context.Context, id int64) ([]domain.Balance, error) {
	return many(ctx, s, `SELECT batch_id,warehouse_id,quantity::numeric(12,3) FROM stock_balances WHERE batch_id=$1 ORDER BY warehouse_id`, []any{id}, func(row scanner) (domain.Balance, error) {
		var b domain.Balance
		err := row.Scan(&b.BatchID, &b.WarehouseID, &b.Quantity)
		return b, err
	})
}

const movementColumns = `id,batch_id,type,quantity,from_warehouse_id,to_warehouse_id,delivery_item_id,reason,moved_at,recorded_by,created_at`

func scanMovement(row scanner) (domain.StockMovement, error) {
	var m domain.StockMovement
	err := row.Scan(&m.ID, &m.BatchID, &m.Type, &m.Quantity, &m.FromWarehouseID, &m.ToWarehouseID, &m.DeliveryItemID, &m.Reason, &m.MovedAt, &m.RecordedBy, &m.CreatedAt)
	return m, translate(err)
}
func (s *Store) Movements(ctx context.Context, id int64, q domain.PageQuery) (domain.Page[domain.StockMovement], error) {
	return page(ctx, s, q, "stock_movements", movementColumns, `($1::bigint=0 OR batch_id=$1) AND ($2='' OR type::text=$2) AND ($3::bigint=0 OR from_warehouse_id=$3 OR to_warehouse_id=$3)`, "moved_at DESC,id DESC", []any{id, q.Status, q.WarehouseID}, scanMovement)
}
func (s *Store) CreateMovement(ctx context.Context, m *domain.StockMovement) error {
	return translate(s.query.QueryRowContext(ctx, `INSERT INTO stock_movements(batch_id,type,quantity,from_warehouse_id,to_warehouse_id,delivery_item_id,reason,moved_at,recorded_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, m.BatchID, m.Type, m.Quantity, m.FromWarehouseID, m.ToWarehouseID, m.DeliveryItemID, m.Reason, m.MovedAt, m.RecordedBy, m.CreatedAt).Scan(&m.ID))
}
func (s *Store) AvailableBatches(ctx context.Context, productID, warehouseID int64, today domain.Date) ([]domain.AvailableBatch, error) {
	rows, err := s.query.QueryContext(ctx, `SELECT b.id,bal.quantity::numeric(12,3) FROM inventory_batches b JOIN stock_balances bal ON bal.batch_id=b.id WHERE b.product_id=$1 AND bal.warehouse_id=$2 AND bal.quantity>0 AND b.triage_status='approved' AND b.expires_on >= $3::date ORDER BY b.expires_on,b.id`, productID, warehouseID, today)
	if err != nil {
		return nil, translate(err)
	}
	ids := []domain.AvailableBatch{}
	for rows.Next() {
		var v domain.AvailableBatch
		if err := rows.Scan(&v.Batch.ID, &v.Quantity); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	for i := range ids {
		b, err := s.Batch(ctx, ids[i].Batch.ID, true)
		if err != nil {
			return nil, err
		}
		ids[i].Batch = b
	}
	return ids, nil
}
func (s *Store) ReturnedQuantity(ctx context.Context, itemID int64) (domain.Decimal, error) {
	var qty domain.Decimal
	err := s.query.QueryRowContext(ctx, `SELECT coalesce(sum(quantity),0)::numeric(12,3) FROM stock_movements WHERE delivery_item_id=$1 AND type='return'`, itemID).Scan(&qty)
	return qty, translate(err)
}
func (s *Store) Stats(ctx context.Context) (domain.StockStats, error) {
	var out domain.StockStats
	err := s.query.QueryRowContext(ctx, `SELECT count(*) FILTER(WHERE b.expires_on<current_date),count(*) FILTER(WHERE b.expires_on BETWEEN current_date AND current_date+2),count(*) FILTER(WHERE b.expires_on BETWEEN current_date AND current_date+7),coalesce(round(100.0*count(b.expires_on)/nullif(count(*),0),2),100) FROM inventory_batches b WHERE EXISTS(SELECT 1 FROM stock_balances bal WHERE bal.batch_id=b.id AND bal.quantity>0)`).Scan(&out.Expired, &out.Critical, &out.Week, &out.RegisteredPct)
	return out, translate(err)
}
