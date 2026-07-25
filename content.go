package main

// ─────────────────────────────────────────────────────────────────────────────
//  EDIT THIS FILE. Everything personal lives here and nowhere else.
//  Anything marked TODO is a placeholder I couldn't fill in for you.
// ─────────────────────────────────────────────────────────────────────────────

type Identity struct {
	Name     string
	Handle   string // shell prompt name, lowercase, no spaces
	Role     string
	Tagline  string // one line, shown under the masthead
	Location string
	Email    string
	GitHub   string
	LinkedIn string
	CVPath   string // e.g. "/static/cv.pdf"; leave "" to hide the link
}

type SkillGroup struct {
	Category string
	Items    []string
}

type Role struct {
	Company string
	Title   string
	Period  string
	Stack   []string
	Bullets []string
}

type Project struct {
	Name       string
	Blurb      string // one sentence, what it does
	Detail     string // 2-3 sentences: the hard part, and how you solved it
	Stack      []string
	Repo       string
	Live       string // "" if not deployed
	SelfHosted bool   // marks it with a ⏺ in the list
}

// ── Who you are ──────────────────────────────────────────────────────────────

var me = Identity{
	Name:     "Ciaran Otter",
	Handle:   "todo",
	Role:     "Full-Stack Engineer",
	Tagline:  "Backend systems, containers, and infrastructure I run myself.",
	Location: "TODO: Cape Town, South Africa",
	Email:    "you@yourdomain.com", // the domain address you set up forwarding for
	GitHub:   "https://github.com/CiaranOtter",
	LinkedIn: "https://linkedin.com/in/ciaranotter",
	CVPath:   "", // drop cv.pdf into static/ and set to "/static/cv.pdf"
}

// ── About ────────────────────────────────────────────────────────────────────
// Keep this short and concrete. Say what you build and what you care about.
// Avoid "passionate about technology" — everyone writes that.

var about = []string{
	"I build backend services and the infrastructure they run on. Most of my " +
		"work sits where application code meets the operating system: containers, " +
		"networking, and the unglamorous parts that decide whether something stays up.",

	"This site is a worked example. It's a Go binary in a ~10MB distroless " +
		"image, running on a Raspberry Pi in my house, reachable only through a " +
		"WireGuard tunnel to a VPS that terminates TLS. The status bar at the " +
		"bottom is reading from that machine right now.",

	// "TODO: A third paragraph about what you're looking for, or what you're " +
	// 	"currently learning. Two sentences is plenty.",
}

// ── Skills ───────────────────────────────────────────────────────────────────
// Fewer, honest entries beat an exhaustive list. Cut anything you'd be
// uncomfortable being interviewed on.

var skills = []SkillGroup{
	{"Languages", []string{"Go", "Python", "TypeScript", "SQL", "Bash"}},
	{"Backend", []string{"REST", "gRPC", "PostgreSQL", "Redis", "Message queues"}},
	{"Infrastructure", []string{"Docker", "Kubernetes", "Linux", "nftables", "WireGuard"}},
	{"Practice", []string{"CI/CD", "Observability", "Infrastructure as code", "Testing"}},
}

// ── Experience ───────────────────────────────────────────────────────────────
// Bullets should carry a result or a number where you have one.

var experience = []Role{
	{
		Company: "Lesaka Technologies",
		Title:   "Software Developer",
		Period:  "2025 — Present",
		Stack:   []string{"python", "django", "AWS", "Docker", "PostgreSQL"},
		Bullets: []string{
			// "I took care of the Card Payments system for small merchants all over south africa",
			// "TODO: A bullet with a number in it — latency, cost, throughput, headcount.",
			// "TODO: Something collaborative — a review process, a migration, mentoring.",
		},
	},
	{
		Company: "Mediahack",
		Title:   "Software Developer",
		Period:  "2022 — 2024",
		Stack:   []string{"Python", "AWS"},
		Bullets: []string{
			// "TODO: Two bullets is fine for older roles.",
			// "TODO: Weight detail toward the most recent work.",
		},
	},
}

// ── Projects ─────────────────────────────────────────────────────────────────
// The first two are real — they're the systems from our earlier conversations.
// Rewrite the details to match what you actually built.

var projects = []Project{
	// {
	// 	Name:  "Self-hosted mail and web edge",
	// 	Blurb: "A home server exposed to the internet through a VPS I control.",
	// 	Detail: "A Raspberry Pi runs the services; a DigitalOcean droplet holds the " +
	// 		"public IP and forwards traffic over WireGuard. The interesting problem was " +
	// 		"preserving real client source addresses through DNAT — naive masquerading " +
	// 		"rewrites them and quietly breaks every spam filter and rate limiter " +
	// 		"downstream. Mail sends via an authenticated relay on 587 with SPF, DKIM, " +
	// 		"and DMARC aligned.",
	// 	Stack:      []string{"WireGuard", "nftables", "Postfix", "Caddy", "Debian"},
	// 	Repo:       "https://github.com/TODO/edge",
	// 	SelfHosted: true,
	// },
	// {
	// 	Name:  "This site",
	// 	Blurb: "A Go portfolio in a 10MB container, cross-compiled for arm64.",
	// 	Detail: "Templates and static assets are embedded into the binary with " +
	// 		"go:embed, so the runtime image is distroless with nothing in it but the " +
	// 		"executable. Built with buildx on my laptop and pulled onto the Pi, since " +
	// 		"compiling on the Pi itself is slow enough to be annoying.",
	// 	Stack:      []string{"Go", "Docker", "buildx", "GitHub Actions"},
	// 	Repo:       "https://github.com/TODO/portfolio",
	// 	Live:       "https://yourdomain.com",
	// 	SelfHosted: true,
	// },
	// {
	// 	Name:   "TODO: Third project",
	// 	Blurb:  "TODO: One sentence on what it does.",
	// 	Detail: "TODO: Lead with the hardest part. What was non-obvious? What did you try that didn't work? That's the part interviewers actually read.",
	// 	Stack:  []string{"TODO", "TODO"},
	// 	Repo:   "https://github.com/TODO",
	// },
}
