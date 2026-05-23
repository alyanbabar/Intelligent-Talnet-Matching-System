"""
Application configuration.

Reads from .env (via python-dotenv) when present; otherwise relies on
real OS environment variables. Never commit a populated .env to git.
"""

import os
from datetime import timedelta

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class Config:
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-key-change-later")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # Database connection.
    # This project targets PostgreSQL (Supabase). The schema relies on
    # Postgres-specific features so SQLite is not a supported fallback.
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    @classmethod
    def validate(cls):
        if not cls.SQLALCHEMY_DATABASE_URI:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy .env.example to .env and set "
                "your Postgres / Supabase connection string."
            )
        if cls.SQLALCHEMY_DATABASE_URI.startswith("https://"):
            raise RuntimeError(
                "DATABASE_URL must start with 'postgresql://' — you appear "
                "to have used the Supabase project URL (https://...). "
                "Copy the connection string from Supabase Project Settings "
                "-> Database -> Connection string -> URI tab."
            )


Config.validate()
