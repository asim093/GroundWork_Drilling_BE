# Groundwork Drilling — Time & Material Logging System

Full-stack prototype. See `groundwork-drilling-project-kickoff.md` for scope, data model, and conventions.

- `Backend/` — Node.js + Express + MongoDB (Mongoose)
- `Frontend/` — React (Vite) + React Router + Mantine + react-toastify

## Prerequisites

- Node.js 20+ (developed on 22)
- MongoDB running locally on `mongodb://127.0.0.1:27017`

Password hashing uses `bcryptjs`. The backend runs on Express 5.

Operators do not get a password from the admin — they are invited by email and set their own
password. Configure SMTP in `Backend/.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM`) for real delivery. Without it, the invite still works: the one-time link is shown
in the admin UI and logged to the server console.

## Backend

```
cd Backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

Runs on `http://localhost:5000`.

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Server + MongoDB connection status |
| POST | `/api/auth/login` | Public | Email/password login, returns JWT + user |
| GET | `/api/auth/me` | Authenticated | Current user from token |
| GET | `/api/auth/invite?token=` | Public | Preview an invitation (name + email) |
| POST | `/api/auth/accept-invite` | Public | Set password from an invite token (`{ token, password }`), returns JWT |
| GET | `/api/dashboard` | Authenticated | Role-aware KPI overview (admin vs operator) |
| GET | `/api/users` | Admin | List operators only — `page`, `limit`, `sort` (name/email/createdAt), `order`, `active`, `status` (pending/active), `search` |
| POST | `/api/users` | Admin | Create operator (no password — sends an invite) |
| GET | `/api/users/:id` | Admin | Single operator |
| PATCH | `/api/users/:id` | Admin | Update operator (name/email/phone/active; no role, no hard delete) |
| POST | `/api/users/:id/resend-invite` | Admin | Regenerate + re-send the set-password link |
| GET | `/api/jobs` | Admin | List jobs — `page`, `limit`, `sort` (scheduledDate/jobNumber/clientName), `order`, `status`, `assignedUser` |
| POST | `/api/jobs` | Admin | Create job |
| GET | `/api/jobs/:id` | Admin | Single job (assigned users populated) |
| PATCH | `/api/jobs/:id` | Admin | Update job |
| PUT | `/api/jobs/:id/assignments` | Admin | Replace a job's assigned users (`{ userIds: [...] }`) |
| GET | `/api/jobs/assigned` | Authenticated | Jobs assigned to the current operator — `page`, `limit`, `sort`, `order`, `status` |
| GET | `/api/jobs/assigned/:id` | Authenticated | Single assigned job (for time-log prefill) |
| GET | `/api/time-logs` | Admin | All time-log entries — `page`, `limit`, `sort` (date/createdAt/status), `order`, `job`, `user`, `status`, `date`, `from`, `to` |
| GET | `/api/time-logs/mine` | Authenticated | Current operator's own entries — same params minus `user` |
| POST | `/api/time-logs` | Authenticated | Create a draft entry (must be assigned to the job) |
| GET | `/api/time-logs/:id` | Owner or admin | Single entry |
| PATCH | `/api/time-logs/:id` | Owner, draft only | Update an entry (409 once submitted) |
| POST | `/api/time-logs/:id/submit` | Owner, draft only | Flip status to `submitted` |
| GET | `/api/time-logs/scheduling` | Admin | Scheduled jobs by date with submission status (`submitted`/`draft`/`missing`) + assigned operators — `from`, `to` (default current month), `job`, `status`, `sort`, `order`, paginated |
| GET | `/api/time-logs/reports/summary` | Admin | Submitted-entry totals for a range — `from`, `to` (default current month), optional `groupBy=user\|job`; hours, standby, consumables per item, and three-way bonus eligibility counts |
| GET | `/api/time-logs/reports/monthly-comparison` | Admin | The summary shape for a month and the preceding month — `month`, `year` (default current) |

List responses are shaped `{ data: [...], pagination: { page, limit, total, totalPages } }`.

**Bonus eligibility** is derived only from a manually entered `recoveryPercent` on a submitted entry: `null` → `not-available`, `>= 85` → `eligible`, else `not-eligible`. It is not auto-calculated (see Open Question #1 in the brief).

Seeded accounts:

- Admin — `admin@groundworkdrilling.com` / `Admin123!`
- Operator — `operator@groundworkdrilling.com` / `Operator123!`

## Frontend

```
cd Frontend
cp .env.example .env
npm install
npm run dev
```

Runs on `http://localhost:5173`. Both roles land on a KPI **Dashboard** (`/admin`, `/operator`). The shell is a collapsible sidebar (nav + profile + sign-out icon at the bottom); the current page title shows in the top bar and each list page's primary action sits in its filter row.

Admin: `/admin` dashboard, `/admin/users` (operators — invite-based, no passwords, no roles), `/admin/jobs`, `/admin/scheduling` (Submitted/Draft/Missing by date), `/admin/reports` (period summary + group-by + three-way bonus eligibility + monthly comparison). Every table has sort, filter, and pagination.

Operator: `/operator` dashboard, `/operator/jobs` (assigned jobs), `/operator/submissions` (My Submissions), and the Time & Material log form at `/operator/jobs/:jobId/log` (new) and `/operator/log/:id` (draft = editable, submitted = read-only).

Operator onboarding: `/set-password?token=…` — the page an invited operator opens to choose their password (auto-signs-in on success).

## Conventions

- No code comments anywhere
- All error messages in English
- Toast notification (bottom-right) on every user action, success or failure
- Clean, minimal, touch-friendly UI for phones/tablets
- Every list/table view must have sort, filter, and pagination
