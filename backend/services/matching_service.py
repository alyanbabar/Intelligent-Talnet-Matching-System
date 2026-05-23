"""
Recommendation / matching logic.

Computes a match score between a candidate and a job from:
  * Skill overlap (the biggest contributor)
  * Preferred working mode match
  * Preferred location match
  * Experience level proximity

For now we compute on-the-fly. The schema has a `recommendations` table
for caching pre-computed scores; populating it is left as a separate
batch job and not done here.
"""

from sqlalchemy.orm import joinedload

from models import Candidate, Job


_EXP_ORDER = {
    "ENTRY": 0, "JUNIOR": 1, "MID": 2,
    "SENIOR": 3, "LEAD": 4, "EXECUTIVE": 5,
}


def _experience_score(candidate_years, job_level):
    """Rough heuristic mapping years-of-experience to expected level."""
    if candidate_years is None or job_level is None:
        return 0.0

    if candidate_years < 1:
        expected = "ENTRY"
    elif candidate_years < 3:
        expected = "JUNIOR"
    elif candidate_years < 6:
        expected = "MID"
    elif candidate_years < 10:
        expected = "SENIOR"
    elif candidate_years < 15:
        expected = "LEAD"
    else:
        expected = "EXECUTIVE"

    diff = abs(_EXP_ORDER.get(expected, 2) - _EXP_ORDER.get(job_level, 2))
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.5
    return 0.0


def score_job_for_candidate(candidate, job, candidate_skill_ids):
    """Compute a 0-100 match score for one (candidate, job) pair.

    Weights (sum to 100):
      * 60 - skill overlap
      * 15 - working mode match
      * 15 - location match
      * 10 - experience-level proximity
    """
    required = {jrs.skill_id for jrs in job.required_skills}
    if required:
        overlap = len(required & candidate_skill_ids)
        skill_score = (overlap / len(required)) * 60.0
    else:
        skill_score = 0.0

    if (candidate.preferred_working_mode
            and job.working_mode
            and candidate.preferred_working_mode == job.working_mode):
        mode_score = 15.0
    else:
        mode_score = 0.0

    if (candidate.preferred_location
            and job.location
            and candidate.preferred_location.lower() == job.location.lower()):
        location_score = 15.0
    else:
        location_score = 0.0

    exp_score = _experience_score(
        candidate.years_of_experience, job.experience_level
    ) * 10.0

    total = skill_score + mode_score + location_score + exp_score
    matched_skill_ids = list(required & candidate_skill_ids) if required else []
    return round(total, 2), matched_skill_ids


def recommend_jobs_for_candidate(candidate, limit=None):
    """Return a sorted list of (job, score, matched_skill_ids)."""
    candidate_skill_ids = {cs.skill_id for cs in candidate.skills}

    jobs = (
        Job.query
        .options(joinedload(Job.required_skills),
                 joinedload(Job.company))
        .filter(Job.is_active.is_(True))
        .all()
    )

    scored = []
    for job in jobs:
        score, matched = score_job_for_candidate(
            candidate, job, candidate_skill_ids
        )
        if score > 0:
            scored.append((job, score, matched))

    scored.sort(key=lambda t: t[1], reverse=True)
    if limit is not None:
        scored = scored[:limit]
    return scored


def recommend_candidates_for_job(job, limit=None):
    """Return a sorted list of (candidate, score, matched_skill_ids)."""
    candidates = (
        Candidate.query
        .options(joinedload(Candidate.skills))
        .all()
    )

    scored = []
    for cand in candidates:
        cand_skill_ids = {cs.skill_id for cs in cand.skills}
        score, matched = score_job_for_candidate(cand, job, cand_skill_ids)
        if score > 0:
            scored.append((cand, score, matched))

    scored.sort(key=lambda t: t[1], reverse=True)
    if limit is not None:
        scored = scored[:limit]
    return scored
