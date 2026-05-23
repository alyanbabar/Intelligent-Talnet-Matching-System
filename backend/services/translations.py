"""
Translation helpers between the public API vocabulary and the database
vocabulary.

The frontend uses lowercase, friendly names: "candidate", "employer",
"admin". The schema uses uppercase enum names: "CANDIDATE", "COMPANY",
"ADMIN", "USER_PROFILE_ADMIN". This module hides the difference so the
rest of the backend speaks one language.
"""

from datetime import datetime, timezone

from models import db, Membership


# ---- Role translation -------------------------------------------------

_API_TO_DB_ROLE = {
    "candidate": "CANDIDATE",
    "employer": "COMPANY",
    "admin": "ADMIN",
}

_DB_TO_API_ROLE = {
    "CANDIDATE": "candidate",
    "COMPANY": "employer",
    "ADMIN": "admin",
    # USER_PROFILE_ADMIN is an internal DB role; we surface it as "admin"
    # for any external consumer that happens to see it.
    "USER_PROFILE_ADMIN": "admin",
}


def api_role_to_db(api_role):
    """Translate a public role label (e.g. 'employer') to a DB enum
    value (e.g. 'COMPANY'). Returns None if the input isn't valid."""
    if api_role is None:
        return None
    return _API_TO_DB_ROLE.get(api_role.lower())


def db_role_to_api(db_role):
    """Translate a DB enum value back to the public role label."""
    if db_role is None:
        return None
    return _DB_TO_API_ROLE.get(db_role, db_role.lower())


# ---- Membership translation ------------------------------------------

def is_premium_member(user):
    """True iff the user currently has an ACTIVE PREMIUM membership.

    The schema models membership as a separate row with tier and status,
    so 'is_member' from the old API is computed here rather than stored
    as a column on the user.
    """
    if user is None:
        return False

    now = datetime.now(timezone.utc)
    active = (
        Membership.query
        .filter_by(user_id=user.user_id, status="ACTIVE")
        .filter(
            (Membership.expires_at.is_(None)) | (Membership.expires_at > now)
        )
        .order_by(Membership.started_at.desc())
        .first()
    )
    return active is not None and active.tier == "PREMIUM"


def set_membership(user, tier):
    """Mark `tier` ('FREE' or 'PREMIUM') as the user's current
    membership.

    Strategy: cancel any existing ACTIVE memberships, then insert a new
    ACTIVE row with the requested tier. This preserves history (you can
    audit when someone upgraded/downgraded) which is the point of
    modelling membership as a table rather than a boolean.
    """
    assert tier in ("FREE", "PREMIUM"), "tier must be FREE or PREMIUM"

    existing_active = (
        Membership.query
        .filter_by(user_id=user.user_id, status="ACTIVE")
        .all()
    )
    for m in existing_active:
        m.status = "CANCELLED"

    new = Membership(
        user_id=user.user_id,
        tier=tier,
        status="ACTIVE",
    )
    db.session.add(new)
    return new
