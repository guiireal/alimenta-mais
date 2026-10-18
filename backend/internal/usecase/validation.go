package usecase

import (
	"net/mail"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"alimenta-mais/backend/internal/domain"
)

type validation domain.ValidationError

func (v validation) text(field, value string, max int, required bool) {
	if (required && strings.TrimSpace(value) == "") || utf8.RuneCountInString(value) > max || strings.ContainsRune(value, 0) {
		v[field] = "campo obrigatório ou tamanho inválido"
	}
}
func (v validation) id(field string, id int64) {
	if id <= 0 {
		v[field] = "identificador inválido"
	}
}
func (v validation) email(field, value string) {
	a, err := mail.ParseAddress(value)
	if err != nil || a.Address != value || len(value) > 254 {
		v[field] = "e-mail inválido"
	}
}
func (v validation) optional(field string, value *string, max int) {
	if value != nil {
		v.text(field, *value, max, false)
	}
}
func (v validation) coordinates(lat, lon *domain.Decimal) {
	if (lat == nil) != (lon == nil) {
		v["coordinates"] = "informe latitude e longitude juntas"
		return
	}
	if lat != nil {
		a, e1 := lat.Scaled(6)
		b, e2 := lon.Scaled(6)
		if e1 != nil || e2 != nil || a < -90000000 || a > 90000000 || b < -180000000 || b > 180000000 {
			v["coordinates"] = "coordenadas inválidas"
		}
	}
}
func (v validation) err() error {
	if len(v) != 0 {
		return domain.ValidationError(v)
	}
	return nil
}
func (v validation) password(password string) {
	letter, digit := false, false
	for _, r := range password {
		letter = letter || unicode.IsLetter(r)
		digit = digit || unicode.IsDigit(r)
	}
	if utf8.RuneCountInString(password) < 8 || len(password) > 72 || !letter || !digit {
		v["password"] = "use de 8 a 72 bytes, com letras e números"
	}
}

var digits = regexp.MustCompile(`^[0-9]+$`)

func validTaxID(v validation, value *string) {
	if value != nil && ((!digits.MatchString(*value)) || (len(*value) != 11 && len(*value) != 14)) {
		v["tax_id"] = "informe 11 ou 14 dígitos"
	}
}
func conflict(message string) error { return &businessConflict{message: message} }

type businessConflict struct{ message string }

func (e *businessConflict) Error() string { return e.message }
func (e *businessConflict) Unwrap() error { return domain.ErrConflict }
