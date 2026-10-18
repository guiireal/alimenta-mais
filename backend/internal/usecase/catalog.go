package usecase

import (
	"context"
	"strings"
	"time"

	"alimenta-mais/backend/internal/domain"
)

type Catalog struct{ Tx UnitOfWork }
type DonorInput struct {
	Type        domain.DonorType `json:"type"`
	Name        string           `json:"name"`
	TaxID       *string          `json:"tax_id"`
	ContactName *string          `json:"contact_name"`
	Email       *string          `json:"email"`
	Phone       *string          `json:"phone"`
	Address     *string          `json:"address"`
	IsActive    *bool            `json:"is_active"`
}
type CategoryInput struct {
	Name         string `json:"name"`
	IsPerishable bool   `json:"is_perishable"`
}
type ProductInput struct {
	CategoryID int64  `json:"category_id"`
	Name       string `json:"name"`
	Unit       string `json:"unit"`
	IsActive   *bool  `json:"is_active"`
}
type WarehouseInput struct {
	Name          string          `json:"name"`
	Address       *string         `json:"address"`
	Latitude      *domain.Decimal `json:"latitude"`
	Longitude     *domain.Decimal `json:"longitude"`
	IsColdStorage bool            `json:"is_cold_storage"`
	IsActive      *bool           `json:"is_active"`
}
type FamilyInput struct {
	ReferenceCode string          `json:"reference_code"`
	ContactName   string          `json:"contact_name"`
	Phone         *string         `json:"phone"`
	HouseholdSize int32           `json:"household_size"`
	Address       string          `json:"address"`
	Neighborhood  string          `json:"neighborhood"`
	City          string          `json:"city"`
	State         string          `json:"state"`
	PostalCode    *string         `json:"postal_code"`
	Latitude      *domain.Decimal `json:"latitude"`
	Longitude     *domain.Decimal `json:"longitude"`
	IsActive      *bool           `json:"is_active"`
}
type PartnerInput struct {
	Name        string          `json:"name"`
	TaxID       *string         `json:"tax_id"`
	ContactName *string         `json:"contact_name"`
	Phone       *string         `json:"phone"`
	Address     string          `json:"address"`
	Latitude    *domain.Decimal `json:"latitude"`
	Longitude   *domain.Decimal `json:"longitude"`
	IsActive    *bool           `json:"is_active"`
}

func (s *Catalog) SaveDonor(ctx context.Context, a domain.Actor, id int64, in DonorInput) (domain.Donor, error) {
	if err := domain.Require(a, domain.WriteCatalog); err != nil {
		return domain.Donor{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	v := validation{}
	v.text("name", in.Name, 200, true)
	validTaxID(v, in.TaxID)
	v.optional("contact_name", in.ContactName, 150)
	v.optional("phone", in.Phone, 30)
	v.optional("address", in.Address, 10000)
	if in.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*in.Email))
		in.Email = &email
		v.email("email", email)
	}
	if in.Type != domain.DonorTypeIndividual && in.Type != domain.DonorTypeCompany {
		v["type"] = "tipo inválido"
	}
	if err := v.err(); err != nil {
		return domain.Donor{}, err
	}
	var out domain.Donor
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var before *domain.Donor
		now := time.Now().UTC()
		out = domain.Donor{ID: id, Type: in.Type, Name: in.Name, TaxID: in.TaxID, ContactName: in.ContactName, Email: in.Email, Phone: in.Phone, Address: in.Address, IsActive: active(in.IsActive), CreatedAt: now, UpdatedAt: now}
		if id != 0 {
			old, err := r.Catalog.Donor(ctx, id)
			if err != nil {
				return err
			}
			before = &old
			out.CreatedAt = old.CreatedAt
		}
		if err := r.Catalog.SaveDonor(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "donor.saved", "donors", out.ID, before, out)
	})
	return out, err
}
func (s *Catalog) SaveCategory(ctx context.Context, a domain.Actor, id int64, in CategoryInput) (domain.ProductCategory, error) {
	if err := domain.Require(a, domain.WriteCatalog); err != nil {
		return domain.ProductCategory{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	v := validation{}
	v.text("name", in.Name, 100, true)
	if err := v.err(); err != nil {
		return domain.ProductCategory{}, err
	}
	out := domain.ProductCategory{ID: id, Name: in.Name, IsPerishable: in.IsPerishable}
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var before *domain.ProductCategory
		if id != 0 {
			old, err := r.Catalog.Category(ctx, id)
			if err != nil {
				return err
			}
			before = &old
			if old.IsPerishable != in.IsPerishable {
				products, err := r.Catalog.Products(ctx, domain.PageQuery{Page: 1, PageSize: 1, CategoryID: id})
				if err != nil {
					return err
				}
				if products.Total > 0 {
					return conflict("categoria com produtos não pode mudar a exigência de refrigeração")
				}
			}
		}
		if err := r.Catalog.SaveCategory(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "category.saved", "product_categories", out.ID, before, out)
	})
	return out, err
}
func (s *Catalog) SaveProduct(ctx context.Context, a domain.Actor, id int64, in ProductInput) (domain.Product, error) {
	if err := domain.Require(a, domain.WriteCatalog); err != nil {
		return domain.Product{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	v := validation{}
	v.text("name", in.Name, 200, true)
	v.id("category_id", in.CategoryID)
	if in.Unit != "kg" && in.Unit != "un" {
		v["unit"] = "use kg ou un"
	}
	if err := v.err(); err != nil {
		return domain.Product{}, err
	}
	var out domain.Product
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		if _, err := r.Catalog.Category(ctx, in.CategoryID); err != nil {
			return err
		}
		var before *domain.Product
		now := time.Now().UTC()
		out = domain.Product{ID: id, CategoryID: in.CategoryID, Name: in.Name, Unit: in.Unit, IsActive: active(in.IsActive), CreatedAt: now, UpdatedAt: now}
		if id != 0 {
			old, err := r.Catalog.Product(ctx, id, true)
			if err != nil {
				return err
			}
			before = &old
			out.CreatedAt = old.CreatedAt
			if old.Unit != in.Unit || old.CategoryID != in.CategoryID {
				batches, err := r.Stock.Batches(ctx, domain.PageQuery{Page: 1, PageSize: 1, ProductID: id})
				if err != nil {
					return err
				}
				if batches.Total > 0 {
					return conflict("produto com lotes não pode mudar de unidade ou categoria")
				}
			}
		}
		if err := r.Catalog.SaveProduct(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "product.saved", "products", out.ID, before, out)
	})
	return out, err
}
func (s *Catalog) SaveWarehouse(ctx context.Context, a domain.Actor, id int64, in WarehouseInput) (domain.Warehouse, error) {
	if err := domain.Require(a, domain.WriteCatalog); err != nil {
		return domain.Warehouse{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	v := validation{}
	v.text("name", in.Name, 100, true)
	v.optional("address", in.Address, 10000)
	v.coordinates(in.Latitude, in.Longitude)
	if err := v.err(); err != nil {
		return domain.Warehouse{}, err
	}
	out := domain.Warehouse{ID: id, Name: in.Name, Address: in.Address, Latitude: in.Latitude, Longitude: in.Longitude, IsColdStorage: in.IsColdStorage, IsActive: active(in.IsActive)}
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var before *domain.Warehouse
		if id != 0 {
			old, err := r.Catalog.Warehouse(ctx, id)
			if err != nil {
				return err
			}
			before = &old
			if old.IsColdStorage && !in.IsColdStorage {
				batches, err := r.Stock.Batches(ctx, domain.PageQuery{Page: 1, PageSize: 1, WarehouseID: id})
				if err != nil {
					return err
				}
				if batches.Total > 0 {
					return conflict("depósito com saldo não pode perder a refrigeração")
				}
			}
		}
		if err := r.Catalog.SaveWarehouse(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "warehouse.saved", "warehouses", out.ID, before, out)
	})
	return out, err
}
func (s *Catalog) SaveFamily(ctx context.Context, a domain.Actor, id int64, in FamilyInput) (domain.Family, error) {
	if err := domain.Require(a, domain.WriteFamilies); err != nil {
		return domain.Family{}, err
	}
	in.ReferenceCode = strings.TrimSpace(in.ReferenceCode)
	in.ContactName = strings.TrimSpace(in.ContactName)
	in.State = strings.ToUpper(strings.TrimSpace(in.State))
	v := validation{}
	v.text("reference_code", in.ReferenceCode, 30, true)
	v.text("contact_name", in.ContactName, 150, true)
	v.text("address", in.Address, 10000, true)
	v.text("neighborhood", in.Neighborhood, 100, true)
	v.text("city", in.City, 100, true)
	v.optional("phone", in.Phone, 30)
	v.coordinates(in.Latitude, in.Longitude)
	if in.HouseholdSize < 1 || in.HouseholdSize > 20 {
		v["household_size"] = "informe de 1 a 20 pessoas"
	}
	if len(in.State) != 2 || strings.IndexFunc(in.State, func(r rune) bool { return r < 'A' || r > 'Z' }) >= 0 {
		v["state"] = "use duas letras"
	}
	if in.PostalCode != nil && (len(*in.PostalCode) != 8 || !digits.MatchString(*in.PostalCode)) {
		v["postal_code"] = "use 8 dígitos"
	}
	if err := v.err(); err != nil {
		return domain.Family{}, err
	}
	var out domain.Family
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var before *domain.Family
		now := time.Now().UTC()
		out = domain.Family{ID: id, ReferenceCode: in.ReferenceCode, ContactName: in.ContactName, Phone: in.Phone, HouseholdSize: in.HouseholdSize, Address: in.Address, Neighborhood: in.Neighborhood, City: in.City, State: in.State, PostalCode: in.PostalCode, Latitude: in.Latitude, Longitude: in.Longitude, IsActive: active(in.IsActive), CreatedAt: now, UpdatedAt: now}
		if id != 0 {
			old, err := r.Catalog.Family(ctx, id, true)
			if err != nil {
				return err
			}
			before = &old
			out.CreatedAt = old.CreatedAt
			out.ConsentGrantedAt = old.ConsentGrantedAt
			out.ConsentRevokedAt = old.ConsentRevokedAt
			out.PrivacyNoticeVersion = old.PrivacyNoticeVersion
		}
		if err := r.Catalog.SaveFamily(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "family.saved", "families", out.ID, before, out)
	})
	return out, err
}
func (s *Catalog) Consent(ctx context.Context, a domain.Actor, id int64, granted bool, version string) (domain.Family, error) {
	if err := domain.Require(a, domain.WriteFamilies); err != nil {
		return domain.Family{}, err
	}
	v := validation{}
	if granted {
		v.text("privacy_notice_version", version, 30, true)
	}
	if err := v.err(); err != nil {
		return domain.Family{}, err
	}
	var out domain.Family
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		f, err := r.Catalog.Family(ctx, id, true)
		if err != nil {
			return err
		}
		before := f
		now := time.Now().UTC()
		if granted {
			f.ConsentGrantedAt = &now
			f.ConsentRevokedAt = nil
			f.PrivacyNoticeVersion = &version
		} else {
			if f.ConsentGrantedAt == nil {
				return conflict("família sem consentimento registrado")
			}
			f.ConsentRevokedAt = &now
		}
		f.UpdatedAt = now
		if err := r.Catalog.SaveFamily(ctx, &f); err != nil {
			return err
		}
		out = f
		return r.Audit.Record(ctx, a, "family.consent_changed", "families", id, before, f)
	})
	return out, err
}
func (s *Catalog) SavePartner(ctx context.Context, a domain.Actor, id int64, in PartnerInput) (domain.PartnerOrganization, error) {
	if err := domain.Require(a, domain.WriteFamilies); err != nil {
		return domain.PartnerOrganization{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	v := validation{}
	v.text("name", in.Name, 200, true)
	v.text("address", in.Address, 10000, true)
	v.optional("contact_name", in.ContactName, 150)
	v.optional("phone", in.Phone, 30)
	validTaxID(v, in.TaxID)
	v.coordinates(in.Latitude, in.Longitude)
	if err := v.err(); err != nil {
		return domain.PartnerOrganization{}, err
	}
	var out domain.PartnerOrganization
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var before *domain.PartnerOrganization
		now := time.Now().UTC()
		out = domain.PartnerOrganization{ID: id, Name: in.Name, TaxID: in.TaxID, ContactName: in.ContactName, Phone: in.Phone, Address: in.Address, Latitude: in.Latitude, Longitude: in.Longitude, IsActive: active(in.IsActive), CreatedAt: now, UpdatedAt: now}
		if id != 0 {
			old, err := r.Catalog.Partner(ctx, id)
			if err != nil {
				return err
			}
			before = &old
			out.CreatedAt = old.CreatedAt
		}
		if err := r.Catalog.SavePartner(ctx, &out); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "partner.saved", "partner_organizations", out.ID, before, out)
	})
	return out, err
}

func active(value *bool) bool { return value == nil || *value }
