package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"alimenta-mais/backend/internal/domain"
	"alimenta-mais/backend/internal/usecase"
)

type Services struct {
	Auth       *usecase.Auth
	Access     *usecase.Access
	Catalog    *usecase.Catalog
	Donations  *usecase.Donations
	Stock      *usecase.Stock
	Deliveries *usecase.Deliveries
	Read       *usecase.Read
}
type endpoint func(http.ResponseWriter, *http.Request) error
type contextKey uint8

const actorKey contextKey = 0
const requestIDKey contextKey = 1

func actor(r *http.Request) domain.Actor {
	a, _ := r.Context().Value(actorKey).(domain.Actor)
	return a
}
func remoteIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if status != http.StatusNoContent {
		_ = json.NewEncoder(w).Encode(v)
	}
}
func decode(w http.ResponseWriter, r *http.Request, out any) error {
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		return domain.ValidationError{"body": "Content-Type deve ser application/json"}
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		var max *http.MaxBytesError
		if errors.As(err, &max) {
			return &payloadTooLarge{}
		}
		return domain.ValidationError{"body": "não foi possível ler o corpo da requisição"}
	}
	body = bytes.TrimSpace(body)
	if len(body) == 0 || body[0] != '{' || !utf8.Valid(body) {
		return domain.ValidationError{"body": "informe um objeto JSON"}
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		return domain.ValidationError{"body": "JSON inválido, campo desconhecido ou valor incompatível"}
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return domain.ValidationError{"body": "informe somente um objeto JSON"}
	}
	return nil
}

type payloadTooLarge struct{}

func (*payloadTooLarge) Error() string { return "corpo da requisição excede 1 MiB" }
func pathID(r *http.Request) (int64, error) {
	text := r.PathValue("id")
	if text == "" {
		return 0, nil
	}
	id, err := strconv.ParseInt(text, 10, 64)
	if err != nil || id <= 0 {
		return 0, domain.ValidationError{"id": "identificador inválido"}
	}
	return id, nil
}
func query(r *http.Request) (domain.PageQuery, error) {
	if _, err := url.ParseQuery(r.URL.RawQuery); err != nil {
		return domain.PageQuery{}, domain.ValidationError{"query": "parâmetros inválidos"}
	}
	p := domain.PageQuery{Page: 1, PageSize: 20, Q: strings.TrimSpace(r.URL.Query().Get("q")), Status: r.URL.Query().Get("status")}
	p.Sort, p.Direction = r.URL.Query().Get("sort"), r.URL.Query().Get("dir")
	for name, target := range map[string]*int{"page": &p.Page, "page_size": &p.PageSize} {
		if value := r.URL.Query().Get(name); value != "" {
			n, err := strconv.Atoi(value)
			if err != nil {
				return p, domain.ValidationError{name: "número inválido"}
			}
			*target = n
		}
	}
	for name, target := range map[string]*int64{"warehouse_id": &p.WarehouseID, "product_id": &p.ProductID, "category_id": &p.CategoryID, "donation_id": &p.DonationID, "donor_id": &p.DonorID, "route_id": &p.RouteID} {
		if value := r.URL.Query().Get(name); value != "" {
			n, err := strconv.ParseInt(value, 10, 64)
			if err != nil || n <= 0 {
				return p, domain.ValidationError{name: "identificador inválido"}
			}
			*target = n
		}
	}
	if !p.Valid() {
		return p, domain.ValidationError{"pagination": "page deve ser positiva e page_size deve estar entre 1 e 100"}
	}
	return p, nil
}
func list[T any](fn func(context.Context, domain.Actor, domain.PageQuery) (T, error)) endpoint {
	return func(w http.ResponseWriter, r *http.Request) error {
		q, err := query(r)
		if err != nil {
			return err
		}
		out, err := fn(r.Context(), actor(r), q)
		if err != nil {
			return err
		}
		write(w, 200, out)
		return nil
	}
}
func get[T any](fn func(context.Context, domain.Actor, int64) (T, error)) endpoint {
	return func(w http.ResponseWriter, r *http.Request) error {
		id, err := pathID(r)
		if err != nil {
			return err
		}
		out, err := fn(r.Context(), actor(r), id)
		if err != nil {
			return err
		}
		write(w, 200, out)
		return nil
	}
}
func mutation[I, O any](fn func(context.Context, domain.Actor, int64, I) (O, error)) endpoint {
	return func(w http.ResponseWriter, r *http.Request) error {
		id, err := pathID(r)
		if err != nil {
			return err
		}
		var in I
		if err := decode(w, r, &in); err != nil {
			return err
		}
		out, err := fn(r.Context(), actor(r), id, in)
		if err != nil {
			return err
		}
		status := 200
		if r.Method == http.MethodPost {
			status = 201
		}
		write(w, status, out)
		return nil
	}
}
func action[T any](fn func(context.Context, domain.Actor, int64) (T, error)) endpoint { return get(fn) }

func respondError(w http.ResponseWriter, r *http.Request, err error, logger *slog.Logger) {
	status, code, message := 500, "internal_error", "não foi possível concluir a operação"
	var fields domain.ValidationError
	var large *payloadTooLarge
	switch {
	case errors.As(err, &fields):
		status, code, message = 422, "validation_error", "dados inválidos"
	case errors.Is(err, domain.ErrUnauthenticated):
		status, code, message = 401, "unauthenticated", "e-mail ou senha incorretos, ou sessão inválida"
	case errors.Is(err, domain.ErrForbidden):
		status, code, message = 403, "forbidden", "acesso negado"
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "registro não encontrado"
	case errors.Is(err, domain.ErrConflict):
		status, code, message = 409, "conflict", err.Error()
	case errors.As(err, &large):
		status, code, message = 413, "payload_too_large", large.Error()
	case errors.Is(err, context.DeadlineExceeded):
		status, code, message = 504, "timeout", "tempo de operação excedido"
	}
	id, _ := r.Context().Value(requestIDKey).(string)
	if status >= 500 {
		logger.Error("request failed", "request_id", id, "error", err)
	}
	if status == 401 {
		w.Header().Set("WWW-Authenticate", "Bearer")
	}
	write(w, status, struct {
		Message   string                 `json:"message"`
		Code      string                 `json:"code"`
		Fields    domain.ValidationError `json:"fields,omitempty"`
		RequestID string                 `json:"request_id"`
	}{message, code, fields, id})
}

func New(s Services, logger *slog.Logger, origin string, ready func(context.Context) error, cookies CookieOptions) http.Handler {
	mux := http.NewServeMux()
	limiter := newLimiter()
	wrap := func(fn endpoint) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if err := fn(w, r); err != nil {
				respondError(w, r, err, logger)
			}
		}
	}
	private := func(pattern string, fn endpoint) {
		mux.Handle(pattern, wrap(func(w http.ResponseWriter, r *http.Request) error {
			token := cookieValue(r, AccessCookie)
			bearer := r.Header.Get("Authorization") != ""
			if bearer {
				var ok bool
				token, ok = strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
				if !ok {
					return domain.ErrUnauthenticated
				}
			}
			if token == "" {
				return domain.ErrUnauthenticated
			}
			a, err := s.Auth.Authenticate(r.Context(), token)
			if err != nil {
				return err
			}
			if !bearer && unsafeMethod(r.Method) && !usecase.ValidCSRF(r.Header.Get("X-CSRF-Token"), a.CSRFHash) {
				return domain.ErrForbidden
			}
			a.IPAddress = remoteIP(r)
			r = r.WithContext(context.WithValue(r.Context(), actorKey, a))
			return fn(w, r)
		}))
	}
	public := func(pattern string, fn endpoint) { mux.Handle(pattern, limiter.limit(wrap(fn))) }
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "Hello, world!")
	})
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, r *http.Request) { write(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /health/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if err := ready(ctx); err != nil {
			write(w, 503, map[string]string{"status": "unavailable"})
			return
		}
		write(w, 200, map[string]string{"status": "ok"})
	})
	public("POST /api/v1/auth/register", func(w http.ResponseWriter, r *http.Request) error {
		var in usecase.RegisterInput
		if err := decode(w, r, &in); err != nil {
			return err
		}
		u, err := s.Auth.Register(r.Context(), in, remoteIP(r))
		if err != nil {
			return err
		}
		write(w, 201, u)
		return nil
	})
	public("POST /api/v1/auth/login", func(w http.ResponseWriter, r *http.Request) error {
		var in usecase.Credentials
		if err := decode(w, r, &in); err != nil {
			return err
		}
		out, err := s.Auth.Login(r.Context(), in, remoteIP(r))
		if err != nil {
			return err
		}
		cookies.set(w, out)
		write(w, 200, out)
		return nil
	})
	public("POST /api/v1/auth/refresh", func(w http.ResponseWriter, r *http.Request) error {
		out, err := s.Auth.Refresh(r.Context(), cookieValue(r, RefreshCookie), r.Header.Get("X-CSRF-Token"), remoteIP(r))
		if err != nil {
			if errors.Is(err, domain.ErrUnauthenticated) {
				cookies.clear(w)
			}
			return err
		}
		cookies.set(w, out)
		write(w, 200, out)
		return nil
	})
	private("GET /api/v1/auth/me", func(w http.ResponseWriter, r *http.Request) error { write(w, 200, actor(r).User); return nil })
	private("POST /api/v1/auth/logout", func(w http.ResponseWriter, r *http.Request) error {
		if err := s.Auth.Logout(r.Context(), actor(r)); err != nil {
			return err
		}
		cookies.clear(w)
		write(w, 204, nil)
		return nil
	})
	private("PUT /api/v1/auth/password", func(w http.ResponseWriter, r *http.Request) error {
		var in struct {
			Current  string `json:"current_password"`
			Password string `json:"password"`
		}
		if err := decode(w, r, &in); err != nil {
			return err
		}
		if err := s.Auth.ChangePassword(r.Context(), actor(r), in.Current, in.Password); err != nil {
			return err
		}
		cookies.clear(w)
		write(w, 204, nil)
		return nil
	})
	registerResources(private, s)
	private("GET /api/v1/stock/stats", func(w http.ResponseWriter, r *http.Request) error {
		out, err := s.Read.Stats(r.Context(), actor(r))
		if err != nil {
			return err
		}
		write(w, 200, out)
		return nil
	})
	private("GET /api/v1/stock/movements", func(w http.ResponseWriter, r *http.Request) error {
		q, err := query(r)
		if err != nil {
			return err
		}
		out, err := s.Read.Movements(r.Context(), actor(r), 0, q)
		if err != nil {
			return err
		}
		write(w, 200, out)
		return nil
	})
	private("GET /api/v1/batches/{id}/movements", func(w http.ResponseWriter, r *http.Request) error {
		id, err := pathID(r)
		if err != nil {
			return err
		}
		q, err := query(r)
		if err != nil {
			return err
		}
		out, err := s.Read.Movements(r.Context(), actor(r), id, q)
		if err != nil {
			return err
		}
		write(w, 200, out)
		return nil
	})
	private("GET /api/v1/search", func(w http.ResponseWriter, r *http.Request) error {
		out, err := s.Read.Search(r.Context(), actor(r), strings.TrimSpace(r.URL.Query().Get("q")))
		if err != nil {
			return err
		}
		write(w, 200, out)
		return nil
	})
	private("GET /api/v1/reports", reportEndpoint(s, false))
	private("GET /api/v1/dashboard", reportEndpoint(s, true))
	return middleware(mux, logger, origin)
}
func reportEndpoint(s Services, dashboard bool) endpoint {
	return func(w http.ResponseWriter, r *http.Request) error {
		now := time.Now().UTC()
		from := time.Date(now.Year(), now.Month()-5, 1, 0, 0, 0, 0, time.UTC)
		to := now
		for name, target := range map[string]*time.Time{"from": &from, "to": &to} {
			if text := r.URL.Query().Get(name); text != "" {
				parsed, err := time.Parse(time.RFC3339, text)
				if err != nil {
					return domain.ValidationError{name: "use uma data RFC3339 com timezone"}
				}
				*target = parsed
			}
		}
		report, err := s.Read.Report(r.Context(), actor(r), from, to)
		if err != nil {
			return err
		}
		if !dashboard {
			write(w, 200, report)
			return nil
		}
		stats, err := s.Read.Stats(r.Context(), actor(r))
		if err != nil {
			return err
		}
		expiring, err := s.Read.Batches(r.Context(), actor(r), domain.PageQuery{Page: 1, PageSize: 8, Status: "critical"})
		if err != nil {
			return err
		}
		routes, err := s.Read.Routes(r.Context(), actor(r), domain.PageQuery{Page: 1, PageSize: 8})
		if err != nil {
			return err
		}
		write(w, 200, struct {
			Report   domain.Report           `json:"report"`
			Stats    domain.StockStats       `json:"stock_stats"`
			Expiring []domain.InventoryBatch `json:"expiring"`
			Routes   []domain.DeliveryRoute  `json:"routes"`
		}{report, stats, expiring.Items, routes.Items})
		return nil
	}
}
