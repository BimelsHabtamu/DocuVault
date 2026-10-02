<p align="center">
  <img src="client/public/logo.png" alt="DocuVault Logo" width="120" />
</p>

<h1 align="center">DocuVault</h1>

<p align="center">
  <strong>Automated document generation · E-signature · Secure delivery · Tamper-evident verification</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Puppeteer-PDF_Engine-40B5A4?logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/i18n-English_%7C_Amharic-blueviolet" />
</p>

---

DocuVault replaces the manual "open Word → retype every name → print → get it signed → scan → archive" workflow with a single web application purpose-built for institutional document operations. Documents are generated from live database records, routed through an approval and e-signature chain, delivered over OTP-protected links, and publicly verifiable by anyone who holds a copy — with no login required to verify.

---

## Table of Contents

- [Why DocuVault](#why-docuvault)
- [Core Features](#core-features)
- [Document Integrity Model](#document-integrity-model)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Security Notes](#security-notes)
- [Project Status](#project-status)

---

## Why DocuVault

Institutional document work — employment letters, certificates, HR forms, financial reports — is almost always the same repeated task over the same underlying records. Three problems come with that:

1. **Slow and error-prone.** Every document is retyped by hand. One wrong name means reprinting, re-signing, and re-delivering from scratch.
2. **Untraceable.** There is no reliable record of who generated, viewed, approved, signed, or downloaded a given document.
3. **Unverifiable.** Once a signed document becomes a scanned PDF, a recipient has no way to tell whether it was altered after signing.

DocuVault solves all three: generation is automated from source data, every action is written to an immutable audit log, and every document carries a cryptographic signature and a public verification channel.

---

## Core Features

### Template Engine

Administrators build templates in a rich-text editor and bind them to a data source table.

- **Dotted-path placeholders** — `{{employee.full_name}}`, `{{employee.department}}`
- **Conditional blocks** — `{{#if employee.salary > 5000}}...{{/if}}`
- **Looping blocks** — `{{#each employee.leave_history}}...{{/each}}`
- **PII filters** — `{{employee.salary|redact}}` suppresses sensitive values
- **Dual calendar dates** — auto-filled Gregorian (`{{generation_date_gc}}`) and Ethiopian (`{{generation_date_ec}}`) formats
- **Branding** — uploadable organization logo, programmatically generated company seal
- **Watermarks** — status-driven (CONFIDENTIAL, FINAL; DRAFT is applied automatically to unsigned documents)
- **Versioning** — editing a template creates a new version linked to its lineage; the list always shows only the latest version per template family
- **Archival** — templates can be archived without deletion

### PDF Generation

- Server-side rendering via **Puppeteer** (headless Chromium) with bundled Unicode font support for Amharic and other non-Latin scripts
- Post-processing with **pdf-lib** for digital signature embedding
- **QR codes** embedded in every document for authenticity verification
- Live preview before committing to a generation run
- **Pre-flight validation** — any unresolved placeholder, failed conditional, or dead loop is reported with its exact token; malformed documents are never silently generated

### Bulk Generation

- Generate hundreds of documents from hundreds of records in a single job
- **Redis-backed BullMQ queue** with live per-record progress reporting
- Job state persists in Redis, so progress survives a server restart
- Failures are isolated per record and reported individually
- Download the entire run as a single ZIP archive

### Approval & E-Signature

- Generator submits a document to a named Approver
- Approver receives a **one-time, no-login, 24-hour JWT-secured review link** via email
- **OTP confirmation** (6 digits, 3-attempt max, 15-minute lockout) before the signature is accepted
- **HMAC-SHA256 digital signature** embedded into the PDF footer with an **NTP-synced timestamp** — clock cannot be manipulated to backdate a signature
- Per-approver signing secrets stored **AES-256-GCM encrypted** at rest; never returned to the client
- Rejection routes back to the Generator with a one-time notification link; the Generator can edit and resubmit

### Secure Delivery

- Tokenised delivery links with **OTP verification**, configurable expiry, and single-use enforcement
- **Recipient cross-validation** — the entered email is verified against the original source data record, so documents cannot be misdirected even if the Generator types a wrong address
- Ownership confirmation or rejection — the sender knows the document reached the right person
- Download logs capture IP address, browser (User-Agent), and timestamp
- **Hand-delivery marking** and **document revocation** supported after delivery
- Recipients can preview before downloading

### Verification

Three independent verification modes — all **public and login-free**:

| Mode | How |
|---|---|
| Document ID | Paste the document's `DOC-YYYYMMDD-XXXXX` identifier |
| File hash | Upload a PDF; the server recomputes the SHA-256 and compares |
| QR scan | Scan the embedded QR code; links directly to the verification result |

### Audit & Reporting

- Every meaningful action is recorded: preview, generate, sign, reject, deliver, verify, download, view, ownership confirmation, deletion, and more
- **Immutable soft-delete** — deleted documents retain their UUID, hash, and status; verification always returns a result
- KPI dashboard with trend charts and monthly activity reports
- Full-text document search across the audit trail
- CSV export for both the audit trail and monthly reports
- Configurable cold-storage archival of older documents

### Offline Capability

- Service worker caches the application shell
- IndexedDB-backed response cache with a 7-day freshness window
- Cached credential hash allows session restoration while offline
- Explicit, user-visible storage controls — cached data can be reviewed and cleared

### Internationalisation

- Full **English** and **Amharic (አማርኛ)** translations across all screens
- Runtime language switching — no page reload required
- Structured locale namespaces: `auth`, `delivery`, `layout`, `settings`, `shared`, `templates`, `translation`

---

## Document Integrity Model

Every DocuVault document is designed to be independently defensible.

| Step | Mechanism |
|---|---|
| Content fingerprint | SHA-256 hash over the generated PDF bytes, stored at generation time |
| Digital signature | HMAC-SHA256 over `fileHash \| timestamp`, keyed by a per-approver 256-bit secret |
| Secret storage | AES-256-GCM encrypted at rest, one key per approver; never returned to the client |
| Timestamp | Queried from an NTP server (`pool.ntp.org`), not the local system clock |
| Verification ID | Embedded in the document footer as plaintext and as a QR code |
| Public check | Anyone can submit the PDF or scan the QR; the server recomputes the hash and reports `valid` or `altered` |

Because each approver holds a distinct secret, a signature produced by one approver cannot be reproduced by another, and removing an approver's access does not invalidate documents they already signed.

---

## Roles & Permissions

Authorization is enforced **server-side by route middleware**, not by hiding UI elements. Public routes (verification, delivery, QR) are mounted separately so they remain reachable without a session.

| Role | Capabilities |
|---|---|
| `super_admin` | Full access — templates, documents, users, settings, audit logs, external database connections |
| `system_admin` | Templates, documents, approvals, delivery, audit logs; no system settings |
| `generator` | Generate documents from bound templates, track status, resubmit rejected work |
| `approver` | Review, approve, reject, and sign documents assigned to them; can also generate |
| `recipient` | Read-only access to their own delivered documents |

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 18+, Express 4 |
| Database | MySQL 8 (`mysql2/promise`) |
| Job Queue | BullMQ 5 + Redis 7 (`ioredis`) |
| PDF Engine | Puppeteer 25 (headless Chromium) + `pdf-lib` |
| Email | Nodemailer 6 (Gmail SMTP / App Password) |
| SMS (optional) | Twilio |
| Cryptography | `bcrypt`, `jsonwebtoken`, Node `crypto` (AES-256-GCM, HMAC-SHA256, SHA-256) |
| Timestamps | `ntp-client` |
| QR Codes | `qrcode` |
| File Uploads | `multer` |
| Archive | `archiver` (ZIP) |
| External DBs | `better-sqlite3`, `mongodb`, `pg` |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18, Vite 5 |
| Routing | React Router 6 |
| Internationalisation | i18next + react-i18next |
| Icons | @heroicons/react |
| Offline | Service Worker + IndexedDB |

### Infrastructure
| Component | Platform |
|---|---|
| API | Render web service (1 CPU / 2 GB), 10 GB persistent disk |
| Job Queue | Render Key Value (Redis 256 MB, `noeviction`) |
| Database | External managed MySQL (Aiven or equivalent) |
| Frontend | Vercel |

---

## Architecture

```
Browser (React SPA)
       │  Bearer JWT · CORS-restricted to CLIENT_URL
       ▼
 ┌─────────────┐    ┌───────────────────┐
 │  Express API │───▶│  Redis / BullMQ   │──▶  Bulk PDF Worker
 └──────┬──────┘    └───────────────────┘
        │                  │
        │                  └── Job state survives restarts
        ▼
 ┌─────────────┐
 │    MySQL    │  templates · users · documents · signatures
 └──────┬──────┘  deliveries · audit logs · notifications
        │
        └── File storage: generated PDFs · logos · avatars
            signatures · bulk ZIPs · archive
            ./storage  (dev)  ·  STORAGE_ROOT  (prod, persistent disk)
```

Storage location is driven entirely by the `STORAGE_ROOT` environment variable. In production this points at the Render disk mount path, so generated documents survive redeploys. Without it, every deploy silently discards previously generated files while the database rows remain.

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **MySQL 8** running locally (XAMPP, MySQL Community, or Docker)
- **Redis 6+** (Memurai, Redis on Windows, or Docker)

### 1. Install dependencies

```bash
npm run install:all
```

This installs both the backend and frontend packages in one step.

### 2. Configure the environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` and set at minimum:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=doc_automation

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Generate strong secrets — never reuse development values in production:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

You need three separate values: `JWT_SECRET`, `HMAC_SECRET`, and a 32-character `EXTERNAL_DB_ENC_KEY`.

### 3. Create the database

```sql
CREATE DATABASE doc_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The schema and seed data are applied automatically on first server start via the self-healing migration runner. To apply the full migration history manually:

```bash
npm run migrate --prefix server
```

### 4. Start the backend

```bash
npm run dev:backend
```

> The server refuses to start if Redis is unreachable, rather than coming up with a silently broken job queue.

Verify it's running:
```
GET http://localhost:5000/api/health
```

> **Windows users:** `start-dev.ps1` starts the Redis service and the backend in a single step.

### 5. Start the frontend

```bash
npm run dev --prefix client
```

Open `http://localhost:5173`.

To reach the app from a phone or another machine on the same network:
```bash
npm run dev --prefix client -- --host
```
Then set `VITE_API_URL` to your machine's LAN IP in `client/.env`.

---

## Environment Variables

The authoritative, commented template is `server/.env.example`. Key entries:

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | Backend port, defaults to `5000` |
| `CLIENT_URL` | Production | Comma-separated allowed browser origins |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Yes | MySQL connection |
| `DB_SSL` / `DB_SSL_CA` | Managed MySQL | TLS for hosted providers (e.g. Aiven) |
| `REDIS_URL` | Yes | BullMQ connection string |
| `JWT_SECRET` | Yes | Signs session tokens |
| `HMAC_SECRET` | Yes | Legacy server-wide signing secret |
| `EXTERNAL_DB_ENC_KEY` | Yes | 32-character AES-256-GCM key for stored external DB passwords |
| `STORAGE_ROOT` | Production | Persistent disk mount path, e.g. `/var/data` |
| `NTP_SERVER` | No | Defaults to `pool.ntp.org`; falls back to system clock with a warning |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Yes | Transactional email |
| `TWILIO_*` | No | Leave `SMS_PROVIDER` empty to disable SMS entirely |

> **Gmail:** create an App Password at `myaccount.google.com → Security`. Two-factor authentication must be enabled first. Use the App Password as `SMTP_PASSWORD`, not your account password.

---

## Demo Accounts

`schema.sql` seeds one account per role. The password for all of them is **`Passw0rd!`**.

| Email | Role |
|---|---|
| `superadmin@example.com` | Super Admin |
| `sysadmin@example.com` | System Admin |
| `hr@example.com` | Document Generator |
| `director@example.com` | Approver |
| `recipient@example.com` | Recipient |

> **Change or remove all demo accounts before any real deployment.** The `employees` table also contains four sample staff records used as a demo data source for field mapping, conditionals, and loops.

---

## Deployment

### Backend — Render Blueprint

`render.yaml` is a complete Render Blueprint. In the dashboard choose **New → Blueprint**, point it at this repository, and Render provisions:

- **`docuvault-api`** — Node web service with a 10 GB persistent disk at `/var/data`; `STORAGE_ROOT` is pre-wired to that mount
- **`docuvault-redis`** — Key Value instance with `noeviction` and journal-snapshot persistence; `REDIS_URL` is automatically wired to the API service

Render prompts for every `sync: false` secret. `JWT_SECRET`, `HMAC_SECRET`, and `EXTERNAL_DB_ENC_KEY` are generated automatically — leave those blank. You will be asked for the MySQL credentials, the MySQL CA certificate, `CLIENT_URL`, and the SMTP settings.

A `preDeployCommand` runs `npm run migrate` on every deploy. It is idempotent and creates the schema on first deploy.

**Sizing note:** Puppeteer runs a real headless Chromium and needs roughly 400 MB on its own. The minimum workable plan is **1 CPU / 2 GB**. The persistent disk also pins the service to a single instance — a second instance would get its own isolated copy of storage.

### Frontend — Vercel

```bash
cd client
npx vercel
```

Set `VITE_API_URL` to the deployed backend URL. After the frontend domain is established, add it (and any preview domains) to the backend's `CLIENT_URL` comma-separated list and redeploy the backend.

---

## Project Structure

```
DocuVault/
├── client/                        React SPA
│   ├── public/                    Service worker, logos, role images
│   └── src/
│       ├── components/            Templates, audit, shared UI components
│       ├── context/               Auth, Network, Toast providers
│       ├── hooks/                 useAuth, useNetwork, useOfflineCache, …
│       ├── i18n/locales/          en/ and am/ translation namespaces
│       ├── pages/                 31 routed screens
│       ├── services/              API client, offline cache, service worker
│       └── utils/                 Role constants, helper functions
│
├── server/                        Express API
│   ├── scripts/migrate.js         Idempotent migration runner
│   ├── storage/                   Runtime file storage (git-ignored)
│   └── src/
│       ├── config/                Database pool, storage paths
│       ├── controllers/           15 controller modules
│       ├── db/                    schema.sql + 25 ordered migration files
│       ├── middleware/            Auth, roles, validation, uploads, errors
│       ├── queues/                BullMQ queue definition + bulk PDF worker
│       ├── routes/                14 route modules
│       └── utils/                 PDF generator, template renderer, HMAC,
│                                  NTP, OTP, AES encryption, email/SMS,
│                                  Ethiopian calendar, audit logger
│
├── render.yaml                    Render deployment Blueprint
├── start-dev.ps1                  Windows dev launcher (Redis + backend)
└── README.md
```

---

## Security Notes

- Passwords are hashed with **bcrypt**; signing secrets are encrypted with **AES-256-GCM** and never leave the server
- CORS uses an explicit origin allow-list from `CLIENT_URL`, not a wildcard — tokens cannot be replayed from arbitrary sites
- Delivery and verification tokens are **single-purpose** and **time-limited**
- OTP endpoints enforce **attempt limits** (3 max) and **lockout periods** (15 minutes) to prevent brute force
- External database connections are guarded against pointing at the application's own database
- Uploaded logos and avatars are served statically; generated documents are **not** — documents are only accessible via authenticated or tokenised routes
- The `forgot-password` endpoint always returns the same generic message regardless of whether the email exists, so it cannot be used to enumerate valid users
- Super Admin accounts are explicitly excluded from self-service password reset
- `.env` files are git-ignored. No credentials are committed to this repository

> **Before production launch:** add rate limiting to the authentication and OTP verification endpoints, and confirm that TLS termination and `CLIENT_URL` are correctly scoped for your deployment environment.

---

## Project Status

**Implemented and working:**

- Template engine (placeholders, conditionals, loops, filters, dual-calendar dates, versioning)
- PDF generation (single record + bulk queue + ZIP download)
- Approval and e-signature workflow with OTP and HMAC signing
- Secure delivery (tokenised link, OTP gate, ownership confirmation, revocation)
- Document verification (Doc ID, file hash, QR code) — public, no login required
- Audit trail, KPI dashboard, trend charts, CSV export
- User management and role-based access control
- Offline capability (service worker + IndexedDB cache)
- Full English and Amharic internationalisation
- Render Blueprint deployment configuration

**Known gaps:**

- No automated test suite — verification to date has been manual
- No live production environment running yet
- The reminder/escalation scheduler is an in-process `setInterval` loop, which duplicates work if the backend is ever scaled horizontally
- Rate limiting is not yet applied to authentication or OTP endpoints

---

## License

Released for academic and demonstration purposes. All rights reserved.
