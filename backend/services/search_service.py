"""
Search service for jobs and candidates.

This implementation uses Postgres' pg_trgm extension (installed by
schema.sql) instead of doing fuzzy matching in Python. The
search_text column on jobs and candidates is maintained automatically
by database triggers, so we just query against it.

Why this matters: the old Python SequenceMatcher loop scanned every row
in the table for every search. With a GIN trigram index on search_text,
Postgres prunes the candidate set before scoring, so search stays fast
as the database grows.
"""

from sqlalchemy import or_, func

from models import db, Job, Candidate, Company, User


def _to_decimal(value):
    """Parse a salary filter from a string. Returns None on bad input."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---- Jobs ------------------------------------------------------------

def search_jobs(keyword=None, location=None, working_mode=None,
                job_type=None, experience_level=None,
                salary_min=None, salary_max=None, limit=100):
    """Search active job postings.

    Filters are AND-combined. The keyword is matched against the
    auto-maintained search_text using ILIKE first (exact substring) and
    falls back to trigram similarity for typo tolerance.
    """
    query = (
        db.session.query(Job, Company)
        .join(Company, Job.company_id == Company.company_id)
        .filter(Job.is_active.is_(True))
    )

    if keyword:
        k = keyword.strip().lower()
        if k:
            # Either an ILIKE match OR a trigram similarity above the
            # default threshold. The `%` operator uses the GIN index.
            query = query.filter(
                or_(
                    Job.search_text.ilike(f"%{k}%"),
                    Job.search_text.op("%")(k),
                )
            )

    if location:
        query = query.filter(func.lower(Job.location) == location.lower())

    if working_mode:
        query = query.filter(Job.working_mode == working_mode.upper())

    if job_type:
        normalised = job_type.upper().replace("-", "_").replace(" ", "_")
        query = query.filter(Job.job_type == normalised)

    if experience_level:
        query = query.filter(Job.experience_level == experience_level.upper())

    # Salary range overlap: keep jobs whose [salary_min, salary_max]
    # intersects the requested [salary_min, salary_max].
    req_min = _to_decimal(salary_min)
    req_max = _to_decimal(salary_max)
    if req_min is not None:
        query = query.filter(
            or_(Job.salary_max.is_(None),
                Job.salary_max >= req_min)
        )
    if req_max is not None:
        query = query.filter(
            or_(Job.salary_min.is_(None),
                Job.salary_min <= req_max)
        )

    query = query.order_by(Job.posted_at.desc()).limit(limit)

    results = []
    for job, company in query.all():
        results.append({
            "job_id": str(job.job_id),
            "title": job.title,
            "description": job.description,
            "responsibilities": job.responsibilities,
            "requirements": job.requirements,
            "location": job.location,
            "working_mode": job.working_mode,
            "job_type": job.job_type,
            "experience_level": job.experience_level,
            "salary_min": float(job.salary_min) if job.salary_min is not None else None,
            "salary_max": float(job.salary_max) if job.salary_max is not None else None,
            "currency": job.currency,
            "posted_at": job.posted_at.isoformat() if job.posted_at else None,
            "company": {
                "company_id": str(company.company_id),
                "name": company.name,
                "industry": company.industry,
                "logo_url": company.logo_url,
            },
        })
    return results


# ---- Candidates ------------------------------------------------------

def search_candidates(keyword=None, location=None, working_mode=None,
                      limit=100):
    """Search candidate profiles. Only employers / admins should call
    this — access control happens in the route layer."""
    query = (
        db.session.query(Candidate, User)
        .join(User, Candidate.user_id == User.user_id)
        .filter(User.is_active.is_(True))
    )

    if keyword:
        k = keyword.strip().lower()
        if k:
            query = query.filter(
                or_(
                    Candidate.search_text.ilike(f"%{k}%"),
                    Candidate.search_text.op("%")(k),
                )
            )

    if location:
        query = query.filter(
            func.lower(Candidate.preferred_location) == location.lower()
        )

    if working_mode:
        query = query.filter(
            Candidate.preferred_working_mode == working_mode.upper()
        )

    query = query.order_by(Candidate.updated_at.desc()).limit(limit)

    results = []
    for candidate, user in query.all():
        results.append({
            "candidate_id": str(candidate.candidate_id),
            "full_name": candidate.full_name,
            "email": user.email,
            "headline": candidate.headline,
            "bio": candidate.bio,
            "preferred_location": candidate.preferred_location,
            "preferred_working_mode": candidate.preferred_working_mode,
            "years_of_experience": candidate.years_of_experience,
        })
    return results
