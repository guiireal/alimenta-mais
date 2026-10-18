package usecase

import (
	"context"
	"strings"
	"time"

	"alimenta-mais/backend/internal/domain"
)

type Stock struct{ Tx UnitOfWork }
type BatchInput struct {
	ProductID    int64               `json:"product_id"`
	BatchCode    string              `json:"batch_code"`
	Quantity     domain.Decimal      `json:"quantity"`
	UnitWeightKg domain.Decimal      `json:"unit_weight_kg"`
	ExpiresOn    *domain.Date        `json:"expires_on"`
	TriageStatus domain.TriageStatus `json:"triage_status"`
	TriageNotes  *string             `json:"triage_notes"`
	WarehouseID  int64               `json:"warehouse_id"`
}
type TriageInput struct {
	Status      domain.TriageStatus `json:"status"`
	Notes       *string             `json:"notes"`
	ExpiresOn   *domain.Date        `json:"expires_on"`
	WarehouseID int64               `json:"warehouse_id"`
}
type MovementInput struct {
	Type            domain.StockMovementType `json:"type"`
	Quantity        domain.Decimal           `json:"quantity"`
	FromWarehouseID *int64                   `json:"from_warehouse_id"`
	ToWarehouseID   *int64                   `json:"to_warehouse_id"`
	Reason          *string                  `json:"reason"`
}

func validateBatch(in BatchInput) error {
	v := validation{}
	v.id("product_id", in.ProductID)
	v.text("batch_code", in.BatchCode, 100, true)
	v.optional("triage_notes", in.TriageNotes, 10000)
	if _, err := domain.PositiveQuantity(in.Quantity); err != nil {
		v["quantity"] = "quantidade inválida"
	}
	n, err := in.UnitWeightKg.Scaled(6)
	if err != nil || n <= 0 || n > 999999999999 {
		v["unit_weight_kg"] = "peso positivo com até 6 casas decimais"
	}
	if in.TriageStatus != domain.TriageStatusPending && in.TriageStatus != domain.TriageStatusApproved && in.TriageStatus != domain.TriageStatusRejected {
		v["triage_status"] = "triagem inválida"
	}
	if in.ExpiresOn != nil && !in.ExpiresOn.Valid() {
		v["expires_on"] = "data inválida"
	}
	if in.TriageStatus == domain.TriageStatusApproved && (in.ExpiresOn == nil || *in.ExpiresOn < domain.Today()) {
		v["expires_on"] = "validade vigente é obrigatória para aprovação"
	}
	if in.TriageStatus == domain.TriageStatusApproved {
		v.id("warehouse_id", in.WarehouseID)
	}
	return v.err()
}
func checkStorage(ctx context.Context, r Repositories, product domain.Product, warehouseID int64) error {
	w, err := r.Catalog.Warehouse(ctx, warehouseID)
	if err != nil {
		return err
	}
	if !w.IsActive {
		return conflict("depósito inativo")
	}
	c, err := r.Catalog.Category(ctx, product.CategoryID)
	if err != nil {
		return err
	}
	if c.IsPerishable && !w.IsColdStorage {
		return domain.ValidationError{"warehouse_id": "perecíveis exigem depósito refrigerado"}
	}
	return nil
}
func createBatch(ctx context.Context, r Repositories, a domain.Actor, donationID *int64, in BatchInput) (domain.InventoryBatch, error) {
	p, err := r.Catalog.Product(ctx, in.ProductID, true)
	if err != nil {
		return domain.InventoryBatch{}, err
	}
	if !p.IsActive {
		return domain.InventoryBatch{}, conflict("produto inativo")
	}
	q, _ := domain.PositiveQuantity(in.Quantity)
	if p.Unit == "un" && q%1000 != 0 {
		return domain.InventoryBatch{}, domain.ValidationError{"quantity": "unidades devem ser inteiras"}
	}
	if p.Unit == "kg" && in.UnitWeightKg != "1" && in.UnitWeightKg != "1.000000" {
		weight, _ := in.UnitWeightKg.Scaled(6)
		if weight != 1000000 {
			return domain.InventoryBatch{}, domain.ValidationError{"unit_weight_kg": "produtos em kg devem usar peso unitário 1"}
		}
	}
	if in.TriageStatus == domain.TriageStatusApproved {
		if err := checkStorage(ctx, r, p, in.WarehouseID); err != nil {
			return domain.InventoryBatch{}, err
		}
	}
	now := time.Now().UTC()
	b := domain.InventoryBatch{DonationID: donationID, ProductID: in.ProductID, BatchCode: strings.TrimSpace(in.BatchCode), ReceivedQuantity: in.Quantity, UnitWeightKg: in.UnitWeightKg, ExpiresOn: in.ExpiresOn, TriageStatus: in.TriageStatus, TriageNotes: in.TriageNotes, CreatedAt: now, UpdatedAt: now}
	if in.TriageStatus != domain.TriageStatusPending {
		b.TriagedBy = &a.User.ID
		b.TriagedAt = &now
	}
	if err := r.Stock.SaveBatch(ctx, &b); err != nil {
		return b, err
	}
	if in.TriageStatus == domain.TriageStatusApproved {
		m := domain.StockMovement{BatchID: b.ID, Type: domain.StockMovementTypeReceipt, Quantity: in.Quantity, ToWarehouseID: &in.WarehouseID, RecordedBy: a.User.ID, MovedAt: now, CreatedAt: now}
		if err := r.Stock.CreateMovement(ctx, &m); err != nil {
			return b, err
		}
	}
	return b, nil
}
func (s *Stock) Create(ctx context.Context, a domain.Actor, in BatchInput) (domain.InventoryBatch, error) {
	if err := domain.Require(a, domain.WriteStock); err != nil {
		return domain.InventoryBatch{}, err
	}
	if in.TriageStatus != "" && in.TriageStatus != domain.TriageStatusApproved {
		return domain.InventoryBatch{}, domain.ValidationError{"triage_status": "entrada manual exige lote aprovado"}
	}
	in.TriageStatus = domain.TriageStatusApproved
	if err := validateBatch(in); err != nil {
		return domain.InventoryBatch{}, err
	}
	var b domain.InventoryBatch
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var err error
		b, err = createBatch(ctx, r, a, nil, in)
		if err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "batch.received", "inventory_batches", b.ID, nil, b)
	})
	return b, err
}
func (s *Stock) Triage(ctx context.Context, a domain.Actor, id int64, in TriageInput) (domain.InventoryBatch, error) {
	if err := domain.Require(a, domain.WriteDonations); err != nil {
		return domain.InventoryBatch{}, err
	}
	if in.Status != domain.TriageStatusApproved && in.Status != domain.TriageStatusRejected {
		return domain.InventoryBatch{}, domain.ValidationError{"status": "use approved ou rejected"}
	}
	var b domain.InventoryBatch
	err := s.Tx.WithinTx(ctx, func(r Repositories) error {
		var err error
		b, err = r.Stock.Batch(ctx, id, false)
		if err != nil {
			return err
		}
		if b.DonationID != nil {
			d, err := r.Donations.Donation(ctx, *b.DonationID, true)
			if err != nil {
				return err
			}
			if d.ConfirmedAt != nil {
				return conflict("doação já confirmada")
			}
		}
		p, err := r.Catalog.Product(ctx, b.ProductID, true)
		if err != nil {
			return err
		}
		b, err = r.Stock.Batch(ctx, id, true)
		if err != nil {
			return err
		}
		if b.TriageStatus != domain.TriageStatusPending {
			return conflict("lote já triado")
		}
		before := b
		if in.ExpiresOn != nil {
			b.ExpiresOn = in.ExpiresOn
		}
		if err := validateBatch(BatchInput{ProductID: b.ProductID, BatchCode: b.BatchCode, Quantity: b.ReceivedQuantity, UnitWeightKg: b.UnitWeightKg, ExpiresOn: b.ExpiresOn, TriageStatus: in.Status, TriageNotes: in.Notes, WarehouseID: in.WarehouseID}); err != nil {
			return err
		}
		if in.Status == domain.TriageStatusApproved {
			if !p.IsActive {
				return conflict("produto inativo")
			}
			if err := checkStorage(ctx, r, p, in.WarehouseID); err != nil {
				return err
			}
		}
		now := time.Now().UTC()
		b.TriageStatus = in.Status
		b.TriagedBy = &a.User.ID
		b.TriagedAt = &now
		b.TriageNotes = in.Notes
		b.UpdatedAt = now
		if err := r.Stock.SaveBatch(ctx, &b); err != nil {
			return err
		}
		if in.Status == domain.TriageStatusApproved {
			m := domain.StockMovement{BatchID: b.ID, Type: domain.StockMovementTypeReceipt, Quantity: b.ReceivedQuantity, ToWarehouseID: &in.WarehouseID, RecordedBy: a.User.ID, MovedAt: now, CreatedAt: now}
			if err := r.Stock.CreateMovement(ctx, &m); err != nil {
				return err
			}
		}
		if b.DonationID != nil {
			d, err := r.Donations.Donation(ctx, *b.DonationID, true)
			if err != nil {
				return err
			}
			d.Status = domain.DonationStatusInTriage
			d.UpdatedAt = now
			if err := r.Donations.SaveDonation(ctx, &d); err != nil {
				return err
			}
		}
		return r.Audit.Record(ctx, a, "batch.triaged", "inventory_batches", id, before, b)
	})
	return b, err
}
func (s *Stock) Move(ctx context.Context, a domain.Actor, id int64, in MovementInput) (domain.StockMovement, error) {
	permission := domain.WriteStock
	if in.Type == domain.StockMovementTypeExpirationLoss || in.Type == domain.StockMovementTypeOtherLoss || in.Type == domain.StockMovementTypeAdjustmentOut || in.Type == domain.StockMovementTypeAdjustmentIn {
		permission = domain.DisposeStock
	}
	if err := domain.Require(a, permission); err != nil {
		return domain.StockMovement{}, err
	}
	qty, err := domain.PositiveQuantity(in.Quantity)
	if err != nil {
		return domain.StockMovement{}, err
	}
	v := validation{}
	v.optional("reason", in.Reason, 10000)
	if in.FromWarehouseID != nil {
		v.id("from_warehouse_id", *in.FromWarehouseID)
	}
	if in.ToWarehouseID != nil {
		v.id("to_warehouse_id", *in.ToWarehouseID)
	}
	switch in.Type {
	case domain.StockMovementTypeTransfer:
		if in.FromWarehouseID == nil || in.ToWarehouseID == nil || *in.FromWarehouseID == *in.ToWarehouseID {
			v["warehouses"] = "transferência exige depósitos diferentes"
		}
	case domain.StockMovementTypeExpirationLoss, domain.StockMovementTypeOtherLoss, domain.StockMovementTypeAdjustmentOut:
		if in.FromWarehouseID == nil || in.ToWarehouseID != nil {
			v["warehouses"] = "informe somente o depósito de origem"
		}
	case domain.StockMovementTypeAdjustmentIn:
		if in.ToWarehouseID == nil || in.FromWarehouseID != nil {
			v["warehouses"] = "informe somente o depósito de destino"
		}
	default:
		v["type"] = "movimentação não permitida por este endpoint"
	}
	if in.Type != domain.StockMovementTypeTransfer && (in.Reason == nil || strings.TrimSpace(*in.Reason) == "") {
		v["reason"] = "motivo obrigatório"
	}
	if err := v.err(); err != nil {
		return domain.StockMovement{}, err
	}
	var m domain.StockMovement
	err = s.Tx.WithinTx(ctx, func(r Repositories) error {
		b, err := r.Stock.Batch(ctx, id, false)
		if err != nil {
			return err
		}
		p, err := r.Catalog.Product(ctx, b.ProductID, true)
		if err != nil {
			return err
		}
		b, err = r.Stock.Batch(ctx, id, true)
		if err != nil {
			return err
		}
		if b.TriageStatus != domain.TriageStatusApproved {
			return conflict("lote não aprovado")
		}
		if p.Unit == "un" && qty%1000 != 0 {
			return domain.ValidationError{"quantity": "unidades devem ser inteiras"}
		}
		if in.Type == domain.StockMovementTypeExpirationLoss && (b.ExpiresOn == nil || *b.ExpiresOn >= domain.Today()) {
			return conflict("lote ainda não venceu")
		}
		if in.FromWarehouseID != nil {
			balance, err := r.Stock.Balance(ctx, id, *in.FromWarehouseID)
			if err != nil {
				return err
			}
			available, err := balance.Scaled(3)
			if err != nil {
				return err
			}
			if available < qty {
				return conflict("saldo insuficiente")
			}
		}
		if in.ToWarehouseID != nil {
			if err := capacity(ctx, r, id, *in.ToWarehouseID, qty); err != nil {
				return err
			}
			if err := checkStorage(ctx, r, p, *in.ToWarehouseID); err != nil {
				return err
			}
			if in.Type == domain.StockMovementTypeAdjustmentIn && (b.ExpiresOn == nil || *b.ExpiresOn < domain.Today() || !p.IsActive) {
				return conflict("lote vencido ou produto inativo não pode receber ajuste de entrada")
			}
		}
		now := time.Now().UTC()
		m = domain.StockMovement{BatchID: id, Type: in.Type, Quantity: in.Quantity, FromWarehouseID: in.FromWarehouseID, ToWarehouseID: in.ToWarehouseID, Reason: in.Reason, MovedAt: now, RecordedBy: a.User.ID, CreatedAt: now}
		if err := r.Stock.CreateMovement(ctx, &m); err != nil {
			return err
		}
		return r.Audit.Record(ctx, a, "stock."+string(in.Type), "stock_movements", m.ID, nil, m)
	})
	return m, err
}

func capacity(ctx context.Context, r Repositories, batchID, warehouseID, quantity int64) error {
	current, err := r.Stock.Balance(ctx, batchID, warehouseID)
	if err != nil {
		return err
	}
	units, err := current.Scaled(3)
	if err != nil {
		return err
	}
	if units+quantity > 999999999999 {
		return conflict("saldo excede a precisão máxima do lote")
	}
	return nil
}
