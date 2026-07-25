package main

import (
	"context"
	"embed"
	"encoding/json"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"sync/atomic"
	"syscall"
	"time"
)

//go:embed templates/*.html templates/partials/*.html
var templateFS embed.FS

//go:embed static
var staticFS embed.FS

var (
	tmpl = template.Must(template.ParseFS(templateFS,
		"templates/*.html", "templates/partials/*.html"))
	startedAt = time.Now()
	buildID   = strconv.FormatInt(time.Now().Unix(), 36)
	hits      atomic.Int64
)

// PageData is everything index.html needs.
type PageData struct {
	Me         Identity
	About      []string
	Skills     []SkillGroup
	Experience []Role
	Projects   []Project
	Year       int
	V          string // build stamp, busts the asset cache on restart
}

// Status is the live host readout for the bottom bar. Real values from the
// machine actually serving the request — that's the whole point of it.
type Status struct {
	Host    string `json:"host"`
	Arch    string `json:"arch"`
	OS      string `json:"os"`
	Go      string `json:"go"`
	CPUs    int    `json:"cpus"`
	Uptime  string `json:"uptime"`
	Hits    int64  `json:"hits"`
	HeapKB  uint64 `json:"heap_kb"`
	Goroutn int    `json:"goroutines"`
}

func currentStatus() Status {
	host, err := os.Hostname()
	if err != nil {
		host = "unknown"
	}
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return Status{
		Host:    host,
		Arch:    runtime.GOARCH,
		OS:      runtime.GOOS,
		Go:      runtime.Version(),
		CPUs:    runtime.NumCPU(),
		Uptime:  humanUptime(time.Since(startedAt)),
		Hits:    hits.Load(),
		HeapKB:  m.HeapAlloc / 1024,
		Goroutn: runtime.NumGoroutine(),
	}
}

func humanUptime(d time.Duration) string {
	d = d.Round(time.Second)
	days := int(d.Hours()) / 24
	h := int(d.Hours()) % 24
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60

	switch {
	case days > 0:
		return itoa(days) + "d " + pad(h) + ":" + pad(m) + ":" + pad(s)
	default:
		return pad(h) + ":" + pad(m) + ":" + pad(s)
	}
}

func pad(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-Frame-Options", "DENY")
		// No external requests anywhere on this site, so the policy can be strict.
		h.Set("Content-Security-Policy",
			"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'")
		next.ServeHTTP(w, r)
	})
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		// X-Forwarded-For is set by Caddy on the droplet.
		client := r.Header.Get("X-Forwarded-For")
		if client == "" {
			client = r.RemoteAddr
		}
		log.Printf("%s %s %s %v", client, r.Method, r.URL.Path, time.Since(start))
	})
}

func main() {
	mux := http.NewServeMux()

	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		log.Fatalf("static fs: %v", err)
	}
	fileServer := http.FileServer(http.FS(sub))
	mux.Handle("GET /static/", http.StripPrefix("/static/",
		cacheControl(fileServer, "public, max-age=3600")))

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data := PageData{
			Me:         me,
			About:      about,
			Skills:     skills,
			Experience: experience,
			Projects:   projects,
			Year:       time.Now().Year(),
			V:          buildID,
		}
		if err := tmpl.ExecuteTemplate(w, "page", data); err != nil {
			log.Printf("render page: %v", err)
		}
	})

	// The CV used to live at its own URL. Keep old links working.
	mux.HandleFunc("GET /cv", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/#about", http.StatusMovedPermanently)
	})

	mux.HandleFunc("GET /api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(currentStatus())
	})

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	// Anything unmatched gets a terminal-flavoured 404 rather than Go's default.
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		tmpl.ExecuteTemplate(w, "404.html", map[string]any{
			"Path":   r.URL.Path,
			"Handle": me.Handle,
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           securityHeaders(logRequests(mux)),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("listening on %s (%s/%s)", addr, runtime.GOOS, runtime.GOARCH)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("serve: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func cacheControl(h http.Handler, value string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", value)
		h.ServeHTTP(w, r)
	})
}
