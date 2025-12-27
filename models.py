"""
Database models for MyEarth application
Defines SQLAlchemy ORM models for users, layers, ratings, categories, and licenses
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, ARRAY, Float, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from enum import Enum

Base = declarative_base()

class UserPlan(str, Enum):
    """User subscription plan"""
    FREE = "free"
    PAID = "paid"

class LayerVisibility(str, Enum):
    """Layer visibility for freemium model"""
    PUBLIC = "public"   # Readable by anyone
    PRIVATE = "private"  # Readable only by owner

class User(Base):
    """User model for authentication and user management"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=True, index=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    
    # OAuth fields
    oauth_provider = Column(String, nullable=False)  # google, github, linkedin
    oauth_id = Column(String, nullable=False)  # Provider's user ID
    provider_sub = Column(String, nullable=True)  # OAuth 'sub' claim (optional, for JWT compatibility)
    
    # Freemium model
    plan = Column(SQLEnum(UserPlan), nullable=False, default=UserPlan.FREE)
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    layers = relationship("Layer", back_populates="user", cascade="all, delete-orphan")
    ratings = relationship("LayerRating", back_populates="user", cascade="all, delete-orphan")
    workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")

class Workspace(Base):
    """Workspace model for organizing user data"""
    __tablename__ = "workspaces"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False, default="My Workspace")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="workspaces")
    layers = relationship("Layer", back_populates="workspace")

class Layer(Base):
    """Layer model for geospatial data layers"""
    __tablename__ = "layers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)  # Owner of the layer
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)  # Optional workspace association
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=[])
    source_url = Column(String, nullable=True)
    license = Column(String, nullable=True)
    category = Column(String, nullable=True)
    
    # Visibility and access control (freemium model)
    is_public = Column(Boolean, default=True)  # Legacy field, kept for compatibility
    visibility = Column(SQLEnum(LayerVisibility), nullable=False, default=LayerVisibility.PUBLIC)
    
    # File information
    file_path = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    file_format = Column(String, nullable=True)  # Original format
    processed_format = Column(String, nullable=True)  # Processed format (usually GeoJSON)
    
    # Spatial information
    bbox = Column(ARRAY(Float), nullable=True)  # [min_lon, min_lat, max_lon, max_lat]
    center_lon = Column(Float, nullable=True)
    center_lat = Column(Float, nullable=True)
    zoom_level = Column(Integer, nullable=True)
    
    # Statistics
    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="layers")
    workspace = relationship("Workspace", back_populates="layers")
    ratings = relationship("LayerRating", back_populates="layer", cascade="all, delete-orphan")
    
    @property
    def average_rating(self):
        """Calculate average rating for this layer"""
        if not self.ratings:
            return 0.0
        total = sum(rating.rating for rating in self.ratings)
        return round(total / len(self.ratings), 1)
    
    @property
    def rating_count(self):
        """Get number of ratings for this layer"""
        return len(self.ratings)

class LayerRating(Base):
    """Rating model for layer ratings"""
    __tablename__ = "layer_ratings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    layer_id = Column(String, ForeignKey("layers.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    layer = relationship("Layer", back_populates="ratings")
    user = relationship("User", back_populates="ratings")

class LayerCategory(Base):
    """Category model for organizing layers"""
    __tablename__ = "layer_categories"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)  # Icon name or URL
    color = Column(String, nullable=True)  # Hex color code
    created_at = Column(DateTime, default=func.now())

class License(Base):
    """License model for layer licensing information"""
    __tablename__ = "licenses"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    url = Column(String, nullable=True)  # License URL
    is_open = Column(Boolean, default=True)  # Whether this is an open license
    created_at = Column(DateTime, default=func.now())





