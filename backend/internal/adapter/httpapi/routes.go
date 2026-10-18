package httpapi

import (
	"alimenta-mais/backend/internal/domain"
	"alimenta-mais/backend/internal/usecase"
	"context"
)

func registerResources(private func(string, endpoint), s Services) {
	private("GET /api/inventory", list(s.Read.Inventory))
	private("GET /api/inventory/{id}", get(s.Read.InventoryLot))
	private("GET /api/overview/donors", list(s.Read.DonorOverview))
	private("GET /api/overview/donations", list(s.Read.DonationOverview))
	private("GET /api/overview/families", list(s.Read.FamilyOverview))
	private("GET /api/overview/routes", list(s.Read.RouteOverview))
	private("GET /api/donors", list(s.Read.Donors))
	private("GET /api/donors/{id}", get(s.Read.Donor))
	private("POST /api/donors", mutation(s.Catalog.SaveDonor))
	private("PUT /api/donors/{id}", mutation(s.Catalog.SaveDonor))
	private("GET /api/categories", list(s.Read.Categories))
	private("GET /api/categories/{id}", get(s.Read.Category))
	private("POST /api/categories", mutation(s.Catalog.SaveCategory))
	private("PUT /api/categories/{id}", mutation(s.Catalog.SaveCategory))
	private("GET /api/products", list(s.Read.Products))
	private("GET /api/products/{id}", get(s.Read.Product))
	private("POST /api/products", mutation(s.Catalog.SaveProduct))
	private("PUT /api/products/{id}", mutation(s.Catalog.SaveProduct))
	private("GET /api/warehouses", list(s.Read.Warehouses))
	private("GET /api/warehouses/{id}", get(s.Read.Warehouse))
	private("POST /api/warehouses", mutation(s.Catalog.SaveWarehouse))
	private("PUT /api/warehouses/{id}", mutation(s.Catalog.SaveWarehouse))
	private("GET /api/families", list(s.Read.Families))
	private("GET /api/families/{id}", get(s.Read.Family))
	private("POST /api/families", mutation(s.Catalog.SaveFamily))
	private("PUT /api/families/{id}", mutation(s.Catalog.SaveFamily))
	private("GET /api/partners", list(s.Read.Partners))
	private("GET /api/partners/{id}", get(s.Read.Partner))
	private("POST /api/partners", mutation(s.Catalog.SavePartner))
	private("PUT /api/partners/{id}", mutation(s.Catalog.SavePartner))
	private("GET /api/batches", list(s.Read.Batches))
	private("GET /api/batches/{id}", get(s.Read.BatchDetail))
	private("GET /api/donations", list(s.Read.Donations))
	private("GET /api/donations/{id}", get(s.Read.DonationDetail))
	private("GET /api/deliveries", list(s.Read.Deliveries))
	private("GET /api/deliveries/{id}", get(s.Read.DeliveryDetail))
	private("GET /api/routes", list(s.Read.Routes))
	private("GET /api/routes/{id}", get(s.Read.RouteDetail))
	private("POST /api/batches", mutation(func(ctx context.Context, a domain.Actor, _ int64, in usecase.BatchInput) (domain.InventoryBatch, error) {
		return s.Stock.Create(ctx, a, in)
	}))
	private("POST /api/donations", mutation(func(ctx context.Context, a domain.Actor, _ int64, in usecase.DonationInput) (domain.DonationDetail, error) {
		return s.Donations.Create(ctx, a, in)
	}))
	private("POST /api/deliveries", mutation(s.Deliveries.Save))
	private("PUT /api/deliveries/{id}", mutation(s.Deliveries.Save))
	private("POST /api/routes", mutation(s.Deliveries.SaveRoute))
	private("PUT /api/routes/{id}", mutation(s.Deliveries.SaveRoute))

	private("POST /api/batches/{id}/triage", mutation(s.Stock.Triage))
	private("POST /api/batches/{id}/movements", mutation(s.Stock.Move))
	private("POST /api/donations/{id}/confirm", action(s.Donations.Confirm))
	private("POST /api/deliveries/{id}/dispatch", action(s.Deliveries.Dispatch))
	private("POST /api/deliveries/{id}/returns", mutation(s.Deliveries.Return))
	private("PUT /api/deliveries/{id}/status", mutation(func(ctx context.Context, a domain.Actor, id int64, in struct {
		Status domain.DeliveryStatus `json:"status"`
		Reason string                `json:"reason"`
	}) (domain.Delivery, error) {
		return s.Deliveries.Status(ctx, a, id, in.Status, in.Reason)
	}))
	private("PUT /api/routes/{id}/status", mutation(func(ctx context.Context, a domain.Actor, id int64, in struct {
		Status domain.RouteStatus `json:"status"`
	}) (domain.DeliveryRoute, error) {
		return s.Deliveries.RouteStatus(ctx, a, id, in.Status)
	}))
	private("PUT /api/families/{id}/consent", mutation(func(ctx context.Context, a domain.Actor, id int64, in struct {
		Granted bool   `json:"granted"`
		Version string `json:"privacy_notice_version"`
	}) (domain.Family, error) {
		return s.Catalog.Consent(ctx, a, id, in.Granted, in.Version)
	}))
	private("GET /api/users", list(s.Read.Users))
	private("GET /api/users/{id}", get(s.Read.User))
	private("PUT /api/users/{id}/access", mutation(s.Access.Update))
	private("GET /api/audit", list(s.Read.Audit))
}
