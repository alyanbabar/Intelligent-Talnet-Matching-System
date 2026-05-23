"""
Employer routes — post jobs, view applications, manage status,
recommended candidates, search.

In the schema, an "employer" is a User with role=COMPANY, with a
matching Company row. Jobs are owned by the Company, not directly by
the User.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import (
    db, User, Company, Job, Application, Candidate,
    Skill, JobRequiredSkill,
)
from services.translations import is_premium_member, set_membership
from services.search_service import search_candidates
from services.matching_service import recommend_candidates_for_job
from services.payment_service import (
    PREMIUM_PRICE, PREMIUM_CURRENCY, validate_payment, simulate_charge,
)

employer_bp = Blueprint("employer", __name__)


# ---- helpers ---------------------------------------------------------

def _require_employer():
    user = User.query.get(get_jwt_identity())
    if not user or user.role != "COMPANY":
        return None, None, (jsonify({"error": "Employer access required"}), 403)
    if not user.company:
        # Schema drift safety: an account exists with role=COMPANY but no
        # company row. Refuse to operate until that's fixed.
        return None, None, (
            jsonify({"error": "Company profile missing — contact support"}), 500
        )
    return user, user.company, None


def _normalise_enum(value, choices):
    if not value:
        return None
    v = value.strip().upper().replace("-", "_").replace(" ", "_")
    return v if v in choices else None


_WORKING_MODES = {"REMOTE", "ONSITE", "HYBRID"}
_JOB_TYPES = {"FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"}
_EXP_LEVELS = {"ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"}


def _resolve_skill(name):
    name_clean = name.strip()
    if not name_clean:
        return None
    skill = Skill.query.filter(
        db.func.lower(Skill.name) == name_clean.lower()
    ).first()
    if not skill:
        skill = Skill(name=name_clean)
        db.session.add(skill)
        db.session.flush()
    return skill


def _job_to_dict(job):
    return {
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
        "is_active": job.is_active,
        "posted_at": job.posted_at.isoformat() if job.posted_at else None,
        "required_skills": [
            {"name": jrs.skill.name, "is_required": jrs.is_required}
            for jrs in job.required_skills
        ],
    }


# ---- routes ----------------------------------------------------------

@employer_bp.route("/jobs", methods=["POST"])
@jwt_required()
def create_job():
    _, company, err = _require_employer()
    if err:
        return err

    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    if not title or not description:
        return jsonify({"error": "title and description are required"}), 400

    job = Job(
        company_id=company.company_id,
        title=title,
        description=description,
        responsibilities=data.get("responsibilities"),
        requirements=data.get("requirements"),
        location=data.get("location"),
        working_mode=_normalise_enum(data.get("working_mode") or data.get("work_mode"),
                                     _WORKING_MODES) or "ONSITE",
        job_type=_normalise_enum(data.get("job_type"), _JOB_TYPES) or "FULL_TIME",
        experience_level=_normalise_enum(data.get("experience_level"),
                                         _EXP_LEVELS) or "MID",
        salary_min=data.get("salary_min"),
        salary_max=data.get("salary_max"),
        currency=(data.get("currency") or "AUD").upper()[:3],
        is_active=True,
    )
    db.session.add(job)
    db.session.flush()

    # Required skills — accept either a comma-separated string or a list.
    raw_skills = data.get("required_skills") or data.get("skills")
    if raw_skills:
        if isinstance(raw_skills, str):
            names = [s.strip() for s in raw_skills.split(",") if s.strip()]
        elif isinstance(raw_skills, list):
            names = []
            for item in raw_skills:
                if isinstance(item, str):
                    names.append(item.strip())
                elif isinstance(item, dict) and item.get("name"):
                    names.append(item["name"].strip())
        else:
            names = []

        seen = set()
        for n in names:
            key = n.lower()
            if key in seen:
                continue
            seen.add(key)
            skill = _resolve_skill(n)
            if skill:
                db.session.add(JobRequiredSkill(
                    job_id=job.job_id,
                    skill_id=skill.skill_id,
                    is_required=True,
                ))

    db.session.commit()

    return jsonify({
        "message": "Job posted successfully",
        "job": _job_to_dict(job),
    }), 201


@employer_bp.route("/jobs", methods=["GET"])
@jwt_required()
def get_employer_jobs():
    _, company, err = _require_employer()
    if err:
        return err

    jobs = (
        Job.query
        .filter_by(company_id=company.company_id)
        .order_by(Job.posted_at.desc())
        .all()
    )
    return jsonify({"jobs": [_job_to_dict(j) for j in jobs]}), 200


@employer_bp.route("/jobs/<job_id>/applications", methods=["GET"])
@jwt_required()
def view_job_applications(job_id):
    _, company, err = _require_employer()
    if err:
        return err

    job = Job.query.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    if job.company_id != company.company_id:
        return jsonify({"error": "Access denied"}), 403

    apps = Application.query.filter_by(job_id=job.job_id).all()
    rows = []
    for app in apps:
        cand = app.candidate
        rows.append({
            "application_id": str(app.application_id),
            "candidate_id": str(cand.candidate_id) if cand else None,
            "candidate_name": cand.full_name if cand else None,
            "candidate_email": cand.user.email if cand and cand.user else None,
            "candidate_headline": cand.headline if cand else None,
            "candidate_skills": [cs.skill.name for cs in cand.skills] if cand else [],
            "years_of_experience": cand.years_of_experience if cand else None,
            "preferred_location": cand.preferred_location if cand else None,
            "preferred_working_mode": cand.preferred_working_mode if cand else None,
            "status": app.status,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None,
            "cover_letter": app.cover_letter,
        })

    return jsonify({
        "job": {"id": str(job.job_id), "title": job.title,
                "company_name": company.name},
        "applications": rows,
    }), 200


_ALLOWED_STATUSES = {
    "PENDING", "REVIEWED", "SHORTLISTED",
    "INTERVIEWED", "ACCEPTED", "REJECTED", "WITHDRAWN",
}

# Map the old API names so the existing frontend keeps working.
_LEGACY_STATUS_MAP = {
    "Submitted": "PENDING",
    "Shortlisted": "SHORTLISTED",
    "Rejected": "REJECTED",
    "Accepted": "ACCEPTED",
}


@employer_bp.route("/applications/<application_id>/status", methods=["PUT"])
@jwt_required()
def update_application_status(application_id):
    _, company, err = _require_employer()
    if err:
        return err

    application = Application.query.get(application_id)
    if not application:
        return jsonify({"error": "Application not found"}), 404

    if not application.job or application.job.company_id != company.company_id:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json() or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "status is required"}), 400

    new_status = _LEGACY_STATUS_MAP.get(new_status, new_status.upper())
    if new_status not in _ALLOWED_STATUSES:
        return jsonify({"error": "Invalid status",
                        "allowed": sorted(_ALLOWED_STATUSES)}), 400

    application.status = new_status
    db.session.commit()

    return jsonify({
        "message": "Application status updated successfully",
        "application": {
            "application_id": str(application.application_id),
            "candidate_id": str(application.candidate_id),
            "job_id": str(application.job_id),
            "status": application.status,
        }
    }), 200


@employer_bp.route("/jobs/<job_id>/recommended-candidates", methods=["GET"])
@jwt_required()
def recommended_candidates(job_id):
    user, company, err = _require_employer()
    if err:
        return err

    job = Job.query.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    if job.company_id != company.company_id:
        return jsonify({"error": "Access denied"}), 403

    limit = None if is_premium_member(user) else 10
    scored = recommend_candidates_for_job(job, limit=limit)

    rows = []
    for cand, score, matched_skill_ids in scored:
        matched_names = [cs.skill.name for cs in cand.skills
                         if cs.skill_id in matched_skill_ids]
        rows.append({
            "candidate_id": str(cand.candidate_id),
            "candidate_name": cand.full_name,
            "candidate_email": cand.user.email if cand.user else None,
            "headline": cand.headline,
            "skills": [cs.skill.name for cs in cand.skills],
            "years_of_experience": cand.years_of_experience,
            "preferred_location": cand.preferred_location,
            "preferred_working_mode": cand.preferred_working_mode,
            "matched_skills": matched_names,
            "match_score": score,
        })

    return jsonify({
        "is_member": is_premium_member(user),
        "recommendation_count": len(rows),
        "recommended_candidates": rows,
    }), 200


@employer_bp.route("/search/candidates", methods=["GET"])
@jwt_required()
def employer_search_candidates():
    _, _, err = _require_employer()
    if err:
        return err

    results = search_candidates(
        keyword=request.args.get("keyword"),
        location=request.args.get("location"),
        working_mode=request.args.get("working_mode") or request.args.get("work_mode"),
    )

    return jsonify({
        "search_type": "candidate_search",
        "result_count": len(results),
        "results": results,
    }), 200


@employer_bp.route("/upgrade", methods=["POST"])
@jwt_required()
def upgrade_membership():
    """Simulated paid upgrade to PREMIUM for employer accounts."""
    user, _company, err = _require_employer()
    if err:
        return err

    if is_premium_member(user):
        return jsonify({
            "error": "You already have an active PREMIUM membership.",
            "is_member": True,
        }), 409

    data = request.get_json() or {}
    ok, message = validate_payment(data)
    if not ok:
        return jsonify({"error": message}), 400

    receipt = simulate_charge()
    set_membership(user, "PREMIUM")
    db.session.commit()

    return jsonify({
        "message": "Membership upgraded successfully.",
        "is_member": True,
        "payment": receipt,
        "tier": "PREMIUM",
        "price": PREMIUM_PRICE,
        "currency": PREMIUM_CURRENCY,
    }), 200
