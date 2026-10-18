package usecase

import (
	"context"
	"sort"
	"strings"
	"time"

	"alimenta-mais/backend/internal/domain"
)

type Deliveries struct{ Tx UnitOfWork }
type RequestedItem struct {
	ProductID int64          `json:"product_id"`
	Quantity  domain.Decimal `json:"quantity"`
}
type DeliveryInput struct {
	FamilyID              *int64          `json:"family_id"`
	PartnerOrganizationID *int64          `json:"partner_organization_id"`
	RouteID               *int64          `json:"route_id"`
	StopSequence          *int32          `json:"stop_sequence"`
	SourceWarehouseID     int64           `json:"source_warehouse_id"`
	DestinationAddress    string          `json:"destination_address"`
	DestinationLatitude   *domain.Decimal `json:"destination_latitude"`
	DestinationLongitude  *domain.Decimal `json:"destination_longitude"`
	ScheduledAt           *time.Time      `json:"scheduled_at"`
	Description           *string         `json:"description"`
	Notes                 *string         `json:"notes"`
	Items                 []RequestedItem `json:"items"`
}
type RouteInput struct {
	ReferenceCode     string      `json:"reference_code"`
	OriginWarehouseID int64       `json:"origin_warehouse_id"`
	ScheduledOn       domain.Date `json:"scheduled_on"`
	AssignedTo        *int64      `json:"assigned_to"`
}
type ReturnInput struct {
	DeliveryItemID int64          `json:"delivery_item_id"`
	WarehouseID    int64          `json:"warehouse_id"`
	Quantity       domain.Decimal `json:"quantity"`
	Reason         string         `json:"reason"`
}

func recipient(ctx context.Context, r Repositories, familyID, partnerID *int64) error {
	if (familyID == nil) == (partnerID == nil) {
		return domain.ValidationError{"recipient": "escolha somente uma família ou organização"}
	}
	if familyID != nil {
		if *familyID <= 0 {
			return domain.ValidationError{"family_id": "identificador inválido"}
		}
		f, err := r.Catalog.Family(ctx, *familyID, true)
		if err != nil {
			return err
		}
		if !f.IsActive || f.ConsentGrantedAt == nil || f.ConsentRevokedAt != nil {
			return conflict("família inativa ou sem consentimento vigente")
		}
	}
	if partnerID != nil {
		if *partnerID <= 0 {
			return domain.ValidationError{"partner_organization_id": "identificador inválido"}
		}
		p, err := r.Catalog.Partner(ctx, *partnerID)
		if err != nil {
			return err
		}
		if !p.IsActive {
			return conflict("organização inativa")
		}
	}
	return nil
}
func allocate(ctx context.Context, r Repositories, warehouseID int64, requests []RequestedItem) ([]domain.DeliveryItem, error) {
	if len(requests) == 0 || len(requests) > 100 {
		return nil, domain.ValidationError{"items": "informe de 1 a 100 produtos"}
	}
	requests = append([]RequestedItem(nil), requests...)
	sort.Slice(requests, func(i, j int) bool { return requests[i].ProductID < requests[j].ProductID })
	items := make([]domain.DeliveryItem, 0)
	for i, request := range requests {
		if request.ProductID <= 0 || (i > 0 && requests[i-1].ProductID == request.ProductID) {
			return nil, domain.ValidationError{"items": "produtos inválidos ou repetidos"}
		}
		needed, err := domain.PositiveQuantity(request.Quantity)
		if err != nil {
			return nil, err
		}
		product, err := r.Catalog.Product(ctx, request.ProductID, true)
		if err != nil {
			return nil, err
		}
		if !product.IsActive {
			return nil, conflict("produto inativo")
		}
		if product.Unit == "un" && needed%1000 != 0 {
			return nil, domain.ValidationError{"quantity": "unidades devem ser inteiras"}
		}
		if err := checkStorage(ctx, r, product, warehouseID); err != nil {
			return nil, err
		}
		batches, err := r.Stock.AvailableBatches(ctx, request.ProductID, warehouseID, domain.Today())
		if err != nil {
			return nil, err
		}
		for _, batch := range batches {
			available, err := batch.Quantity.Scaled(3)
			if err != nil {
				return nil, err
			}
			if available <= 0 {
				continue
			}
			take := min(needed, available)
			items = append(items, domain.DeliveryItem{BatchID: batch.Batch.ID, Quantity: domain.Quantity(take)})
			needed -= take
			if needed == 0 {
				break
			}
		}
		if needed > 0 {
			return nil, conflict("saldo aprovado e vigente insuficiente para a entrega")
		}
	}
	return items, nil
}
func (s *Deliveries) Save(ctx context.Context, a domain.Actor, id int64, in DeliveryInput) (domain.DeliveryDetail, error) {
	if err := domain.Require(a, domain.WriteDeliveries); err != nil {
		return domain.DeliveryDetail{}, err
	}
	v := validation{}
	v.id("source_warehouse_id", in.SourceWarehouseID)
	v.text("destination_address", in.DestinationAddress, 10000, true)
	v.coordinates(in.DestinationLatitude, in.DestinationLongitude)
	v.optional("description", in.Description, 255)
	v.optional("notes", in.Notes, 10000)
	if in.ScheduledAt != nil && (in.ScheduledAt.IsZero() || in.ScheduledAt.Year() < 1) {
		v["scheduled_at"] = "data inválida"
	}
	if in.ScheduledAt != nil {
		normalized := in.ScheduledAt.UTC()
		in.ScheduledAt = &normalized
	}
	if (in.RouteID == nil) != (in.StopSequence == nil) || (in.StopSequence != nil && *in.StopSequence <= 0) || (in.RouteID != nil && *in.RouteID <= 0) {
		v["route"] = "rota e sequência positiva devem ser informadas juntas"
	}
	if err := v.err(); err != nil {
		return domain.DeliveryDetail{}, err
	}
	var out domain.DeliveryDetail
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var before *domain.DeliveryDetail
		if id != 0 {
			old, err := r.Deliveries.Delivery(ctx, id, false)
			if err != nil {
				return err
			}
			routeIDs := []int64{}
			if old.RouteID != nil {
				routeIDs = append(routeIDs, *old.RouteID)
			}
			if in.RouteID != nil {
				routeIDs = append(routeIDs, *in.RouteID)
			}
			sort.Slice(routeIDs, func(i, j int) bool { return routeIDs[i] < routeIDs[j] })
			for _, routeID := range routeIDs {
				if _, err := r.Deliveries.Route(ctx, routeID, true); err != nil {
					return err
				}
			}
			current, err := r.Deliveries.Delivery(ctx, id, true)
			if err != nil {
				return err
			}
			if !sameID(current.RouteID, old.RouteID) {
				return conflict("entrega alterada por outra operação; tente novamente")
			}
			if current.Status != domain.DeliveryStatusWaiting {
				return conflict("somente entregas aguardando podem ser editadas")
			}
			oldItems, err := r.Deliveries.DeliveryItems(ctx, id)
			if err != nil {
				return err
			}
			before = &domain.DeliveryDetail{Delivery: current, Items: oldItems}
		}
		if in.RouteID != nil {
			route, err := r.Deliveries.Route(ctx, *in.RouteID, true)
			if err != nil {
				return err
			}
			if route.Status != domain.RouteStatusWaiting || route.OriginWarehouseID != in.SourceWarehouseID {
				return conflict("rota indisponível ou origem divergente")
			}
		}
		if err := recipient(ctx, r, in.FamilyID, in.PartnerOrganizationID); err != nil {
			return err
		}
		items, err := allocate(ctx, r, in.SourceWarehouseID, in.Items)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		d := domain.Delivery{ID: id, FamilyID: in.FamilyID, PartnerOrganizationID: in.PartnerOrganizationID, RouteID: in.RouteID, StopSequence: in.StopSequence, SourceWarehouseID: &in.SourceWarehouseID, Status: domain.DeliveryStatusWaiting, DestinationAddress: strings.TrimSpace(in.DestinationAddress), DestinationLatitude: in.DestinationLatitude, DestinationLongitude: in.DestinationLongitude, ScheduledAt: in.ScheduledAt, Description: in.Description, Notes: in.Notes, CreatedBy: a.User.ID, CreatedAt: now, UpdatedAt: now}
		if before != nil {
			d.CreatedAt = before.Delivery.CreatedAt
			d.CreatedBy = before.Delivery.CreatedBy
		}
		if err := r.Deliveries.SaveDelivery(ctx, &d); err != nil {
			return err
		}
		if err := r.Deliveries.ReplaceDeliveryItems(ctx, d.ID, items); err != nil {
			return err
		}
		items, err = r.Deliveries.DeliveryItems(ctx, d.ID)
		if err != nil {
			return err
		}
		out = domain.DeliveryDetail{Delivery: d, Items: items}
		return r.Audit.Record(ctx, a, "delivery.planned", "deliveries", d.ID, before, out)
	})
	return out, err
}
func (s *Deliveries) Dispatch(ctx context.Context, a domain.Actor, id int64) (domain.DeliveryDetail, error) {
	if err := domain.Require(a, domain.WriteDeliveries); err != nil {
		return domain.DeliveryDetail{}, err
	}
	var out domain.DeliveryDetail
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		d, err := r.Deliveries.Delivery(ctx, id, false)
		if err != nil {
			return err
		}
		plannedRoute := d.RouteID
		if d.RouteID != nil {
			route, err := r.Deliveries.Route(ctx, *d.RouteID, true)
			if err != nil {
				return err
			}
			if route.Status != domain.RouteStatusInTransit {
				return conflict("inicie a rota antes de despachar")
			}
		}
		d, err = r.Deliveries.Delivery(ctx, id, true)
		if err != nil {
			return err
		}
		if !sameID(plannedRoute, d.RouteID) {
			return conflict("entrega alterada por outra operação; tente novamente")
		}
		if d.Status != domain.DeliveryStatusWaiting {
			return conflict("entrega já despachada ou encerrada")
		}
		if d.SourceWarehouseID == nil {
			return conflict("entrega sem depósito de origem")
		}
		if err := recipient(ctx, r, d.FamilyID, d.PartnerOrganizationID); err != nil {
			return err
		}
		oldItems, err := r.Deliveries.DeliveryItems(ctx, id)
		if err != nil {
			return err
		}
		totals := map[int64]int64{}
		for _, item := range oldItems {
			b, err := r.Stock.Batch(ctx, item.BatchID, false)
			if err != nil {
				return err
			}
			qty, err := domain.PositiveQuantity(item.Quantity)
			if err != nil {
				return err
			}
			totals[b.ProductID] += qty
		}
		requests := make([]RequestedItem, 0, len(totals))
		for productID, qty := range totals {
			requests = append(requests, RequestedItem{ProductID: productID, Quantity: domain.Quantity(qty)})
		}
		// Reallocate at dispatch: a waiting delivery does not reserve stock.
		items, err := allocate(ctx, r, *d.SourceWarehouseID, requests)
		if err != nil {
			return err
		}
		if err := r.Deliveries.ReplaceDeliveryItems(ctx, id, items); err != nil {
			return err
		}
		items, err = r.Deliveries.DeliveryItems(ctx, id)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		for _, item := range items {
			m := domain.StockMovement{BatchID: item.BatchID, Type: domain.StockMovementTypeDistribution, Quantity: item.Quantity, FromWarehouseID: d.SourceWarehouseID, DeliveryItemID: &item.ID, MovedAt: now, RecordedBy: a.User.ID, CreatedAt: now}
			if err := r.Stock.CreateMovement(ctx, &m); err != nil {
				return err
			}
		}
		before := domain.DeliveryDetail{Delivery: d, Items: oldItems}
		d.Status = domain.DeliveryStatusInTransit
		d.DispatchedAt = &now
		d.UpdatedAt = now
		if err := r.Deliveries.SaveDelivery(ctx, &d); err != nil {
			return err
		}
		out = domain.DeliveryDetail{Delivery: d, Items: items}
		return r.Audit.Record(ctx, a, "delivery.dispatched", "deliveries", id, before, out)
	})
	return out, err
}
func (s *Deliveries) Status(ctx context.Context, a domain.Actor, id int64, status domain.DeliveryStatus, reason string) (domain.Delivery, error) {
	if err := domain.Require(a, domain.WriteDeliveries); err != nil {
		return domain.Delivery{}, err
	}
	var out domain.Delivery
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		d, err := r.Deliveries.Delivery(ctx, id, false)
		if err != nil {
			return err
		}
		if d.RouteID != nil {
			if _, err := r.Deliveries.Route(ctx, *d.RouteID, true); err != nil {
				return err
			}
		}
		d, err = r.Deliveries.Delivery(ctx, id, true)
		if err != nil {
			return err
		}
		before := d
		now := time.Now().UTC()
		switch status {
		case domain.DeliveryStatusDelivered:
			if d.Status != domain.DeliveryStatusInTransit {
				return conflict("somente entregas em trânsito podem ser concluídas")
			}
			d.DeliveredAt = &now
		case domain.DeliveryStatusFailed:
			if d.Status != domain.DeliveryStatusInTransit {
				return conflict("somente entregas em trânsito podem falhar")
			}
			if strings.TrimSpace(reason) == "" || len(reason) > 10000 {
				return domain.ValidationError{"reason": "motivo obrigatório, até 10000 bytes"}
			}
			d.Notes = &reason
		case domain.DeliveryStatusCancelled:
			if d.Status != domain.DeliveryStatusWaiting {
				return conflict("somente entregas aguardando podem ser canceladas")
			}
			if strings.TrimSpace(reason) == "" || len(reason) > 10000 {
				return domain.ValidationError{"reason": "motivo obrigatório, até 10000 bytes"}
			}
			d.Notes = &reason
		default:
			return domain.ValidationError{"status": "transição inválida"}
		}
		d.Status = status
		d.UpdatedAt = now
		if err := r.Deliveries.SaveDelivery(ctx, &d); err != nil {
			return err
		}
		out = d
		return r.Audit.Record(ctx, a, "delivery."+string(status), "deliveries", id, before, d)
	})
	return out, err
}
func (s *Deliveries) Return(ctx context.Context, a domain.Actor, id int64, in ReturnInput) (domain.StockMovement, error) {
	if err := domain.Require(a, domain.WriteDeliveries); err != nil {
		return domain.StockMovement{}, err
	}
	qty, err := domain.PositiveQuantity(in.Quantity)
	if err != nil {
		return domain.StockMovement{}, err
	}
	v := validation{}
	v.id("delivery_item_id", in.DeliveryItemID)
	v.id("warehouse_id", in.WarehouseID)
	v.text("reason", in.Reason, 10000, true)
	if err := v.err(); err != nil {
		return domain.StockMovement{}, err
	}
	var out domain.StockMovement
	err = s.Tx.WithinTx(ctx, func(r Repositories) error {
		d, err := r.Deliveries.Delivery(ctx, id, true)
		if err != nil {
			return err
		}
		if d.Status != domain.DeliveryStatusInTransit && d.Status != domain.DeliveryStatusDelivered && d.Status != domain.DeliveryStatusFailed {
			return conflict("entrega não despachada")
		}
		items, err := r.Deliveries.DeliveryItems(ctx, id)
		if err != nil {
			return err
		}
		var selected *domain.DeliveryItem
		for _, item := range items {
			if item.ID == in.DeliveryItemID {
				selected = &item
				break
			}
		}
		if selected == nil {
			return domain.ErrNotFound
		}
		b, err := r.Stock.Batch(ctx, selected.BatchID, false)
		if err != nil {
			return err
		}
		p, err := r.Catalog.Product(ctx, b.ProductID, true)
		if err != nil {
			return err
		}
		if _, err := r.Stock.Batch(ctx, b.ID, true); err != nil {
			return err
		}
		if p.Unit == "un" && qty%1000 != 0 {
			return domain.ValidationError{"quantity": "unidades devem ser inteiras"}
		}
		if err := checkStorage(ctx, r, p, in.WarehouseID); err != nil {
			return err
		}
		returned, err := r.Stock.ReturnedQuantity(ctx, selected.ID)
		if err != nil {
			return err
		}
		already, err := returned.Scaled(3)
		if err != nil {
			return err
		}
		sent, err := selected.Quantity.Scaled(3)
		if err != nil {
			return err
		}
		if already+qty > sent {
			return conflict("devolução excede a quantidade distribuída")
		}
		if err := capacity(ctx, r, b.ID, in.WarehouseID, qty); err != nil {
			return err
		}
		now := time.Now().UTC()
		out = domain.StockMovement{BatchID: b.ID, Type: domain.StockMovementTypeReturn, Quantity: in.Quantity, ToWarehouseID: &in.WarehouseID, DeliveryItemID: &selected.ID, Reason: &in.Reason, MovedAt: now, RecordedBy: a.User.ID, CreatedAt: now}
		if err := r.Stock.CreateMovement(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "delivery.returned", "stock_movements", out.ID, nil, out)
	})
	return out, err
}
func (s *Deliveries) SaveRoute(ctx context.Context, a domain.Actor, id int64, in RouteInput) (domain.DeliveryRoute, error) {
	if err := domain.Require(a, domain.WriteDeliveries); err != nil {
		return domain.DeliveryRoute{}, err
	}
	v := validation{}
	v.text("reference_code", in.ReferenceCode, 30, true)
	v.id("origin_warehouse_id", in.OriginWarehouseID)
	if in.AssignedTo != nil {
		v.id("assigned_to", *in.AssignedTo)
	}
	if !in.ScheduledOn.Valid() {
		v["scheduled_on"] = "data inválida"
	}
	if err := v.err(); err != nil {
		return domain.DeliveryRoute{}, err
	}
	var out domain.DeliveryRoute
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var before *domain.DeliveryRoute
		if id != 0 {
			old, err := r.Deliveries.Route(ctx, id, true)
			if err != nil {
				return err
			}
			if old.Status != domain.RouteStatusWaiting {
				return conflict("somente rotas aguardando podem ser editadas")
			}
			before = &old
			if old.OriginWarehouseID != in.OriginWarehouseID {
				deliveries, err := r.Deliveries.RouteDeliveries(ctx, id)
				if err != nil {
					return err
				}
				if len(deliveries) > 0 {
					return conflict("rota com entregas não pode mudar de origem")
				}
			}
		}
		w, err := r.Catalog.Warehouse(ctx, in.OriginWarehouseID)
		if err != nil {
			return err
		}
		if !w.IsActive {
			return conflict("depósito inativo")
		}
		if in.AssignedTo != nil {
			u, err := r.Users.User(ctx, *in.AssignedTo, false)
			if err != nil {
				return err
			}
			if !u.IsActive {
				return conflict("responsável inativo")
			}
		}
		now := time.Now().UTC()
		out = domain.DeliveryRoute{ID: id, ReferenceCode: strings.TrimSpace(in.ReferenceCode), OriginWarehouseID: in.OriginWarehouseID, ScheduledOn: in.ScheduledOn, Status: domain.RouteStatusWaiting, AssignedTo: in.AssignedTo, CreatedBy: a.User.ID, CreatedAt: now, UpdatedAt: now}
		if before != nil {
			out.CreatedAt = before.CreatedAt
			out.CreatedBy = before.CreatedBy
		}
		if err := r.Deliveries.SaveRoute(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "route.saved", "delivery_routes", out.ID, before, out)
	})
	return out, err
}
func (s *Deliveries) RouteStatus(ctx context.Context, a domain.Actor, id int64, status domain.RouteStatus) (domain.DeliveryRoute, error) {
	if err := domain.Require(a, domain.WriteDeliveries); err != nil {
		return domain.DeliveryRoute{}, err
	}
	var out domain.DeliveryRoute
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		route, err := r.Deliveries.Route(ctx, id, true)
		if err != nil {
			return err
		}
		before := route
		deliveries, err := r.Deliveries.RouteDeliveries(ctx, id)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		switch status {
		case domain.RouteStatusInTransit:
			if route.Status != domain.RouteStatusWaiting || route.ScheduledOn > domain.Today() || len(deliveries) == 0 {
				return conflict("rota não pode ser iniciada")
			}
			w, err := r.Catalog.Warehouse(ctx, route.OriginWarehouseID)
			if err != nil {
				return err
			}
			if !w.IsActive {
				return conflict("depósito inativo")
			}
			if route.AssignedTo == nil {
				return conflict("informe um responsável para a rota")
			}
			u, err := r.Users.User(ctx, *route.AssignedTo, false)
			if err != nil {
				return err
			}
			if !u.IsActive {
				return conflict("responsável inativo")
			}
			route.StartedAt = &now
		case domain.RouteStatusCompleted:
			if route.Status != domain.RouteStatusInTransit || len(deliveries) == 0 {
				return conflict("rota não está em trânsito")
			}
			for _, d := range deliveries {
				if d.Status == domain.DeliveryStatusWaiting || d.Status == domain.DeliveryStatusInTransit {
					return conflict("rota tem entregas pendentes")
				}
			}
			route.CompletedAt = &now
		case domain.RouteStatusCancelled:
			if route.Status != domain.RouteStatusWaiting {
				return conflict("somente rotas aguardando podem ser canceladas")
			}
			for _, d := range deliveries {
				if d.Status != domain.DeliveryStatusWaiting && d.Status != domain.DeliveryStatusCancelled {
					return conflict("rota tem entregas despachadas")
				}
				d.Status = domain.DeliveryStatusCancelled
				d.UpdatedAt = now
				if err := r.Deliveries.SaveDelivery(ctx, &d); err != nil {
					return err
				}
			}
		default:
			return domain.ValidationError{"status": "transição inválida"}
		}
		route.Status = status
		route.UpdatedAt = now
		if err := r.Deliveries.SaveRoute(ctx, &route); err != nil {
			return err
		}
		out = route
		return r.Audit.Record(ctx, a, "route."+string(status), "delivery_routes", id, before, route)
	})
	return out, err
}

func sameID(a, b *int64) bool { return (a == nil && b == nil) || (a != nil && b != nil && *a == *b) }
