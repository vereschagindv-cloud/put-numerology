# Путь — Robokassa payment worker

Cloudflare Worker that handles Robokassa payment initiation and confirmation
for waynumber.ru. The main site stays on GitHub Pages (pure static) — this
Worker is the only piece that needs to run server-side, because Robokassa's
payment confirmation (ResultURL) must be called server-to-server and verified
with a secret (Password #2) that can never live in front-end JS.

## Routes

- `GET /pay` — generates an invoice ID and a signed Robokassa redirect URL.
- `POST /result` — Robokassa's server-to-server confirmation webhook. Verifies
  the signature with Password #2, then marks the invoice paid in KV.
- `GET /check?invId=123` — the frontend polls this after returning from
  Robokassa to see whether that invoice is confirmed paid.

## One-time setup

```
cd worker
npx wrangler login                      # opens a browser to authorize
npx wrangler kv namespace create PAYMENTS
# paste the returned id into wrangler.toml under [[kv_namespaces]]
npx wrangler secret put ROBOKASSA_LOGIN
npx wrangler secret put ROBOKASSA_PASSWORD1
npx wrangler secret put ROBOKASSA_PASSWORD2
npx wrangler deploy
```

`wrangler deploy` prints the live URL (`https://put-numerology-payments.<your-subdomain>.workers.dev`).
That URL needs to be pasted into `PAYMENTS_API` in `../index.html`.

## Robokassa dashboard

Set the **ResultURL** (second, server-to-server one — labelled "Result URL"
in Robokassa's technical settings) to:

```
https://put-numerology-payments.<your-subdomain>.workers.dev/result
```

Method: whichever Robokassa sends by default (the Worker accepts both GET
and POST). SuccessURL/FailURL are generated per-payment by `/pay` itself and
don't need to be configured in the dashboard.

## Test mode

`IsTest=1` is hardcoded in `/pay` for now — Robokassa test-mode card numbers
work against it, no real money moves. Remove that flag (and swap in
production Merchant Login/passwords) once ready to go live, and revisit
54-FZ fiscal receipt requirements at that point — not implemented here yet.
