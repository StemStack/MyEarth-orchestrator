"""
Authentication system for MyEarth.app
Handles OAuth2 login, JWT tokens, and user management
"""

import os
import jwt
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User, Base
import requests
from dotenv import load_dotenv

load_dotenv()

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2 Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")

# Database setup
# Try multiple database configurations
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Try common PostgreSQL configurations
    possible_urls = [
        "postgresql://postgres:myearth_password@localhost/myearth",
        "postgresql://postgres:password@localhost/myearth",
        "postgresql://postgres:@localhost/myearth",
        "postgresql://myearth:myearth@localhost/myearth"
    ]
    DATABASE_URL = possible_urls[0]  # Use first one as default

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables (with error handling)
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
except Exception as e:
    print(f"⚠️  Database connection failed: {e}")
    print("⚠️  Application will start without database functionality")
    # Create a dummy engine for development
    engine = None
    SessionLocal = None

# Security
security = HTTPBearer()

def get_db():
    """Get database session"""
    if SessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not available"
        )
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("sub")
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# OAuth2 Provider Functions
async def verify_google_token(token: str) -> Dict[str, Any]:
    """Verify Google OAuth2 token"""
    try:
        response = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?access_token={token}"
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        raise HTTPException(status_code=400, detail="Invalid Google token")

async def verify_github_token(token: str) -> Dict[str, Any]:
    """Verify GitHub OAuth2 token"""
    try:
        headers = {"Authorization": f"token {token}"}
        response = requests.get("https://api.github.com/user", headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        raise HTTPException(status_code=400, detail="Invalid GitHub token")

async def verify_linkedin_token(token: str) -> Dict[str, Any]:
    """Verify LinkedIn OAuth2 token"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            "https://api.linkedin.com/v2/me",
            headers=headers
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        raise HTTPException(status_code=400, detail="Invalid LinkedIn token")

def get_or_create_user(db: Session, oauth_data: Dict[str, Any], provider: str) -> User:
    """Get existing user or create new one from OAuth data"""
    oauth_id = str(oauth_data.get("id") or oauth_data.get("sub"))
    email = oauth_data.get("email")
    
    # Try to find existing user by OAuth ID
    user = db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_id == oauth_id
    ).first()
    
    if user:
        return user
    
    # Try to find by email
    if email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Update existing user with OAuth info
            user.oauth_provider = provider
            user.oauth_id = oauth_id
            db.commit()
            return user
    
    # Create new user
    username = oauth_data.get("login") or oauth_data.get("preferred_username") or email.split("@")[0]
    
    # Ensure unique username
    base_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1
    
    user = User(
        email=email,
        username=username,
        full_name=oauth_data.get("name") or oauth_data.get("full_name"),
        avatar_url=oauth_data.get("picture") or oauth_data.get("avatar_url"),
        oauth_provider=provider,
        oauth_id=oauth_id
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# Authentication endpoints will be added to main.py
