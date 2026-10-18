package usecase

import (
	"context"
	"time"

	"alimenta-mais/backend/internal/domain"
)

// Repositories are provided again inside each transaction; no SQL leaks into use cases.
type Repositories struct {
	Users      UserRepository
	Sessions   SessionRepository
	Catalog    CatalogRepository
	Donations  DonationRepository
	Stock      StockRepository
	Deliveries DeliveryRepository
	Audit      AuditRepository
	Queries    QueryRepository
}
type UnitOfWork interface {
	WithinTx(context.Context, func(Repositories) error) error
}
type Passwords interface {
	Hash(string) (string, error)
	Compare(string, string) bool
}
type AccessTokens interface {
	Issue(int64, string, time.Time) (string, error)
	Verify(string) (domain.TokenIdentity, error)
}
type UserRepository interface {
	User(context.Context, int64, bool) (domain.User, error)
	UserByEmail(context.Context, string) (domain.User, error)
	Users(context.Context, domain.PageQuery) (domain.Page[domain.User], error)
	CreateUser(context.Context, *domain.User) error
	UpdateUser(context.Context, domain.User) error
	LockAdministrators(context.Context) error
	ActiveAdministrators(context.Context) (int, error)
}
type SessionRepository interface {
	CreateSession(context.Context, domain.Session) error
	SessionUser(context.Context, string) (domain.Actor, error)
	DeleteSession(context.Context, string) error
	DeleteUserSessions(context.Context, int64) error
	CreateRefreshToken(context.Context, domain.RefreshToken) error
	RefreshToken(context.Context, string) (domain.RefreshToken, error)
	UseRefreshToken(context.Context, string) error
}
type CatalogRepository interface {
	Donor(context.Context, int64) (domain.Donor, error)
	Donors(context.Context, domain.PageQuery) (domain.Page[domain.Donor], error)
	SaveDonor(context.Context, *domain.Donor) error
	Category(context.Context, int64) (domain.ProductCategory, error)
	Categories(context.Context, domain.PageQuery) (domain.Page[domain.ProductCategory], error)
	SaveCategory(context.Context, *domain.ProductCategory) error
	Product(context.Context, int64, bool) (domain.Product, error)
	Products(context.Context, domain.PageQuery) (domain.Page[domain.Product], error)
	SaveProduct(context.Context, *domain.Product) error
	Warehouse(context.Context, int64) (domain.Warehouse, error)
	Warehouses(context.Context, domain.PageQuery) (domain.Page[domain.Warehouse], error)
	SaveWarehouse(context.Context, *domain.Warehouse) error
	Family(context.Context, int64, bool) (domain.Family, error)
	Families(context.Context, domain.PageQuery) (domain.Page[domain.Family], error)
	SaveFamily(context.Context, *domain.Family) error
	Partner(context.Context, int64) (domain.PartnerOrganization, error)
	Partners(context.Context, domain.PageQuery) (domain.Page[domain.PartnerOrganization], error)
	SavePartner(context.Context, *domain.PartnerOrganization) error
}
type DonationRepository interface {
	Donation(context.Context, int64, bool) (domain.Donation, error)
	Donations(context.Context, domain.PageQuery) (domain.Page[domain.Donation], error)
	SaveDonation(context.Context, *domain.Donation) error
	DonationBatches(context.Context, int64) ([]domain.InventoryBatch, error)
}
type StockRepository interface {
	Batch(context.Context, int64, bool) (domain.InventoryBatch, error)
	Batches(context.Context, domain.PageQuery) (domain.Page[domain.InventoryBatch], error)
	SaveBatch(context.Context, *domain.InventoryBatch) error
	Balance(context.Context, int64, int64) (domain.Decimal, error)
	Balances(context.Context, int64) ([]domain.Balance, error)
	Movements(context.Context, int64, domain.PageQuery) (domain.Page[domain.StockMovement], error)
	CreateMovement(context.Context, *domain.StockMovement) error
	AvailableBatches(context.Context, int64, int64, domain.Date) ([]domain.AvailableBatch, error)
	ReturnedQuantity(context.Context, int64) (domain.Decimal, error)
	Stats(context.Context) (domain.StockStats, error)
}
type DeliveryRepository interface {
	Delivery(context.Context, int64, bool) (domain.Delivery, error)
	Deliveries(context.Context, domain.PageQuery) (domain.Page[domain.Delivery], error)
	SaveDelivery(context.Context, *domain.Delivery) error
	DeliveryItems(context.Context, int64) ([]domain.DeliveryItem, error)
	ReplaceDeliveryItems(context.Context, int64, []domain.DeliveryItem) error
	Route(context.Context, int64, bool) (domain.DeliveryRoute, error)
	Routes(context.Context, domain.PageQuery) (domain.Page[domain.DeliveryRoute], error)
	SaveRoute(context.Context, *domain.DeliveryRoute) error
	RouteDeliveries(context.Context, int64) ([]domain.Delivery, error)
}
type AuditRepository interface {
	Record(context.Context, domain.Actor, string, string, int64, any, any) error
	Audit(context.Context, domain.PageQuery) (domain.Page[domain.AuditLog], error)
}
type QueryRepository interface {
	Report(context.Context, time.Time, time.Time) (domain.Report, error)
	Inventory(context.Context, domain.PageQuery) (domain.Page[domain.InventoryLot], error)
	InventoryLot(context.Context, int64) (domain.InventoryLot, error)
	DonorOverview(context.Context, domain.PageQuery) (domain.Page[domain.DonorOverview], error)
	DonationOverview(context.Context, domain.PageQuery) (domain.Page[domain.DonationOverview], error)
	FamilyOverview(context.Context, domain.PageQuery) (domain.Page[domain.FamilyOverview], error)
	RouteOverview(context.Context, domain.PageQuery) (domain.Page[domain.RouteOverview], error)
}
