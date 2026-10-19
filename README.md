# Portfolio Gateway

A single public entry point for a backend portfolio made of independent projects. Each project
([`APIAutomatizacionAI`](https://github.com/DylanRh2128/APIAutomatizacionAI),
[`BotAutomatizacionDiaria`](https://github.com/DylanRh2128/BotAutomatizacionDiaria),
[`AlmacenamientoCDN`](https://github.com/DylanRh2128/AlmacenamientoCDN),
[`PasarelaPagoFacturacion`](https://github.com/DylanRh2128/PasarelaPagoFacturacion))
is its own repo, with its own tests, docs, and Docker setup — this repo doesn't change any of
that. It just puts an nginx reverse proxy in front of all four, routing by path, plus a small
landing page linking to each project (and to the portfolio version of `SistemaFacturacion`, a
desktop app that can't be proxied this way).

**This is a reverse proxy, not a microservices architecture** — the four backends don't call
each other. The gateway exists purely so a visitor gets one URL instead of four.

## Routes

| Path | Project |
|---|---|
| `/` | landing page |
| `/expenses/*` | APIAutomatizacionAI |
| `/support/*` | BotAutomatizacionDiaria |
| `/storage/*` | AlmacenamientoCDN |
| `/billing/*` | PasarelaPagoFacturacion |

Each backend keeps its own original routes (`/reports`, `/tickets/from-email`, `/files`,
`/checkout-sessions`, ...) — nginx strips the prefix before forwarding, so none of the four
projects had to change.

## Run it locally

Clone this repo and the four project repos side by side:

```bash
for r in Portafolio-Gateway APIAutomatizacionAI BotAutomatizacionDiaria AlmacenamientoCDN PasarelaPagoFacturacion; do
  git clone https://github.com/DylanRh2128/$r.git
done
cd Portafolio-Gateway
```

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

## Deploying for real (single VPS)

[`docker-compose.vps.yml`](docker-compose.vps.yml) runs everything on one Linux server with
Docker: a single Postgres with one database per project (created by
[`vps/init-dbs.sql`](vps/init-dbs.sql)), the four APIs on Docker's internal network only, and the
gateway on `127.0.0.1:8120`. The host's own nginx terminates TLS and proxies to it, so the
backends are never reachable except through the gateway.

```bash
mkdir -p /opt/portafolio && cd /opt/portafolio
for r in Portafolio-Gateway APIAutomatizacionAI BotAutomatizacionDiaria AlmacenamientoCDN PasarelaPagoFacturacion; do
  git clone https://github.com/DylanRh2128/$r.git
done
cd Portafolio-Gateway
cp vps/env.ejemplo .env        # fill it in; random values: openssl rand -hex 32
docker compose -f docker-compose.vps.yml up -d --build

cp vps/nginx-host.conf /etc/nginx/sites-enabled/portafolio.conf   # set server_name first
nginx -t && systemctl reload nginx && certbot --nginx -d <server_name>
```

To update after pushing changes: `git pull` in each repo, then the same `up -d --build`.

Notes:
- Each API runs with `UVICORN_ROOT_PATH=/<prefix>` so its `/docs` page loads
  `/<prefix>/openapi.json` through the gateway instead of the landing page's `/openapi.json`.
- `API_KEY` protects every read endpoint and the expenses upload; `/docs` stays public but calls
  only work for whoever holds the key.
- Stripe and AWS values are optional: without them `/billing` and `/storage` still start and serve
  their docs, but real payments and uploads fail.
- Once the domain is live, point the Stripe webhook at `https://<domain>/billing/webhooks/stripe`
  and the n8n HTTP Request node at `https://<domain>/support/tickets/from-email`.

## Why no Kubernetes here either

Four small services behind one reverse proxy is still well within what Docker Compose on a
single VPS handles fine. Kubernetes would add an orchestration layer this portfolio
has no scaling problem that needs solving.
