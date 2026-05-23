"""
Admin routes — list users, manage memberships.

Membership is stored in its own table now, so 'updating membership'
means inserting a new ACTIVE row (and cancelling old ones), not flipping
a boolean.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, User
from services.translations import (
    db_role_to_api,
    is_premium_member,
    set_membership,
)

admin_bp = Blueprint("admin", __name__)


def _require_admin():
    """Returns the admin User or a (response, status) tuple to bail with."""
    user = User.query.get(get_jwt_identity())
    if not user or user.role not in ("ADMIN", "USER_PROFILE_ADMIN"):
        return None, (jsonify({"error": "Admin access required"}), 403)
    return user, None


@admin_bp.route("/users", methods=["GET"])
@jwt_required()
def view_users():
    _, err = _require_admin()
    if err:
        return err

    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({
        "users": [
            {
                "id": str(u.user_id),
                "email": u.email,
                "role": db_role_to_api(u.role),
                "is_active": u.is_active,
                "is_member": is_premium_member(u),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }), 200


@admin_bp.route("/users/<user_id>/membership", methods=["PUT"])
@jwt_required()
def update_membership(user_id):
    _, err = _require_admin()
    if err:
        return err

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    # Accept either the legacy boolean ('is_member': true/false) or the
    # new tier name ('tier': 'PREMIUM'/'FREE'). The frontend currently
    # sends the boolean — we honour it.
    if "tier" in data:
        tier = (data.get("tier") or "").upper()
        if tier not in ("FREE", "PREMIUM"):
            return jsonify({"error": "tier must be FREE or PREMIUM"}), 400
    elif "is_member" in data:
        if not isinstance(data["is_member"], bool):
            return jsonify({"error": "is_member must be true or false"}), 400
        tier = "PREMIUM" if data["is_member"] else "FREE"
    else:
        return jsonify({"error": "Provide either 'tier' or 'is_member'"}), 400

    set_membership(user, tier)
    db.session.commit()

    return jsonify({
        "message": "Membership status updated successfully",
        "user": {
            "id": str(user.user_id),
            "email": user.email,
            "role": db_role_to_api(user.role),
            "is_member": is_premium_member(user),
        }
    }), 200
