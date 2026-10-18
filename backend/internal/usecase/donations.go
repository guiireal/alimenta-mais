package usecase

import (
	"context"
	"sort"
	"time"

	"alimenta-mais/backend/internal/domain"
)

type Donations struct{ Tx UnitOfWork }
type DonationInput struct {
	DonorID           int64        `json:"donor_id"`
	ReceivedAt        time.Time    `json:"received_at"`
	DocumentReference *string      `json:"document_reference"`
	DocumentPath      *string      `json:"document_path"`
	Notes             *string      `json:"notes"`
	Items             []BatchInput `json:"items"`
}

func (s *Donations) Create(ctx context.Context, a domain.Actor, in DonationInput) (domain.DonationDetail, error) {
	if err := domain.Require(a, domain.WriteDonations); err != nil {
		return domain.DonationDetail{}, err
	}
	v := validation{}
	v.id("donor_id", in.DonorID)
	v.optional("document_reference", in.DocumentReference, 150)
	v.optional("document_path", in.DocumentPath, 500)
	v.optional("notes", in.Notes, 10000)
	if in.ReceivedAt.IsZero() || in.ReceivedAt.Year() < 1 || in.ReceivedAt.After(time.Now().UTC()) {
		v["received_at"] = "data de recebimento inválida ou futura"
	}
	if len(in.Items) == 0 || len(in.Items) > 100 {
		v["items"] = "informe de 1 a 100 itens"
	}
	if err := v.err(); err != nil {
		return domain.DonationDetail{}, err
	}
	in.ReceivedAt = in.ReceivedAt.UTC()
	for i := range in.Items {
		if in.Items[i].TriageStatus == "" {
			in.Items[i].TriageStatus = domain.TriageStatusPending
		}
		if err := validateBatch(in.Items[i]); err != nil {
			return domain.DonationDetail{}, err
		}
	}
	sort.SliceStable(in.Items, func(i, j int) bool { return in.Items[i].ProductID < in.Items[j].ProductID })
	var out domain.DonationDetail
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		donor, err := r.Catalog.Donor(ctx, in.DonorID)
		if err != nil {
			return err
		}
		if !donor.IsActive {
			return conflict("doador inativo")
		}
		now := time.Now().UTC()
		d := domain.Donation{DonorID: in.DonorID, Status: domain.DonationStatusInTriage, ReceivedAt: &in.ReceivedAt, DocumentReference: in.DocumentReference, DocumentPath: in.DocumentPath, Notes: in.Notes, CreatedBy: a.User.ID, CreatedAt: now, UpdatedAt: now}
		if err := r.Donations.SaveDonation(ctx, &d); err != nil {
			return err
		}
		batches := make([]domain.InventoryBatch, 0, len(in.Items))
		pending := false
		for _, item := range in.Items {
			b, err := createBatch(ctx, r, a, &d.ID, item)
			if err != nil {
				return err
			}
			batches = append(batches, b)
			pending = pending || b.TriageStatus == domain.TriageStatusPending
		}
		if !pending {
			d.Status = domain.DonationStatusStored
			if err := r.Donations.SaveDonation(ctx, &d); err != nil {
				return err
			}
		}
		out = domain.DonationDetail{Donation: d, Batches: batches}
		return r.Audit.Record(ctx, a, "donation.received", "donations", d.ID, nil, out)
	})
	return out, err
}
func (s *Donations) Confirm(ctx context.Context, a domain.Actor, id int64) (domain.Donation, error) {
	if err := domain.Require(a, domain.WriteDonations); err != nil {
		return domain.Donation{}, err
	}
	var out domain.Donation
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		d, err := r.Donations.Donation(ctx, id, true)
		if err != nil {
			return err
		}
		if d.ConfirmedAt != nil {
			return conflict("doação já confirmada")
		}
		batches, err := r.Donations.DonationBatches(ctx, id)
		if err != nil {
			return err
		}
		if len(batches) == 0 {
			return conflict("doação sem lotes")
		}
		approved := false
		for _, b := range batches {
			if b.TriageStatus == domain.TriageStatusPending {
				return conflict("existem lotes pendentes de triagem")
			}
			approved = approved || b.TriageStatus == domain.TriageStatusApproved
		}
		if !approved {
			return conflict("doação sem lotes aprovados não pode ser disponibilizada")
		}
		before := d
		now := time.Now().UTC()
		d.Status = domain.DonationStatusAvailable
		d.ConfirmedBy = &a.User.ID
		d.ConfirmedAt = &now
		d.UpdatedAt = now
		if err := r.Donations.SaveDonation(ctx, &d); err != nil {
			return err
		}
		out = d
		return r.Audit.Record(ctx, a, "donation.confirmed", "donations", id, before, d)
	})
	return out, err
}
