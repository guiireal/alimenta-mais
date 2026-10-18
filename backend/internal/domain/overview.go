package domain

import "time"

// Projections combine data needed by the UI without changing the write entities.
type InventoryLot struct {
	InventoryBatch
	ProductName  string             `json:"product_name"`
	CategoryID   int64              `json:"category_id"`
	CategoryName string             `json:"category_name"`
	Unit         string             `json:"unit"`
	Quantity     Decimal            `json:"quantity"`
	Balances     []InventoryBalance `json:"balances"`
}
type InventoryBalance struct {
	WarehouseID   int64   `json:"warehouse_id"`
	WarehouseName string  `json:"warehouse_name"`
	Quantity      Decimal `json:"quantity"`
}
type DonorOverview struct {
	Donor
	TotalKg        Decimal    `json:"total_kg"`
	DonationsCount int64      `json:"donations_count"`
	LastDonationAt *time.Time `json:"last_donation_at"`
}
type DonationOverview struct {
	Donation
	DonorName string    `json:"donor_name"`
	DonorType DonorType `json:"donor_type"`
	WeightKg  Decimal   `json:"weight_kg"`
}
type FamilyOverview struct {
	Family
	LastDeliveryAt *time.Time `json:"last_delivery_at"`
}
type RouteOverview struct {
	DeliveryRoute
	AssignedName  string     `json:"assigned_name"`
	WarehouseName string     `json:"warehouse_name"`
	Stops         []Delivery `json:"stops"`
}
