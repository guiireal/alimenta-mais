package httpapi

import (
	"alimenta-mais/backend/internal/domain"
	"alimenta-mais/backend/internal/usecase"
	"context"
)

func registerResources(private func(string, endpoint), s Services) {
	private("GET /api/v1/inventory", list(s.Read.Inventory))
	private("GET /api/v1/inventory/{id}", get(s.Read.InventoryLot))
	private("GET /api/v1/overview/donors", list(s.Read.DonorOverview))
	private("GET /api/v1/overview/donations", list(s.Read.DonationOverview))
	private("GET /api/v1/overview/families", list(s.Read.FamilyOverview))
	private("GET /api/v1/overview/routes", list(s.Read.RouteOverview))
	private("GET /api/v1/donors", list(s.Read.Donors))
	private("GET /api/v1/donors/{id}", get(s.Read.Donor))
	private("POST /api/v1/donors", mutation(s.Catalog.SaveDonor))
	private("PUT /api/v1/donors/{id}", mutation(s.Catalog.SaveDonor))
	private("GET /api/v1/categories", list(s.Read.Categories))
	private("GET /api/v1/categories/{id}", get(s.Read.Category))
	private("POST /api/v1/categories", mutation(s.Catalog.SaveCategory))
	private("PUT /api/v1/categories/{id}", mutation(s.Catalog.SaveCategory))
	private("GET /api/v1/products", list(s.Read.Products))
	private("GET /api/v1/products/{id}", get(s.Read.Product))
	private("POST /api/v1/products", mutation(s.Catalog.SaveProduct))
	private("PUT /api/v1/products/{id}", mutation(s.Catalog.SaveProduct))
	private("GET /api/v1/warehouses", list(s.Read.Warehouses))
	private("GET /api/v1/warehouses/{id}", get(s.Read.Warehouse))
	private("POST /api/v1/warehouses", mutation(s.Catalog.SaveWarehouse))
	private("PUT /api/v1/warehouses/{id}", mutation(s.Catalog.SaveWarehouse))
	private("GET /api/v1/families", list(s.Read.Families))
	private("GET /api/v1/families/{id}", get(s.Read.Family))
	private("POST /api/v1/families", mutation(s.Catalog.SaveFamily))
	private("PUT /api/v1/families/{id}", mutation(s.Catalog.SaveFamily))
	private("GET /api/v1/partners", list(s.Read.Partners))
	private("GET /api/v1/partners/{id}", get(s.Read.Partner))
	private("POST /api/v1/partners", mutation(s.Catalog.SavePartner))
	private("PUT /api/v1/partners/{id}", mutation(s.Catalog.SavePartner))
	private("GET /api/v1/batches", list(s.Read.Batches))
	private("GET /api/v1/batches/{id}", get(s.Read.BatchDetail))
	private("GET /api/v1/donations", list(s.Read.Donations))
	private("GET /api/v1/donations/{id}", get(s.Read.DonationDetail))
	private("GET /api/v1/deliveries", list(s.Read.Deliveries))
	private("GET /api/v1/deliveries/{id}", get(s.Read.DeliveryDetail))
	private("GET /api/v1/routes", list(s.Read.Routes))
	private("GET /api/v1/routes/{id}", get(s.Read.RouteDetail))
	private("POST /api/v1/batches", mutation(func(ctx context.Context, a domain.Actor, _ int64, in usecase.BatchInput) (domain.InventoryBatch, error) {
		return s.Stock.Create(ctx, a, in)
	}))
	private("POST /api/v1/donations", mutation(func(ctx context.Context, a domain.Actor, _ int64, in usecase.DonationInput) (domain.DonationDetail, error) {
		return s.Donations.Create(ctx, a, in)
	}))
	private("POST /api/v1/deliveries", mutation(s.Deliveries.Save))
	private("PUT /api/v1/deliveries/{id}", mutation(s.Deliveries.Save))
	private("POST /api/v1/routes", mutation(s.Deliveries.SaveRoute))
	private("PUT /api/v1/routes/{id}", mutation(s.Deliveries.SaveRoute))

	private("POST /api/v1/batches/{id}/triage", mutation(s.Stock.Triage))
	private("POST /api/v1/batches/{id}/movements", mutation(s.Stock.Move))
	private("POST /api/v1/donations/{id}/confirm", action(s.Donations.Confirm))
	private("POST /api/v1/deliveries/{id}/dispatch", action(s.Deliveries.Dispatch))
	private("POST /api/v1/deliveries/{id}/returns", mutation(s.Deliveries.Return))
	private("PUT /api/v1/deliveries/{id}/status", mutation(func(ctx context.Context, a domain.Actor, id int64, in struct {
		Status domain.DeliveryStatus `json:"status"`
		Reason string                `json:"reason"`
	}) (domain.Delivery, error) {
		return s.Deliveries.Status(ctx, a, id, in.Status, in.Reason)
	}))
	private("PUT /api/v1/routes/{id}/status", mutation(func(ctx context.Context, a domain.Actor, id int64, in struct {
		Status domain.RouteStatus `json:"status"`
	}) (domain.DeliveryRoute, error) {
		return s.Deliveries.RouteStatus(ctx, a, id, in.Status)
	}))
	private("PUT /api/v1/families/{id}/consent", mutation(func(ctx context.Context, a domain.Actor, id int64, in struct {
		Granted bool   `json:"granted"`
		Version string `json:"privacy_notice_version"`
	}) (domain.Family, error) {
		return s.Catalog.Consent(ctx, a, id, in.Granted, in.Version)
	}))
	private("GET /api/v1/users", list(s.Read.Users))
	private("GET /api/v1/users/{id}", get(s.Read.User))
	private("PUT /api/v1/users/{id}/access", mutation(s.Access.Update))
	private("GET /api/v1/audit", list(s.Read.Audit))
}
