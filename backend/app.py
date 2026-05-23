"""
Flask application entry point.

The database schema is owned by Supabase (see schema.sql). We do NOT
call db.create_all() here, because the schema uses Postgres-only
features (enums, triggers, pg_trgm GIN indexes, views) that SQLAlchemy
cannot fully express. If you need to recreate the schema, run
schema.sql against a fresh database.
"""

import os

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from models import db
from routes.auth_routes import auth_bp
from routes.candidate_routes import candidate_bp
from routes.employer_routes import employer_bp
from routes.admin_routes import admin_bp


app = Flask(__name__)
app.config.from_object(Config)

# CORS: allow the Vite dev server by default; tighten in production via
# CORS_ORIGINS in .env (comma-separated list).
_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
CORS(app, resources={r"/*": {"origins": [o.strip() for o in _origins if o.strip()]}})

jwt = JWTManager(app)
db.init_app(app)

app.register_blueprint(auth_bp, url_prefix="/auth")
app.register_blueprint(candidate_bp, url_prefix="/candidate")
app.register_blueprint(employer_bp, url_prefix="/employer")
app.register_blueprint(admin_bp, url_prefix="/admin")


@app.route("/")
def home():
    return {"message": "Intelligent Talent Matching Platform Backend is running"}


@app.errorhandler(404)
def not_found(_error):
    return {"error": "Route not found"}, 404


@app.errorhandler(500)
def internal_error(_error):
    return {"error": "Internal server error"}, 500


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug)
