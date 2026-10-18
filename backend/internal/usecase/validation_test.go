package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"alimenta-mais/backend/internal/domain"
)

func TestUseCasesDenyUnauthorizedBeforePersistence(t *testing.T) {
	a := domain.Actor{User: domain.User{ID: 1, IsActive: true, Role: domain.UserRoleOperator}}
	ctx := context.Background()
	for name, call := range map[string]func() error{
		"donor":    func() error { _, err := (&Catalog{}).SaveDonor(ctx, a, 0, DonorInput{}); return err },
		"family":   func() error { _, err := (&Catalog{}).SaveFamily(ctx, a, 0, FamilyInput{}); return err },
		"stock":    func() error { _, err := (&Stock{}).Create(ctx, a, BatchInput{}); return err },
		"delivery": func() error { _, err := (&Deliveries{}).Save(ctx, a, 0, DeliveryInput{}); return err },
		"route":    func() error { _, err := (&Deliveries{}).SaveRoute(ctx, a, 0, RouteInput{}); return err },
		"access":   func() error { _, err := (&Access{}).Update(ctx, a, 2, UserAccessInput{}); return err },
		"report":   func() error { _, err := (&Read{}).Report(ctx, a, time.Time{}, time.Time{}); return err },
	} {
		t.Run(name, func(t *testing.T) {
			if err := call(); !errors.Is(err, domain.ErrForbidden) {
				t.Fatal(err)
			}
		})
	}
}
func TestPasswordValidation(t *testing.T) {
	for _, password := range []string{"", "short1", "abcdefgh", "12345678"} {
		v := validation{}
		v.password(password)
		if v.err() == nil {
			t.Errorf("aceitou %q", password)
		}
	}
	v := validation{}
	v.password("Valid1234")
	if v.err() != nil {
		t.Fatal(v)
	}
}
