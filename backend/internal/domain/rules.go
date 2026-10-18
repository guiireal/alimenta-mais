package domain

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var (
	ErrNotFound        = errors.New("registro não encontrado")
	ErrConflict        = errors.New("operação conflitante com o estado atual")
	ErrForbidden       = errors.New("acesso negado")
	ErrUnauthenticated = errors.New("sessão inválida ou expirada")
)

type ValidationError map[string]string

func (v ValidationError) Error() string { return "dados inválidos" }

// Decimal keeps database precision without coupling the domain to a SQL driver.
type Decimal string

func (d Decimal) Scaled(scale int) (int64, error) {
	s := string(d)
	negative := strings.HasPrefix(s, "-")
	if negative {
		s = s[1:]
	}
	whole, fraction, _ := strings.Cut(s, ".")
	if whole == "" || len(fraction) > scale || len(whole)+scale > 18 {
		return 0, fmt.Errorf("decimal inválido: %q", d)
	}
	for _, c := range whole + fraction {
		if c < '0' || c > '9' {
			return 0, errors.New("decimal inválido")
		}
	}
	if strings.HasSuffix(s, ".") {
		return 0, errors.New("decimal inválido")
	}
	n, err := strconv.ParseInt(whole+fraction+strings.Repeat("0", scale-len(fraction)), 10, 64)
	if negative {
		n = -n
	}
	return n, err
}

func Quantity(n int64) Decimal {
	return Decimal(fmt.Sprintf("%d.%03d", n/1000, n%1000))
}

func PositiveQuantity(d Decimal) (int64, error) {
	n, err := d.Scaled(3)
	if err != nil || n <= 0 || n > 999999999999 {
		return 0, ValidationError{"quantity": "use uma quantidade positiva com até 3 casas decimais"}
	}
	return n, nil
}

type Date string

func (d Date) Valid() bool {
	parsed, err := time.Parse("2006-01-02", string(d))
	return err == nil && parsed.Year() > 0 && parsed.Format("2006-01-02") == string(d)
}
func Today() Date { return Date(time.Now().UTC().Format("2006-01-02")) }

type Actor struct {
	User             User
	IPAddress        string
	SessionID        string
	CSRFHash         string
	SessionExpiresAt time.Time
}

type Permission string

const (
	ReadCatalog     Permission = "catalog:read"
	WriteCatalog    Permission = "catalog:write"
	ReadStock       Permission = "stock:read"
	WriteStock      Permission = "stock:write"
	DisposeStock    Permission = "stock:dispose"
	ReadDonations   Permission = "donation:read"
	WriteDonations  Permission = "donation:write"
	ReadFamilies    Permission = "family:read"
	WriteFamilies   Permission = "family:write"
	ReadDeliveries  Permission = "delivery:read"
	WriteDeliveries Permission = "delivery:write"
	ReadReports     Permission = "report:read"
	ReadAccess      Permission = "access:read"
	WriteAccess     Permission = "access:write"
)

func (a Actor) Can(p Permission) bool {
	if !a.User.IsActive {
		return false
	}
	switch p {
	case ReadCatalog, WriteCatalog, ReadStock, WriteStock, DisposeStock, ReadDonations, WriteDonations, ReadFamilies, WriteFamilies, ReadDeliveries, WriteDeliveries, ReadReports, ReadAccess, WriteAccess:
	default:
		return false
	}
	switch a.User.Role {
	case UserRoleAdministrator:
		return true
	case UserRoleManager:
		return p != WriteAccess
	case UserRoleOperator:
		return p == ReadCatalog || p == ReadStock || p == ReadDonations || p == WriteDonations
	default:
		return false
	}
}

func Require(a Actor, p Permission) error {
	if !a.Can(p) {
		return ErrForbidden
	}
	return nil
}

type PageQuery struct {
	Page        int
	PageSize    int
	Q           string
	Status      string
	Sort        string
	Direction   string
	WarehouseID int64
	ProductID   int64
	CategoryID  int64
	DonationID  int64
	DonorID     int64
	RouteID     int64
}

func (p PageQuery) Offset() int { return (p.Page - 1) * p.PageSize }
func (p PageQuery) Valid() bool {
	return p.Page > 0 && p.Page <= 1000000 && p.PageSize > 0 && p.PageSize <= 100 && len(p.Q) <= 200 &&
		(p.Sort == "" || p.Sort == "expiresAt" || p.Sort == "item" || p.Sort == "quantity" || p.Sort == "id") &&
		(p.Direction == "" || p.Direction == "asc" || p.Direction == "desc")
}

type Page[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
}

type Balance struct {
	BatchID     int64   `json:"batch_id"`
	WarehouseID int64   `json:"warehouse_id"`
	Quantity    Decimal `json:"quantity"`
}
type AvailableBatch struct {
	Batch    InventoryBatch
	Quantity Decimal
}
type BatchDetail struct {
	Batch     InventoryBatch  `json:"batch"`
	Balances  []Balance       `json:"balances"`
	Movements []StockMovement `json:"movements"`
}
type DonationDetail struct {
	Donation Donation         `json:"donation"`
	Batches  []InventoryBatch `json:"batches"`
}
type DeliveryDetail struct {
	Delivery Delivery       `json:"delivery"`
	Items    []DeliveryItem `json:"items"`
}
type RouteDetail struct {
	Route      DeliveryRoute `json:"route"`
	Deliveries []Delivery    `json:"deliveries"`
}
type MonthlyPoint struct {
	Month         string  `json:"month"`
	DonatedKg     Decimal `json:"donated_kg"`
	DistributedKg Decimal `json:"distributed_kg"`
}
type CategoryLoss struct {
	Category string  `json:"category"`
	Kg       Decimal `json:"kg"`
}
type Report struct {
	From                 time.Time      `json:"from"`
	To                   time.Time      `json:"to"`
	DonatedKg            Decimal        `json:"donated_kg"`
	DistributedKg        Decimal        `json:"distributed_kg"`
	LossKg               Decimal        `json:"loss_kg"`
	Turnover             Decimal        `json:"turnover"`
	AverageDeliveryHours Decimal        `json:"average_delivery_hours"`
	CoveragePct          Decimal        `json:"coverage_pct"`
	Monthly              []MonthlyPoint `json:"monthly"`
	LossByCategory       []CategoryLoss `json:"loss_by_category"`
}
type StockStats struct {
	Expired       int     `json:"expired"`
	Critical      int     `json:"critical"`
	Week          int     `json:"week"`
	RegisteredPct Decimal `json:"registered_pct"`
}
type SearchResult struct {
	Batches   []InventoryBatch `json:"batches"`
	Donors    []Donor          `json:"donors"`
	Families  []Family         `json:"families"`
	Donations []Donation       `json:"donations"`
}
type Session struct {
	ID        string
	CSRFHash  string
	UserID    int64
	ExpiresAt time.Time
}

type TokenIdentity struct {
	UserID    int64
	SessionID string
}
type RefreshToken struct {
	TokenHash string
	SessionID string
	ExpiresAt time.Time
	UsedAt    *time.Time
}
