"""
Auth routes — register and login.

The public API still uses the friendly role names ("candidate",
"employer", "admin"), which we translate to the DB enum names. On
registration we also create the role-specific child row (Candidate or
Company) so the downstream routes have something to work with.
"""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from sqlalchemy.exc import IntegrityError

from models import db, User, Candidate, Company, Membership
from services.translations import (
    api_role_to_db,
    db_role_to_api,
    is_premium_member,
)

auth_bp = Blueprint("auth", __name__)


# We deliberately don't expose USER_PROFILE_ADMIN — that's an internal
# DB role created via admin tools.
_REGISTRABLE_ROLES = {"candidate", "employer"}


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "").strip().lower()

    # For employer signups, accept a company_name too. Falls back to
    # full_name if not provided so older clients still work.
    company_name = (data.get("company_name") or "").strip() or full_name

    if not full_name or not email or not password or not role:
        return jsonify({"error": "All fields are required"}), 400

    if role not in _REGISTRABLE_ROLES:
        return jsonify({"error": "Invalid role"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    db_role = api_role_to_db(role)
    user = User(email=email, role=db_role)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()    # gets user.user_id

    if role == "candidate":
        candidate = Candidate(user_id=user.user_id, full_name=full_name)
        db.session.add(candidate)
    elif role == "employer":
        company = Company(user_id=user.user_id, name=company_name)
        db.session.add(company)

    # Every new user starts with a FREE active membership.
    db.session.add(Membership(
        user_id=user.user_id,
        tier="FREE",
        status="ACTIVE",
    ))

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Registration failed", "detail": str(e.orig)}), 400

    return jsonify({
        "message": "User registered successfully",
        "user": {
            "id": str(user.user_id),
            "full_name": full_name,
            "email": user.email,
            "role": role,
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.is_active:
        return jsonify({"error": "Account is disabled"}), 403

    user.last_login_at = datetime.now(timezone.utc)
    db.session.commit()

    access_token = create_access_token(identity=str(user.user_id))

    # Resolve display name from the role-specific profile.
    if user.role == "CANDIDATE" and user.candidate:
        full_name = user.candidate.full_name
    elif user.role == "COMPANY" and user.company:
        full_name = user.company.name
    else:
        full_name = user.email  # admin fallback

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "user": {
            "id": str(user.user_id),
            "full_name": full_name,
            "email": user.email,
            "role": db_role_to_api(user.role),
            "is_member": is_premium_member(user),
        }
    }), 200
