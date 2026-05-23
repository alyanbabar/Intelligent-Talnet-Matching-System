"""
SQLAlchemy models for the Intelligent Talent Matching Platform.

These models mirror the PostgreSQL schema defined in schema.sql. The
schema is owned by the database (created in Supabase / via schema.sql);
SQLAlchemy here is read/write only — we do NOT use db.create_all() to
generate it, because:
  * The schema relies on Postgres-specific features (enums, triggers,
    pg_trgm indexes, views) that SQLAlchemy cannot fully express.
  * Multiple developers share one database; the schema is versioned in
    schema.sql, not by ORM autogeneration.

Conventions:
  - All primary keys are UUIDs.
  - Enum columns are typed as Postgres ENUMs (matching schema.sql); we
    declare them with create_type=False so SQLAlchemy never tries to
    CREATE TYPE — Supabase already has them.
  - Timestamps default on the DB side (DEFAULT NOW()); we don't restate
    them client-side.
"""

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID, ENUM, JSONB
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


# ----------------------------------------------------------------------
# Postgres ENUM types (defined in schema.sql, not by us)
# ----------------------------------------------------------------------

UserRole = ENUM(
    "ADMIN", "USER_PROFILE_ADMIN", "CANDIDATE", "COMPANY",
    name="user_role", create_type=False,
)
WorkingMode = ENUM(
    "REMOTE", "ONSITE", "HYBRID",
    name="working_mode", create_type=False,
)
JobTypeEnum = ENUM(
    "FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY",
    name="job_type", create_type=False,
)
ExperienceLevel = ENUM(
    "ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE",
    name="experience_level", create_type=False,
)
MembershipTier = ENUM(
    "FREE", "PREMIUM",
    name="membership_tier", create_type=False,
)
MembershipStatus = ENUM(
    "ACTIVE", "EXPIRED", "CANCELLED",
    name="membership_status", create_type=False,
)
ApplicationStatus = ENUM(
    "PENDING", "REVIEWED", "SHORTLISTED", "INTERVIEWED",
    "ACCEPTED", "REJECTED", "WITHDRAWN",
    name="application_status", create_type=False,
)
ProficiencyLevel = ENUM(
    "BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT",
    name="proficiency_level", create_type=False,
)


# ----------------------------------------------------------------------
# Core tables
# ----------------------------------------------------------------------

class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(UUID(as_uuid=True), primary_key=True,
                        server_default=db.text("gen_random_uuid()"))
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(UserRole, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, server_default=db.text("TRUE"))
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))
    updated_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)

    candidate = db.relationship("Candidate", uselist=False, back_populates="user",
                                cascade="all, delete-orphan")
    company = db.relationship("Company", uselist=False, back_populates="user",
                              cascade="all, delete-orphan")
    memberships = db.relationship("Membership", back_populates="user",
                                  cascade="all, delete-orphan",
                                  order_by="Membership.started_at.desc()")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Candidate(db.Model):
    __tablename__ = "candidates"

    candidate_id = db.Column(UUID(as_uuid=True), primary_key=True,
                             server_default=db.text("gen_random_uuid()"))
    user_id = db.Column(UUID(as_uuid=True),
                        db.ForeignKey("users.user_id", ondelete="CASCADE"),
                        nullable=False, unique=True)
    full_name = db.Column(db.String(150), nullable=False)
    phone = db.Column(db.String(30))
    headline = db.Column(db.String(255))
    bio = db.Column(db.Text)
    preferred_working_mode = db.Column(WorkingMode)
    preferred_location = db.Column(db.String(150))
    preferred_salary_min = db.Column(db.Numeric(12, 2))
    preferred_salary_max = db.Column(db.Numeric(12, 2))
    years_of_experience = db.Column(db.Integer, server_default=db.text("0"))
    search_text = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))
    updated_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))

    user = db.relationship("User", back_populates="candidate")
    skills = db.relationship("CandidateSkill", back_populates="candidate",
                             cascade="all, delete-orphan")
    work_experiences = db.relationship("CandidateWorkExperience",
                                       back_populates="candidate",
                                       cascade="all, delete-orphan")
    applications = db.relationship("Application", back_populates="candidate",
                                   cascade="all, delete-orphan")


class CandidateWorkExperience(db.Model):
    __tablename__ = "candidate_work_experience"

    experience_id = db.Column(UUID(as_uuid=True), primary_key=True,
                              server_default=db.text("gen_random_uuid()"))
    candidate_id = db.Column(UUID(as_uuid=True),
                             db.ForeignKey("candidates.candidate_id",
                                           ondelete="CASCADE"),
                             nullable=False)
    company_name = db.Column(db.String(150), nullable=False)
    job_title = db.Column(db.String(150), nullable=False)
    location = db.Column(db.String(150))
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)
    description = db.Column(db.Text)
    is_current = db.Column(db.Boolean, nullable=False,
                           server_default=db.text("FALSE"))
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))

    candidate = db.relationship("Candidate", back_populates="work_experiences")


class Skill(db.Model):
    __tablename__ = "skills"

    skill_id = db.Column(UUID(as_uuid=True), primary_key=True,
                         server_default=db.text("gen_random_uuid()"))
    name = db.Column(db.String(100), nullable=False, unique=True)
    category = db.Column(db.String(50))
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))


class CandidateSkill(db.Model):
    __tablename__ = "candidate_skills"

    candidate_id = db.Column(UUID(as_uuid=True),
                             db.ForeignKey("candidates.candidate_id",
                                           ondelete="CASCADE"),
                             primary_key=True)
    skill_id = db.Column(UUID(as_uuid=True),
                         db.ForeignKey("skills.skill_id", ondelete="CASCADE"),
                         primary_key=True)
    proficiency = db.Column(ProficiencyLevel, nullable=False,
                            server_default=db.text("'INTERMEDIATE'"))
    years_experience = db.Column(db.Integer, server_default=db.text("0"))

    candidate = db.relationship("Candidate", back_populates="skills")
    skill = db.relationship("Skill")


class Company(db.Model):
    __tablename__ = "companies"

    company_id = db.Column(UUID(as_uuid=True), primary_key=True,
                           server_default=db.text("gen_random_uuid()"))
    user_id = db.Column(UUID(as_uuid=True),
                        db.ForeignKey("users.user_id", ondelete="CASCADE"),
                        nullable=False, unique=True)
    name = db.Column(db.String(200), nullable=False)
    industry = db.Column(db.String(100))
    website = db.Column(db.String(255))
    description = db.Column(db.Text)
    headquarters = db.Column(db.String(150))
    company_size = db.Column(db.String(50))
    founded_year = db.Column(db.Integer)
    logo_url = db.Column(db.String(500))
    search_text = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))
    updated_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))

    user = db.relationship("User", back_populates="company")
    jobs = db.relationship("Job", back_populates="company",
                           cascade="all, delete-orphan")


class Job(db.Model):
    __tablename__ = "jobs"

    job_id = db.Column(UUID(as_uuid=True), primary_key=True,
                       server_default=db.text("gen_random_uuid()"))
    company_id = db.Column(UUID(as_uuid=True),
                           db.ForeignKey("companies.company_id",
                                         ondelete="CASCADE"),
                           nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    responsibilities = db.Column(db.Text)
    requirements = db.Column(db.Text)
    location = db.Column(db.String(150))
    working_mode = db.Column(WorkingMode, nullable=False,
                             server_default=db.text("'ONSITE'"))
    job_type = db.Column(JobTypeEnum, nullable=False,
                         server_default=db.text("'FULL_TIME'"))
    experience_level = db.Column(ExperienceLevel, nullable=False,
                                 server_default=db.text("'MID'"))
    salary_min = db.Column(db.Numeric(12, 2))
    salary_max = db.Column(db.Numeric(12, 2))
    currency = db.Column(db.CHAR(3), server_default=db.text("'AUD'"))
    is_active = db.Column(db.Boolean, nullable=False,
                          server_default=db.text("TRUE"))
    posted_at = db.Column(db.DateTime(timezone=True),
                          server_default=db.text("NOW()"))
    closes_at = db.Column(db.DateTime(timezone=True))
    search_text = db.Column(db.Text)

    company = db.relationship("Company", back_populates="jobs")
    required_skills = db.relationship("JobRequiredSkill", back_populates="job",
                                      cascade="all, delete-orphan")
    applications = db.relationship("Application", back_populates="job",
                                   cascade="all, delete-orphan")


class JobRequiredSkill(db.Model):
    __tablename__ = "job_required_skills"

    job_id = db.Column(UUID(as_uuid=True),
                       db.ForeignKey("jobs.job_id", ondelete="CASCADE"),
                       primary_key=True)
    skill_id = db.Column(UUID(as_uuid=True),
                         db.ForeignKey("skills.skill_id", ondelete="CASCADE"),
                         primary_key=True)
    is_required = db.Column(db.Boolean, nullable=False,
                            server_default=db.text("TRUE"))
    min_proficiency = db.Column(ProficiencyLevel,
                                server_default=db.text("'INTERMEDIATE'"))

    job = db.relationship("Job", back_populates="required_skills")
    skill = db.relationship("Skill")


class Membership(db.Model):
    __tablename__ = "memberships"

    membership_id = db.Column(UUID(as_uuid=True), primary_key=True,
                              server_default=db.text("gen_random_uuid()"))
    user_id = db.Column(UUID(as_uuid=True),
                        db.ForeignKey("users.user_id", ondelete="CASCADE"),
                        nullable=False)
    tier = db.Column(MembershipTier, nullable=False,
                     server_default=db.text("'FREE'"))
    status = db.Column(MembershipStatus, nullable=False,
                       server_default=db.text("'ACTIVE'"))
    started_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))
    expires_at = db.Column(db.DateTime(timezone=True))
    auto_renew = db.Column(db.Boolean, nullable=False,
                           server_default=db.text("FALSE"))
    price_paid = db.Column(db.Numeric(10, 2))
    created_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))

    user = db.relationship("User", back_populates="memberships")


class Application(db.Model):
    __tablename__ = "applications"
    __table_args__ = (
        db.UniqueConstraint("job_id", "candidate_id",
                            name="applications_job_id_candidate_id_key"),
    )

    application_id = db.Column(UUID(as_uuid=True), primary_key=True,
                               server_default=db.text("gen_random_uuid()"))
    job_id = db.Column(UUID(as_uuid=True),
                       db.ForeignKey("jobs.job_id", ondelete="CASCADE"),
                       nullable=False)
    candidate_id = db.Column(UUID(as_uuid=True),
                             db.ForeignKey("candidates.candidate_id",
                                           ondelete="CASCADE"),
                             nullable=False)
    cover_letter = db.Column(db.Text)
    status = db.Column(ApplicationStatus, nullable=False,
                       server_default=db.text("'PENDING'"))
    applied_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))
    updated_at = db.Column(db.DateTime(timezone=True),
                           server_default=db.text("NOW()"))

    job = db.relationship("Job", back_populates="applications")
    candidate = db.relationship("Candidate", back_populates="applications")


class Recommendation(db.Model):
    __tablename__ = "recommendations"
    __table_args__ = (
        db.UniqueConstraint("candidate_id", "job_id",
                            name="recommendations_candidate_id_job_id_key"),
    )

    recommendation_id = db.Column(UUID(as_uuid=True), primary_key=True,
                                  server_default=db.text("gen_random_uuid()"))
    candidate_id = db.Column(UUID(as_uuid=True),
                             db.ForeignKey("candidates.candidate_id",
                                           ondelete="CASCADE"),
                             nullable=False)
    job_id = db.Column(UUID(as_uuid=True),
                       db.ForeignKey("jobs.job_id", ondelete="CASCADE"),
                       nullable=False)
    match_score = db.Column(db.Numeric(5, 2), nullable=False)
    rank_position = db.Column(db.Integer, nullable=False)
    generated_at = db.Column(db.DateTime(timezone=True),
                             server_default=db.text("NOW()"))


class SearchHistory(db.Model):
    __tablename__ = "search_history"

    search_id = db.Column(UUID(as_uuid=True), primary_key=True,
                          server_default=db.text("gen_random_uuid()"))
    user_id = db.Column(UUID(as_uuid=True),
                        db.ForeignKey("users.user_id", ondelete="SET NULL"))
    query_text = db.Column(db.Text)
    filters_json = db.Column(JSONB)
    result_count = db.Column(db.Integer)
    searched_at = db.Column(db.DateTime(timezone=True),
                            server_default=db.text("NOW()"))
