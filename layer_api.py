"""
Layer management API for MyEarth.app
Handles layer CRUD operations, search, ratings, and file uploads
"""

import os
import json
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from pydantic import BaseModel
import uuid
from datetime import datetime

from models import User, Layer, LayerRating, LayerCategory, License
from auth import get_current_active_user, get_db
import geopandas as gpd
import requests
from urllib.parse import urlparse

router = APIRouter(prefix="/api/layers", tags=["layers"])

# Pydantic models for request/response
class LayerCreate(BaseModel):
    title: str
    description: Optional[str] = None
    tags: List[str] = []
    source_url: Optional[str] = None
    license: str = "CC BY 4.0"
    category: str = "general"
    is_public: bool = True

class LayerUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    source_url: Optional[str] = None
    license: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None

class LayerResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    tags: List[str]
    source_url: Optional[str]
    license: str
    category: str
    is_public: bool
    file_path: Optional[str]
    file_size: Optional[int]
    file_format: Optional[str]
    processed_format: Optional[str]
    bbox: Optional[List[float]]
    center_lon: Optional[float]
    center_lat: Optional[float]
    zoom_level: Optional[int]
    view_count: int
    download_count: int
    average_rating: float
    rating_count: int
    user_rating: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    user: Dict[str, Any]

class RatingCreate(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None

class SearchFilters(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    license: Optional[str] = None
    tags: Optional[List[str]] = None
    min_rating: Optional[float] = None
    is_public: Optional[bool] = None
    sort_by: str = "created_at"  # created_at, rating, popularity, title
    sort_order: str = "desc"  # asc, desc

# Layer CRUD Operations
@router.post("/", response_model=LayerResponse)
async def create_layer(
    layer_data: LayerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new layer"""
    layer = Layer(
        user_id=current_user.id,
        title=layer_data.title,
        description=layer_data.description,
        tags=layer_data.tags,
        source_url=layer_data.source_url,
        license=layer_data.license,
        category=layer_data.category,
        is_public=layer_data.is_public
    )
    
    db.add(layer)
    db.commit()
    db.refresh(layer)
    
    return layer

@router.get("/", response_model=List[LayerResponse])
async def search_layers(
    query: Optional[str] = Query(None, description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    license: Optional[str] = Query(None, description="Filter by license"),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    min_rating: Optional[float] = Query(None, description="Minimum rating"),
    is_public: Optional[bool] = Query(True, description="Public layers only"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Search and filter layers"""
    # Build query
    query_builder = db.query(Layer)
    
    # Apply filters
    if is_public:
        query_builder = query_builder.filter(Layer.is_public == True)
    
    if query:
        search_term = f"%{query}%"
        query_builder = query_builder.filter(
            or_(
                Layer.title.ilike(search_term),
                Layer.description.ilike(search_term),
                Layer.tags.any(lambda tag: tag.ilike(search_term))
            )
        )
    
    if category:
        query_builder = query_builder.filter(Layer.category == category)
    
    if license:
        query_builder = query_builder.filter(Layer.license == license)
    
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",")]
        for tag in tag_list:
            query_builder = query_builder.filter(Layer.tags.contains([tag]))
    
    if min_rating:
        # This is a simplified version - in production you'd use a subquery
        query_builder = query_builder.filter(Layer.id.in_(
            db.query(LayerRating.layer_id)
            .group_by(LayerRating.layer_id)
            .having(func.avg(LayerRating.rating) >= min_rating)
        ))
    
    # Apply sorting
    if sort_by == "rating":
        # Sort by average rating (simplified)
        query_builder = query_builder.order_by(desc(Layer.id))
    elif sort_by == "popularity":
        query_builder = query_builder.order_by(desc(Layer.view_count))
    elif sort_by == "title":
        query_builder = query_builder.order_by(Layer.title)
    else:  # created_at
        query_builder = query_builder.order_by(desc(Layer.created_at))
    
    # Apply pagination
    offset = (page - 1) * limit
    layers = query_builder.offset(offset).limit(limit).all()
    
    # Add user rating if authenticated
    result = []
    for layer in layers:
        layer_dict = {
            "id": str(layer.id),
            "title": layer.title,
            "description": layer.description,
            "tags": layer.tags,
            "source_url": layer.source_url,
            "license": layer.license,
            "category": layer.category,
            "is_public": layer.is_public,
            "file_path": layer.file_path,
            "file_size": layer.file_size,
            "file_format": layer.file_format,
            "processed_format": layer.processed_format,
            "bbox": layer.bbox,
            "center_lon": layer.center_lon,
            "center_lat": layer.center_lat,
            "zoom_level": layer.zoom_level,
            "view_count": layer.view_count,
            "download_count": layer.download_count,
            "average_rating": layer.average_rating,
            "rating_count": layer.rating_count,
            "created_at": layer.created_at,
            "updated_at": layer.updated_at,
            "user": {
                "id": str(layer.user.id),
                "username": layer.user.username,
                "full_name": layer.user.full_name,
                "avatar_url": layer.user.avatar_url
            }
        }
        
        # Add user rating if authenticated
        if current_user:
            user_rating = db.query(LayerRating).filter(
                and_(
                    LayerRating.layer_id == layer.id,
                    LayerRating.user_id == current_user.id
                )
            ).first()
            layer_dict["user_rating"] = user_rating.rating if user_rating else None
        
        result.append(layer_dict)
    
    return result

@router.get("/{layer_id}", response_model=LayerResponse)
async def get_layer(
    layer_id: str,
    current_user: Optional[User] = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific layer by ID"""
    layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Check if user can access private layer
    if not layer.is_public and (not current_user or layer.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Increment view count
    layer.view_count += 1
    db.commit()
    
    # Build response
    layer_dict = {
        "id": str(layer.id),
        "title": layer.title,
        "description": layer.description,
        "tags": layer.tags,
        "source_url": layer.source_url,
        "license": layer.license,
        "category": layer.category,
        "is_public": layer.is_public,
        "file_path": layer.file_path,
        "file_size": layer.file_size,
        "file_format": layer.file_format,
        "processed_format": layer.processed_format,
        "bbox": layer.bbox,
        "center_lon": layer.center_lon,
        "center_lat": layer.center_lat,
        "zoom_level": layer.zoom_level,
        "view_count": layer.view_count,
        "download_count": layer.download_count,
        "average_rating": layer.average_rating,
        "rating_count": layer.rating_count,
        "created_at": layer.created_at,
        "updated_at": layer.updated_at,
        "user": {
            "id": str(layer.user.id),
            "username": layer.user.username,
            "full_name": layer.user.full_name,
            "avatar_url": layer.user.avatar_url
        }
    }
    
    # Add user rating if authenticated
    if current_user:
        user_rating = db.query(LayerRating).filter(
            and_(
                LayerRating.layer_id == layer.id,
                LayerRating.user_id == current_user.id
            )
        ).first()
        layer_dict["user_rating"] = user_rating.rating if user_rating else None
    
    return layer_dict

@router.put("/{layer_id}", response_model=LayerResponse)
async def update_layer(
    layer_id: str,
    layer_data: LayerUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a layer (owner or admin only)"""
    layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Check permissions
    if layer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update fields
    update_data = layer_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(layer, field, value)
    
    layer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(layer)
    
    return layer

@router.delete("/{layer_id}")
async def delete_layer(
    layer_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a layer (owner or admin only)"""
    layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Check permissions
    if layer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete associated file if exists
    if layer.file_path and os.path.exists(layer.file_path):
        os.remove(layer.file_path)
    
    db.delete(layer)
    db.commit()
    
    return {"message": "Layer deleted successfully"}

# Rating System
@router.post("/{layer_id}/rate")
async def rate_layer(
    layer_id: str,
    rating_data: RatingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Rate a layer (1-5 stars)"""
    if not 1 <= rating_data.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Check if user already rated this layer
    existing_rating = db.query(LayerRating).filter(
        and_(
            LayerRating.layer_id == layer.id,
            LayerRating.user_id == current_user.id
        )
    ).first()
    
    if existing_rating:
        # Update existing rating
        existing_rating.rating = rating_data.rating
        existing_rating.comment = rating_data.comment
        existing_rating.updated_at = datetime.utcnow()
    else:
        # Create new rating
        new_rating = LayerRating(
            layer_id=layer.id,
            user_id=current_user.id,
            rating=rating_data.rating,
            comment=rating_data.comment
        )
        db.add(new_rating)
    
    db.commit()
    
    return {"message": "Rating saved successfully"}

@router.delete("/{layer_id}/rate")
async def remove_rating(
    layer_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove user's rating for a layer"""
    layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    rating = db.query(LayerRating).filter(
        and_(
            LayerRating.layer_id == layer.id,
            LayerRating.user_id == current_user.id
        )
    ).first()
    
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    db.delete(rating)
    db.commit()
    
    return {"message": "Rating removed successfully"}

# File Upload and Processing
@router.post("/{layer_id}/upload")
async def upload_layer_file(
    layer_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload a file for a layer"""
    layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Check permissions
    if layer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate file format
    allowed_extensions = ['.geojson', '.shp', '.gpkg', '.kml', '.kmz', '.zip']
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Create uploads directory if it doesn't exist
    uploads_dir = Path("uploads")
    uploads_dir.mkdir(exist_ok=True)
    
    # Save file
    file_path = uploads_dir / f"{layer_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process file and extract metadata
    try:
        metadata = await process_geospatial_file(file_path, file_ext)
        
        # Update layer with file information
        layer.file_path = str(file_path)
        layer.file_size = file_path.stat().st_size
        layer.file_format = file_ext
        layer.processed_format = metadata.get("processed_format", "geojson")
        layer.bbox = metadata.get("bbox")
        layer.center_lon = metadata.get("center_lon")
        layer.center_lat = metadata.get("center_lat")
        layer.zoom_level = metadata.get("zoom_level")
        layer.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "message": "File uploaded and processed successfully",
            "metadata": metadata
        }
        
    except Exception as e:
        # Clean up file if processing failed
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

async def process_geospatial_file(file_path: Path, file_ext: str) -> Dict[str, Any]:
    """Process geospatial file and extract metadata"""
    try:
        if file_ext == '.zip':
            # Handle zip files (shapefiles)
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                # Extract to temp directory
                temp_dir = Path(tempfile.mkdtemp())
                zip_ref.extractall(temp_dir)
                
                # Find shapefile
                shp_files = list(temp_dir.glob("*.shp"))
                if not shp_files:
                    raise ValueError("No shapefile found in zip")
                
                gdf = gpd.read_file(shp_files[0])
                
                # Clean up temp directory
                shutil.rmtree(temp_dir)
        else:
            # Read directly with geopandas
            gdf = gpd.read_file(file_path)
        
        # Extract metadata
        bounds = gdf.total_bounds  # [minx, miny, maxx, maxy]
        center_lon = (bounds[0] + bounds[2]) / 2
        center_lat = (bounds[1] + bounds[3]) / 2
        
        # Calculate zoom level based on extent
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        max_extent = max(width, height)
        
        # Simple zoom calculation (can be improved)
        if max_extent > 180:
            zoom_level = 1
        elif max_extent > 90:
            zoom_level = 2
        elif max_extent > 45:
            zoom_level = 3
        elif max_extent > 20:
            zoom_level = 4
        elif max_extent > 10:
            zoom_level = 5
        elif max_extent > 5:
            zoom_level = 6
        elif max_extent > 2:
            zoom_level = 7
        elif max_extent > 1:
            zoom_level = 8
        elif max_extent > 0.5:
            zoom_level = 9
        else:
            zoom_level = 10
        
        return {
            "processed_format": "geojson",
            "bbox": [bounds[0], bounds[1], bounds[2], bounds[3]],
            "center_lon": center_lon,
            "center_lat": center_lat,
            "zoom_level": zoom_level,
            "feature_count": len(gdf),
            "crs": str(gdf.crs)
        }
        
    except Exception as e:
        raise ValueError(f"Failed to process file: {str(e)}")

# URL-based layer addition
@router.post("/{layer_id}/add-url")
async def add_layer_url(
    layer_id: str,
    url: str = Form(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a layer via URL (WMS, TileJSON, GeoJSON API)"""
    layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Check permissions
    if layer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate and process URL
    try:
        metadata = await process_layer_url(url)
        
        # Update layer with URL information
        layer.source_url = url
        layer.processed_format = metadata.get("format", "unknown")
        layer.bbox = metadata.get("bbox")
        layer.center_lon = metadata.get("center_lon")
        layer.center_lat = metadata.get("center_lat")
        layer.zoom_level = metadata.get("zoom_level")
        layer.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "message": "URL added successfully",
            "metadata": metadata
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid URL: {str(e)}")

async def process_layer_url(url: str) -> Dict[str, Any]:
    """Process layer URL and extract metadata"""
    parsed_url = urlparse(url)
    
    try:
        if "wms" in url.lower():
            # Handle WMS
            return await process_wms_url(url)
        elif "tilejson" in url.lower() or "mbtiles" in url.lower():
            # Handle TileJSON
            return await process_tilejson_url(url)
        elif url.endswith('.geojson') or 'geojson' in url.lower():
            # Handle GeoJSON
            return await process_geojson_url(url)
        else:
            # Try to detect format
            response = requests.head(url, timeout=10)
            content_type = response.headers.get('content-type', '')
            
            if 'json' in content_type:
                return await process_geojson_url(url)
            elif 'xml' in content_type:
                return await process_wms_url(url)
            else:
                raise ValueError("Unsupported URL format")
                
    except requests.RequestException as e:
        raise ValueError(f"Failed to access URL: {str(e)}")

async def process_wms_url(url: str) -> Dict[str, Any]:
    """Process WMS URL"""
    # This is a simplified implementation
    # In production, you'd parse the WMS capabilities document
    return {
        "format": "wms",
        "bbox": [-180, -90, 180, 90],  # Default world extent
        "center_lon": 0,
        "center_lat": 0,
        "zoom_level": 1
    }

async def process_tilejson_url(url: str) -> Dict[str, Any]:
    """Process TileJSON URL"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        tilejson = response.json()
        
        bounds = tilejson.get("bounds", [-180, -90, 180, 90])
        center = tilejson.get("center", [0, 0, 1])
        
        return {
            "format": "tilejson",
            "bbox": bounds,
            "center_lon": center[0],
            "center_lat": center[1],
            "zoom_level": center[2] if len(center) > 2 else 1
        }
    except Exception as e:
        raise ValueError(f"Failed to parse TileJSON: {str(e)}")

async def process_geojson_url(url: str) -> Dict[str, Any]:
    """Process GeoJSON URL"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        geojson = response.json()
        
        # Extract bounds from GeoJSON
        if "bbox" in geojson:
            bounds = geojson["bbox"]
        else:
            # Calculate bounds from features
            bounds = [-180, -90, 180, 90]  # Default
        
        center_lon = (bounds[0] + bounds[2]) / 2
        center_lat = (bounds[1] + bounds[3]) / 2
        
        return {
            "format": "geojson",
            "bbox": bounds,
            "center_lon": center_lon,
            "center_lat": center_lat,
            "zoom_level": 5  # Default zoom
        }
    except Exception as e:
        raise ValueError(f"Failed to parse GeoJSON: {str(e)}")

# Categories and Licenses
@router.get("/categories")
async def get_categories(db: Session = Depends(get_db)):
    """Get available layer categories"""
    categories = db.query(LayerCategory).all()
    return [
        {
            "id": str(cat.id),
            "name": cat.name,
            "description": cat.description,
            "icon": cat.icon,
            "color": cat.color
        }
        for cat in categories
    ]

@router.get("/licenses")
async def get_licenses(db: Session = Depends(get_db)):
    """Get available licenses"""
    licenses = db.query(License).all()
    return [
        {
            "id": str(lic.id),
            "name": lic.name,
            "description": lic.description,
            "url": lic.url,
            "is_open": lic.is_open
        }
        for lic in licenses
    ]

