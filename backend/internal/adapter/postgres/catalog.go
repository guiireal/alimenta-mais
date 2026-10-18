package postgres

import (
	"alimenta-mais/backend/internal/domain"
	"context"
)

const donorColumns = `id, type, name, tax_id, contact_name, email, phone, address, is_active, created_at, updated_at`

func scanDonor(row scanner) (domain.Donor, error) {
	var v domain.Donor
	err := row.Scan(&v.ID, &v.Type, &v.Name, &v.TaxID, &v.ContactName, &v.Email, &v.Phone, &v.Address, &v.IsActive, &v.CreatedAt, &v.UpdatedAt)
	return v, translate(err)
}
func (s *Store) Donor(ctx context.Context, id int64) (domain.Donor, error) {
	return scanDonor(s.query.QueryRowContext(ctx, "SELECT "+donorColumns+" FROM donors WHERE id=$1"+" FOR SHARE", id))
}
func (s *Store) Donors(ctx context.Context, q domain.PageQuery) (domain.Page[domain.Donor], error) {
	return page(ctx, s, q, "donors", donorColumns, `($1='' OR strpos(lower(coalesce(name,'')),lower($1))>0 OR strpos(lower(coalesce(tax_id,'')),lower($1))>0 OR strpos(lower(coalesce(email,'')),lower($1))>0) AND ($2='' OR ($2='active' AND is_active) OR ($2='inactive' AND NOT is_active))`, "id", []any{q.Q, q.Status}, scanDonor)
}
func (s *Store) SaveDonor(ctx context.Context, v *domain.Donor) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO donors (type,name,tax_id,contact_name,email,phone,address,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, v.Type, v.Name, v.TaxID, v.ContactName, v.Email, v.Phone, v.Address, v.IsActive, v.CreatedAt, v.UpdatedAt).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE donors SET type=$1,name=$2,tax_id=$3,contact_name=$4,email=$5,phone=$6,address=$7,is_active=$8,created_at=$9,updated_at=$10 WHERE id=$11`, v.Type, v.Name, v.TaxID, v.ContactName, v.Email, v.Phone, v.Address, v.IsActive, v.CreatedAt, v.UpdatedAt, v.ID))
}

const categoryColumns = `id, name, is_perishable`

func scanCategory(row scanner) (domain.ProductCategory, error) {
	var v domain.ProductCategory
	err := row.Scan(&v.ID, &v.Name, &v.IsPerishable)
	return v, translate(err)
}
func (s *Store) Category(ctx context.Context, id int64) (domain.ProductCategory, error) {
	return scanCategory(s.query.QueryRowContext(ctx, "SELECT "+categoryColumns+" FROM product_categories WHERE id=$1"+" FOR SHARE", id))
}
func (s *Store) Categories(ctx context.Context, q domain.PageQuery) (domain.Page[domain.ProductCategory], error) {
	return page(ctx, s, q, "product_categories", categoryColumns, `($1='' OR strpos(lower(coalesce(name,'')),lower($1))>0)`, "id", []any{q.Q}, scanCategory)
}
func (s *Store) SaveCategory(ctx context.Context, v *domain.ProductCategory) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO product_categories (name,is_perishable) VALUES ($1,$2) RETURNING id`, v.Name, v.IsPerishable).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE product_categories SET name=$1,is_perishable=$2 WHERE id=$3`, v.Name, v.IsPerishable, v.ID))
}

const productColumns = `id, category_id, name, unit, is_active, created_at, updated_at`

func scanProduct(row scanner) (domain.Product, error) {
	var v domain.Product
	err := row.Scan(&v.ID, &v.CategoryID, &v.Name, &v.Unit, &v.IsActive, &v.CreatedAt, &v.UpdatedAt)
	return v, translate(err)
}
func (s *Store) Product(ctx context.Context, id int64, forUpdate bool) (domain.Product, error) {
	return scanProduct(s.query.QueryRowContext(ctx, "SELECT "+productColumns+" FROM products WHERE id=$1"+lock(forUpdate), id))
}
func (s *Store) Products(ctx context.Context, q domain.PageQuery) (domain.Page[domain.Product], error) {
	return page(ctx, s, q, "products", productColumns, `($1='' OR strpos(lower(coalesce(name,'')),lower($1))>0) AND ($2='' OR ($2='active' AND is_active) OR ($2='inactive' AND NOT is_active)) AND ($3::bigint=0 OR category_id=$3)`, "id", []any{q.Q, q.Status, q.CategoryID}, scanProduct)
}
func (s *Store) SaveProduct(ctx context.Context, v *domain.Product) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO products (category_id,name,unit,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, v.CategoryID, v.Name, v.Unit, v.IsActive, v.CreatedAt, v.UpdatedAt).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE products SET category_id=$1,name=$2,unit=$3,is_active=$4,created_at=$5,updated_at=$6 WHERE id=$7`, v.CategoryID, v.Name, v.Unit, v.IsActive, v.CreatedAt, v.UpdatedAt, v.ID))
}

const warehouseColumns = `id, name, address, latitude, longitude, is_active, is_cold_storage`

func scanWarehouse(row scanner) (domain.Warehouse, error) {
	var v domain.Warehouse
	err := row.Scan(&v.ID, &v.Name, &v.Address, &v.Latitude, &v.Longitude, &v.IsActive, &v.IsColdStorage)
	return v, translate(err)
}
func (s *Store) Warehouse(ctx context.Context, id int64) (domain.Warehouse, error) {
	return scanWarehouse(s.query.QueryRowContext(ctx, "SELECT "+warehouseColumns+" FROM warehouses WHERE id=$1"+" FOR SHARE", id))
}
func (s *Store) Warehouses(ctx context.Context, q domain.PageQuery) (domain.Page[domain.Warehouse], error) {
	return page(ctx, s, q, "warehouses", warehouseColumns, `($1='' OR strpos(lower(coalesce(name,'')),lower($1))>0 OR strpos(lower(coalesce(address,'')),lower($1))>0) AND ($2='' OR ($2='active' AND is_active) OR ($2='inactive' AND NOT is_active))`, "id", []any{q.Q, q.Status}, scanWarehouse)
}
func (s *Store) SaveWarehouse(ctx context.Context, v *domain.Warehouse) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO warehouses (name,address,latitude,longitude,is_active,is_cold_storage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, v.Name, v.Address, v.Latitude, v.Longitude, v.IsActive, v.IsColdStorage).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE warehouses SET name=$1,address=$2,latitude=$3,longitude=$4,is_active=$5,is_cold_storage=$6 WHERE id=$7`, v.Name, v.Address, v.Latitude, v.Longitude, v.IsActive, v.IsColdStorage, v.ID))
}

const familyColumns = `id, reference_code, contact_name, phone, household_size, address, neighborhood, city, state, postal_code, latitude, longitude, consent_granted_at, consent_revoked_at, privacy_notice_version, is_active, created_at, updated_at`

func scanFamily(row scanner) (domain.Family, error) {
	var v domain.Family
	err := row.Scan(&v.ID, &v.ReferenceCode, &v.ContactName, &v.Phone, &v.HouseholdSize, &v.Address, &v.Neighborhood, &v.City, &v.State, &v.PostalCode, &v.Latitude, &v.Longitude, &v.ConsentGrantedAt, &v.ConsentRevokedAt, &v.PrivacyNoticeVersion, &v.IsActive, &v.CreatedAt, &v.UpdatedAt)
	return v, translate(err)
}
func (s *Store) Family(ctx context.Context, id int64, forUpdate bool) (domain.Family, error) {
	return scanFamily(s.query.QueryRowContext(ctx, "SELECT "+familyColumns+" FROM families WHERE id=$1"+lock(forUpdate), id))
}
func (s *Store) Families(ctx context.Context, q domain.PageQuery) (domain.Page[domain.Family], error) {
	return page(ctx, s, q, "families", familyColumns, `($1='' OR strpos(lower(coalesce(reference_code,'')),lower($1))>0 OR strpos(lower(coalesce(contact_name,'')),lower($1))>0 OR strpos(lower(coalesce(neighborhood,'')),lower($1))>0 OR strpos(lower(coalesce(city,'')),lower($1))>0) AND ($2='' OR ($2='active' AND is_active) OR ($2='inactive' AND NOT is_active))`, "id", []any{q.Q, q.Status}, scanFamily)
}
func (s *Store) SaveFamily(ctx context.Context, v *domain.Family) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO families (reference_code,contact_name,phone,household_size,address,neighborhood,city,state,postal_code,latitude,longitude,consent_granted_at,consent_revoked_at,privacy_notice_version,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`, v.ReferenceCode, v.ContactName, v.Phone, v.HouseholdSize, v.Address, v.Neighborhood, v.City, v.State, v.PostalCode, v.Latitude, v.Longitude, v.ConsentGrantedAt, v.ConsentRevokedAt, v.PrivacyNoticeVersion, v.IsActive, v.CreatedAt, v.UpdatedAt).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE families SET reference_code=$1,contact_name=$2,phone=$3,household_size=$4,address=$5,neighborhood=$6,city=$7,state=$8,postal_code=$9,latitude=$10,longitude=$11,consent_granted_at=$12,consent_revoked_at=$13,privacy_notice_version=$14,is_active=$15,created_at=$16,updated_at=$17 WHERE id=$18`, v.ReferenceCode, v.ContactName, v.Phone, v.HouseholdSize, v.Address, v.Neighborhood, v.City, v.State, v.PostalCode, v.Latitude, v.Longitude, v.ConsentGrantedAt, v.ConsentRevokedAt, v.PrivacyNoticeVersion, v.IsActive, v.CreatedAt, v.UpdatedAt, v.ID))
}

const partnerColumns = `id, name, tax_id, contact_name, phone, address, latitude, longitude, is_active, created_at, updated_at`

func scanPartner(row scanner) (domain.PartnerOrganization, error) {
	var v domain.PartnerOrganization
	err := row.Scan(&v.ID, &v.Name, &v.TaxID, &v.ContactName, &v.Phone, &v.Address, &v.Latitude, &v.Longitude, &v.IsActive, &v.CreatedAt, &v.UpdatedAt)
	return v, translate(err)
}
func (s *Store) Partner(ctx context.Context, id int64) (domain.PartnerOrganization, error) {
	return scanPartner(s.query.QueryRowContext(ctx, "SELECT "+partnerColumns+" FROM partner_organizations WHERE id=$1"+" FOR SHARE", id))
}
func (s *Store) Partners(ctx context.Context, q domain.PageQuery) (domain.Page[domain.PartnerOrganization], error) {
	return page(ctx, s, q, "partner_organizations", partnerColumns, `($1='' OR strpos(lower(coalesce(name,'')),lower($1))>0 OR strpos(lower(coalesce(tax_id,'')),lower($1))>0) AND ($2='' OR ($2='active' AND is_active) OR ($2='inactive' AND NOT is_active))`, "id", []any{q.Q, q.Status}, scanPartner)
}
func (s *Store) SavePartner(ctx context.Context, v *domain.PartnerOrganization) error {
	if v.ID == 0 {
		return translate(s.query.QueryRowContext(ctx, `INSERT INTO partner_organizations (name,tax_id,contact_name,phone,address,latitude,longitude,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, v.Name, v.TaxID, v.ContactName, v.Phone, v.Address, v.Latitude, v.Longitude, v.IsActive, v.CreatedAt, v.UpdatedAt).Scan(&v.ID))
	}
	return changed(s.query.ExecContext(ctx, `UPDATE partner_organizations SET name=$1,tax_id=$2,contact_name=$3,phone=$4,address=$5,latitude=$6,longitude=$7,is_active=$8,created_at=$9,updated_at=$10 WHERE id=$11`, v.Name, v.TaxID, v.ContactName, v.Phone, v.Address, v.Latitude, v.Longitude, v.IsActive, v.CreatedAt, v.UpdatedAt, v.ID))
}
