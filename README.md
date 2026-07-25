# Portfolio

A Go portfolio site, embedded into a single static binary, containerised for
arm64, and served from a Raspberry Pi through a WireGuard tunnel to a VPS.

```
portfolio/
├── content.go            ← everything personal. Start here.
├── main.go               ← server, routes, /api/status
├── templates/
│   ├── page.html         ← the shell; composes every partial
│   ├── 404.html
│   └── partials/         ← one file per section
│       ├── hero.html     ← full-viewport, holds the canvas
│       ├── nav.html      ← sticky section nav
│       ├── about.html
│       ├── skills.html
│       ├── experience.html
│       ├── projects.html
│       ├── contact.html
│       ├── footer.html
│       └── statusbar.html
├── static/
│   ├── css/style.css     ← one stylesheet, one page
│   ├── js/landing.js     ← the halftone field
│   ├── js/main.js        ← status bar polling
│   └── favicon.svg
├── Dockerfile            ← multi-stage → distroless
├── compose.yaml          ← runs on the Pi
├── deploy/Caddyfile      ← runs on the droplet
└── .github/workflows/deploy.yml
```

## Run it locally

```bash
go mod tidy
go run .
# → http://localhost:8080
```

Everything is embedded, so the binary is the whole site. `go build -o portfolio .`
produces something you could copy to a bare machine and run with no arguments.

## Make it yours

Edit **`content.go`** and nothing else. Every string in the site — name, bio,
skills, roles, projects, links — is a Go struct in that file. Search for `TODO`
to find what still needs filling in.

Two things to change beyond that:

- `deploy/Caddyfile` — replace `yourdomain.com`
- `compose.yaml` — replace `YOURUSER` with your GitHub username

To add a CV: drop `cv.pdf` into `static/`, set `CVPath: "/static/cv.pdf"` in
`content.go`. It gets embedded into the binary on the next build.

## Theme

The palette is four values of one amber hue, defined at the top of `style.css`.
To switch to green phosphor, change `--amber`, `--amber-lit`, `--amber-dim` and
`--amber-ghost` and leave everything else alone — hierarchy in this design comes
from size and letterspacing, not colour, so it survives a hue change intact.

## Deploy

Build for the Pi's architecture on a faster machine:

```bash
docker buildx build --platform linux/arm64 \
  -t ghcr.io/YOURUSER/portfolio:latest --push .
```

Then on the Pi:

```bash
docker compose pull && docker compose up -d
docker compose logs -f
```

Confirm the Pi's architecture first — `uname -m` should say `aarch64`. If it
says `armv7l`, use `--platform linux/arm/v7` here and in the workflow.

No registry? Pipe the image over the tunnel instead:

```bash
docker buildx build --platform linux/arm64 -t portfolio:latest --load .
docker save portfolio:latest | gzip | ssh pi@10.8.0.2 'gunzip | docker load'
```

### Droplet side

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Add DNS at your registrar: `A @ → <droplet IP>` and `A www → <droplet IP>`.
These sit alongside your MX records without conflict — different record types,
different jobs.

## Notes

- `compose.yaml` binds to `10.8.0.2:8080`, not `0.0.0.0`. The Pi only answers
  on the tunnel; Caddy on the droplet is the single entrypoint.
- The container runs read-only, non-root, with all capabilities dropped. There
  is no shell inside the image, so `docker exec` won't get you a prompt — debug
  from the logs.
- Routes: `/` is the whole site, `/cv` 301-redirects to `/#about` for old
  links, `/api/status` feeds the status bar, `/healthz` is for Caddy.
- Asset URLs carry `?v={{.V}}`, a build stamp minted at startup, so a restart
  busts the browser cache without weakening `max-age`.

## Adding a section

Three steps, no exceptions:

1. `templates/partials/writing.html` containing `{{define "writing"}}...{{end}}`
2. `{{template "writing" .}}` in `page.html`, wherever it belongs in the order
3. A link in `partials/nav.html`

Every partial receives the same `PageData`, so `.Me`, `.Projects` and the rest
are all in scope. New data means a new field on `PageData` in `main.go` and a
new variable in `content.go`. Exported names only -- a lowercase field is
invisible to templates and fails silently.
- The Content-Security-Policy in `main.go` is `style-src 'self'; script-src 'self'`,
  so **no inline `<style>` or `<script>` will run** — the browser blocks them
  and the page renders unstyled or inert. Every stylesheet and script must live
  under `static/` and be linked by URL. Same applies to an external font or
  analytics snippet: add its origin to the directive or it fails silently.

  Tuning the wave field: all the constants are at the top of
  `static/js/landing.js`. `HUE_COLD`/`HUE_HOT` set the colour range (try 160/120
  for green phosphor), `SPACING` sets density, `CURSOR_R` and `PUSH` set how far
  and how hard your pointer pushes.
- `/api/status` exposes hostname, architecture, uptime and heap size. That's
  deliberate — it's the point of the status bar — but decide for yourself
  whether you're comfortable publishing it.
