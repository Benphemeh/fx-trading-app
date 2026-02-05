# FX Trading App – Backend

Backend for an FX Trading App. Users register with OTP, verify email, fund multi-currency wallets, and trade/convert currencies using real-time FX rates. Built with **NestJS**, **TypeORM**, **PostgreSQL**, and **Redis**.

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### 1. Clone and install

```bash
git clone <repo-url>
cd credpal
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required: `DB_*`, `REDIS_*`, `JWT_SECRET`, `EXCHANGE_RATE_API_KEY`. Optional: `RESEND_API_KEY` or `MAIL_*` for OTP emails (see `.env.example`).

### 3. Database

```bash
createdb fx_trading
```

### 4. Run

```bash
npm run start:dev
```

- API: `http://localhost:3000`
- **Swagger API docs:** `http://localhost:3000/api/docs`

### 5. Testing role-based access (Admin)

**For evaluators:** Admin is not tied to any pre-configured email in the repo. To test admin endpoints:

1. In your local `.env`, set `ADMIN_EMAILS` to **your own email** (the one you will use to register), e.g.  
   `ADMIN_EMAILS=your-email@example.com`
2. Restart the app, then **register** and **verify OTP** with that same email.
3. The verify response will include `"role": "ADMIN"`. Copy the `access_token`.
4. In Swagger (`/api/docs`), click **Authorize**, paste the token, then call:
   - `GET /admin/users` — list users
   - `GET /admin/transactions` — list all transactions

Anyone testing the app can become an admin by adding their email to `ADMIN_EMAILS` and completing registration + OTP verify.

## API Documentation

Interactive API documentation is available at **`/api/docs`** (Swagger UI) when the app is running. Includes:

- POST `/auth/register` — Register and send OTP
- POST `/auth/verify` — Verify OTP and get JWT
- GET `/wallet` — Wallet balances (JWT required)
- POST `/wallet/fund` — Fund wallet
- POST `/wallet/convert` — Convert between currencies
- POST `/wallet/trade` — Trade NGN ↔ others
- GET `/fx/rates?base=USD` — FX rates (cached)
- GET `/transactions` — Transaction history
- GET `/admin/users` — List users (Admin only)
- GET `/admin/transactions` — List all transactions (Admin only)

All wallet, FX, and transaction endpoints require **Bearer JWT** and **verified email**. Admin endpoints require **ADMIN** role.

## Key Assumptions

- **Wallet model** — One row per user per currency. Balances in minor units (kobo, cents) to avoid floating-point errors.
- **FX rates** — ExchangeRate-API v6, cached in Redis. Stale cache fallback on API failure.
- **Supported currencies** — NGN, USD, EUR, GBP (configurable via `SUPPORTED_CURRENCIES`).
- **Idempotency** — `fund`, `convert`, and `trade` accept optional `idempotencyKey`. Duplicate requests with the same key return the same result without re-executing.
- **Atomicity** — All balance changes run in a single transaction. Atomic SQL updates prevent double-spending.

## Summary of Architectural Decisions

- **Modular structure** — `src/modules/` (auth, user, wallet, fx, transactions). Business logic in services; thin controllers; repositories for data access.
- **Repository pattern** — Encapsulated TypeORM usage. Atomic `addBalance` / `subtractBalance` within transactions.
- **Security** — JWT after OTP verification; `VerifiedUserGuard`; rate limiting (Throttler); input validation (class-validator).
- **Resilience** — FX API retries (3 attempts), stale cache fallback on failure.
- **Precision** — Minor units for all amounts. `getMinorUnitMultiplier` for conversions.

## Scaling Considerations

For millions of users, consider:

- **Database**
  - Read replicas for GET-heavy endpoints (wallet, transactions). Writes stay on primary.
  - Connection pooling (e.g. PgBouncer) to limit connections per instance.
  - Sharding by `userId` if a single DB becomes a bottleneck; wallet and transaction data partition naturally by user.
- **Redis**
  - Redis Cluster for FX cache high availability and horizontal scaling.
  - Separate cache instances for FX rates vs session/cache if needed.
- **Application**
  - Stateless API instances behind a load balancer (e.g. nginx, AWS ALB). JWT auth supports horizontal scaling.
  - Queue (e.g. Bull) for heavy or async work (e.g. email, analytics) to decouple from request path.
- **FX rates**
  - Cached rates reduce external API load. TTL tuning balances freshness vs load.
  - Multiple base-currency caches can be pre-warmed by a background job.

## Role-Based Access

The app supports **USER** and **ADMIN** roles.

- **USER** (default): Register, verify, fund, convert, trade, view own wallet and transactions.
- **ADMIN**: Same as USER plus:
  - `GET /admin/users` — List users (paginated).
  - `GET /admin/transactions` — List all transactions across users (paginated).

To grant admin access, set `ADMIN_EMAILS` in `.env` (comma-separated emails). Users who verify with those emails receive the ADMIN role. Example:

```env
ADMIN_EMAILS=admin@example.com,support@example.com
```

## Tests

```bash
npm run test
```

Unit tests cover auth, FX rates, wallet (balance, fund, convert, trade, idempotency, validation), and transactions.

## License

MIT
