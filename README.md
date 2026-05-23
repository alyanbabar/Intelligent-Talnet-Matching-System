# Intelligent Talent Matching Platform

[![CI](https://github.com/alyanbabar/Intelligent-Talnet-Matching-System/actions/workflows/ci.yml/badge.svg)](https://github.com/alyanbabar/Intelligent-Talnet-Matching-System/actions/workflows/ci.yml)

**CSIT314 — Systems Development Methodologies**  
University of Wollongong · Session 1, 2026

An intelligent talent matching platform that connects **candidates** and **employers** through profile management, job postings, applications, keyword and fuzzy search, skill-based recommendations, and membership tiers (FREE / PREMIUM).

---

## Source code repository

| Item | Details |
|------|---------|
| **GitHub** | https://github.com/alyanbabar/Intelligent-Talnet-Matching-System |
| **Branch** | `main` |
| **Clone** | `git clone https://github.com/alyanbabar/Intelligent-Talnet-Matching-System.git` |

---

## Team members and contributions

> Update student IDs before final submission if required by your brief.

| Name | Contribution | Student ID |
|------|----------------|------------|
| **Saad** | Backend — Flask REST API, routes, services (matching, search, payment), authentication, seed data | _[8158411]_ |
| **Ernest Teh** | Database — PostgreSQL / Supabase schema (`schema.sql`), data model, migrations and DB integration | _[8359118]_ |
| **Alyan Alam** | Frontend — React UI (Vite), pages, API integration, membership upgrade flow | _[8070799]_ |
| _[Sujal, Adel]_ | _[-]_ | _[-]_ |

### Repository layout by contributor

| Folder / area | Primary owners |
|---------------|----------------|
| `backend/` (Flask app, API, business logic) | Saad |
| `backend/schema.sql`, database design & Supabase | Ernest |
| `frontend/` (React SPA) | Alyan |

---

## Repository structure
ntelligent-Talnet-Matching-System/ ├── README.md # This file — start here ├── backend/ # Flask REST API — Saad │ ├── app.py # Application entry point │ ├── schema.sql # PostgreSQL schema — Ernest │ ├── seed_data.py # Demo users, jobs, applications │ ├── requirements.txt │ └── routes/ # auth, candidate, employer, admin ├── frontend/ # React SPA (Vite) — Alyan │ ├── src/pages/ # UI screens │ ├── src/lib/api.js # API client (JWT) │ └── package.json


Further detail: [`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md)

---

## Technology stack

| Layer | Technologies | Lead |
|-------|----------------|------|
| **Frontend** | React 19, Vite 8, React Router 7 | Alyan |
| **Backend** | Python 3.10+, Flask, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-CORS | Saad |
| **Database** | PostgreSQL (Supabase) — `pgcrypto`, `pg_trgm`, `unaccent` | Ernest |
| **Auth** | JWT (Bearer token), bcrypt password hashing | Saad |

---

## Prerequisites

- **Python** 3.10+ (3.13 recommended on macOS)
- **Node.js** 20+ and **npm**
- **PostgreSQL** database (Supabase — see Ernest’s schema in `backend/schema.sql`)
- Git

---

## Quick start (run the full application)

You need **two terminals** — backend first, then frontend.

### 1. Database setup (one-time) — Ernest

1. Create a Supabase project (or any PostgreSQL 14+ instance).
2. In the Supabase **SQL Editor**, run the full script: [`backend/schema.sql`](backend/schema.sql)
3. Enable extensions if prompted: `pgcrypto`, `pg_trgm`, `unaccent`

### 2. Backend — Saad

cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate           # Windows

pip install -r requirements.txt

# Configure environment (create .env — see Environment variables below)
cp .env.example .env
# Edit .env and set DATABASE_URL and JWT_SECRET_KEY

python seed_data.py               # Demo users and sample data
python app.py

Backend runs at http://127.0.0.1:5000
Health check: open http://127.0.0.1:5000/ — expect JSON: "Intelligent Talent Matching Platform Backend is running".

cd frontend

npm install

# Optional: copy .env.example to .env if you need a non-default API URL
cp .env.example .env

npm run dev

Frontend runs at http://localhost:5173 — open this URL in your browser.

Environment variables
Backend (backend/.env)
Create backend/.env locally (never commit this file):
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
JWT_SECRET_KEY=your-secret-key-at-least-32-characters-long
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

DATABASE_URL must start with postgresql:// (copy the URI from Supabase → Project Settings → Database).
The schema is defined in backend/schema.sql (Ernest). The API reads/writes via SQLAlchemy models in backend/models.py (Saad).
Markers without a database can request shared Supabase credentials from the team separately.

Demo accounts
After running seed_data.py:

Role	Email	Password
Admin	admin@test.com	123456
Employer	abz0@test.com	123456
Candidate	sk12@test.com	123456

Membership upgrade (simulated payment):

Card: 4242 4242 4242 4242
Expiry: any future date (e.g. 12/29)
CVV: any 3 digits (e.g. 123)

**Main features**
- User registration and login (candidate, employer, admin)
- JWT authentication and role-based access
- Candidate profiles, job search, applications, recommendations
- Employer job posting, applicant management, candidate search and recommendations
- Skill-based matching and PostgreSQL trigram fuzzy search
- FREE vs PREMIUM membership (simulated payment flow)
- Admin user and membership management

**Files not in this repository**
The following are intentionally excluded via .gitignore:

- backend/.env, frontend/.env (secrets)
- venv/, node_modules/, dist/
- Local SQLite / cache files


