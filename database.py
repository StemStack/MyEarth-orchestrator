from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Use the actual Replit PostgreSQL database URL
DATABASE_URL = os.getenv("DATABASE_URL")

# Fix SSL issues for production PostgreSQL
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    # For Replit's PostgreSQL, use sslmode=require for better reliability
    if "sslmode=" in DATABASE_URL:
        # Split on the sslmode parameter and reconstruct
        base_url = DATABASE_URL.split("?")[0] if "?" in DATABASE_URL else DATABASE_URL
        DATABASE_URL = base_url + "?sslmode=require"
    else:
        # Add SSL mode for production databases
        if "?" in DATABASE_URL:
            DATABASE_URL += "&sslmode=require"
        else:
            DATABASE_URL += "?sslmode=require"

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Enable connection health checks
    pool_recycle=300,    # Recycle connections every 5 minutes
    connect_args={"sslmode": "require"}  # Explicit SSL requirement
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()