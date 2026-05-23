# TalentMatch — Backend

Flask backend API for the **Intelligent Talent Matching Platform** (CSIT314 coursework). Aligned with the PostgreSQL schema in `schema.sql`.

## Stack

- **Python** 3.10+
- **Flask** + Flask-SQLAlchemy + Flask-JWT-Extended + Flask-CORS
- **PostgreSQL** (Supabase) with `pgcrypto`, `pg_trgm`, `unaccent` extensions
- **psycopg2** as the DB driver

## Quick start

```powershell
# 1. Create and enter a virtual environment
py -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure your database
copy .env.example .env
# Now edit .env and paste your Supabase URI into DATABASE_URL

# 4. Make sure the schema exists in Supabase (run schema.sql once via the
#    SQL Editor if you haven't already)

# 5. Seed demo data
py seed_data.py

# 6. Run
py app.py
```

The backend runs at `http://127.0.0.1:5000`. Health check: `GET /` returns
`{"message": "Intelligent Talent Matching Platform Backend is running"}`.

## Demo accounts

```
admin@test.com / 123456    (admin)
abz0@test.com  / 123456    (employer — University of Wollongong)
sk12@test.com  / 123456    (candidate — Sujal Kumar)
```

All three start with a FREE membership. Upgrade via the in-app payment flow (test card `4242 4242 4242 4242`) or via the admin endpoint.

## API overview

```
/auth/register                                POST    Register candidate or employer
/auth/login                                   POST    Login, returns JWT

/candidate/jobs                               GET     List all active jobs
/candidate/profile                            GET     My candidate profile
/candidate/profile                            POST    Create/update my profile
/candidate/recommendations                    GET     Recommended jobs (top 10 for FREE)
/candidate/apply/<job_id>                     POST    Apply to a job
/candidate/applications                       GET     My application history
/candidate/search/jobs?keyword=...            GET     Search jobs
/candidate/upgrade                            POST    Simulated payment + upgrade to PREMIUM

/employer/jobs                                POST    Create a job
/employer/jobs                                GET     My posted jobs
/employer/jobs/<job_id>/applications          GET     Applicants for a job
/employer/jobs/<job_id>/recommended-candidates GET    Recommended candidates
/employer/applications/<id>/status            PUT     Change application status
/employer/search/candidates?keyword=...       GET     Search candidates
/employer/upgrade                             POST    Simulated payment + upgrade to PREMIUM

/admin/users                                  GET     List all users
/admin/users/<user_id>/membership             PUT     Set user's membership tier
```

All routes except `/auth/*` require `Authorization: Bearer <token>`.

## Simulated payment

The `/candidate/upgrade` and `/employer/upgrade` endpoints accept a payment payload, validate its shape (card length, expiry not in the past, CVV format) and — if valid — write a new ACTIVE PREMIUM row to the `memberships` table. There is no real PSP. Any card that looks valid works; the canonical test card is `4242 4242 4242 4242` with any future expiry and any 3-digit CVV.

The validation lives in `services/payment_service.py`; swapping in a real Stripe / PayPal integration would only touch that one file.

## Role naming

The frontend uses friendly role names (`candidate`, `employer`, `admin`).
The database uses the schema enum names (`CANDIDATE`, `COMPANY`, `ADMIN`).
The backend translates between them so the frontend doesn't need to change.

## Membership

The schema models membership as its own table with tiers (`FREE`, `PREMIUM`),
status, expiry, and history — not a boolean on the user. For backward
compatibility the API still exposes a simple `is_member` boolean
(`true` ↔ active PREMIUM, `false` ↔ everything else).

When a user upgrades, the existing ACTIVE membership is marked CANCELLED and a new ACTIVE PREMIUM row is inserted. Downgrades work the same way in reverse. This preserves a full audit history.

## Schema ownership

`schema.sql` is the source of truth for the database schema. It includes
Postgres-only features (enums, triggers, pg_trgm GIN indexes, the
`v_active_membership` view) that SQLAlchemy can't emit. **`app.py` does
not call `db.create_all()`.** If you need to rebuild the schema, run
`schema.sql` against a fresh database.

## Project layout

```
backend/
├── app.py                  # Flask entry point
├── config.py               # config + DB URL validation
├── models.py               # SQLAlchemy models mirroring schema.sql
├── seed_data.py            # demo users, jobs, profile, application
├── schema.sql              # Postgres schema (source of truth)
├── requirements.txt
├── .env.example
├── README.md
│
├── routes/
│   ├── __init__.py
│   ├── auth_routes.py
│   ├── candidate_routes.py
│   ├── employer_routes.py
│   └── admin_routes.py
│
└── services/
    ├── __init__.py
    ├── translations.py     # role + membership translation helpers
    ├── search_service.py   # Postgres trigram + ILIKE search
    ├── matching_service.py # candidate ↔ job match scoring
    └── payment_service.py  # simulated payment validation
```

## CORS

Allowed origins are configured by `CORS_ORIGINS` in `.env` (comma-separated). The default is the two Vite dev addresses (`http://localhost:5173` and `http://127.0.0.1:5173`). Change this when deploying behind a different domain.

## Notes on changes from the previous backend

- All primary keys are now UUIDs, not integers.
- Skills moved out of comma-separated strings into a normalized
  `skills` + `candidate_skills` + `job_required_skills` set of tables.
- "Employer" role stored as `COMPANY` in the DB, with a separate
  `companies` table holding name/industry/website/etc.
- Fuzzy search uses Postgres `pg_trgm` instead of Python loops.
- Membership is now a table, not a boolean.
- New endpoints: `/candidate/applications`, `/candidate/upgrade`, `/employer/upgrade`.

Developed by Saad as part of CSIT314 — University of Wollongong.
