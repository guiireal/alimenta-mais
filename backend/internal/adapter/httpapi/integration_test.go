package httpapi_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"alimenta-mais/backend/internal/adapter/httpapi"
	"alimenta-mais/backend/internal/adapter/postgres"
	"alimenta-mais/backend/internal/adapter/security"
	"alimenta-mais/backend/internal/domain"
	"alimenta-mais/backend/internal/testutil"
	"alimenta-mais/backend/internal/usecase"
)

type apiTest struct {
	t       *testing.T
	handler http.Handler
	db      *sql.DB
	token   string
	logs    *bytes.Buffer
}

func setup(t *testing.T) *apiTest {
	t.Helper()
	db := testutil.Database(t)
	store := postgres.New(db)
	repos := store.Repositories()
	passwords := security.Passwords{}
	dummy, err := passwords.Hash("Dummy123456")
	if err != nil {
		t.Fatal(err)
	}
	tokens, err := security.NewTokens("test-key-for-jwt-with-at-least-32-bytes")
	if err != nil {
		t.Fatal(err)
	}
	auth := &usecase.Auth{Users: repos.Users, Sessions: repos.Sessions, Tx: store, Passwords: passwords, DummyHash: dummy, Tokens: tokens}
	if err := auth.Bootstrap(context.Background(), usecase.RegisterInput{Name: "Administrator", Email: "admin@example.test", Password: "Secret1234"}); err != nil {
		t.Fatal(err)
	}
	s := httpapi.Services{Auth: auth, Access: &usecase.Access{Tx: store}, Catalog: &usecase.Catalog{Tx: store}, Donations: &usecase.Donations{Tx: store}, Stock: &usecase.Stock{Tx: store}, Deliveries: &usecase.Deliveries{Tx: store}, Read: &usecase.Read{Repos: repos}}
	logs := new(bytes.Buffer)
	a := &apiTest{t: t, db: db, logs: logs, handler: httpapi.New(s, slog.New(slog.NewTextHandler(logs, nil)), "http://localhost:5173", db.PingContext, httpapi.CookieOptions{Secure: false})}
	var login usecase.LoginResult
	a.call("POST", "/auth/login", usecase.Credentials{Email: "ADMIN@example.test", Password: "Secret1234"}, 200, &login)
	a.token = login.Token
	return a
}
func (a *apiTest) request(method, path string, body any) *httptest.ResponseRecorder {
	a.t.Helper()
	var input io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			a.t.Fatal(err)
		}
		input = bytes.NewReader(data)
	}
	r := httptest.NewRequest(method, "/api"+path, input)
	r.RemoteAddr = "127.0.0.1:12345"
	r.Header.Set("Content-Type", "application/json")
	if a.token != "" {
		r.Header.Set("Authorization", "Bearer "+a.token)
	}
	w := httptest.NewRecorder()
	a.handler.ServeHTTP(w, r)
	return w
}
func (a *apiTest) call(method, path string, body any, status int, out any) {
	a.t.Helper()
	w := a.request(method, path, body)
	if w.Code != status {
		logs := a.logs.String()
		if len(logs) > 2000 {
			logs = logs[len(logs)-2000:]
		}
		a.t.Fatalf("%s %s: want %d got %d: %s\n%s", method, path, status, w.Code, w.Body.String(), logs)
	}
	if out != nil {
		if err := json.Unmarshal(w.Body.Bytes(), out); err != nil {
			a.t.Fatal(err)
		}
		if login, ok := out.(*usecase.LoginResult); ok {
			for _, c := range w.Result().Cookies() {
				if c.Name == httpapi.AccessCookie {
					login.Token = c.Value
				}
			}
		}
	}
}
func idPath(resource string, id int64) string { return fmt.Sprintf("/%s/%d", resource, id) }
func (a *apiTest) catalog() (domain.Product, domain.Warehouse, domain.Warehouse, domain.Donor, domain.Family) {
	a.t.Helper()
	var category domain.ProductCategory
	var product domain.Product
	var first, second domain.Warehouse
	var donor domain.Donor
	var family domain.Family
	a.call("POST", "/categories", usecase.CategoryInput{Name: "Grãos"}, 201, &category)
	a.call("POST", "/products", usecase.ProductInput{CategoryID: category.ID, Name: "Arroz", Unit: "kg"}, 201, &product)
	a.call("POST", "/warehouses", usecase.WarehouseInput{Name: "Central"}, 201, &first)
	a.call("POST", "/warehouses", usecase.WarehouseInput{Name: "Secundário"}, 201, &second)
	a.call("POST", "/donors", usecase.DonorInput{Type: domain.DonorTypeIndividual, Name: "Doador"}, 201, &donor)
	a.call("POST", "/families", usecase.FamilyInput{ReferenceCode: "F-1", ContactName: "Família", HouseholdSize: 3, Address: "Rua A", Neighborhood: "Centro", City: "São Paulo", State: "SP"}, 201, &family)
	a.call("PUT", idPath("families", family.ID)+"/consent", map[string]any{"granted": true, "privacy_notice_version": "v1"}, 200, &family)
	if !product.IsActive || !first.IsActive || !donor.IsActive || !family.IsActive {
		a.t.Fatal("cadastros deveriam iniciar ativos")
	}
	return product, first, second, donor, family
}
func TestAPIWorkflow(t *testing.T) {
	a := setup(t)
	product, warehouse, second, donor, family := a.catalog()
	expires := domain.Date(time.Now().UTC().AddDate(0, 0, 10).Format("2006-01-02"))
	later := domain.Date(time.Now().UTC().AddDate(0, 0, 20).Format("2006-01-02"))
	received := time.Now().UTC().Truncate(time.Microsecond).Add(-time.Hour).In(time.FixedZone("BRT", -3*60*60))
	var donation domain.DonationDetail
	a.call("POST", "/donations", usecase.DonationInput{DonorID: donor.ID, ReceivedAt: received, Items: []usecase.BatchInput{{ProductID: product.ID, BatchCode: "EARLY", Quantity: "10.000", UnitWeightKg: "1", ExpiresOn: &expires, WarehouseID: warehouse.ID, TriageStatus: domain.TriageStatusApproved}, {ProductID: product.ID, BatchCode: "LATER", Quantity: "10", UnitWeightKg: "1", ExpiresOn: &later, WarehouseID: warehouse.ID, TriageStatus: domain.TriageStatusPending}}}, 201, &donation)
	a.call("GET", idPath("donations", donation.Donation.ID), nil, 200, &donation)
	if donation.Donation.ReceivedAt == nil || !donation.Donation.ReceivedAt.Equal(received) {
		t.Fatal("instante de recebimento não foi preservado em UTC")
	}
	a.call("POST", idPath("donations", donation.Donation.ID)+"/confirm", nil, 409, nil)
	a.call("POST", idPath("batches", donation.Batches[1].ID)+"/triage", usecase.TriageInput{Status: domain.TriageStatusApproved, WarehouseID: warehouse.ID}, 201, nil)
	a.call("POST", idPath("batches", donation.Batches[1].ID)+"/triage", usecase.TriageInput{Status: domain.TriageStatusApproved, WarehouseID: warehouse.ID}, 409, nil)
	a.call("POST", idPath("donations", donation.Donation.ID)+"/confirm", nil, 200, nil)
	a.call("POST", idPath("donations", donation.Donation.ID)+"/confirm", nil, 409, nil)
	var route domain.DeliveryRoute
	a.call("POST", "/routes", usecase.RouteInput{ReferenceCode: "R-1", OriginWarehouseID: warehouse.ID, ScheduledOn: domain.Today(), AssignedTo: &donation.Donation.CreatedBy}, 201, &route)
	a.call("PUT", idPath("routes", route.ID), usecase.RouteInput{ReferenceCode: "R-1", OriginWarehouseID: warehouse.ID, ScheduledOn: domain.Today(), AssignedTo: &donation.Donation.CreatedBy}, 200, &route)
	stop := int32(1)
	var delivery domain.DeliveryDetail
	a.call("POST", "/deliveries", usecase.DeliveryInput{FamilyID: &family.ID, RouteID: &route.ID, StopSequence: &stop, SourceWarehouseID: warehouse.ID, DestinationAddress: family.Address, Items: []usecase.RequestedItem{{ProductID: product.ID, Quantity: "12"}}}, 201, &delivery)
	if len(delivery.Items) != 2 || delivery.Items[0].BatchID != donation.Batches[0].ID || delivery.Items[0].Quantity != "10.000" {
		t.Fatalf("FEFO incorreto: %+v", delivery.Items)
	}
	a.call("PUT", idPath("deliveries", delivery.Delivery.ID), usecase.DeliveryInput{FamilyID: &family.ID, RouteID: &route.ID, StopSequence: &stop, SourceWarehouseID: warehouse.ID, DestinationAddress: family.Address, Items: []usecase.RequestedItem{{ProductID: product.ID, Quantity: "12"}}}, 200, &delivery)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/dispatch", nil, 409, nil)
	a.call("PUT", idPath("routes", route.ID)+"/status", map[string]string{"status": "in_transit"}, 200, nil)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/dispatch", nil, 200, &delivery)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/dispatch", nil, 409, nil)
	a.call("PUT", idPath("routes", route.ID)+"/status", map[string]string{"status": "completed"}, 409, nil)
	a.call("PUT", idPath("deliveries", delivery.Delivery.ID)+"/status", map[string]string{"status": "delivered"}, 200, nil)
	a.call("PUT", idPath("routes", route.ID)+"/status", map[string]string{"status": "completed"}, 200, nil)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/returns", usecase.ReturnInput{DeliveryItemID: delivery.Items[0].ID, WarehouseID: warehouse.ID, Quantity: "1", Reason: "Sobra devolvida"}, 201, nil)
	a.call("POST", idPath("deliveries", delivery.Delivery.ID)+"/returns", usecase.ReturnInput{DeliveryItemID: delivery.Items[0].ID, WarehouseID: warehouse.ID, Quantity: "10", Reason: "Repetição inválida"}, 409, nil)
	a.call("POST", idPath("batches", donation.Batches[1].ID)+"/movements", usecase.MovementInput{Type: domain.StockMovementTypeTransfer, Quantity: "3", FromWarehouseID: &warehouse.ID, ToWarehouseID: &second.ID}, 201, nil)
	a.call("POST", idPath("batches", donation.Batches[1].ID)+"/movements", usecase.MovementInput{Type: domain.StockMovementTypeTransfer, Quantity: "100", FromWarehouseID: &warehouse.ID, ToWarehouseID: &second.ID}, 409, nil)
	var report domain.Report
	a.call("GET", "/reports", nil, 200, &report)
	if report.DonatedKg != "20.000000" || report.DistributedKg != "11.000000" || report.CoveragePct != "100.00" {
		t.Fatalf("relatório incorreto: %+v", report)
	}
	for _, path := range []string{"/dashboard", "/stock/stats", "/stock/movements", "/search?q=Ar", "/audit", "/users", "/donors", "/categories", "/products", "/warehouses", "/families", "/partners", "/batches", "/donations", "/routes", "/deliveries", idPath("batches", donation.Batches[0].ID), idPath("donations", donation.Donation.ID), idPath("routes", route.ID), idPath("deliveries", delivery.Delivery.ID)} {
		a.call("GET", path, nil, 200, nil)
	}
	var negative int
	if err := a.db.QueryRow(`SELECT count(*) FROM stock_balances WHERE quantity<0`).Scan(&negative); err != nil {
		t.Fatal(err)
	}
	if negative != 0 {
		t.Fatal("saldo negativo")
	}
	var sessions int
	if err := a.db.QueryRow(`SELECT count(*) FROM sessions WHERE id=$1`, a.token).Scan(&sessions); err != nil {
		t.Fatal(err)
	}
	if sessions != 0 {
		t.Fatal("token salvo em texto puro")
	}
}
func TestAuthenticationAndBoundaries(t *testing.T) {
	a := setup(t)
	adminToken := a.token
	var user domain.User
	a.call("POST", "/auth/register", map[string]string{"name": "Operator", "email": "operator@example.test", "password": "Secret1234", "role": "administrator"}, 422, nil)
	a.call("POST", "/auth/register", usecase.RegisterInput{Name: "Operator", Email: "operator@example.test", Password: "Secret1234"}, 201, &user)
	if user.Role != domain.UserRoleOperator {
		t.Fatal("autocadastro com privilégio indevido")
	}
	a.call("POST", "/auth/register", usecase.RegisterInput{Name: "Operator", Email: "OPERATOR@example.test", Password: "Secret1234"}, 409, nil)
	var login usecase.LoginResult
	a.call("POST", "/auth/login", usecase.Credentials{Email: user.Email, Password: "wrong"}, 401, nil)
	a.call("POST", "/auth/login", usecase.Credentials{Email: user.Email, Password: "Secret1234"}, 200, &login)
	a.token = login.Token
	a.call("GET", "/auth/me", nil, 200, nil)
	a.call("GET", "/families", nil, 403, nil)
	a.call("GET", "/reports", nil, 403, nil)
	a.call("POST", "/warehouses", usecase.WarehouseInput{Name: "Forbidden"}, 403, nil)
	var search domain.SearchResult
	a.call("GET", "/search?q=te", nil, 200, &search)
	if len(search.Families) != 0 {
		t.Fatal("busca expôs famílias")
	}
	a.call("POST", "/auth/logout", nil, 204, nil)
	a.call("GET", "/auth/me", nil, 401, nil)
	a.token = adminToken
	a.call("PUT", idPath("users", user.ID)+"/access", usecase.UserAccessInput{Role: domain.UserRoleManager, IsActive: true}, 200, nil)
	a.token = login.Token
	a.call("GET", "/auth/me", nil, 401, nil)
	a.token = adminToken
	for _, path := range []string{"/batches?page=0", "/batches?page_size=101", "/donors/nope", "/search?q=x", "/reports?from=invalid"} {
		a.call("GET", path, nil, 422, nil)
	}
	a.call("GET", "/donors/99999", nil, 404, nil)
	w := a.request("GET", "/auth/me", nil)
	if strings.Contains(w.Body.String(), "password") || strings.Contains(w.Body.String(), "$2a$") {
		t.Fatal("resposta contém senha ou hash")
	}
	r := httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{"email":"one"} {"email":"two"}`))
	r.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	a.handler.ServeHTTP(w, r)
	if w.Code != 422 {
		t.Fatal(w.Code)
	}
	r = httptest.NewRequest("GET", "/health/live", nil)
	r.Header.Set("Origin", "https://evil.test")
	w = httptest.NewRecorder()
	a.handler.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("CORS permitiu origem indevida")
	}
	for _, path := range []string{"/", "/health/live", "/health/ready"} {
		r = httptest.NewRequest("GET", path, nil)
		w = httptest.NewRecorder()
		a.handler.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatal(path, w.Code)
		}
	}
}
func TestConcurrentWithdrawals(t *testing.T) {
	a := setup(t)
	product, warehouse, _, _, _ := a.catalog()
	expires := domain.Date(time.Now().UTC().AddDate(0, 0, 10).Format("2006-01-02"))
	var batch domain.InventoryBatch
	a.call("POST", "/batches", usecase.BatchInput{ProductID: product.ID, BatchCode: "RACE", Quantity: "10", UnitWeightKg: "1", ExpiresOn: &expires, WarehouseID: warehouse.ID}, 201, &batch)
	var wg sync.WaitGroup
	statuses := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			reason := "Avaria"
			w := a.request("POST", idPath("batches", batch.ID)+"/movements", usecase.MovementInput{Type: domain.StockMovementTypeOtherLoss, Quantity: "7", FromWarehouseID: &warehouse.ID, Reason: &reason})
			statuses <- w.Code
		}()
	}
	wg.Wait()
	close(statuses)
	ok, conflict := 0, 0
	for status := range statuses {
		if status == 201 {
			ok++
		}
		if status == 409 {
			conflict++
		}
	}
	if ok != 1 || conflict != 1 {
		t.Fatalf("baixas concorrentes: ok=%d conflicts=%d", ok, conflict)
	}
	var balance string
	if err := a.db.QueryRow(`SELECT quantity FROM stock_balances WHERE batch_id=$1 AND warehouse_id=$2`, batch.ID, warehouse.ID).Scan(&balance); err != nil || balance != "3.000" {
		t.Fatalf("saldo: %s err=%v", balance, err)
	}
}
