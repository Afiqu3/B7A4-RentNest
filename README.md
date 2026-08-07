# RentNest API

Backend REST API for a property-rental platform connecting **tenants**, **landlords**, and **admins**. Tenants browse available properties, request rentals, and pay via Stripe; landlords list properties, approve requests, and track their portfolio; admins manage users, categories, and see platform-wide statistics.

Built with Express 5 + TypeScript, PostgreSQL via Prisma 7, JWT auth, and Stripe Checkout.

## Live API

- Production base URL: https://rent-nest-eta.vercel.app/
- Health check endpoint: `GET /`
- Use this URL for deployed API testing and integration.

---

## Tech stack

| Concern | Choice |
|---|---|
| Runtime / framework | Node.js, Express 5 (ES modules, TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`) |
| Auth | JWT (access + refresh), bcryptjs, cookie- or header-based |
| Payments | Stripe Checkout + webhooks (BDT) |
| Validation | Zod 4 (per-route middleware) |
| Bundler | tsup (ESM output to `dist/`) |
| Scheduling | Vercel Cron → HTTP endpoint (node-cron helper also available) |
| Hosting | Vercel (`vercel.json`) |

---

## Project structure

```
src/
  app.ts                 # Express app: middleware + route mounting
  server.ts              # Connects Prisma, starts the HTTP server
  config/                # Env config object
  lib/                   # prisma client, stripe client, node-cron scheduler
  middlewares/           # auth, validateRequest, globalErrorHandler, notFound
  utils/                 # catchAsync, jwt, sendResponse
  modules/
    auth/                # register, login, profile, admin user mgmt, overviews
    category/            # property categories (soft-deletable)
    property/            # listings + search
    rentalRequest/       # tenant rental requests + lifecycle
    payment/             # Stripe checkout, webhook, history
    review/              # tenant reviews after a completed rental
    cron/                # HTTP-triggered scheduled jobs
prisma/
  schema/                # one .prisma file per model
  migrations/            # SQL migrations (incl. hand-written partial indexes)
generated/prisma/        # generated Prisma client (git-ignored)
```

Most feature modules follow a `route → controller → service` split, with `interface.ts` for types and `validation.ts` for Zod schemas. Exceptions: `payment` has no Zod schemas and adds `payment.utils.ts`; `rentalRequest` validates inside the service instead of via middleware; `cron` is a single route file with the handler inlined.

> The Prisma client is generated **outside** `node_modules`, into `generated/prisma/` at the repo root. Source files import from `../../generated/prisma/client` and `.../enums`. Run `prisma generate` after any schema change (`postinstall` and `build` already do this).

---

## Getting started

### Prerequisites

Node.js 20+ (not enforced — there is no `engines` field), a PostgreSQL database, and a Stripe account (for payments).

### Install

```bash
npm install     # postinstall runs `prisma generate`
```

### Environment

Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PORT=5000
APP_URL=http://localhost:3000
BCRYPT_SALT_ROUNDS=10
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
CRON_SECRET=some_long_random_string   # optional; protects /api/cron/*
```

- `APP_URL` is used for **both** the CORS origin and the Stripe success/cancel redirect targets, so it should point at your **frontend** origin (e.g. `http://localhost:3000` locally, your deployed frontend in production).
- `CRON_SECRET` is optional and **not** listed in `.env.example`. It is read directly via `process.env.CRON_SECRET` in `cron.route.ts` rather than through `src/config`. If set, `/api/cron/*` requires `Authorization: Bearer <CRON_SECRET>`; if unset, the endpoint is open — set it in production.
- `STRIPE_PRODUCT_PRICE_ID` is read by `src/config/index.ts` but unused (checkout builds inline `price_data`), so it can be omitted.

### Database

```bash
npx prisma migrate deploy   # apply migrations
npx prisma generate         # generate the client into generated/prisma
```

### Run

```bash
npm run dev     # tsx watch src/server.ts
npm run build   # prisma generate && tsup  ->  dist/server.js (ESM)
npm start       # node dist/server.js
```

> `package.json` also defines `npm run seed`, but `prisma/seed.ts` does not exist yet — the script currently fails.

For local Stripe webhooks:

```bash
npm run stripe  # stripe listen --forward-to http://localhost:5000/api/payments/confirm
```

> The `stripe` script targets port `5000`, matching the `PORT` default in `src/config`. If you change `PORT`, update the script too.

---

## Conventions

### Response envelope

Successful JSON responses go through `sendResponse`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "…",
  "data": {},
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

`meta` is only present on paginated endpoints. (`totalPages` is returned at runtime by every paginated service but is not yet part of the `TMeta` type in `src/utils/sendResponse.ts`.)

### Authentication

Send the access token either as an `httpOnly` cookie (`accessToken`, set automatically on login) or as an `Authorization: Bearer <token>` header. Protected routes also enforce **roles** — a valid token with the wrong role is rejected. Blocked users (`activeStatus: BLOCKED`) are denied at login, on refresh, and on every authenticated request.

Roles: `TENANT` (default on register), `LANDLORD`, `ADMIN`. `POST /api/auth/register` only accepts `TENANT` or `LANDLORD`; admins are seeded/promoted directly in the database.

Cookies: `accessToken` (1 day) and `refreshToken` (7 days), both `httpOnly`, `sameSite: none`, `secure: false`. Because browsers reject `SameSite=None` cookies that are not `Secure`, cookie auth will not work cross-site from a real browser — use the `Authorization: Bearer` header for cross-origin clients until `secure` is made environment-aware.

### Errors

Errors return:

```json
{
  "success": false,
  "statusCode": 400,
  "name": "ZodError",
  "message": "Validation failed.",
  "errors": [{ "path": "email", "message": "invalid email address" }],
  "error": "…stack trace…"
}
```

`errors` is always present (empty for non-Zod errors), and `error` carries the stack trace.

Mappings in `globalErrorHandler`:

| Error | Status |
|---|---|
| `ZodError` | `400` (with per-field `errors`) |
| `PrismaClientValidationError` | `400` |
| Prisma `P2002` / `P2003` / `P2025` | `409` / `400` / `404` |
| Any other `PrismaClientKnownRequestError` | `400`, raw Prisma message |
| Prisma `P1000` / `P1001` | `401` / `503` |
| `PrismaClientUnknownRequestError` | `500` |
| Anything with a `statusCode` property | that status |

Unmatched routes return a plain `404` `{ message, path, date }` body from `notFound`.

> **Known gap:** business-rule and authorization failures (wrong password, wrong role, blocked account, "You are not the owner of this property!", "This property is no longer available for rent.", "You are not allowed to review yet!") are thrown as plain `Error`s, so they surface as **`500`** with the message in `message` rather than `400`/`401`/`403`. The same applies to expired or invalid JWTs: `jwtUtils.verifyToken` swallows the original jwt error and re-throws a plain `Error`, which makes the `TokenExpiredError`/`JsonWebTokenError` → `401` branches in `globalErrorHandler` unreachable. Introducing an `AppError` class with a `statusCode` would fix all of these at once.

---

## Domain lifecycle

**Rental status:** `PENDING` → `APPROVED` → `ACTIVE` → `COMPLETED` (or `REJECTED`).

1. Tenant submits a request → `PENDING`, and a `PENDING` `Payment` row is created in the same transaction (amount = one month's rent).
2. Landlord approves → `APPROVED` (or `REJECTED`). Only those two values are accepted as targets; note that the *current* status is not checked, so an `ACTIVE` or `COMPLETED` request can still be flipped.
3. Tenant pays via Stripe Checkout → the webhook marks the payment `COMPLETED`, the rental `ACTIVE`, and the property `RENTED`.
4. When `endDate` (computed at request time as `moveInDate` + `durationMonths`) passes, the expiry job marks the rental `COMPLETED` and frees the property back to `AVAILABLE`.
5. Once `COMPLETED`, the tenant may leave exactly one review for that rental.

**Property status:** `AVAILABLE` → `RENTED` → `AVAILABLE` (plus `UNAVAILABLE`, set manually or on soft-delete).

Integrity guarantees enforced at the DB level via hand-written partial unique indexes: at most one *open* rental request (`PENDING`/`APPROVED`/`ACTIVE`) per tenant + property, and at most one *active* rental per property. Terminal states (`REJECTED`/`COMPLETED`) may repeat, so repeat rentals work.

Soft deletes: `Property.deletedAt` and `Category.deletedAt`. Deleting a property also sets its status to `UNAVAILABLE`. Filtering is not universal — the public/landlord property queries and the category list exclude soft-deleted rows, but the admin `GET /api/properties` list and the category update/delete paths do not.

---

## Data model

| Model | Notes |
|---|---|
| `User` (`users`) | `name` (VarChar 255), `email` (unique), `phone`, `password` (bcrypt), `role` (default `TENANT`), `activeStatus` (default `ACTIVE`). |
| `Category` (`categories`) | `name` (unique), `deletedAt` (soft delete). |
| `Property` (`properties`) | `title`, `description`, `image`, `location`, `address`, `rentAmount` (Decimal 10,2), `bedrooms` (default 1), `bathrooms` (default 1), `areaSquareFt?` (`Int?`), `amenities` (String[]), `status` (default `AVAILABLE`), `landlordId`, `categoryId`, `deletedAt`. |
| `RentalRequest` (`rental_requests`) | `status`, `moveInDate`, `durationMonths` (default 1, DB `CHECK >= 1`), `endDate?`, `tenantId`, `propertyId`; one `Payment` and one `Review`. Indexed on `[status, endDate]` for the expiry job. |
| `Payment` (`payments`) | `transactionId?` (unique), `amount` (Decimal 10,2), `status`, `paidAt?`, `rentalRequestId` (unique), `tenantId`. |
| `Review` (`reviews`) | `rating` (1–5 — enforced by Zod, again in the service, and by the `rating_range_check` DB constraint), `comment?`, `tenantId`, `propertyId`, `rentalRequestId` (unique — this is what limits a rental to one review; a second attempt hits `P2002` → `409`). |

---

## API reference

Base URL: `http://localhost:<PORT>` or `https://rent-nest-eta.vercel.app/`
**Auth** column = required role(s); "Public" = no token needed.

### Auth — `/api/auth`

| Method | Path | Auth | Body / Query | Description |
|---|---|---|---|---|
| POST | `/register` | Public | `{ name, email, password, phone, role? }` | Register a user. `name` 2–100, `password` **min 4**, `phone` 10–15; `role` may be `TENANT` or `LANDLORD` (default `TENANT`). Returns `data.user` (password omitted) — note this is the one endpoint that nests its payload. |
| POST | `/login` | Public | `{ email, password }` | Log in; sets `accessToken`/`refreshToken` cookies and returns both tokens. |
| POST | `/refresh-token` | Public (uses `refreshToken` cookie) | — | Issue a new access token and reset the `accessToken` cookie. |
| POST | `/logout` | Public | — | Clear both auth cookies. |
| GET | `/me` | TENANT, LANDLORD, ADMIN | — | Current user's profile. |
| PATCH | `/my-profile` | TENANT, LANDLORD, ADMIN | `{ name?, phone? }` (at least one) | Update own name/phone. |
| GET | `/users` | ADMIN | `?page&limit&search` | Paginated list of landlords and tenants; `search` matches name (case-insensitive). Returns `data` + `meta`. *Known issue: `meta.total`/`totalPages` are computed with an unfiltered `count()`, so they include admins and ignore `search`.* |
| PUT | `/users/:userId` | ADMIN | `{ activeStatus: "ACTIVE" \| "BLOCKED" }` | Block/unblock a user. |
| GET | `/overview` | ADMIN | — | Platform statistics — user counts by status/role, property counts by status, rental-request counts by status. |
| GET | `/landlord-overview` | LANDLORD | — | The landlord's own stats: `totalProperties`, `totalActiveRequests`. |

### Categories — `/api/categories`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/` | ADMIN | `{ name }` | Create a category. |
| GET | `/` | ADMIN, LANDLORD, TENANT | — | List non-deleted categories. |
| PUT | `/:categoryId` | ADMIN | `{ name }` | Rename a category. |
| DELETE | `/:categoryId` | ADMIN | — | Soft-delete a category (sets `deletedAt`). |

### Properties — `/api/properties`

| Method | Path | Auth | Body / Query | Description |
|---|---|---|---|---|
| POST | `/` | LANDLORD | `{ title, description, image, location, address, rentAmount, bedrooms, bathrooms, areaSquareFt?, amenities[], status, categoryId }` | Create a listing. `image` and `status` are required by the Zod schema (even though the column defaults to `AVAILABLE`); `amenities` must be non-empty. `areaSquareFt` is validated as a positive *number*, not an integer, while the column is `Int?` — a fractional value passes validation and then fails at the DB. |
| GET | `/` | ADMIN | `?page&limit` | Paginated list of **all** properties (including soft-deleted). Returns `data` + `meta`. |
| GET | `/my-properties` | LANDLORD | `?page&limit` | Paginated list of the landlord's own non-deleted properties. Returns `data` + `meta`. |
| GET | `/available` | Public | See below | Paginated search over available properties. Returns `data` + `meta`. |
| GET | `/:propertyId` | Public | — | Public property detail (with category). Errors if the property is soft-deleted or not `AVAILABLE`. |
| GET | `/:propertyId/user` | TENANT, LANDLORD, ADMIN | — | Same as above **plus** landlord contact details (name, phone, email). |
| PATCH | `/:propertyId` | LANDLORD | Any subset of the create body | Update own property. Rejected if you don't own it or it's soft-deleted. |
| DELETE | `/:propertyId` | LANDLORD | — | Soft-delete own property and set status `UNAVAILABLE`. |

**`GET /available` query params:** `searchTerm` (matches `location`, case-insensitive), `minPrice`, `maxPrice`, `categoryId`, `amenities` (JSON array string, e.g. `["wifi","parking"]` — matches properties having **any** of them), `page` (default 1), `limit` (default 10), `sortBy` (default `createdAt`), `sortOrder` (`asc`|`desc`, default `desc`).

Two caveats on that endpoint: `minPrice`/`maxPrice` collapse into a single filter that only fires when at least one is present and always applies `gte` (0 when absent), so `?maxPrice=0` is ignored; and `amenities` is passed to a bare `JSON.parse`, so a malformed value throws and surfaces as a `500`.

### Rental requests — `/api/rentals`

| Method | Path | Auth | Body / Query | Description |
|---|---|---|---|---|
| POST | `/:propertyId` | TENANT | `{ moveInDate, durationMonths? }` | Submit a rental request and create the pending payment. **Not Zod-validated** — `durationMonths` is checked in the service (whole number ≥ 1, default 1), and `moveInDate` is unvalidated, so a missing or garbage value becomes an `Invalid Date` and fails at the DB layer. Rejected if you already have an open request for this property. |
| GET | `/` | ADMIN | `?page&limit` | Paginated list of all requests, with property, landlord, tenant and payment status. Returns `data` + `meta`. |
| GET | `/my-rental` | LANDLORD | — | All requests on the landlord's properties, with tenant contact details. |
| GET | `/my-request` | TENANT | — | The tenant's own requests, with property details. |
| PUT | `/:requestId/status` | LANDLORD | `{ status: "APPROVED" \| "REJECTED" }` | Approve or reject. Also **not Zod-validated** — the check lives in the service. The landlord must own the property; any other target value is rejected, but the current status is not checked. |

### Payments — `/api/payments`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/checkout/:rentalRequestId` | TENANT | Create a Stripe Checkout session; returns `{ transactionResult: "<checkout url>" }`. Total = monthly rent × `durationMonths`, charged in **BDT** via inline `price_data`, card only. Rejected if the property is no longer `AVAILABLE`. Redirects to `${APP_URL}/dashboard/payments/success` or `.../cancel`. *Note: it does not verify the rental request is `APPROVED` or that the payment is still `PENDING`, so a `PENDING` request can be paid and a second session can be opened for an already-completed payment.* |
| POST | `/confirm` | Stripe (webhook) | Stripe webhook endpoint. Mounted with `express.raw` (before `express.json`) and verified against `STRIPE_WEBHOOK_SECRET` via the `stripe-signature` header. On `checkout.session.completed` with `payment_status: paid`, fulfills the payment and activates the rental. Unhandled event types are logged and still answered `200`; a signature-verification failure currently returns `500` rather than `400`. |
| GET | `/history` | TENANT | The authenticated tenant's payment history, with rental and property details. |

### Reviews — `/api/reviews`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/:rentalRequestId` | TENANT | `{ rating, comment? }` | Leave one review for a **completed** rental. `rating` is an integer 1–5; `comment` max 1000 chars. |
| GET | `/:rentalRequestId/exists` | TENANT | — | Returns `true`/`false` — whether a review already exists for that rental. *The lookup is not scoped to the calling tenant, so any tenant can probe any rental-request id.* |
| GET | `/landlord-reviews` | LANDLORD | — | All reviews left on the landlord's properties. |

### Cron — `/api/cron`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expire-rentals` | `Bearer $CRON_SECRET` (if `CRON_SECRET` is set) | Runs `expireOverdueRentals` and returns `data: { scanned, completed }`. This route hand-rolls its response instead of using `sendResponse`, so there is no `statusCode` field in the body. |

### Misc

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check — returns `Hello, World!`. |

---

## Scheduled jobs

`expireOverdueRentals` (in `rentalRequest.service.ts`) finds `ACTIVE` rentals whose `endDate` has passed, marks them `COMPLETED`, and frees their properties back to `AVAILABLE`. Each rental is processed in its own transaction, so the job is idempotent and safe to re-run.

**In production (Vercel):** serverless functions can't host long-running timers, so the job is invoked over HTTP. `vercel.json` declares a cron that calls `GET /api/cron/expire-rentals` daily at `0 5 * * *` (05:00 UTC). Set `CRON_SECRET` in the Vercel project's environment variables so the endpoint isn't publicly callable.

**In a long-running Node process:** `src/lib/scheduler.ts` exports `startScheduledJobs()`, which registers the same job with `node-cron` at `5 0 * * *` (00:05). It is not wired into `src/server.ts` by default — call it from `main()` if you deploy to a traditional server instead of Vercel.

---

## Deployment

Deployed on Vercel via `vercel.json`, which uses the legacy `version: 2` + `builds`/`routes` form: `dist/server.js` is built with `@vercel/node` and all routes are rewritten to it. `npm run build` (`prisma generate && tsup`) produces that bundle — since there is no explicit `buildCommand`, make sure `dist/` is produced by Vercel's default build detection (or committed) before deploying.

Remember to set every variable from the environment list above — including `CRON_SECRET` — in the Vercel project settings.
