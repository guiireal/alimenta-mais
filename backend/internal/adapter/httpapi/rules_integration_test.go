package httpapi_test

import (
	"fmt"
	"testing"
	"time"

	"alimenta-mais/backend/internal/domain"
	"alimenta-mais/backend/internal/usecase"
)

func TestRollbackAndFoodSafety(t *testing.T) {
	a := setup(t)
	product, warehouse, _, donor, _ := a.catalog()
	expires := domain.Date(time.Now().UTC().AddDate(0, 0, 10).Format("2006-01-02"))
	yesterday := domain.Date(time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02"))
	received := time.Now().UTC().Add(-time.Hour)
	valid := usecase.BatchInput{ProductID: product.ID, BatchCode: "VALID", Quantity: "5", UnitWeightKg: "1", ExpiresOn: &expires, WarehouseID: warehouse.ID, TriageStatus: domain.TriageStatusApproved}
	invalid := valid
	invalid.ProductID = 99999
	a.call("POST", "/donations", usecase.DonationInput{DonorID: donor.ID, ReceivedAt: received, Items: []usecase.BatchInput{valid, invalid}}, 404, nil)
	for _, table := range []string{"donations", "inventory_batches", "stock_movements"} {
		var count int
		if err := a.db.QueryRow("SELECT count(*) FROM " + table).Scan(&count); err != nil || count != 0 {
			t.Fatalf("rollback de %s: count=%d err=%v", table, count, err)
		}
	}
	var perishable domain.ProductCategory
	a.call("POST", "/categories", usecase.CategoryInput{Name: "Laticínios", IsPerishable: true}, 201, &perishable)
	var milk domain.Product
	a.call("POST", "/products", usecase.ProductInput{CategoryID: perishable.ID, Name: "Leite", Unit: "un"}, 201, &milk)
	item := usecase.BatchInput{ProductID: milk.ID, BatchCode: "MILK", Quantity: "5", UnitWeightKg: "0.500000", ExpiresOn: &expires, WarehouseID: warehouse.ID}
	a.call("POST", "/batches", item, 422, nil)
	var cold domain.Warehouse
	a.call("POST", "/warehouses", usecase.WarehouseInput{Name: "Câmara", IsColdStorage: true}, 201, &cold)
	item.WarehouseID = cold.ID
	item.Quantity = "1.5"
	a.call("POST", "/batches", item, 422, nil)
	item.Quantity = "5"
	item.ExpiresOn = &yesterday
	a.call("POST", "/batches", item, 422, nil)
	item.ExpiresOn = &expires
	var batch domain.InventoryBatch
	a.call("POST", "/batches", item, 201, &batch)
	a.call("PUT", idPath("products", milk.ID), usecase.ProductInput{CategoryID: perishable.ID, Name: "Leite", Unit: "kg"}, 409, nil)
	a.call("PUT", idPath("categories", perishable.ID), usecase.CategoryInput{Name: "Laticínios", IsPerishable: false}, 409, nil)
	a.call("PUT", idPath("warehouses", cold.ID), usecase.WarehouseInput{Name: "Câmara", IsColdStorage: false}, 409, nil)
	reason := "Avaria"
	a.call("POST", idPath("batches", batch.ID)+"/movements", usecase.MovementInput{Type: domain.StockMovementTypeOtherLoss, Quantity: "1", FromWarehouseID: &cold.ID}, 422, nil)
	a.call("POST", idPath("batches", batch.ID)+"/movements", usecase.MovementInput{Type: domain.StockMovementTypeExpirationLoss, Quantity: "1", FromWarehouseID: &cold.ID, Reason: &reason}, 409, nil)
	if _, err := a.db.Exec(`UPDATE inventory_batches SET expires_on=$1 WHERE id=$2`, yesterday, batch.ID); err != nil {
		t.Fatal(err)
	}
	a.call("POST", idPath("batches", batch.ID)+"/movements", usecase.MovementInput{Type: domain.StockMovementTypeExpirationLoss, Quantity: "1", FromWarehouseID: &cold.ID, Reason: &reason}, 201, nil)
	var report domain.Report
	a.call("GET", "/reports", nil, 200, &report)
	if report.LossKg != "0.500000" || len(report.LossByCategory) != 1 || report.LossByCategory[0].Kg != "0.500000" {
		t.Fatalf("peso da perda: %+v", report)
	}
	var auditCount int
	if err := a.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE action='donation.received'`).Scan(&auditCount); err != nil || auditCount != 0 {
		t.Fatal("auditoria de transação revertida persistiu", err)
	}
}
func TestConsentAndReturns(t *testing.T) {
	a := setup(t)
	product, warehouse, _, _, family := a.catalog()
	expires := domain.Date(time.Now().UTC().AddDate(0, 0, 10).Format("2006-01-02"))
	var batch domain.InventoryBatch
	a.call("POST", "/batches", usecase.BatchInput{ProductID: product.ID, BatchCode: "B1", Quantity: "5", UnitWeightKg: "1", ExpiresOn: &expires, WarehouseID: warehouse.ID}, 201, &batch)
	var delivery domain.DeliveryDetail
	a.call("POST", "/deliveries", usecase.DeliveryInput{FamilyID: &family.ID, SourceWarehouseID: warehouse.ID, DestinationAddress: family.Address, Items: []usecase.RequestedItem{{ProductID: product.ID, Quantity: "2"}}}, 201, &delivery)
	a.call("PUT", idPath("families", family.ID)+"/consent", map[string]any{"granted": false}, 200, nil)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/dispatch", nil, 409, nil)
	var count int
	if err := a.db.QueryRow(`SELECT count(*) FROM stock_movements WHERE type='distribution'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("despacho sem consentimento baixou estoque", err)
	}
	a.call("PUT", idPath("families", family.ID)+"/consent", map[string]any{"granted": true, "privacy_notice_version": "v2"}, 200, nil)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/dispatch", nil, 200, &delivery)
	a.call("PUT", idPath("deliveries", delivery.Delivery.ID)+"/status", map[string]string{"status": "failed", "reason": "Destinatário ausente"}, 200, nil)
	a.call("PUT", idPath("deliveries", delivery.Delivery.ID)+"/status", map[string]string{"status": "delivered"}, 409, nil)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/returns", usecase.ReturnInput{DeliveryItemID: delivery.Items[0].ID, WarehouseID: warehouse.ID, Quantity: "2", Reason: "Retorno ao depósito"}, 201, nil)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/returns", usecase.ReturnInput{DeliveryItemID: delivery.Items[0].ID, WarehouseID: warehouse.ID, Quantity: "2", Reason: "Repetição"}, 409, nil)
	var balances string
	if err := a.db.QueryRow(`SELECT quantity FROM stock_balances WHERE batch_id=$1`, batch.ID).Scan(&balances); err != nil || balances != "5.000" {
		t.Fatal(balances, err)
	}
}
func TestPasswordAndSessionRevocation(t *testing.T) {
	a := setup(t)
	var user domain.User
	a.call("POST", "/auth/register", usecase.RegisterInput{Name: "Person", Email: "person@example.test", Password: "Secret1234"}, 201, &user)
	var login usecase.LoginResult
	a.call("POST", "/auth/login", usecase.Credentials{Email: user.Email, Password: "Secret1234"}, 200, &login)
	a.token = login.Token
	a.call("PUT", "/auth/password", map[string]string{"current_password": "wrong", "password": "NewSecret123"}, 422, nil)
	a.call("GET", "/auth/me", nil, 200, nil)
	a.call("PUT", "/auth/password", map[string]string{"current_password": "Secret1234", "password": "NewSecret123"}, 204, nil)
	a.call("GET", "/auth/me", nil, 401, nil)
	a.call("POST", "/auth/login", usecase.Credentials{Email: user.Email, Password: "Secret1234"}, 401, nil)
	a.call("POST", "/auth/login", usecase.Credentials{Email: user.Email, Password: "NewSecret123"}, 200, &login)
	a.token = login.Token
	if _, err := a.db.Exec(`UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1`, user.ID); err != nil {
		t.Fatal(err)
	}
	a.call("GET", "/auth/me", nil, 401, nil)
	var hashes int
	if err := a.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE before_values LIKE '%password_hash%' OR after_values LIKE '%password_hash%' OR before_values LIKE '%NewSecret%' OR after_values LIKE '%NewSecret%'`).Scan(&hashes); err != nil || hashes != 0 {
		t.Fatal("auditoria expôs credenciais", err)
	}
	if user.PasswordHash != "" {
		t.Fatal(fmt.Sprintf("hash apareceu na resposta do usuário %d", user.ID))
	}
}
