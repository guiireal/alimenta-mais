package domain

import (
	"time"
)

type User struct {
	ID           int64      `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	Role         UserRole   `json:"role"`
	IsActive     bool       `json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type Donor struct {
	ID          int64     `json:"id"`
	Type        DonorType `json:"type"`
	Name        string    `json:"name"`
	TaxID       *string   `json:"tax_id"`
	ContactName *string   `json:"contact_name"`
	Email       *string   `json:"email"`
	Phone       *string   `json:"phone"`
	Address     *string   `json:"address"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProductCategory struct {
	IsPerishable bool   `json:"is_perishable"`
	ID           int64  `json:"id"`
	Name         string `json:"name"`
}

type Product struct {
	ID         int64     `json:"id"`
	CategoryID int64     `json:"category_id"`
	Name       string    `json:"name"`
	Unit       string    `json:"unit"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Warehouse struct {
	IsColdStorage bool     `json:"is_cold_storage"`
	ID            int64    `json:"id"`
	Name          string   `json:"name"`
	Address       *string  `json:"address"`
	Latitude      *Decimal `json:"latitude"`
	Longitude     *Decimal `json:"longitude"`
	IsActive      bool     `json:"is_active"`
}

type Donation struct {
	ID                int64          `json:"id"`
	DonorID           int64          `json:"donor_id"`
	Status            DonationStatus `json:"status"`
	ReceivedAt        *time.Time     `json:"received_at"`
	DocumentReference *string        `json:"document_reference"`
	DocumentPath      *string        `json:"document_path"`
	Notes             *string        `json:"notes"`
	CreatedBy         int64          `json:"created_by"`
	ConfirmedBy       *int64         `json:"confirmed_by"`
	ConfirmedAt       *time.Time     `json:"confirmed_at"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type InventoryBatch struct {
	ID               int64        `json:"id"`
	DonationID       *int64       `json:"donation_id"`
	ProductID        int64        `json:"product_id"`
	BatchCode        string       `json:"batch_code"`
	ReceivedQuantity Decimal      `json:"received_quantity"`
	UnitWeightKg     Decimal      `json:"unit_weight_kg"`
	ExpiresOn        *Date        `json:"expires_on"`
	TriageStatus     TriageStatus `json:"triage_status"`
	TriagedBy        *int64       `json:"triaged_by"`
	TriagedAt        *time.Time   `json:"triaged_at"`
	TriageNotes      *string      `json:"triage_notes"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
}

type Family struct {
	ID                   int64      `json:"id"`
	ReferenceCode        string     `json:"reference_code"`
	ContactName          string     `json:"contact_name"`
	Phone                *string    `json:"phone"`
	HouseholdSize        int32      `json:"household_size"`
	Address              string     `json:"address"`
	Neighborhood         string     `json:"neighborhood"`
	City                 string     `json:"city"`
	State                string     `json:"state"`
	PostalCode           *string    `json:"postal_code"`
	Latitude             *Decimal   `json:"latitude"`
	Longitude            *Decimal   `json:"longitude"`
	ConsentGrantedAt     *time.Time `json:"consent_granted_at"`
	ConsentRevokedAt     *time.Time `json:"consent_revoked_at"`
	PrivacyNoticeVersion *string    `json:"privacy_notice_version"`
	IsActive             bool       `json:"is_active"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type PartnerOrganization struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	TaxID       *string   `json:"tax_id"`
	ContactName *string   `json:"contact_name"`
	Phone       *string   `json:"phone"`
	Address     string    `json:"address"`
	Latitude    *Decimal  `json:"latitude"`
	Longitude   *Decimal  `json:"longitude"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type DeliveryRoute struct {
	ID                int64       `json:"id"`
	ReferenceCode     string      `json:"reference_code"`
	OriginWarehouseID int64       `json:"origin_warehouse_id"`
	ScheduledOn       Date        `json:"scheduled_on"`
	Status            RouteStatus `json:"status"`
	AssignedTo        *int64      `json:"assigned_to"`
	StartedAt         *time.Time  `json:"started_at"`
	CompletedAt       *time.Time  `json:"completed_at"`
	CreatedBy         int64       `json:"created_by"`
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
}

type Delivery struct {
	SourceWarehouseID     *int64         `json:"source_warehouse_id"`
	ID                    int64          `json:"id"`
	FamilyID              *int64         `json:"family_id"`
	PartnerOrganizationID *int64         `json:"partner_organization_id"`
	RouteID               *int64         `json:"route_id"`
	StopSequence          *int32         `json:"stop_sequence"`
	Status                DeliveryStatus `json:"status"`
	DestinationAddress    string         `json:"destination_address"`
	DestinationLatitude   *Decimal       `json:"destination_latitude"`
	DestinationLongitude  *Decimal       `json:"destination_longitude"`
	ScheduledAt           *time.Time     `json:"scheduled_at"`
	DispatchedAt          *time.Time     `json:"dispatched_at"`
	DeliveredAt           *time.Time     `json:"delivered_at"`
	Description           *string        `json:"description"`
	Notes                 *string        `json:"notes"`
	CreatedBy             int64          `json:"created_by"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
}

type DeliveryItem struct {
	ID         int64   `json:"id"`
	DeliveryID int64   `json:"delivery_id"`
	BatchID    int64   `json:"batch_id"`
	Quantity   Decimal `json:"quantity"`
}

type StockMovement struct {
	ID              int64             `json:"id"`
	BatchID         int64             `json:"batch_id"`
	Type            StockMovementType `json:"type"`
	Quantity        Decimal           `json:"quantity"`
	FromWarehouseID *int64            `json:"from_warehouse_id"`
	ToWarehouseID   *int64            `json:"to_warehouse_id"`
	DeliveryItemID  *int64            `json:"delivery_item_id"`
	Reason          *string           `json:"reason"`
	MovedAt         time.Time         `json:"moved_at"`
	RecordedBy      int64             `json:"recorded_by"`
	CreatedAt       time.Time         `json:"created_at"`
}

type AuditLog struct {
	ID           int64     `json:"id"`
	ActorID      *int64    `json:"actor_id"`
	Action       string    `json:"action"`
	EntityTable  *string   `json:"entity_table"`
	EntityID     *int64    `json:"entity_id"`
	BeforeValues *string   `json:"before_values"`
	AfterValues  *string   `json:"after_values"`
	IPAddress    *string   `json:"ip_address"`
	OccurredAt   time.Time `json:"occurred_at"`
}
