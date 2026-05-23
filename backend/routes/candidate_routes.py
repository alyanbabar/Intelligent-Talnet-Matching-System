"""
Candidate routes — profile, browse jobs, apply, recommendations, search.

Skills are managed via the candidate_skills join table; the API accepts
a simple list of skill names and resolves / creates Skill rows behind
the scenes.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import (
    db, User, Candidate, Job, Application, Skill, CandidateSkill
)
from services.translations import is_premium_member, set_membership
from services.search_service import search_jobs
from services.matching_service import recommend_jobs_for_candidate
from services.payment_service import (
    PREMIUM_PRICE, PREMIUM_CURRENCY, validate_payment, simulate_charge,
)

candidate_bp = Blueprint("candidate", __name__)


# ---- helpers ---------------------------------------------------------

def _require_candidate():
    """Resolve the authenticated candidate user + profile row.
    Returns (user, candidate_profile, None) on success, or
    (None, None, error_response) on failure."""
    user = User.query.get(get_jwt_identity())
    if not user or user.role != "CANDIDATE":
        return None, None, (jsonify({"error": "Candidate access required"}), 403)
    return user, user.candidate, None


def _resolve_skill(name):
    """Get-or-create a Skill row by name (case-insensitive)."""
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


def _normalise_working_mode(value):
    if not value:
        return None
    v = value.strip().upper()
    return v if v in ("REMOTE", "ONSITE", "HYBRID") else None


def _job_to_dict(job):
    """Serialize a Job with its company info."""
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
        "posted_at": job.posted_at.isoformat() if job.posted_at else None,
        "company": {
            "company_id": str(job.company.company_id),
            "name": job.company.name,
            "industry": job.company.industry,
            "logo_url": job.company.logo_url,
        } if job.company else None,
    }


# ---- routes ----------------------------------------------------------

@candidate_bp.route("/jobs", methods=["GET"])
@jwt_required()
def view_all_jobs():
    _, _, err = _require_candidate()
    if err:
        return err

    jobs = (
        Job.query
        .filter(Job.is_active.is_(True))
        .order_by(Job.posted_at.desc())
        .all()
    )
    return jsonify({"jobs": [_job_to_dict(j) for j in jobs]}), 200


@candidate_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    _, candidate, err = _require_candidate()
    if err:
        return err

    if not candidate:
        return jsonify({"error": "Profile not found"}), 404

    return jsonify({
        "profile": {
            "candidate_id": str(candidate.candidate_id),
            "full_name": candidate.full_name,
            "phone": candidate.phone,
            "headline": candidate.headline,
            "bio": candidate.bio,
            "preferred_working_mode": candidate.preferred_working_mode,
            "preferred_location": candidate.preferred_location,
            "preferred_salary_min": float(candidate.preferred_salary_min)
                if candidate.preferred_salary_min is not None else None,
            "preferred_salary_max": float(candidate.preferred_salary_max)
                if candidate.preferred_salary_max is not None else None,
            "years_of_experience": candidate.years_of_experience,
            "skills": [
                {"name": cs.skill.name, "proficiency": cs.proficiency}
                for cs in candidate.skills
            ],
        }
    }), 200


@candidate_bp.route("/profile", methods=["POST"])
@jwt_required()
def create_or_update_profile():
    user, candidate, err = _require_candidate()
    if err:
        return err

    data = request.get_json() or {}

    # A candidate profile row is created at registration time, but in
    # case it's somehow missing, recover gracefully.
    if not candidate:
        full_name = (data.get("full_name") or user.email).strip()
        candidate = Candidate(user_id=user.user_id, full_name=full_name)
        db.session.add(candidate)
        db.session.flush()

    if "full_name" in data and data["full_name"]:
        candidate.full_name = data["full_name"].strip()
    if "phone" in data:
        candidate.phone = data["phone"]
    if "headline" in data:
        candidate.headline = data["headline"]
    if "bio" in data:
        candidate.bio = data["bio"]
    if "preferred_location" in data:
        candidate.preferred_location = data["preferred_location"]
    if "preferred_working_mode" in data:
        candidate.preferred_working_mode = _normalise_working_mode(
            data["preferred_working_mode"]
        )
    if "preferred_salary_min" in data and data["preferred_salary_min"] not in (None, ""):
        candidate.preferred_salary_min = data["preferred_salary_min"]
    if "preferred_salary_max" in data and data["preferred_salary_max"] not in (None, ""):
        candidate.preferred_salary_max = data["preferred_salary_max"]
    if "years_of_experience" in data and data["years_of_experience"] not in (None, ""):
        candidate.years_of_experience = int(data["years_of_experience"])

    # Skills: accept either a list of names or a comma-separated string
    # (matches the simpler shape the frontend uses today).
    if "skills" in data:
        raw_skills = data["skills"]
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

        # Replace the candidate's skill set with the new list.
        CandidateSkill.query.filter_by(
            candidate_id=candidate.candidate_id
        ).delete()
        seen = set()
        for n in names:
            key = n.lower()
            if key in seen:
                continue
            seen.add(key)
            skill = _resolve_skill(n)
            if skill:
                db.session.add(CandidateSkill(
                    candidate_id=candidate.candidate_id,
                    skill_id=skill.skill_id,
                ))

    db.session.commit()
    return get_profile()


@candidate_bp.route("/recommendations", methods=["GET"])
@jwt_required()
def recommended_jobs():
    user, candidate, err = _require_candidate()
    if err:
        return err

    if not candidate:
        return jsonify({"error": "Please create profile first"}), 404

    # FREE members get top 10; PREMIUM members get the full list.
    limit = None if is_premium_member(user) else 10
    scored = recommend_jobs_for_candidate(candidate, limit=limit)

    recommendations = []
    for job, score, matched_skill_ids in scored:
        # Resolve skill names without an extra query per row.
        matched_names = [
            jrs.skill.name for jrs in job.required_skills
            if jrs.skill_id in matched_skill_ids
        ]
        rec = _job_to_dict(job)
        rec["match_score"] = score
        rec["matched_skills"] = matched_names
        recommendations.append(rec)

    return jsonify({
        "is_member": is_premium_member(user),
        "recommendation_count": len(recommendations),
        "recommendations": recommendations,
    }), 200


@candidate_bp.route("/apply/<job_id>", methods=["POST"])
@jwt_required()
def apply_for_job(job_id):
    user, candidate, err = _require_candidate()
    if err:
        return err

    if not candidate:
        return jsonify({"error": "Please create profile first"}), 400

    job = Job.query.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    existing = Application.query.filter_by(
        candidate_id=candidate.candidate_id,
        job_id=job.job_id,
    ).first()
    if existing:
        return jsonify({"error": "You have already applied"}), 409

    data = request.get_json(silent=True) or {}
    application = Application(
        candidate_id=candidate.candidate_id,
        job_id=job.job_id,
        cover_letter=data.get("cover_letter"),
        status="PENDING",
    )
    db.session.add(application)
    db.session.commit()

    return jsonify({
        "message": "Application submitted successfully",
        "application": {
            "application_id": str(application.application_id),
            "job_id": str(application.job_id),
            "status": application.status,
        }
    }), 201


@candidate_bp.route("/applications", methods=["GET"])
@jwt_required()
def my_applications():
    """Lists this candidate's applications. New endpoint — the original
    backend had no equivalent, but the frontend has a 'My Applications'
    page so we provide it here."""
    _, candidate, err = _require_candidate()
    if err:
        return err

    if not candidate:
        return jsonify({"applications": []}), 200

    apps = (
        Application.query
        .filter_by(candidate_id=candidate.candidate_id)
        .order_by(Application.applied_at.desc())
        .all()
    )
    result = []
    for app in apps:
        result.append({
            "application_id": str(app.application_id),
            "status": app.status,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None,
            "cover_letter": app.cover_letter,
            "job": _job_to_dict(app.job) if app.job else None,
        })
    return jsonify({"applications": result}), 200


@candidate_bp.route("/search/jobs", methods=["GET"])
@jwt_required()
def candidate_search_jobs():
    _, _, err = _require_candidate()
    if err:
        return err

    results = search_jobs(
        keyword=request.args.get("keyword"),
        location=request.args.get("location"),
        working_mode=request.args.get("working_mode") or request.args.get("work_mode"),
        job_type=request.args.get("job_type"),
        experience_level=request.args.get("experience_level"),
        salary_min=request.args.get("salary_min"),
        salary_max=request.args.get("salary_max"),
    )

    return jsonify({
        "search_type": "job_search",
        "result_count": len(results),
        "results": results,
    }), 200


@candidate_bp.route("/upgrade", methods=["POST"])
@jwt_required()
def upgrade_membership():
    """Simulated paid upgrade to PREMIUM.

    Accepts a fake payment payload. If validation passes, upgrades the
    candidate to PREMIUM and returns the synthetic transaction info.
    """
    user, _candidate, err = _require_candidate()
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
