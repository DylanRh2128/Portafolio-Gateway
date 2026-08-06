# Portfolio Gateway

A single public entry point for a backend portfolio made of independent projects. Each project
(`APIautomatizacionAI`, `BotAutomatizacionDiaria`, `AlmacenamientoCDN`, `PasarelaPagoFacturacion`)
is its own repo, with its own tests, docs, and Docker setup — this repo doesn't change any of
that. It just puts an nginx reverse proxy in front of all four, routing by path, plus a small
landing page linking to each project (and to `SistemaFacturacion`, a desktop app that can't be
proxied this way).

**This is a reverse proxy, not a microservices architecture** — the four backends don't call
each other. The gateway exists purely so a visitor gets one URL instead of four.

## Routes

| Path | Project |
|---|---|
| `/` | landing page |
| `/expenses/*` | APIautomatizacionAI |
| `/support/*` | BotAutomatizacionDiaria |
| `/storage/*` | AlmacenamientoCDN |
| `/billing/*` | PasarelaPagoFacturacion |

Each backend keeps its own original routes (`/reports`, `/tickets/from-email`, `/files`,
`/checkout-sessions`, ...) — nginx strips the prefix before forwarding, so none of the four
projects had to change.

## Run it locally

Requires the four project repos cloned as sibling folders under `PortafolioGithub/`, exactly as
laid out on this machine (`../PortafolioGithub/APIautomatizacionAI`, etc.).

```bash
docker compose up --build
```

This uses SQLite inside each service purely to smoke-test the routing without needing four
Postgres instances — it is **not** how these get deployed for real (see below). Once it's up:

```bash
curl http://localhost:8080/expenses/health
curl http://localhost:8080/support/health
curl http://localhost:8080/storage/health
curl http://localhost:8080/billing/health
```

## Deploying for real (Railway)

This is a manual, one-time setup done in Railway's dashboard — nothing here automates it.

1. Create a Railway account and a new **Project**.
2. Add each of the 4 backend repos as its own **Service** in that project (`New Service` →
   `GitHub Repo`), plus a **PostgreSQL** addon for each — Railway gives every service and addon
   a private hostname reachable by the others inside the same project (`<service>.railway.internal`).
3. On each service, set the environment variables from that project's own `.env.example`
   (`DATABASE_URL` from the Postgres addon Railway just created, `ANTHROPIC_API_KEY`, and
   whichever service-specific ones apply — `WEBHOOK_SECRET`, the AWS/CloudFront vars, or the
   Stripe vars).
4. Add **this repo** (`portfolio-gateway`) as a 5th service. Set its environment variables to
   each backend's private Railway hostname:
   ```
   EXPENSES_UPSTREAM=<expenses-service-name>.railway.internal:8000
   SUPPORT_UPSTREAM=<support-service-name>.railway.internal:8000
   STORAGE_UPSTREAM=<storage-service-name>.railway.internal:8000
   BILLING_UPSTREAM=<billing-service-name>.railway.internal:8000
   ```
5. Generate/attach a public domain **only on the gateway service** — the 4 backends stay
   internal-only, reachable exclusively through the gateway.
6. Once the domain is live, update:
   - The Stripe Dashboard's webhook endpoint URL to `https://<your-domain>/billing/webhooks/stripe`.
   - The n8n workflow's HTTP Request node to `https://<your-domain>/support/tickets/from-email`.

## Why no Kubernetes here either

Four small services behind one reverse proxy is still well within what Docker Compose / a
single Railway project handles fine. Kubernetes would add an orchestration layer this portfolio
has no scaling problem that needs solving.
