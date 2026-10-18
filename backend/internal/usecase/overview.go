package usecase

import (
	"alimenta-mais/backend/internal/domain"
	"context"
)

func (s *Read) Inventory(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.InventoryLot], error) {
	return readPage(ctx, a, domain.ReadStock, q, s.Repos.Queries.Inventory)
}
func (s *Read) InventoryLot(ctx context.Context, a domain.Actor, id int64) (domain.InventoryLot, error) {
	return readOne(ctx, a, domain.ReadStock, id, s.Repos.Queries.InventoryLot)
}
func (s *Read) DonorOverview(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.DonorOverview], error) {
	return readPage(ctx, a, domain.ReadCatalog, q, s.Repos.Queries.DonorOverview)
}
func (s *Read) DonationOverview(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.DonationOverview], error) {
	return readPage(ctx, a, domain.ReadDonations, q, s.Repos.Queries.DonationOverview)
}
func (s *Read) FamilyOverview(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.FamilyOverview], error) {
	return readPage(ctx, a, domain.ReadFamilies, q, s.Repos.Queries.FamilyOverview)
}
func (s *Read) RouteOverview(ctx context.Context, a domain.Actor, q domain.PageQuery) (domain.Page[domain.RouteOverview], error) {
	return readPage(ctx, a, domain.ReadDeliveries, q, s.Repos.Queries.RouteOverview)
}
