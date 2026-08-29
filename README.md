# Kanban Board Backend API

A production-ready REST API for a Kanban Board Application built with **Node.js**, **Express**, and **Supabase**.

## Features

- 🔐 **Authentication** — Supabase Auth (JWT), registration, login, password reset
- 📋 **Projects** — Full CRUD with ownership and role-based access
- 👥 **Team Management** — Email invitations, roles (owner / admin / member), accept/decline flow
- 🗂️ **Boards** — Multiple boards per project with configurable column order
- ✅ **Tasks** — Full CRUD, drag-and-drop position/status updates, email assignment notifications
- 📥 **CSV Import** — Bulk task import with detailed per-row validation and partial import support
- 📧 **Email** — Nodemailer (Gmail SMTP) for invitations, welcome emails, and task assignment notifications
- 🛡️ **Security** — Helmet, CORS, rate limiting, Row Level Security in Supabase
- 📊 **Logging** — Winston structured logging to console and files
- 🧪 **Tests** — Jest + Supertest integration and unit tests

---

## Project Structure

```
kanban-backend/
├── src/
│   ├── config/
│   │   ├── supabase.js        # Supabase clients (anon + admin)
│   │   └── email.js           # Nodemailer SMTP transporter
│   ├── middleware/
│   │   ├── auth.js            # JWT verification middleware
│   │   ├── upload.js          # Multer CSV upload handler
│   │   └── validation.js      # express-validator error responder
│   ├── services/
│   │   ├── supabase.service.js # All DB operations
│   │   ├── auth.service.js     # Supabase Auth wrappers
│   │   ├── csv.service.js      # CSV parsing & validation
│   │   └── email.service.js    # Email templates
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── project.controller.js
│   │   ├── board.controller.js
│   │   ├── task.controller.js
│   │   ├── member.controller.js
│   │   └── csv.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── project.routes.js
│   │   ├── board.routes.js
│   │   ├── task.routes.js
│   │   └── member.routes.js
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── project.validator.js
│   │   └── task.validator.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── helpers.js
│   └── app.js
├── database/
│   └── schema.sql             # Full Supabase schema + RLS policies
├── __tests__/
│   ├── auth.test.js
│   ├── project.test.js
│   ├── task.test.js
│   └── csv.test.js
├── .env                       # Environment variables (never commit)
├── .gitignore
└── package.json
```

---

## Setup

### Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) project
- A Gmail account (or any SMTP provider) for emails

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd kanban-backend
npm install
```

### 2. Configure Environment Variables

Copy `.env` and fill in your values:

```bash
cp .env .env.local   # optional — edit .env directly
```

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (**keep secret**) |
| `JWT_SECRET` | Secret for signing custom JWTs (≥ 32 chars) |
| `EMAIL_HOST` | SMTP host (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | SMTP port (587 for TLS, 465 for SSL) |
| `EMAIL_USER` | Your email address |
| `EMAIL_PASS` | Gmail App Password (not your regular password) |
| `FRONTEND_URL` | Your frontend URL for CORS and email links |

### 3. Set Up the Database

Run the schema in the **Supabase SQL Editor** (`database/schema.sql`):

1. Open your Supabase Dashboard → **SQL Editor**
2. Paste the contents of `database/schema.sql`
3. Click **Run**

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:5000`.

**Health check:** `GET http://localhost:5000/health`

---

## API Reference

All endpoints return this structure:

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "errors": null
}
```

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login and get tokens |
| GET | `/api/auth/me` | ✅ | Get current user |
| POST | `/api/auth/forgot-password` | ❌ | Send password reset email |
| POST | `/api/auth/reset-password` | ❌ | Reset password with token |
| POST | `/api/auth/logout` | ✅ | Logout |

### Projects

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects` | ✅ | List user's projects (paginated) |
| POST | `/api/projects` | ✅ | Create project |
| GET | `/api/projects/:id` | ✅ | Get project details |
| PUT | `/api/projects/:id` | ✅ Owner | Update project |
| DELETE | `/api/projects/:id` | ✅ Owner | Delete project |

### Members

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects/:id/members` | ✅ | List members |
| POST | `/api/projects/:id/invite` | ✅ Admin | Invite member by email |
| PUT | `/api/projects/:id/members/:userId` | ✅ Admin | Update member role |
| DELETE | `/api/projects/:id/members/:userId` | ✅ Admin | Remove member |
| POST | `/api/invitations/accept` | ✅ | Accept invitation (body: `{ token }`) |
| POST | `/api/invitations/decline` | ✅ | Decline invitation (body: `{ token }`) |

### Boards

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects/:projectId/boards` | ✅ | List boards |
| POST | `/api/projects/:projectId/boards` | ✅ | Create board |
| GET | `/api/boards/:id` | ✅ | Get board details |
| PUT | `/api/boards/:id` | ✅ | Update board |
| DELETE | `/api/boards/:id` | ✅ Admin | Delete board |

### Tasks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/boards/:boardId/tasks` | ✅ | List tasks (paginated, filterable by `?status=`) |
| POST | `/api/boards/:boardId/tasks` | ✅ | Create task |
| GET | `/api/tasks/:id` | ✅ | Get task details |
| PUT | `/api/tasks/:id` | ✅ | Full task update |
| DELETE | `/api/tasks/:id` | ✅ | Delete task |
| PATCH | `/api/tasks/:id/status` | ✅ | Update task status (column move) |
| PATCH | `/api/tasks/:id/position` | ✅ | Update task position (drag-and-drop) |
| POST | `/api/boards/:boardId/import-csv` | ✅ | Import tasks from CSV |
| GET | `/api/boards/:boardId/export` | ✅ | Export board tasks as JSON |

---

## CSV Import Format

Upload a CSV file to `POST /api/boards/:boardId/import-csv` with field name `file`.

**Required columns (case-insensitive):**

```
Week, Day, Date, Assignee, Email, Side, Status, Title, Epic, Priority,
EstimateHours, Repo, Branch, Dependencies, Goal, FullPrompt
```

**Example:**

```csv
Week,Day,Date,Assignee,Email,Side,Status,Title,Epic,Priority,EstimateHours,Repo,Branch,Dependencies,Goal,FullPrompt
1,1 (Jul 22),Jul 22,Hiwot,hiwot@example.com,FE,To do,Shared UI component library,Foundation,High,6,marketplace-web,chore/ui-components,React app skeleton,Build reusable components,"Implement this story..."
```

**Response includes:**
- `total_rows` — rows in the file
- `imported` — successfully created tasks
- `failed` — rows that failed validation
- `invalid_rows` — array of `{ row, data, errors[] }` for failed rows

---

## Authentication Flow

1. **Register** → `POST /api/auth/register` → Supabase creates the user → welcome email sent
2. **Login** → `POST /api/auth/login` → receive `access_token` + `refresh_token`
3. **Authenticated requests** → include `Authorization: Bearer <access_token>` header
4. **Password reset** → `POST /api/auth/forgot-password` → Supabase sends reset email → `POST /api/auth/reset-password` with the token from the email link

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Gmail App Password Setup

1. Enable 2-Step Verification on your Google account
2. Go to **Google Account → Security → App passwords**
3. Generate a password for "Mail" / "Windows Computer"
4. Use that 16-character password as `EMAIL_PASS` in `.env`

---

## Security Notes

- The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security — never expose it to clients
- Rate limiting is applied on auth routes (10 req / 15 min) and globally (200 req / 15 min)
- All user input is validated with `express-validator` before hitting the database
- Helmet sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- Invitation tokens are 64-character random strings that expire after 72 hours
