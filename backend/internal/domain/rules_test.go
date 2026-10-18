package domain

import "testing"

func TestDecimalPrecision(t *testing.T) {
	for _, test := range []struct {
		input Decimal
		scale int
		want  int64
	}{{"0.001", 3, 1}, {"1.234", 3, 1234}, {"999999999.999", 3, 999999999999}, {"-23.550520", 6, -23550520}, {"1", 6, 1000000}} {
		got, err := test.input.Scaled(test.scale)
		if err != nil || got != test.want {
			t.Fatalf("%s: got=%d err=%v", test.input, got, err)
		}
	}
	for _, input := range []Decimal{"", "NaN", "Infinity", "1e3", "1.0001", "1.", ".5", "+1", "1..2", " 1", "999999999999999999999999"} {
		if _, err := input.Scaled(3); err == nil {
			t.Errorf("aceitou %q", input)
		}
	}
	for _, input := range []Decimal{"0", "-1", "1000000000", "NaN", "0.0001"} {
		if _, err := PositiveQuantity(input); err == nil {
			t.Errorf("quantidade inválida: %q", input)
		}
	}
	if got := Quantity(1234); got != "1.234" {
		t.Fatal(got)
	}
}
func TestPermissions(t *testing.T) {
	for _, test := range []struct {
		role UserRole
		p    Permission
		want bool
	}{{UserRoleAdministrator, WriteAccess, true}, {UserRoleManager, WriteAccess, false}, {UserRoleManager, WriteDeliveries, true}, {UserRoleOperator, ReadStock, true}, {UserRoleOperator, WriteDonations, true}, {UserRoleOperator, ReadFamilies, false}, {UserRoleOperator, ReadReports, false}, {"unknown", ReadStock, false}} {
		a := Actor{User: User{Role: test.role, IsActive: true}}
		if a.Can(test.p) != test.want {
			t.Errorf("%s %s", test.role, test.p)
		}
		a.User.IsActive = false
		if a.Can(test.p) {
			t.Error("usuário inativo autorizado")
		}
	}
}
func TestDatesAndPagination(t *testing.T) {
	if !Date("2026-10-17").Valid() || Date("2026-02-30").Valid() || Date("17/10/2026").Valid() || Date("0000-01-01").Valid() {
		t.Fatal("datas inválidas")
	}
	for _, q := range []PageQuery{{Page: 0, PageSize: 10}, {Page: 1, PageSize: 101}, {Page: 1000001, PageSize: 10}} {
		if q.Valid() {
			t.Fatalf("aceitou %+v", q)
		}
	}
}
