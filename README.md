# Creative Furniture — Backend API

A production-grade TypeScript/Node.js backend for a furniture e-commerce platform ("Creative Furniture"). It serves two surfaces: a **customer storefront** (browse, cart, checkout, account) and an **admin panel** (product/order/inventory management + a real-time analytics dashboard).

The service is built around Express + MongoDB, with payments handled via Paystack, transactional email delivered asynchronously through BullMQ + Redis, and live admin updates pushed over Socket.IO using MongoDB change streams.

---

## Features

- **Authentication & accounts** — JWT-based sessions (rotating access + refresh tokens), email verification, password reset, login lockout after 5 failed attempts, JWT revocation via a token blocklist.
- **Product catalog** — CRUD (admin), listing with category filter + price sorting, "latest products", per-product detail, Cloudinary-backed image uploads.
- **Shopping cart** — authenticated, per-user cart with quantity updates, merge-from-guest-cart support, live total calculation.
- **Orders** — user order history, admin listing, status transitions, archival; `Order → Shipped` triggers an async shipping email.
- **Payments (Paystack)** — initialize/verify/webhook flow with HMAC-SHA-512 signature verification, idempotency keys, atomic stock decrement via MongoDB transactions, and **automatic refunds** when stock cannot be fulfilled.
- **Admin dashboard** — paginated metrics (sales / inventory / customers / finance), zero-filled sales chart, live updates over Socket.IO.
- **Email pipeline** — every transactional email (welcome, verification, password reset, payment success/failure, refund, shipping) is enqueued in BullMQ with retries and de-duplication.
- **Background jobs** — hourly cron cleans expired blocklist entries, stale verification tokens, and resets failed-login counters.
- **Security hardening** — Helmet, CORS allow-list, three tiers of rate limiting, in-memory image upload filters, bcrypt password hashing.
- **Graceful shutdown** — closes the BullMQ worker and MongoDB connection on `SIGINT`/`SIGTERM`.

---

## Tech Stack

| Layer | Tools |
|---|---|
| Runtime | Node.js, TypeScript 5, Express 4 |
| Database | MongoDB (Mongoose 8) — replica set required for change streams & transactions |
| Auth | JWT (`jsonwebtoken`), bcrypt, `cookie-parser` |
| Validation / Security | `helmet`, `cors`, `express-rate-limit`, `validator` |
| Async jobs | BullMQ + ioredis (Upstash Redis) |
| Email | Nodemailer (Gmail SMTP) |
| Real-time | Socket.IO 4 + MongoDB change streams |
| Payments | Paystack (REST API + webhooks) |
| File storage | Cloudinary (streamed buffer upload) |
| Uploads | Multer (in-memory, image-only) |
| Scheduling | node-cron |
| Testing | Jest + ts-jest |
| CI | GitHub Actions (typecheck → build → tests) |

---

## Project Structure

```
backend-Project/
├── server.ts                 # Entry: connect Mongo → Express + Socket.IO → mount routes → start cron & worker
├── package.json
├── jest.config.js
├── tsconfig.json / tsconfig.build.json
├── .env                      # Secrets (Mongo, JWT, Redis, Cloudinary, Paystack, SMTP)
├── .github/workflows/ci.yml  # CI pipeline
├── config/                   # corsOrigin, socket, changeStream, paystack, redis
├── controllers/              # 8 controllers
├── middleware/               # auth, adminAuth, multer, rateLimiter
├── models/                   # 7 Mongoose models
├── routes/                   # 8 Express routers (mounted under /api)
├── types/                    # express.d.ts (Request augmentation)
├── utils/                    # root utilities + notification/ + payment/
├── test/                     # 7 Jest test files
└── uploads/                  # placeholder (uploads go to Cloudinary)
```

---

## API Routes

All routes are mounted under **`/api`**.

### User authentication — `/api`
| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create account, queue verification email |
| POST | `/login` | Authenticate, issue JWT pair (cookie-based) |
| POST | `/logoutUser` | Blocklist access token, clear refresh cookie |
| GET | `/verify-email` | Confirm 6-digit OTP |
| POST | `/resend-verification` | Resend OTP (5-minute cooldown) |
| GET | `/user/profile` | Current user + order status counts |
| POST | `/forgot-password` | Start password reset (5-minute cooldown) |
| GET | `/verify-reset-token` | Validate reset token |
| POST | `/reset-password` | Update password, send confirmation email |

### Products — `/api`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/add` | admin | Create product (Cloudinary image upload) |
| PUT | `/update/:id` | admin | Update product (optional image replace) |
| DELETE | `/remove/:id` | admin | Delete product + Cloudinary asset |
| GET | `/single/:id` | public | Product detail |
| GET | `/products` | public | List with `?category=` and `?sort=low-high\|high-low` |
| GET | `/latest` | public | 8 newest products |
| GET | `/categories` | public | List categories with counts |
| GET | `/categories/:category` | public | Products in a category |

### Cart — `/api/cart` *(auth + verified)*
- `GET /items` — list items with live total
- `POST /add/` — add `{ productId, quantity }`
- `POST /remove` — remove `{ productId }`
- `PATCH /quantity` — adjust by `{ productId, delta }` (aggregation pipeline)
- `DELETE /clear` — empty cart
- `POST /merge` — merge a guest cart into the user cart

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/user-orders` | user | The user's orders |
| GET | `/orders/:id` | user | Single order (ownership-checked) |
| POST | `/list-orders` | admin | All orders (paginated, populated) |
| POST | `/status` | admin | Update order status (sends shipping email on Pending→Shipped) |
| POST | `/delete-order` | admin | Delete (refuses if a successful payment exists) |
| POST | `/archive-order` | admin | Archive an order |

### Admin — `/api`
| Method | Path | Description |
|---|---|---|
| POST | `/register-admin` | Register a new admin |
| POST | `/login-admin` | Issue admin JWT pair |
| POST | `/logout-admin` | Blocklist admin token |
| POST | `/verify-token` | Validate admin JWT |

### Refresh — `/api`
- `POST /refresh-token` — rotate access + refresh pair (works for users and admins)

### Payments — `/api/paystack`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/init` | user + verified | Initialize transaction (requires `Idempotency-Key` header) |
| GET | `/verify/:reference/:orderId` | user + verified | Verify by reference |
| POST | `/webhook` | signature-verified | Handle `charge.success` / `charge.failed` |

### Dashboard — `/api` *(admin only)*
| Method | Path | Description |
|---|---|---|
| GET | `/dash-metrics` | Aggregated metrics (period + pagination query params) |
| GET | `/metrics/:metricType` | One of `sales`, `inventory`, `customers`, `finance` |
| GET | `/sales-chart` | Zero-filled daily sales for the last *N* days |

---

## Data Models

| Model | Key fields |
|---|---|
| **User** | `username`, `email`, `password` (bcrypt), `verified`, verification/reset token fields, failed-login counters, hashed refresh token |
| **Admin** | `email`, `password`, hashed refresh token |
| **Product** | `name`, `description`, `images[]`, `imagePublicId`, `price`, `category`, `quantity`, `isOutOfStock` |
| **Cart** | `user`, `items[{ productId, quantity }]` |
| **Order** | `userId`, `items[]`, `amount`, `status` (Pending/Shipped/Delivered/Cancelled), `shippingDetails`, `isPaid`, `isArchived` |
| **Payment** | `orderId`, `provider`, `reference`, `idempotencyKey`, `amount`, `currency`, `status`, refund fields, `gatewayResponse` |
| **TokenBlocklist** | `token` (unique, indexed), `expiresAt` |

---

## Architecture Highlights

- **Async email pipeline** — every transactional email is enqueued in BullMQ (`email-notifications` queue), retried with exponential backoff, and de-duplicated by `jobId`. If Redis is unreachable, the system falls back to a direct Nodemailer send.
- **Real-time dashboard** — MongoDB change streams watch `Order` and `Product`. Relevant insert/update/delete events are fanned out to the `dashboard-updates` Socket.IO room; auto-reconnects on failure.
- **Payment integrity** — the `Idempotency-Key` header is regex-validated and stored as a unique index. Webhooks verify Paystack signatures with constant-time HMAC SHA-512 over the raw request body. Successful charges atomically decrement stock via a Mongo transaction; if stock validation fails, the order is cancelled and Paystack is asked for a refund automatically.
- **JWT rotation & revocation** — short-lived access token (15 min) + long-lived refresh token (7 days, hashed at rest), with a `TokenBlocklist` collection cleaned every hour by cron.
- **Layered rate limiting** — `generalLimiter` (100/15 min global), `authLimiter` (10/15 min), `emailLimiter` (5/10 min).
- **Graceful shutdown** — `SIGINT`/`SIGTERM` close the BullMQ worker and MongoDB connection before exit.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB **replica set** (required for transactions and change streams — a free Atlas cluster works)
- A Redis instance (Upstash recommended)
- Paystack, Cloudinary, and Gmail SMTP credentials

### Installation
```bash
git clone <repo-url>
cd backend-Project
npm install
```

### Environment variables (`.env`)
```dotenv
PORT=5000
MONGODB_URL=mongodb+srv://...
ACCESS_TOKEN_SECRET=...
REFRESH_TOKEN_SECRET=...
REDIS_URL=rediss://...           # Upstash
PAYSTACK_SECRET_KEY=...
PAYSTACK_WEBHOOK_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SMTP_USER=...
SMTP_PASS=...
ADMIN_REGISTRATION_SECRET=...
```

### Run
```bash
npm run start       # dev server (ts-node-dev, hot reload)
npm run typecheck   # tsc --noEmit
npm run build       # tsc -p tsconfig.build.json
npm test            # Jest
```

The server boots at `http://localhost:$PORT`. On startup it connects to MongoDB, starts the BullMQ email worker, and schedules the cleanup cron job.

---

## Testing

Tests are written with Jest + ts-jest and live in `test/`. They mock external services (Mongo, Paystack, Nodemailer, Cloudinary, Redis) and exercise the controllers and core utilities:

- `cartController.test.ts`
- `cartUtils.test.ts`
- `paymentController.test.ts`
- `paymentService.test.ts`
- `stockUtils.test.ts`
- `dashboardController.test.ts`
- `notification.test.ts`

Run them with `npm test`. The CI workflow (`.github/workflows/ci.yml`) runs `npm run typecheck` and `npm run build` before executing the test suite.

---

## License

ISC — © Bello Ayoola
