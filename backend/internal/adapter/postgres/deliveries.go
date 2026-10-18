package postgres

import (
	"alimenta-mais/backend/internal/domain"
	"context"
)

const donationColumns = `id, donor_id, status, received_at, document_reference, document_path, notes, created_by, confirmed_by, confirmed_at, created_at, updated_at`

func scanDonation(row scanner) (domain.Donation, error) {
	var v domain.Donation
	err := row.Scan(&v.ID, &v.DonorID, &v.Status, &v.ReceivedAt, &v.DocumentReference, &v.DocumentPath, &v.Notes, &v.CreatedBy, &v.ConfirmedBy, &v.ConfirmedAt, &v.CreatedAt, &v.UpdatedAt)
	return v, translate(err)
}
func (s *Store) Donation(ctx context.Context, id int64, forUpdate bool) (domain.Donation, error) {
	return scanDonation(s.query.QueryRowContext(ctx, "SELECT "+donationColumns+" FROM donations WHERE id=$1"+lock(forUpdate), id))
}
func (s *Store) Donations(ctx context.Context, q domain.PageQuery) (domain.Page[domain.Donation], error) {
	return page(ctx, s, q, "donations", donationColumns, `($1='' OR id::text=$1 OR strpos(lower(coalesce(document_reference,'')),lower($1))>0 OR donor_id IN (SELECT id FROM donors WHERE strpos(lower(name),lower($1))>0)) AND ($2='' OR status::text=$2)`, "id DESC", []any{q.Q, q.Status}, scanDonation)
}
func (s *Store) SaveDonation(ctx context.Context, v *domain.Donation) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO donations (donor_id,status,received_at,document_reference,document_path,notes,created_by,confirmed_by,confirmed_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, v.DonorID, v.Status, v.ReceivedAt, v.DocumentReference, v.DocumentPath, v.Notes, v.CreatedBy, v.ConfirmedBy, v.ConfirmedAt, v.CreatedAt, v.UpdatedAt).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE donations SET donor_id=$1,status=$2,received_at=$3,document_reference=$4,document_path=$5,notes=$6,created_by=$7,confirmed_by=$8,confirmed_at=$9,created_at=$10,updated_at=$11 WHERE id=$12`, v.DonorID, v.Status, v.ReceivedAt, v.DocumentReference, v.DocumentPath, v.Notes, v.CreatedBy, v.ConfirmedBy, v.ConfirmedAt, v.CreatedAt, v.UpdatedAt, v.ID))
}

const deliveryColumns = `id, family_id, partner_organization_id, route_id, stop_sequence, status, destination_address, destination_latitude, destination_longitude, scheduled_at, dispatched_at, delivered_at, description, notes, created_by, created_at, updated_at, source_warehouse_id`

func scanDelivery(row scanner) (domain.Delivery, error) {
	var v domain.Delivery
	err := row.Scan(&v.ID, &v.FamilyID, &v.PartnerOrganizationID, &v.RouteID, &v.StopSequence, &v.Status, &v.DestinationAddress, &v.DestinationLatitude, &v.DestinationLongitude, &v.ScheduledAt, &v.DispatchedAt, &v.DeliveredAt, &v.Description, &v.Notes, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt, &v.SourceWarehouseID)
	return v, translate(err)
}
func (s *Store) Delivery(ctx context.Context, id int64, forUpdate bool) (domain.Delivery, error) {
	return scanDelivery(s.query.QueryRowContext(ctx, "SELECT "+deliveryColumns+" FROM deliveries WHERE id=$1"+lock(forUpdate), id))
}
func (s *Store) Deliveries(ctx context.Context, q domain.PageQuery) (domain.Page[domain.Delivery], error) {
	return page(ctx, s, q, "deliveries", deliveryColumns, `($1='' OR id::text=$1 OR strpos(lower(destination_address),lower($1))>0) AND ($2='' OR status::text=$2) AND ($3::bigint=0 OR route_id=$3)`, "id DESC", []any{q.Q, q.Status, q.RouteID}, scanDelivery)
}
func (s *Store) SaveDelivery(ctx context.Context, v *domain.Delivery) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO deliveries (family_id,partner_organization_id,route_id,stop_sequence,status,destination_address,destination_latitude,destination_longitude,scheduled_at,dispatched_at,delivered_at,description,notes,created_by,created_at,updated_at,source_warehouse_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`, v.FamilyID, v.PartnerOrganizationID, v.RouteID, v.StopSequence, v.Status, v.DestinationAddress, v.DestinationLatitude, v.DestinationLongitude, v.ScheduledAt, v.DispatchedAt, v.DeliveredAt, v.Description, v.Notes, v.CreatedBy, v.CreatedAt, v.UpdatedAt, v.SourceWarehouseID).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE deliveries SET family_id=$1,partner_organization_id=$2,route_id=$3,stop_sequence=$4,status=$5,destination_address=$6,destination_latitude=$7,destination_longitude=$8,scheduled_at=$9,dispatched_at=$10,delivered_at=$11,description=$12,notes=$13,created_by=$14,created_at=$15,updated_at=$16,source_warehouse_id=$17 WHERE id=$18`, v.FamilyID, v.PartnerOrganizationID, v.RouteID, v.StopSequence, v.Status, v.DestinationAddress, v.DestinationLatitude, v.DestinationLongitude, v.ScheduledAt, v.DispatchedAt, v.DeliveredAt, v.Description, v.Notes, v.CreatedBy, v.CreatedAt, v.UpdatedAt, v.SourceWarehouseID, v.ID))
}

const routeColumns = `id, reference_code, origin_warehouse_id, to_char(scheduled_on,'YYYY-MM-DD'), status, assigned_to, started_at, completed_at, created_by, created_at, updated_at`

func scanRoute(row scanner) (domain.DeliveryRoute, error) {
	var v domain.DeliveryRoute
	err := row.Scan(&v.ID, &v.ReferenceCode, &v.OriginWarehouseID, &v.ScheduledOn, &v.Status, &v.AssignedTo, &v.StartedAt, &v.CompletedAt, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt)
	return v, translate(err)
}
func (s *Store) Route(ctx context.Context, id int64, forUpdate bool) (domain.DeliveryRoute, error) {
	return scanRoute(s.query.QueryRowContext(ctx, "SELECT "+routeColumns+" FROM delivery_routes WHERE id=$1"+lock(forUpdate), id))
}
func (s *Store) Routes(ctx context.Context, q domain.PageQuery) (domain.Page[domain.DeliveryRoute], error) {
	return page(ctx, s, q, "delivery_routes", routeColumns, `($1='' OR strpos(lower(reference_code),lower($1))>0) AND ($2='' OR status::text=$2)`, "scheduled_on DESC,id DESC", []any{q.Q, q.Status}, scanRoute)
}
func (s *Store) SaveRoute(ctx context.Context, v *domain.DeliveryRoute) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO delivery_routes (reference_code,origin_warehouse_id,scheduled_on,status,assigned_to,started_at,completed_at,created_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, v.ReferenceCode, v.OriginWarehouseID, v.ScheduledOn, v.Status, v.AssignedTo, v.StartedAt, v.CompletedAt, v.CreatedBy, v.CreatedAt, v.UpdatedAt).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE delivery_routes SET reference_code=$1,origin_warehouse_id=$2,scheduled_on=$3,status=$4,assigned_to=$5,started_at=$6,completed_at=$7,created_by=$8,created_at=$9,updated_at=$10 WHERE id=$11`, v.ReferenceCode, v.OriginWarehouseID, v.ScheduledOn, v.Status, v.AssignedTo, v.StartedAt, v.CompletedAt, v.CreatedBy, v.CreatedAt, v.UpdatedAt, v.ID))
}

func (s *Store) DonationBatches(ctx context.Context, id int64) ([]domain.InventoryBatch, error) {
	return many(ctx, s, "SELECT "+batchColumns+" FROM inventory_batches b WHERE b.donation_id=$1 ORDER BY b.id", []any{id}, scanBatch)
}
func (s *Store) DeliveryItems(ctx context.Context, id int64) ([]domain.DeliveryItem, error) {
	return many(ctx, s, `SELECT id,delivery_id,batch_id,quantity FROM delivery_items WHERE delivery_id=$1 ORDER BY id`, []any{id}, func(row scanner) (domain.DeliveryItem, error) {
		var i domain.DeliveryItem
		err := row.Scan(&i.ID, &i.DeliveryID, &i.BatchID, &i.Quantity)
		return i, err
	})
}
func (s *Store) ReplaceDeliveryItems(ctx context.Context, id int64, items []domain.DeliveryItem) error {
	if _, err := s.query.ExecContext(ctx, `DELETE FROM delivery_items WHERE delivery_id=$1`, id); err != nil {
		return translate(err)
	}
	for _, item := range items {
		if _, err := s.query.ExecContext(ctx, `INSERT INTO delivery_items(delivery_id,batch_id,quantity) VALUES($1,$2,$3)`, id, item.BatchID, item.Quantity); err != nil {
			return translate(err)
		}
	}
	return nil
}
func (s *Store) RouteDeliveries(ctx context.Context, id int64) ([]domain.Delivery, error) {
	return many(ctx, s, "SELECT "+deliveryColumns+" FROM deliveries WHERE route_id=$1 ORDER BY stop_sequence,id", []any{id}, scanDelivery)
}
