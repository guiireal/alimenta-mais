package httpapi

import (
	"context"
	"crypto/rand"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
		w.ResponseWriter.WriteHeader(status)
	}
}
func (w *responseWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(200)
	}
	return w.ResponseWriter.Write(p)
}
func (w *responseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
func middleware(next http.Handler, logger *slog.Logger, origin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := rand.Text()
		r = r.WithContext(context.WithValue(r.Context(), requestIDKey, id))
		w.Header().Set("X-Request-ID", id)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		started := time.Now()
		rw := &responseWriter{ResponseWriter: w}
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("request panic", "request_id", id)
				if rw.status == 0 {
					write(rw, 500, map[string]string{"message": "erro interno", "request_id": id})
				}
			}
			logger.Info("http request", "request_id", id, "method", r.Method, "path", r.URL.Path, "status", rw.status, "duration", time.Since(started))
		}()
		if requestOrigin := r.Header.Get("Origin"); requestOrigin != "" {
			rw.Header().Add("Vary", "Origin")
			if requestOrigin != origin {
				write(rw, 403, map[string]string{"message": "origem não permitida"})
				return
			}
			rw.Header().Set("Access-Control-Allow-Origin", origin)
			rw.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-CSRF-Token")
			rw.Header().Set("Access-Control-Allow-Credentials", "true")
			rw.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
			rw.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
		}
		if r.Method == http.MethodOptions {
			rw.WriteHeader(204)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		next.ServeHTTP(rw, r.WithContext(ctx))
	})
}

type loginWindow struct {
	count int
	until time.Time
}
type limiter struct {
	mu      sync.Mutex
	clients map[string]loginWindow
}

// shortcut: limits are per process; use a shared gateway when deploying multiple instances.

func newLimiter() *limiter { return &limiter{clients: make(map[string]loginWindow)} }
func (l *limiter) limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now()
		ip := remoteIP(r)
		l.mu.Lock()
		for key, window := range l.clients {
			if now.After(window.until) {
				delete(l.clients, key)
			}
		}
		window := l.clients[ip]
		if window.until.IsZero() {
			window.until = now.Add(time.Minute)
		}
		allowed := window.count < 10 && len(l.clients) < 10000
		window.count++
		if len(l.clients) < 10000 {
			l.clients[ip] = window
		}
		l.mu.Unlock()
		if !allowed {
			w.Header().Set("Retry-After", "60")
			write(w, 429, map[string]string{"message": "muitas tentativas; aguarde um minuto"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
