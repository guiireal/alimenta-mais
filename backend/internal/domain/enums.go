package domain

type UserRole string

const (
	UserRoleAdministrator UserRole = "administrator"
	UserRoleManager       UserRole = "manager"
	UserRoleOperator      UserRole = "operator"
)

type DonorType string

const (
	DonorTypeIndividual DonorType = "individual"
	DonorTypeCompany    DonorType = "company"
)

type DonationStatus string

const (
	DonationStatusDraft     DonationStatus = "draft"
	DonationStatusReceived  DonationStatus = "received"
	DonationStatusInTriage  DonationStatus = "in_triage"
	DonationStatusStored    DonationStatus = "stored"
	DonationStatusAvailable DonationStatus = "available"
)

type TriageStatus string

const (
	TriageStatusPending  TriageStatus = "pending"
	TriageStatusApproved TriageStatus = "approved"
	TriageStatusRejected TriageStatus = "rejected"
)

type RouteStatus string

const (
	RouteStatusWaiting   RouteStatus = "waiting"
	RouteStatusInTransit RouteStatus = "in_transit"
	RouteStatusCompleted RouteStatus = "completed"
	RouteStatusCancelled RouteStatus = "cancelled"
)

type DeliveryStatus string

const (
	DeliveryStatusWaiting   DeliveryStatus = "waiting"
	DeliveryStatusInTransit DeliveryStatus = "in_transit"
	DeliveryStatusDelivered DeliveryStatus = "delivered"
	DeliveryStatusFailed    DeliveryStatus = "failed"
	DeliveryStatusCancelled DeliveryStatus = "cancelled"
)

type StockMovementType string

const (
	StockMovementTypeReceipt        StockMovementType = "receipt"
	StockMovementTypeTransfer       StockMovementType = "transfer"
	StockMovementTypeDistribution   StockMovementType = "distribution"
	StockMovementTypeReturn         StockMovementType = "return"
	StockMovementTypeExpirationLoss StockMovementType = "expiration_loss"
	StockMovementTypeOtherLoss      StockMovementType = "other_loss"
	StockMovementTypeAdjustmentIn   StockMovementType = "adjustment_in"
	StockMovementTypeAdjustmentOut  StockMovementType = "adjustment_out"
)
