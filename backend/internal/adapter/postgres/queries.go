package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"alimenta-mais/backend/internal/domain"
)

func (s *Store) Record(ctx context.Context, a domain.Actor, action, table string, id int64, before, after any) error {
	encode := func(v any) (*string, error) {
		if v == nil {
			return nil, nil
		}
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		s := string(b)
		return &s, nil
	}
	b, err := encode(before)
	if err != nil {
		return err
	}
	next, err := encode(after)
	if err != nil {
		return err
	}
	var actor *int64
	if a.User.ID > 0 {
		actor = &a.User.ID
	}
	var ip *string
	if a.IPAddress != "" {
		ip = &a.IPAddress
	}
	_, err = s.query.ExecContext(ctx, `INSERT INTO audit_logs(actor_id,action,entity_table,entity_id,before_values,after_values,ip_address,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, actor, action, table, id, b, next, ip, time.Now().UTC())
	return translate(err)
}
func (s *Store) Audit(ctx context.Context, q domain.PageQuery) (domain.Page[domain.AuditLog], error) {
	return page(ctx, s, q, "audit_logs", `id,actor_id,action,entity_table,entity_id,before_values,after_values,ip_address,occurred_at`, `($1='' OR strpos(lower(action),lower($1))>0 OR strpos(lower(coalesce(entity_table,'')),lower($1))>0)`, "occurred_at DESC,id DESC", []any{q.Q}, func(row scanner) (domain.AuditLog, error) {
		var a domain.AuditLog
		err := row.Scan(&a.ID, &a.ActorID, &a.Action, &a.EntityTable, &a.EntityID, &a.BeforeValues, &a.AfterValues, &a.IPAddress, &a.OccurredAt)
		return a, err
	})
}

func (s *Store) Report(ctx context.Context, from, to time.Time) (domain.Report, error) {
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
		if err != nil {
			return domain.Report{}, translate(err)
		}
		defer tx.Rollback()
		out, err := (&Store{query: tx}).Report(ctx, from, to)
		if err != nil {
			return out, err
		}
		return out, translate(tx.Commit())
	}
	out := domain.Report{From: from, To: to, Monthly: []domain.MonthlyPoint{}, LossByCategory: []domain.CategoryLoss{}}
	err := s.query.QueryRowContext(ctx, `
	WITH donation_totals AS (
	 SELECT coalesce(sum(b.received_quantity*b.unit_weight_kg),0) kg
	 FROM donations d JOIN inventory_batches b ON b.donation_id=d.id WHERE d.received_at >= $1 AND d.received_at < $2 AND d.status<>'draft'
	), movement_totals AS (
	 SELECT coalesce(sum(CASE WHEN m.type='distribution' THEN m.quantity*b.unit_weight_kg WHEN m.type='return' THEN -m.quantity*b.unit_weight_kg ELSE 0 END),0) distributed,
	 coalesce(sum(m.quantity*b.unit_weight_kg) FILTER(WHERE m.type IN ('expiration_loss','other_loss')),0) loss
	 FROM stock_movements m JOIN inventory_batches b ON b.id=m.batch_id WHERE m.moved_at >= $1 AND m.moved_at < $2
	), stock_points AS (
	 SELECT coalesce(sum((CASE WHEN m.to_warehouse_id IS NOT NULL THEN m.quantity ELSE 0 END-CASE WHEN m.from_warehouse_id IS NOT NULL THEN m.quantity ELSE 0 END)*b.unit_weight_kg) FILTER(WHERE m.moved_at<$1),0) opening,
	 coalesce(sum((CASE WHEN m.to_warehouse_id IS NOT NULL THEN m.quantity ELSE 0 END-CASE WHEN m.from_warehouse_id IS NOT NULL THEN m.quantity ELSE 0 END)*b.unit_weight_kg),0) closing
	 FROM stock_movements m JOIN inventory_batches b ON b.id=m.batch_id WHERE m.moved_at<$2
	), delivery_stats AS (
	 SELECT coalesce(avg(extract(epoch FROM (delivered_at-dispatched_at))/3600),0) hours FROM deliveries WHERE status='delivered' AND delivered_at >= $1 AND delivered_at < $2
	), coverage AS (
	 SELECT count(*) total,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM deliveries d WHERE d.family_id=f.id AND d.status='delivered' AND d.delivered_at >= $1 AND d.delivered_at < $2)) served
	 FROM families f WHERE f.is_active AND f.consent_granted_at IS NOT NULL AND f.consent_revoked_at IS NULL
	)
	SELECT round(d.kg,6),round(m.distributed,6),round(m.loss,6),coalesce(round(m.distributed/nullif((p.opening+p.closing)/2,0),4),0),round(s.hours,4),coalesce(round(100.0*c.served/nullif(c.total,0),2),0)
	FROM donation_totals d CROSS JOIN movement_totals m CROSS JOIN stock_points p CROSS JOIN delivery_stats s CROSS JOIN coverage c`, from, to).Scan(&out.DonatedKg, &out.DistributedKg, &out.LossKg, &out.Turnover, &out.AverageDeliveryHours, &out.CoveragePct)
	if err != nil {
		return out, translate(err)
	}
	out.Monthly, err = many(ctx, s, `
	 WITH months AS (SELECT generate_series(date_trunc('month',$1::timestamp),date_trunc('month',$2::timestamp-interval '1 microsecond'),interval '1 month') AS period_start),
	 donated AS (SELECT date_trunc('month',d.received_at) AS period_start,sum(b.received_quantity*b.unit_weight_kg) kg FROM donations d JOIN inventory_batches b ON b.donation_id=d.id WHERE d.received_at >= $1 AND d.received_at < $2 AND d.status<>'draft' GROUP BY 1),
	 distributed AS (SELECT date_trunc('month',m.moved_at) AS period_start,sum((CASE WHEN m.type='distribution' THEN m.quantity ELSE -m.quantity END)*b.unit_weight_kg) kg FROM stock_movements m JOIN inventory_batches b ON b.id=m.batch_id WHERE m.type IN ('distribution','return') AND m.moved_at >= $1 AND m.moved_at < $2 GROUP BY 1)
	 SELECT to_char(months.period_start,'YYYY-MM'),round(coalesce(donated.kg,0),6),round(coalesce(distributed.kg,0),6) FROM months LEFT JOIN donated USING(period_start) LEFT JOIN distributed USING(period_start) ORDER BY months.period_start`, []any{from, to}, func(row scanner) (domain.MonthlyPoint, error) {
		var v domain.MonthlyPoint
		err := row.Scan(&v.Month, &v.DonatedKg, &v.DistributedKg)
		return v, err
	})
	if err != nil {
		return out, err
	}
	out.LossByCategory, err = many(ctx, s, `SELECT c.name,round(sum(m.quantity*b.unit_weight_kg),6) FROM stock_movements m JOIN inventory_batches b ON b.id=m.batch_id JOIN products p ON p.id=b.product_id JOIN product_categories c ON c.id=p.category_id WHERE m.type IN ('expiration_loss','other_loss') AND m.moved_at >= $1 AND m.moved_at < $2 GROUP BY c.id,c.name ORDER BY c.name`, []any{from, to}, func(row scanner) (domain.CategoryLoss, error) {
		var v domain.CategoryLoss
		err := row.Scan(&v.Category, &v.Kg)
		return v, err
	})
	return out, err
}
