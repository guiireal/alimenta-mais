package postgres

import (
	"alimenta-mais/backend/internal/domain"
	"context"
	"encoding/json"
	"strings"
)

func scanJSON[T any](row scanner) (T, error) {
	var out T
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return out, translate(err)
	}
	err := json.Unmarshal(raw, &out)
	return out, err
}

func entityJSON(alias string, timestamps ...string) string {
	fields := []string{}
	for _, field := range append([]string{"created_at", "updated_at"}, timestamps...) {
		fields = append(fields, "'"+field+"'", alias+"."+field+" AT TIME ZONE 'UTC'")
	}
	return "(to_jsonb(" + alias + ")||jsonb_build_object(" + strings.Join(fields, ",") + "))"
}

const inventoryFrom = `inventory_batches b JOIN products p ON p.id=b.product_id JOIN product_categories c ON c.id=p.category_id
 CROSS JOIN LATERAL (SELECT coalesce(sum(bal.quantity),0) quantity,
 coalesce(jsonb_agg(jsonb_build_object('warehouse_id',w.id,'warehouse_name',w.name,'quantity',bal.quantity::text) ORDER BY w.name) FILTER(WHERE bal.quantity>0),'[]'::jsonb) balances
 FROM stock_balances bal JOIN warehouses w ON w.id=bal.warehouse_id WHERE bal.batch_id=b.id) stock`

var inventoryJSON = entityJSON("b", "triaged_at") + `||jsonb_build_object('received_quantity',b.received_quantity::text,'unit_weight_kg',b.unit_weight_kg::text,
 'product_name',p.name,'category_id',c.id,'category_name',c.name,'unit',p.unit,'quantity',stock.quantity::text,'balances',stock.balances)`

func (s *Store) Inventory(ctx context.Context, q domain.PageQuery) (domain.Page[domain.InventoryLot], error) {
	order := map[string]string{"": "b.expires_on", "expiresAt": "b.expires_on", "item": "p.name", "quantity": "stock.quantity", "id": "b.id"}[q.Sort]
	if order == "" {
		return domain.Page[domain.InventoryLot]{}, domain.ValidationError{"sort": "ordenação inválida"}
	}
	dir := " ASC"
	if q.Direction == "desc" {
		dir = " DESC"
	}
	return page(ctx, s, q, inventoryFrom, inventoryJSON, `stock.quantity>0 AND ($1='' OR strpos(lower(b.batch_code),lower($1))>0 OR strpos(lower(p.name),lower($1))>0 OR b.id::text=$1)
 AND ($2='' OR ($2='expired' AND b.expires_on<current_date) OR ($2='critical' AND b.expires_on BETWEEN current_date AND current_date+2)
 OR ($2='alert' AND b.expires_on<=current_date+2) OR ($2='warning' AND b.expires_on BETWEEN current_date+3 AND current_date+7)
 OR ($2='ok' AND b.expires_on>current_date+7) OR ($2='none' AND b.expires_on IS NULL))
 AND ($3::bigint=0 OR c.id=$3) AND ($4::bigint=0 OR p.id=$4) AND ($5::bigint=0 OR EXISTS(SELECT 1 FROM stock_balances sb WHERE sb.batch_id=b.id AND sb.warehouse_id=$5 AND sb.quantity>0))`, order+dir+" NULLS LAST,b.id", []any{q.Q, q.Status, q.CategoryID, q.ProductID, q.WarehouseID}, scanJSON[domain.InventoryLot])
}
func (s *Store) InventoryLot(ctx context.Context, id int64) (domain.InventoryLot, error) {
	return scanJSON[domain.InventoryLot](s.query.QueryRowContext(ctx, "SELECT "+inventoryJSON+" FROM "+inventoryFrom+" WHERE b.id=$1", id))
}
func (s *Store) DonorOverview(ctx context.Context, q domain.PageQuery) (domain.Page[domain.DonorOverview], error) {
	return page(ctx, s, q, `donors d CROSS JOIN LATERAL (SELECT count(*) donations_count,max(received_at) last_donation_at FROM donations WHERE donor_id=d.id AND status<>'draft') stats`,
		entityJSON("d")+`||jsonb_build_object('donations_count',stats.donations_count,'last_donation_at',stats.last_donation_at AT TIME ZONE 'UTC','total_kg',
 (SELECT coalesce(sum(b.received_quantity*b.unit_weight_kg),0)::text FROM donations dn JOIN inventory_batches b ON b.donation_id=dn.id WHERE dn.donor_id=d.id AND dn.status<>'draft'))`,
		`($1='' OR strpos(lower(d.name),lower($1))>0 OR d.id::text=$1) AND ($2::bigint=0 OR d.id=$2)`, "d.name,d.id", []any{q.Q, q.DonorID}, scanJSON[domain.DonorOverview])
}
func (s *Store) DonationOverview(ctx context.Context, q domain.PageQuery) (domain.Page[domain.DonationOverview], error) {
	return page(ctx, s, q, `donations d JOIN donors donor ON donor.id=d.donor_id`,
		entityJSON("d", "received_at", "confirmed_at")+`||jsonb_build_object('donor_name',donor.name,'donor_type',donor.type,'weight_kg',(SELECT coalesce(sum(received_quantity*unit_weight_kg),0)::text FROM inventory_batches WHERE donation_id=d.id))`,
		`($1='' OR strpos(lower(donor.name),lower($1))>0 OR strpos(lower(coalesce(d.document_reference,'')),lower($1))>0 OR d.id::text=$1) AND ($2::bigint=0 OR d.donor_id=$2) AND ($3='' OR d.status::text=$3)`, "d.received_at DESC NULLS LAST,d.id DESC", []any{q.Q, q.DonorID, q.Status}, scanJSON[domain.DonationOverview])
}
func (s *Store) FamilyOverview(ctx context.Context, q domain.PageQuery) (domain.Page[domain.FamilyOverview], error) {
	return page(ctx, s, q, "families f", "("+entityJSON("f", "consent_granted_at", "consent_revoked_at")+`-'latitude'-'longitude')||jsonb_build_object('latitude',f.latitude::text,'longitude',f.longitude::text,'last_delivery_at',(SELECT max(delivered_at) AT TIME ZONE 'UTC' FROM deliveries WHERE family_id=f.id AND status='delivered'))`,
		`($1='' OR strpos(lower(f.reference_code),lower($1))>0 OR strpos(lower(f.contact_name),lower($1))>0 OR strpos(lower(f.neighborhood),lower($1))>0)
 AND ($2='' OR ($2='granted' AND f.consent_granted_at IS NOT NULL AND f.consent_revoked_at IS NULL) OR ($2='pending' AND (f.consent_granted_at IS NULL OR f.consent_revoked_at IS NOT NULL)))`, "f.reference_code,f.id", []any{q.Q, q.Status}, scanJSON[domain.FamilyOverview])
}
func (s *Store) RouteOverview(ctx context.Context, q domain.PageQuery) (domain.Page[domain.RouteOverview], error) {
	return page(ctx, s, q, "delivery_routes r JOIN warehouses w ON w.id=r.origin_warehouse_id LEFT JOIN users u ON u.id=r.assigned_to",
		entityJSON("r", "started_at", "completed_at")+`||jsonb_build_object('assigned_name',coalesce(u.name,''),'warehouse_name',w.name,'stops',coalesce((SELECT jsonb_agg((`+entityJSON("d", "scheduled_at", "dispatched_at", "delivered_at")+`-'destination_latitude'-'destination_longitude')||jsonb_build_object('destination_latitude',d.destination_latitude::text,'destination_longitude',d.destination_longitude::text) ORDER BY d.stop_sequence,d.id) FROM deliveries d WHERE d.route_id=r.id),'[]'::jsonb))`,
		`($1='' OR strpos(lower(r.reference_code),lower($1))>0) AND ($2::bigint=0 OR r.id=$2) AND ($3='' OR r.status::text=$3)`, "r.scheduled_on DESC,r.id DESC", []any{q.Q, q.RouteID, q.Status}, scanJSON[domain.RouteOverview])
}
