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

All wallet, FX, and transaction endpoints require **Bearer JWT** and **verified email**.

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

## Tests

```bash
npm run test
```

Unit tests cover auth, FX rates, wallet (balance, fund, convert, trade, idempotency, validation), and transactions.

## License

MIT
