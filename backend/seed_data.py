"""
Seed demo data into the database.

Idempotent: safe to re-run. Looks up rows by their natural key (email,
skill name, etc.) and inserts only if missing.

Creates:
  * 3 users (admin, employer/company, candidate) with FREE memberships
  * 1 company profile
  * 1 candidate profile + skills
  * 1 job + required skills
  * 1 application from the candidate to that job
  * 8 skills in the master catalogue
"""

from app import app
from models import (
    db, User, Candidate, Company, Job, Application,
    Skill, CandidateSkill, JobRequiredSkill, Membership,
)


DEMO_SKILLS = [
    ("Python", "Programming"),
    ("SQL", "Programming"),
    ("Excel", "Tools"),
    ("Data Analysis", "Domain"),
    ("JavaScript", "Programming"),
    ("React", "Frontend"),
    ("Flask", "Backend"),
    ("PostgreSQL", "Database"),
]


def get_or_create_user(email, password, role):
    user = User.query.filter_by(email=email).first()
    if user:
        return user
    user = User(email=email, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    db.session.add(Membership(user_id=user.user_id, tier="FREE", status="ACTIVE"))
    return user


def ensure_skill(name, category):
    skill = Skill.query.filter(db.func.lower(Skill.name) == name.lower()).first()
    if skill:
        return skill
    skill = Skill(name=name, category=category)
    db.session.add(skill)
    db.session.flush()
    return skill


def seed():
    with app.app_context():
        print("Starting seed data setup...")

        # Master skill catalogue
        skills_by_name = {}
        for name, category in DEMO_SKILLS:
            skills_by_name[name] = ensure_skill(name, category)

        # Admin
        get_or_create_user("admin@test.com", "123456", "ADMIN")

        # Employer (User + Company)
        employer_user = get_or_create_user("abz0@test.com", "123456", "COMPANY")
        company = Company.query.filter_by(user_id=employer_user.user_id).first()
        if not company:
            company = Company(
                user_id=employer_user.user_id,
                name="University of Wollongong",
                industry="Education",
                headquarters="Wollongong, NSW",
                description="A leading Australian university.",
            )
            db.session.add(company)
            db.session.flush()

        # Candidate (User + Candidate profile + skills)
        candidate_user = get_or_create_user("sk12@test.com", "123456", "CANDIDATE")
        candidate = Candidate.query.filter_by(user_id=candidate_user.user_id).first()
        if not candidate:
            candidate = Candidate(
                user_id=candidate_user.user_id,
                full_name="Sujal Kumar",
                headline="Data Analyst Intern Candidate",
                bio="Computer Science student interested in data and analytics.",
                preferred_working_mode="HYBRID",
                preferred_location="Wollongong",
                preferred_salary_min=50000,
                preferred_salary_max=70000,
                years_of_experience=0,
            )
            db.session.add(candidate)
            db.session.flush()

        for skill_name in ["Python", "SQL", "Excel", "Data Analysis"]:
            sk = skills_by_name[skill_name]
            exists = CandidateSkill.query.filter_by(
                candidate_id=candidate.candidate_id,
                skill_id=sk.skill_id,
            ).first()
            if not exists:
                db.session.add(CandidateSkill(
                    candidate_id=candidate.candidate_id,
                    skill_id=sk.skill_id,
                    proficiency="INTERMEDIATE",
                ))

        # Demo job
        job = Job.query.filter_by(
            company_id=company.company_id,
            title="Data Analyst Intern",
        ).first()
        if not job:
            job = Job(
                company_id=company.company_id,
                title="Data Analyst Intern",
                description=(
                    "Support reporting, dashboards, student data analysis, "
                    "and operational insights across university departments."
                ),
                requirements="Currently studying a Bachelor's degree in CS, IT, or similar.",
                location="Wollongong",
                working_mode="HYBRID",
                job_type="INTERNSHIP",
                experience_level="ENTRY",
                salary_min=50000,
                salary_max=65000,
                currency="AUD",
                is_active=True,
            )
            db.session.add(job)
            db.session.flush()

        for skill_name in ["Python", "SQL", "Excel", "Data Analysis"]:
            sk = skills_by_name[skill_name]
            exists = JobRequiredSkill.query.filter_by(
                job_id=job.job_id, skill_id=sk.skill_id
            ).first()
            if not exists:
                db.session.add(JobRequiredSkill(
                    job_id=job.job_id,
                    skill_id=sk.skill_id,
                    is_required=True,
                    min_proficiency="INTERMEDIATE",
                ))

        # Demo application
        existing_app = Application.query.filter_by(
            candidate_id=candidate.candidate_id,
            job_id=job.job_id,
        ).first()
        if not existing_app:
            db.session.add(Application(
                candidate_id=candidate.candidate_id,
                job_id=job.job_id,
                status="PENDING",
                cover_letter="I'm very interested in this internship opportunity.",
            ))

        db.session.commit()

        print("Seed data created successfully.")
        print("Admin login:     admin@test.com / 123456")
        print("Employer login:  abz0@test.com / 123456")
        print("Candidate login: sk12@test.com / 123456")


if __name__ == "__main__":
    seed()
