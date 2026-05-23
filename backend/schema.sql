-- =====================================================================
-- CSIT314 Group Project - Job Recommendation Platform
-- Database Schema (PostgreSQL 14+ / Supabase compatible)
-- 2nd Submission - includes profile enhancement, membership, search
-- =====================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy / trigram search
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- accent-insensitive search

-- =====================================================================
-- 1. ENUM TYPES
-- =====================================================================

CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'USER_PROFILE_ADMIN',
    'CANDIDATE',
    'COMPANY'
);

CREATE TYPE working_mode AS ENUM ('REMOTE', 'ONSITE', 'HYBRID');

CREATE TYPE job_type AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERNSHIP',
    'TEMPORARY'
);

CREATE TYPE experience_level AS ENUM (
    'ENTRY',
    'JUNIOR',
    'MID',
    'SENIOR',
    'LEAD',
    'EXECUTIVE'
);

CREATE TYPE membership_tier AS ENUM ('FREE', 'PREMIUM');

CREATE TYPE membership_status AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

CREATE TYPE application_status AS ENUM (
    'PENDING',
    'REVIEWED',
    'SHORTLISTED',
    'INTERVIEWED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN'
);

CREATE TYPE proficiency_level AS ENUM (
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'EXPERT'
);

-- =====================================================================
-- 2. CORE USER TABLES
-- =====================================================================

-- Base account table. Every actor in the system has a row here.
CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- =====================================================================
-- 3. CANDIDATE PROFILE (with 2nd submission enhancements)
-- =====================================================================

CREATE TABLE candidates (
    candidate_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    full_name               VARCHAR(150) NOT NULL,
    phone                   VARCHAR(30),
    headline                VARCHAR(255),         -- e.g. "Junior Backend Engineer"
    bio                     TEXT,
    -- Profile enhancement (Requirement 1)
    preferred_working_mode  working_mode,
    preferred_location      VARCHAR(150),
    preferred_salary_min    NUMERIC(12,2),
    preferred_salary_max    NUMERIC(12,2),
    years_of_experience     INTEGER DEFAULT 0 CHECK (years_of_experience >= 0),
    -- Searchable text (kept in sync by trigger for fuzzy / keyword search)
    search_text             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_location ON candidates(preferred_location);
CREATE INDEX idx_candidates_working_mode ON candidates(preferred_working_mode);
-- Trigram index for fuzzy search across the candidate profile text
CREATE INDEX idx_candidates_search_trgm
    ON candidates USING GIN (search_text gin_trgm_ops);

-- Work experience entries (Requirement 1)
CREATE TABLE candidate_work_experience (
    experience_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
    company_name    VARCHAR(150) NOT NULL,
    job_title       VARCHAR(150) NOT NULL,
    location        VARCHAR(150),
    start_date      DATE NOT NULL,
    end_date        DATE,                       -- NULL = current role
    description     TEXT,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_work_exp_candidate ON candidate_work_experience(candidate_id);

-- Master skill catalogue (shared between candidates and jobs)
CREATE TABLE skills (
    skill_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    category        VARCHAR(50),            -- e.g. "Programming", "Soft Skill"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skills_name_trgm
    ON skills USING GIN (name gin_trgm_ops);

-- Candidate <-> Skills (Requirement 1)
CREATE TABLE candidate_skills (
    candidate_id        UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
    skill_id            UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    proficiency         proficiency_level NOT NULL DEFAULT 'INTERMEDIATE',
    years_experience    INTEGER DEFAULT 0 CHECK (years_experience >= 0),
    PRIMARY KEY (candidate_id, skill_id)
);

CREATE INDEX idx_candidate_skills_skill ON candidate_skills(skill_id);

-- =====================================================================
-- 4. COMPANY PROFILE
-- =====================================================================

CREATE TABLE companies (
    company_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    industry        VARCHAR(100),
    website         VARCHAR(255),
    description     TEXT,
    headquarters    VARCHAR(150),
    company_size    VARCHAR(50),                -- e.g. "11-50", "1000+"
    founded_year    INTEGER CHECK (founded_year BETWEEN 1800 AND EXTRACT(YEAR FROM NOW())),
    logo_url        VARCHAR(500),
    search_text     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_companies_search_trgm
    ON companies USING GIN (search_text gin_trgm_ops);

-- =====================================================================
-- 5. JOB POSTINGS
-- =====================================================================

CREATE TABLE jobs (
    job_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    title               VARCHAR(200) NOT NULL,
    description         TEXT NOT NULL,
    responsibilities    TEXT,
    requirements        TEXT,
    location            VARCHAR(150),
    working_mode        working_mode NOT NULL DEFAULT 'ONSITE',
    job_type            job_type NOT NULL DEFAULT 'FULL_TIME',
    experience_level    experience_level NOT NULL DEFAULT 'MID',
    salary_min          NUMERIC(12,2),
    salary_max          NUMERIC(12,2),
    currency            CHAR(3) DEFAULT 'AUD',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    posted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closes_at           TIMESTAMPTZ,
    search_text         TEXT,
    CONSTRAINT chk_salary CHECK (salary_max IS NULL OR salary_min IS NULL OR salary_max >= salary_min)
);

CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_active ON jobs(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_working_mode ON jobs(working_mode);
CREATE INDEX idx_jobs_type ON jobs(job_type);
CREATE INDEX idx_jobs_level ON jobs(experience_level);
CREATE INDEX idx_jobs_search_trgm
    ON jobs USING GIN (search_text gin_trgm_ops);

-- Required skills for a job (used in matching algorithm)
CREATE TABLE job_required_skills (
    job_id          UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    skill_id        UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = nice-to-have
    min_proficiency proficiency_level DEFAULT 'INTERMEDIATE',
    PRIMARY KEY (job_id, skill_id)
);

CREATE INDEX idx_job_skills_skill ON job_required_skills(skill_id);

-- =====================================================================
-- 6. MEMBERSHIP (Requirement 2)
-- =====================================================================
-- Membership applies to BOTH candidates and companies. We attach it to
-- the user_id so the same model serves both actor types.

CREATE TABLE memberships (
    membership_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    tier            membership_tier NOT NULL DEFAULT 'FREE',
    status          membership_status NOT NULL DEFAULT 'ACTIVE',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,                 -- NULL = no expiry (e.g. FREE)
    auto_renew      BOOLEAN NOT NULL DEFAULT FALSE,
    price_paid      NUMERIC(10,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_active
    ON memberships(user_id, status)
    WHERE status = 'ACTIVE';

-- Helper view: current active membership per user
CREATE VIEW v_active_membership AS
SELECT DISTINCT ON (user_id)
       user_id,
       membership_id,
       tier,
       status,
       expires_at
FROM   memberships
WHERE  status = 'ACTIVE'
  AND  (expires_at IS NULL OR expires_at > NOW())
ORDER BY user_id, started_at DESC;

-- =====================================================================
-- 7. APPLICATIONS & RECOMMENDATIONS
-- =====================================================================

-- Applications submitted by candidates
CREATE TABLE applications (
    application_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    candidate_id    UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
    cover_letter    TEXT,
    status          application_status NOT NULL DEFAULT 'PENDING',
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, candidate_id)
);

CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Cached recommendations. The match_score is produced by the matching
-- algorithm (skills overlap + working mode + location + experience).
-- The top-N enforcement for FREE users happens at query/application
-- layer; this table stores the full ranked list.
CREATE TABLE recommendations (
    recommendation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
    job_id              UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    match_score         NUMERIC(5,2) NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    rank_position       INTEGER NOT NULL,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (candidate_id, job_id)
);

CREATE INDEX idx_recommendations_candidate_score
    ON recommendations(candidate_id, match_score DESC);
CREATE INDEX idx_recommendations_job_score
    ON recommendations(job_id, match_score DESC);

-- =====================================================================
-- 8. SEARCH SUPPORT (Requirement 3)
-- =====================================================================
-- Optional history table for analytics / "recent searches"
CREATE TABLE search_history (
    search_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(user_id) ON DELETE SET NULL,
    query_text      TEXT,
    filters_json    JSONB,                       -- flexible filter storage
    result_count    INTEGER,
    searched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_history_user ON search_history(user_id, searched_at DESC);
CREATE INDEX idx_search_history_filters ON search_history USING GIN (filters_json);

-- =====================================================================
-- 9. TRIGGERS - keep search_text and updated_at in sync
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Build candidate search_text from headline, bio, location, skills
CREATE OR REPLACE FUNCTION trg_candidate_search_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_text := unaccent(lower(
        COALESCE(NEW.full_name, '') || ' ' ||
        COALESCE(NEW.headline, '')  || ' ' ||
        COALESCE(NEW.bio, '')       || ' ' ||
        COALESCE(NEW.preferred_location, '')
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_search_text
    BEFORE INSERT OR UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION trg_candidate_search_text();

-- Build job search_text from title, description, location
CREATE OR REPLACE FUNCTION trg_job_search_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_text := unaccent(lower(
        COALESCE(NEW.title, '')          || ' ' ||
        COALESCE(NEW.description, '')    || ' ' ||
        COALESCE(NEW.requirements, '')   || ' ' ||
        COALESCE(NEW.location, '')
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_search_text
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION trg_job_search_text();

-- =====================================================================
-- 10. EXAMPLE SEARCH QUERIES (for reference / report)
-- =====================================================================
-- Keyword search:
--   SELECT * FROM jobs
--   WHERE  search_text ILIKE '%software engineer%';
--
-- Fuzzy search (handles "sofware enginer"):
--   SELECT *, similarity(search_text, 'sofware enginer') AS sim
--   FROM   jobs
--   WHERE  search_text % 'sofware enginer'
--   ORDER  BY sim DESC
--   LIMIT  20;
--
-- Keyword + filter:
--   SELECT * FROM jobs
--   WHERE  search_text ILIKE '%data analyst%'
--     AND  working_mode = 'REMOTE'
--     AND  experience_level = 'ENTRY';
--
-- Recommendation fetch with membership-aware limit (handled in app layer):
--   SELECT j.*, r.match_score
--   FROM   recommendations r
--   JOIN   jobs j ON j.job_id = r.job_id
--   WHERE  r.candidate_id = $1
--   ORDER  BY r.match_score DESC
--   LIMIT  CASE WHEN $is_member THEN NULL ELSE 10 END;
-- =====================================================================
