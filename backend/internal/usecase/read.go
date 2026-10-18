package usecase

import (
	"alimenta-mais/backend/internal/domain"
	"context"
	"time"
	"unicode/utf8"
)

type Read struct{ Repos Repositories }

func readPage[T any](ctx context.Context, a domain.Actor, p domain.Permission, q domain.PageQuery, fetch func(context.Context, domain.PageQuery) (domain.Page[T], error)) (domain.Page[T], error) {
	if err := domain.Require(a, p); err != nil {
		return domain.Page[T]{}, err
	}
	if !q.Valid() {
		return domain.Page[T]{}, domain.ValidationError{"pagination": "paginação inválida"}
	}
	return fetch(ctx, q)
}
func readOne[T any](ctx context.Context, a domain.Actor, p domain.Permission, id int64, fetch func(context.Context, int64) (T, error)) (T, error) {
	var zero T
	if err := domain.Require(a, p); err != nil {
		return zero, err
	}
	if id <= 0 {
		return zero, domain.ValidationError{"id": "identificador inválido"}
	}
	return fetch(ctx, id)
}

func (s *Read) Donors(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.Donor], error) {
	return readPage(ctx, a, domain.ReadCatalog, q, s.Repos.Catalog.Donors)
}
func (s *Read) Donor(ctx context.Context, a domain.Actor, id int64) (domain.Donor, error) {
	return readOne(ctx, a, domain.ReadCatalog, id, s.Repos.Catalog.Donor)
}

func (s *Read) Categories(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.ProductCategory], error) {
	return readPage(ctx, a, domain.ReadCatalog, q, s.Repos.Catalog.Categories)
}
func (s *Read) Category(ctx context.Context, a domain.Actor, id int64) (domain.ProductCategory, error) {
	return readOne(ctx, a, domain.ReadCatalog, id, s.Repos.Catalog.Category)
}

func (s *Read) Products(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.Product], error) {
	return readPage(ctx, a, domain.ReadCatalog, q, s.Repos.Catalog.Products)
}
func (s *Read) Product(ctx context.Context, a domain.Actor, id int64) (domain.Product, error) {
	return readOne(ctx, a, domain.ReadCatalog, id, func(ctx context.Context, id int64) (domain.Product, error) {
		return s.Repos.Catalog.Product(ctx, id, false)
	})
}

func (s *Read) Warehouses(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.Warehouse], error) {
	return readPage(ctx, a, domain.ReadCatalog, q, s.Repos.Catalog.Warehouses)
}
func (s *Read) Warehouse(ctx context.Context, a domain.Actor, id int64) (domain.Warehouse, error) {
	return readOne(ctx, a, domain.ReadCatalog, id, s.Repos.Catalog.Warehouse)
}

func (s *Read) Families(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.Family], error) {
	return readPage(ctx, a, domain.ReadFamilies, q, s.Repos.Catalog.Families)
}
func (s *Read) Family(ctx context.Context, a domain.Actor, id int64) (domain.Family, error) {
	return readOne(ctx, a, domain.ReadFamilies, id, func(ctx context.Context, id int64) (domain.Family, error) {
		return s.Repos.Catalog.Family(ctx, id, false)
	})
}

func (s *Read) Partners(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.PartnerOrganization], error) {
	return readPage(ctx, a, domain.ReadFamilies, q, s.Repos.Catalog.Partners)
}
func (s *Read) Partner(ctx context.Context, a domain.Actor, id int64) (domain.PartnerOrganization, error) {
	return readOne(ctx, a, domain.ReadFamilies, id, s.Repos.Catalog.Partner)
}

func (s *Read) Batches(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.InventoryBatch], error) {
	return readPage(ctx, a, domain.ReadStock, q, s.Repos.Stock.Batches)
}
func (s *Read) Batch(ctx context.Context, a domain.Actor, id int64) (domain.InventoryBatch, error) {
	return readOne(ctx, a, domain.ReadStock, id, func(ctx context.Context, id int64) (domain.InventoryBatch, error) {
		return s.Repos.Stock.Batch(ctx, id, false)
	})
}

func (s *Read) Donations(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.Donation], error) {
	return readPage(ctx, a, domain.ReadDonations, q, s.Repos.Donations.Donations)
}
func (s *Read) Donation(ctx context.Context, a domain.Actor, id int64) (domain.Donation, error) {
	return readOne(ctx, a, domain.ReadDonations, id, func(ctx context.Context, id int64) (domain.Donation, error) {
		return s.Repos.Donations.Donation(ctx, id, false)
	})
}

func (s *Read) Deliveries(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.Delivery], error) {
	return readPage(ctx, a, domain.ReadDeliveries, q, s.Repos.Deliveries.Deliveries)
}
func (s *Read) Delivery(ctx context.Context, a domain.Actor, id int64) (domain.Delivery, error) {
	return readOne(ctx, a, domain.ReadDeliveries, id, func(ctx context.Context, id int64) (domain.Delivery, error) {
		return s.Repos.Deliveries.Delivery(ctx, id, false)
	})
}

func (s *Read) Routes(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.DeliveryRoute], error) {
	return readPage(ctx, a, domain.ReadDeliveries, q, s.Repos.Deliveries.Routes)
}
func (s *Read) Route(ctx context.Context, a domain.Actor, id int64) (domain.DeliveryRoute, error) {
	return readOne(ctx, a, domain.ReadDeliveries, id, func(ctx context.Context, id int64) (domain.DeliveryRoute, error) {
		return s.Repos.Deliveries.Route(ctx, id, false)
	})
}

func (s *Read) Users(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.User], error) {
	return readPage(ctx, a, domain.ReadAccess, q, s.Repos.Users.Users)
}
func (s *Read) User(ctx context.Context, a domain.Actor, id int64) (domain.User, error) {
	return readOne(ctx, a, domain.ReadAccess, id, func(ctx context.Context, id int64) (domain.User, error) { return s.Repos.Users.User(ctx, id, false) })
}

func (s *Read) Movements(ctx context.Context, a domain.Actor, id int64, q domain.PageQuery) (domain.Page[domain.StockMovement], error) {
	if err := domain.Require(a, domain.ReadStock); err != nil {
		return domain.Page[domain.StockMovement]{}, err
	}
	if !q.Valid() {
		return domain.Page[domain.StockMovement]{}, domain.ValidationError{"pagination": "paginação inválida"}
	}
	if id > 0 {
		if _, err := s.Repos.Stock.Batch(ctx, id, false); err != nil {
			return domain.Page[domain.StockMovement]{}, err
		}
	}
	return s.Repos.Stock.Movements(ctx, id, q)
}
func (s *Read) BatchDetail(ctx context.Context, a domain.Actor, id int64) (domain.BatchDetail, error) {
	b, err := s.Batch(ctx, a, id)
	if err != nil {
		return domain.BatchDetail{}, err
	}
	balances, err := s.Repos.Stock.Balances(ctx, id)
	if err != nil {
		return domain.BatchDetail{}, err
	}
	movements, err := s.Repos.Stock.Movements(ctx, id, domain.PageQuery{Page: 1, PageSize: 100})
	return domain.BatchDetail{Batch: b, Balances: balances, Movements: movements.Items}, err
}
func (s *Read) DonationDetail(ctx context.Context, a domain.Actor, id int64) (domain.DonationDetail, error) {
	d, err := s.Donation(ctx, a, id)
	if err != nil {
		return domain.DonationDetail{}, err
	}
	b, err := s.Repos.Donations.DonationBatches(ctx, id)
	return domain.DonationDetail{Donation: d, Batches: b}, err
}
func (s *Read) DeliveryDetail(ctx context.Context, a domain.Actor, id int64) (domain.DeliveryDetail, error) {
	d, err := s.Delivery(ctx, a, id)
	if err != nil {
		return domain.DeliveryDetail{}, err
	}
	items, err := s.Repos.Deliveries.DeliveryItems(ctx, id)
	return domain.DeliveryDetail{Delivery: d, Items: items}, err
}
func (s *Read) RouteDetail(ctx context.Context, a domain.Actor, id int64) (domain.RouteDetail, error) {
	r, err := s.Route(ctx, a, id)
	if err != nil {
		return domain.RouteDetail{}, err
	}
	deliveries, err := s.Repos.Deliveries.RouteDeliveries(ctx, id)
	return domain.RouteDetail{Route: r, Deliveries: deliveries}, err
}
func (s *Read) Audit(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.AuditLog], error) {
	return readPage(ctx, a, domain.ReadAccess, q, s.Repos.Audit.Audit)
}
func (s *Read) Stats(ctx context.Context, a domain.Actor) (domain.StockStats, error) {
	if err := domain.Require(a, domain.ReadStock); err != nil {
		return domain.StockStats{}, err
	}
	return s.Repos.Stock.Stats(ctx)
}
func (s *Read) Report(ctx context.Context, a domain.Actor, from, to time.Time) (domain.Report, error) {
	if err := domain.Require(a, domain.ReadReports); err != nil {
		return domain.Report{}, err
	}
	if from.IsZero() || !to.After(from) || to.Sub(from) > 5*366*24*time.Hour {
		return domain.Report{}, domain.ValidationError{"period": "intervalo inválido; máximo de 5 anos"}
	}
	return s.Repos.Queries.Report(ctx, from.UTC(), to.UTC())
}
func (s *Read) Search(ctx context.Context, a domain.Actor, q string) (domain.SearchResult, error) {
	out := domain.SearchResult{Batches: []domain.InventoryBatch{}, Donors: []domain.Donor{}, Families: []domain.Family{}, Donations: []domain.Donation{}}
	if !a.User.IsActive {
		return out, domain.ErrUnauthenticated
	}
	if utf8.RuneCountInString(q) < 2 || len(q) > 200 {
		return out, domain.ValidationError{"q": "informe de 2 a 200 caracteres"}
	}
	query := domain.PageQuery{Page: 1, PageSize: 8, Q: q}
	if a.Can(domain.ReadStock) {
		items, err := s.Repos.Stock.Batches(ctx, query)
		if err != nil {
			return out, err
		}
		out.Batches = items.Items
	}
	if a.Can(domain.ReadCatalog) {
		items, err := s.Repos.Catalog.Donors(ctx, query)
		if err != nil {
			return out, err
		}
		out.Donors = items.Items
	}
	if a.Can(domain.ReadFamilies) {
		items, err := s.Repos.Catalog.Families(ctx, query)
		if err != nil {
			return out, err
		}
		out.Families = items.Items
	}
	if a.Can(domain.ReadDonations) {
		items, err := s.Repos.Donations.Donations(ctx, query)
		if err != nil {
			return out, err
		}
		out.Donations = items.Items
	}
	return out, nil
}
