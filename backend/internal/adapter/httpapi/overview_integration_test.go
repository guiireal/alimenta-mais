package httpapi_test

import (
	"alimenta-mais/backend/internal/domain"
	"alimenta-mais/backend/internal/usecase"
	"fmt"
	"testing"
	"time"
)

func TestFrontendReadProjections(t *testing.T) {
	a := setup(t)
	p, w, _, donor, family := a.catalog()
	expires := domain.Date(time.Now().UTC().AddDate(0, 0, 10).Format("2006-01-02"))
	var donation domain.DonationDetail
	a.call("POST", "/donations", usecase.DonationInput{DonorID: donor.ID, ReceivedAt: time.Now().UTC().Add(-time.Hour), Items: []usecase.BatchInput{{ProductID: p.ID, BatchCode: "ABC", Quantity: "1.001", UnitWeightKg: "1", ExpiresOn: &expires, WarehouseID: w.ID, TriageStatus: domain.TriageStatusApproved}}}, 201, &donation)
	var inventory domain.Page[domain.InventoryLot]
	a.call("GET", fmt.Sprintf("/inventory?category_id=%d&sort=quantity&dir=desc&page_size=1", p.CategoryID), nil, 200, &inventory)
	if inventory.Total != 1 || inventory.Items[0].Quantity != "1.001" || inventory.Items[0].ProductName != "Arroz" || len(inventory.Items[0].Balances) != 1 {
		t.Fatalf("inventory projection wrong: %+v", inventory)
	}
	var lot domain.InventoryLot
	a.call("GET", idPath("inventory", donation.Batches[0].ID), nil, 200, &lot)
	if lot.CreatedAt.IsZero() || lot.UnitWeightKg != "1.000000" {
		t.Fatalf("incorrect precision/timestamp: %+v", lot)
	}
	a.call("GET", "/inventory?sort=quantity;drop", nil, 422, nil)
	var donors domain.Page[domain.DonorOverview]
	a.call("GET", fmt.Sprintf("/overview/donors?donor_id=%d", donor.ID), nil, 200, &donors)
	if len(donors.Items) != 1 || donors.Items[0].DonationsCount != 1 || donors.Items[0].TotalKg != "1.001000000" || donors.Items[0].LastDonationAt == nil {
		t.Fatalf("donor projection wrong: %+v", donors)
	}
	var donations domain.Page[domain.DonationOverview]
	a.call("GET", fmt.Sprintf("/overview/donations?donor_id=%d", donor.ID), nil, 200, &donations)
	if donations.Total != 1 || donations.Items[0].DonorName != "Doador" {
		t.Fatalf("donation projection wrong: %+v", donations)
	}
	var families domain.Page[domain.FamilyOverview]
	a.call("GET", "/overview/families?status=granted", nil, 200, &families)
	if families.Total != 1 || families.Items[0].ID != family.ID {
		t.Fatalf("family projection wrong: %+v", families)
	}
	var route domain.DeliveryRoute
	a.call("POST", "/routes", usecase.RouteInput{ReferenceCode: "R1", OriginWarehouseID: w.ID, ScheduledOn: domain.Today()}, 201, &route)
	stop := int32(1)
	a.call("POST", "/deliveries", usecase.DeliveryInput{FamilyID: &family.ID, RouteID: &route.ID, SourceWarehouseID: w.ID, StopSequence: &stop, DestinationAddress: family.Address, Items: []usecase.RequestedItem{{ProductID: p.ID, Quantity: "1"}}}, 201, nil)
	var routes domain.Page[domain.RouteOverview]
	a.call("GET", "/overview/routes", nil, 200, &routes)
	if routes.Total != 1 || len(routes.Items[0].Stops) != 1 || routes.Items[0].WarehouseName != "Central" {
		t.Fatalf("route projection wrong: %+v", routes)
	}
	a.token = ""
	var session usecase.LoginResult
	a.call("POST", "/auth/register", usecase.RegisterInput{Name: "Operator", Email: "op@example.test", Password: "Secret1234"}, 201, nil)
	a.call("POST", "/auth/login", usecase.Credentials{Email: "op@example.test", Password: "Secret1234"}, 200, &session)
	a.token = session.Token
	for _, path := range []string{"/inventory", "/overview/donors", "/overview/donations"} {
		a.call("GET", path, nil, 200, nil)
	}
	for _, path := range []string{"/overview/families", "/overview/routes"} {
		a.call("GET", path, nil, 403, nil)
	}
}
