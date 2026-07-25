# ── build ───────────────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS build
WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

ARG TARGETARCH
ARG TARGETVARIANT
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/portfolio .

# ── runtime ─────────────────────────────────────────────────────────────────
# Nothing in this image but the binary. No shell, no package manager,
# no libc — which is why CGO_ENABLED=0 above is load-bearing.
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/portfolio /portfolio

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/portfolio"]
