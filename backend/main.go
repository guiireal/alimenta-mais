package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"alimenta-mais/backend/internal/adapter/httpapi"
	"alimenta-mais/backend/internal/adapter/postgres"
	"alimenta-mais/backend/internal/adapter/security"
	"alimenta-mais/backend/internal/database"
	"alimenta-mais/backend/internal/usecase"
)

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := database.Open(ctx)
	if err != nil {
		return err
	}
	defer db.Close()
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	store := postgres.New(db)
	repos := store.Repositories()
	passwords := security.Passwords{}
	dummy, err := passwords.Hash("invalid-login-dummy-password")
	if err != nil {
		return err
	}
	tokens, err := security.NewTokens(os.Getenv("JWT_SECRET"))
	if err != nil {
		return err
	}
	services := httpapi.Services{
		Auth:       &usecase.Auth{Users: repos.Users, Sessions: repos.Sessions, Tx: store, Passwords: passwords, DummyHash: dummy, Tokens: tokens},
		Access:     &usecase.Access{Tx: store},
		Catalog:    &usecase.Catalog{Tx: store},
		Donations:  &usecase.Donations{Tx: store},
		Stock:      &usecase.Stock{Tx: store},
		Deliveries: &usecase.Deliveries{Tx: store},
		Read:       &usecase.Read{Repos: repos},
	}
	origin := os.Getenv("ALLOWED_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}
	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return errors.New("ALLOWED_ORIGIN deve conter somente scheme e host")
	}
	secureCookies := true
	if raw := os.Getenv("COOKIE_SECURE"); raw != "" {
		secureCookies, err = strconv.ParseBool(raw)
		if err != nil {
			return errors.New("COOKIE_SECURE inválido")
		}
	}
	if !secureCookies {
		ip := net.ParseIP(u.Hostname())
		if u.Hostname() != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return errors.New("cookies sem Secure são permitidos somente no ambiente local")
		}
	}
	address := os.Getenv("HTTP_ADDR")
	if address == "" {
		address = ":8080"
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	server := &http.Server{Addr: address, Handler: httpapi.New(services, logger, origin, db.PingContext, httpapi.CookieOptions{Secure: secureCookies}), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	errorsCh := make(chan error, 1)
	go func() { errorsCh <- server.ListenAndServe() }()
	logger.Info("server started", "address", address)
	select {
	case err := <-errorsCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			_ = server.Close()
			return err
		}
		return nil
	}
}

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
