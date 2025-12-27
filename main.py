"""
FastAPI server for MyEarth:
- Serves CesiumJS static files
- Provides API endpoints for DB connection and health checks
- Handles user authentication and layer management
- Replaces old Flask + custom HTTP server setup
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer
import psycopg2
import os
import shutil
from pathlib import Path
import subprocess
import tempfile
import mimetypes
import time
import json
import requests
import zipfile
import asyncio
import uuid
from typing import Optional, Dict
from enum import Enum

# Server start timestamp (for BUILD badge) - set once at import time
SERVER_START_TS = int(time.time())

# --------------------
# Import our modules
# --------------------
from auth import (
    get_current_active_user, 
    get_current_user_or_anonymous,
    get_db, 
    create_access_token, 
    verify_google_token, 
    verify_github_token, 
    verify_linkedin_token, 
    get_or_create_user,
    get_or_create_workspace
)
from layer_api import router as layer_router
from models import User, Layer, LayerRating, LayerCategory, License, Workspace, UserPlan, LayerVisibility

# --------------------
# Database configuration
# --------------------
from dotenv import load_dotenv
import os
import psycopg2

# Load environment variables (optional)
load_dotenv()

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "myearth"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432")
}

def get_db_connection():
    """Connect to PostgreSQL using psycopg2"""
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

# --------------------
# Initialize FastAPI
# --------------------
app = FastAPI(
    title="MyEarth.app API",
    description="GIS platform API for 3D globe visualization and layer management",
    version="1.0.0"
)

# --------------------
# Job Tracking System for Long-Running Uploads/Conversions
# --------------------
class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"

class JobStage(str, Enum):
    UPLOAD_SAVED = "upload_saved"
    EXTRACTING_SLPK = "extracting_slpk"
    CONVERTING_POINTCLOUD = "converting_pointcloud"
    GENERATING_TILESET = "generating_tileset"
    DONE = "done"

# In-memory job storage (use Redis/DB for production)
jobs: Dict[str, dict] = {}

def create_job(filename: str) -> str:
    """Create a new job and return job_id"""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "filename": filename,
        "status": JobStatus.QUEUED,
        "stage": JobStage.UPLOAD_SAVED,
        "progress": 0,
        "message": "Upload saved, starting processing...",
        "error": None,
        "result": None,
        "created_at": time.time()
    }
    return job_id

def update_job(job_id: str, **kwargs):
    """Update job status"""
    if job_id in jobs:
        jobs[job_id].update(kwargs)
        jobs[job_id]["updated_at"] = time.time()

# Enable CORS (all origins allowed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include layer management routes
app.include_router(layer_router)

# --------------------
# Authentication endpoints
# --------------------
@app.post("/api/auth/google")
async def google_auth(token: str = Form(...), db = Depends(get_db)):
    """Authenticate with Google OAuth2"""
    try:
        # Verify Google token
        google_data = await verify_google_token(token)
        
        # Get or create user
        user = get_or_create_user(db, google_data, "google")
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "is_admin": user.is_admin
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/github")
async def github_auth(token: str = Form(...), db = Depends(get_db)):
    """Authenticate with GitHub OAuth2"""
    try:
        # Verify GitHub token
        github_data = await verify_github_token(token)
        
        # Get or create user
        user = get_or_create_user(db, github_data, "github")
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "is_admin": user.is_admin
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/linkedin")
async def linkedin_auth(token: str = Form(...), db = Depends(get_db)):
    """Authenticate with LinkedIn OAuth2"""
    try:
        # Verify LinkedIn token
        linkedin_data = await verify_linkedin_token(token)
        
        # Get or create user
        user = get_or_create_user(db, linkedin_data, "linkedin")
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "is_admin": user.is_admin
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "is_admin": current_user.is_admin,
        "plan": current_user.plan.value if current_user.plan else "free",
        "created_at": current_user.created_at
    }

@app.get("/api/auth/logout")
async def logout():
    """Logout endpoint (client should discard token)"""
    return {"message": "Logged out successfully"}

# --------------------
# Workspace endpoints
# --------------------
@app.get("/api/workspaces/me")
async def get_my_workspace(
    current_user: User = Depends(get_current_active_user),
    db = Depends(get_db)
):
    """
    Get current user's workspace (create if doesn't exist).
    
    For v1 freemium model:
    - Each user has one default workspace (auto-created on first access)
    - Future: support multiple workspaces for paid users
    """
    workspace = get_or_create_workspace(db, current_user)
    
    return {
        "id": str(workspace.id),
        "owner_user_id": str(workspace.owner_user_id),
        "name": workspace.name,
        "description": workspace.description,
        "created_at": workspace.created_at,
        "updated_at": workspace.updated_at
    }

# --------------------
# Serve static files
# --------------------
# Mount static folder for assets (favicon, logos, etc.) with robust fallbacks
BASE_DIR = Path(__file__).resolve().parent

# Prefer frontend directory, then nested UI (BASE_DIR/MyEarth), then root UI as fallback
_candidate_ui_dirs = [
    BASE_DIR / "frontend",  # new frontend directory
    BASE_DIR / "MyEarth",   # nested app directory
    BASE_DIR                # root as fallback
]
UI_DIR = None
for _d in _candidate_ui_dirs:
    if (_d / "index.html").exists():
        UI_DIR = _d.resolve()
        break
if UI_DIR is None:
    # Default to frontend path even if index is missing (will fallback later)
    UI_DIR = (BASE_DIR / "frontend").resolve()

# Choose a static directory that actually exists
_candidate_static_dirs = [
    UI_DIR / "static",
    BASE_DIR / "frontend" / "static",
    BASE_DIR / "static",
    BASE_DIR / "MyEarth" / "static"
]
STATIC_DIR = None
for _s in _candidate_static_dirs:
    if _s.is_dir():
        STATIC_DIR = _s.resolve()
        break

INDEX_FILE = (UI_DIR / "index.html") if (UI_DIR / "index.html").exists() else None
VERSION_FILE = (BASE_DIR / "version.json").resolve()

if STATIC_DIR is not None:
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Root route → serves index.html directly (with fallback response)
from fastapi.responses import RedirectResponse

def _index_candidate_paths():
    return [
        (BASE_DIR / "frontend" / "index.html"),              # new frontend directory (preferred)
        (BASE_DIR / "MyEarth" / "index.html"),               # nested UI
        (BASE_DIR / "index.html"),                            # root UI
        (BASE_DIR / "MyEarth" / "MyEarth" / "index.html"),  # double-nested safety
    ]

@app.get("/")
def serve_index():
    """Serve index.html with robust runtime fallbacks.

    Order:
    1) Local candidate files
    2) Remote fallback from GitHub raw (outer repo then nested UI)
    """
    # Hard-prefer the frontend/index.html (this is where the UI is maintained now)
    preferred_frontend = (BASE_DIR / "frontend" / "index.html")
    if preferred_frontend.exists():
        return FileResponse(str(preferred_frontend.resolve()), headers={
            "X-MyEarth-Index-Path": str(preferred_frontend.resolve())
        })

    # Otherwise, choose the best local candidate by content (prefer real HTML over tiny pointer files)
    best_path = None
    best_score = -1
    for path in _index_candidate_paths():
        if not path.exists():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            text = ""
        size = len(text)
        is_html = ("<html" in text.lower() or "<!doctype" in text.lower())
        looks_like_pointer = (size < 200 and text.strip().endswith("index.html"))
        # Score: large size and contains html wins; pointer gets score -1
        score = (size if is_html else 0)
        if looks_like_pointer:
            score = -1
        if score > best_score:
            best_score = score
            best_path = path

    if best_path and best_score >= 0:
        return FileResponse(str(best_path.resolve()), headers={
            "X-MyEarth-Index-Path": str(best_path.resolve())
        })

    # Remote fallback to ensure site stays up even if files missing locally
    try:
        raw_urls = [
            "https://raw.githubusercontent.com/StemStack/MyEarth/main/index.html",
            "https://raw.githubusercontent.com/StemStack/MyEarth/main/MyEarth/index.html",
        ]
        for url in raw_urls:
            r = requests.get(url, timeout=5)
            if r.status_code == 200 and "</html>" in r.text:
                return Response(
                    content=r.text,
                    media_type="text/html",
                    headers={"X-MyEarth-Index-Path": f"remote:{url}"},
                )
    except Exception:
        pass

    return JSONResponse({"error": "index.html not found"}, status_code=404)

@app.get("/api/debug-index")
def debug_index():
    """Debug helper to inspect which index.html candidates exist on the server."""
    data = []
    for p in _index_candidate_paths():
        data.append({
            "path": str(p.resolve()),
            "exists": p.exists(),
            "size": (p.stat().st_size if p.exists() else 0)
        })
    return {
        "base_dir": str(BASE_DIR.resolve()),
        "ui_dir": str(UI_DIR) if UI_DIR is not None else None,
        "preferred_frontend": str((BASE_DIR / "frontend" / "index.html").resolve()),
        "candidates": data,
    }

# Serve gizmo JavaScript files
@app.get("/CesiumModelImporter.js")
async def serve_model_importer():
    """Serve the CesiumModelImporter.js file"""
    return FileResponse(str(UI_DIR / "CesiumModelImporter.js"))

@app.get("/CesiumGizmo.js")
async def serve_gizmo():
    """Serve the CesiumGizmo.js file"""
    return FileResponse(str(UI_DIR / "CesiumGizmo.js"))

@app.get("/printService.js")
async def serve_print_service():
    """Serve the printService.js file"""
    return FileResponse(str(UI_DIR / "printService.js"))

@app.get("/printStyles.css")
async def serve_print_styles():
    """Serve the printStyles.css file"""
    return FileResponse(str(UI_DIR / "printStyles.css"))

@app.get("/PrintOverlay.js")
async def serve_print_overlay():
    """Serve the PrintOverlay.js file"""
    return FileResponse(str(UI_DIR / "PrintOverlay.js"))

@app.get("/printOverlayStyles.css")
async def serve_print_overlay_styles():
    """Serve the printOverlayStyles.css file"""
    return FileResponse(str(UI_DIR / "printOverlayStyles.css"))

@app.get("/version.json")
async def serve_version():
    """Serve version info with separate server start time and build time"""
    import datetime
 
    # SERVER START: when THIS Python process started (changes on server restart)
    # BUILD: when the app was built (static, from VERSION_FILE or fallback to server start)
    version_data = {
        "version": "0.6.5-dev",
        "serverStartTimestamp": SERVER_START_TS,
        "serverStartDate": datetime.datetime.utcfromtimestamp(SERVER_START_TS).isoformat() + "Z",
        "buildTimestamp": SERVER_START_TS,  # Fallback if no VERSION_FILE
        "buildDate": datetime.datetime.utcfromtimestamp(SERVER_START_TS).isoformat() + "Z",
        "commitHash": "dev",
        "environment": os.getenv("APP_ENV", "development")
    }
 
    # Try to read build timestamp from VERSION_FILE (production builds)
    try:
        if VERSION_FILE.exists():
            with open(str(VERSION_FILE), "r") as f:
                file_data = json.load(f) or {}
            # Use file data for build info (but keep serverStart* from current process)
            if "buildTimestamp" in file_data:
                version_data["buildTimestamp"] = file_data["buildTimestamp"]
            if "buildDate" in file_data:
                version_data["buildDate"] = file_data["buildDate"]
            if "version" in file_data:
                version_data["version"] = file_data["version"]
            if "commitHash" in file_data:
                version_data["commitHash"] = file_data["commitHash"]
    except Exception as e:
        print(f"Could not read version.json: {e}")
 
    return JSONResponse(
        content=version_data,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.get("/api/oauth-config")
async def get_oauth_config():
    """Serve OAuth configuration for frontend"""
    return {
        "google_client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "github_client_id": os.getenv("GITHUB_CLIENT_ID", ""),
        "linkedin_client_id": os.getenv("LINKEDIN_CLIENT_ID", ""),
        "oauth_enabled": bool(os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GITHUB_CLIENT_ID") or os.getenv("LINKEDIN_CLIENT_ID"))
    }

# --------------------
# ArcGIS Integration Endpoints
# --------------------

@app.get("/arcgis")
async def serve_arcgis_viewer():
    """Serve ArcGIS Scene Viewer page"""
    arcgis_html = UI_DIR / "arcgis.html"
    if not arcgis_html.exists():
        raise HTTPException(status_code=404, detail="ArcGIS viewer page not found")
    return FileResponse(str(arcgis_html))

@app.get("/api/arcgis/item/{item_id}")
async def get_arcgis_item(item_id: str):
    """Fetch ArcGIS Portal item metadata and data"""
    import logging
    logger = logging.getLogger("myearth.arcgis")
    
    base_url = "https://www.arcgis.com/sharing/rest"
    
    try:
        # Fetch item metadata
        metadata_url = f"{base_url}/content/items/{item_id}"
        metadata_params = {"f": "pjson"}
        metadata_response = requests.get(metadata_url, params=metadata_params, timeout=10)
        metadata_response.raise_for_status()
        metadata = metadata_response.json()
        
        # Fetch item data (WebScene JSON for Scene items)
        data_url = f"{base_url}/content/items/{item_id}/data"
        data_params = {"f": "pjson"}
        data_response = requests.get(data_url, params=data_params, timeout=10)
        
        data = None
        if data_response.status_code == 200:
            try:
                data = data_response.json()
            except Exception:
                data = {"error": "Data is not JSON"}
        
        logger.info(f"Fetched ArcGIS item {item_id}: {metadata.get('title', 'Unknown')}")
        
        return JSONResponse({
            "metadata": metadata,
            "data": data,
            "item_id": item_id
        })
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch ArcGIS item {item_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch item: {str(e)}")

# --------------------
# Sample Layers (Read-only test datasets)
# --------------------

@app.get("/api/sample-layers/earthquakes")
async def load_sample_earthquakes():
    """
    Load World Earthquakes 2000-2010 sample SLPK layer.
    
    Technical Note:
    - SLPK files cannot be loaded directly by Cesium from a URL
    - SLPK is a ZIP archive containing I3S data structure
    - Must be downloaded, extracted, and served via /i3s/ endpoint
    - This endpoint downloads once, caches locally, and returns I3S URL
    """
    import logging
    logger = logging.getLogger("myearth.sample_layers")
    
    sample_name = "sample_earthquakes"
    sample_dir = UPLOADS_DIR / sample_name
    slpk_url = "https://github.com/Esri/arcgis-python-api/raw/master/samples/05_content_publishers/data/World_earthquakes_2000_2010.slpk"
    
    # Check if already downloaded and extracted
    if sample_dir.exists() and (sample_dir / "3dSceneLayer.json").exists():
        logger.info(f"✅ Sample layer already exists: {sample_name}")
        return JSONResponse({
            "success": True,
            "url": f"/i3s/{sample_name}",
            "processing_type": "i3s",
            "title": "World Earthquakes 2000–2010",
            "cached": True,
            "message": "Sample layer ready (cached)"
        })
    
    # Download and extract SLPK
    temp_slpk = None  # Initialize to prevent NameError in exception handler
    try:
        logger.info(f"⬇️ Downloading sample SLPK: {slpk_url}")
        
        # Download to temp file
        temp_slpk = UPLOADS_DIR / f"{sample_name}_temp.slpk"
        
        with requests.get(slpk_url, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(temp_slpk, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192*1024):
                    if chunk:
                        f.write(chunk)
        
        logger.info(f"✅ Downloaded: {temp_slpk.stat().st_size} bytes")
        
        # Extract using existing handle_slpk logic
        # Rename sample_name to match expected pattern
        final_slpk = UPLOADS_DIR / f"{sample_name}.slpk"
        temp_slpk.rename(final_slpk)
        
        result = await handle_slpk(final_slpk, "World_earthquakes_2000_2010.slpk")

        # Do NOT delete final_slpk here.
        # handle_slpk() owns the lifecycle and may move/rename/delete the file.

        # Rename extracted directory to sample_name
        if result.get("processing_type") == "i3s":
            # Extract folder name from result URL
            original_url = result.get("url", "")
            if original_url.startswith("/i3s/"):
                original_folder = original_url.replace("/i3s/", "")
                original_path = UPLOADS_DIR / original_folder
                if original_path.exists() and original_path != sample_dir:
                    original_path.rename(sample_dir)
        
        logger.info(f"✅ Sample layer ready: {sample_name}")
        
        return JSONResponse({
            "success": True,
            "url": f"/i3s/{sample_name}",
            "processing_type": "i3s",
            "title": "World Earthquakes 2000–2010",
            "cached": False,
            "message": "Sample layer downloaded and ready"
        })
        
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Failed to download sample SLPK: {e}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Failed to process sample SLPK: {e}", exc_info=True)
        # Clean up on error
        for p in [temp_slpk, (UPLOADS_DIR / f"{sample_name}.slpk")]:
            try:
                if p and p.exists():
                    p.unlink()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

# --------------------
# I3S Shim Endpoint (for proper I3S REST API simulation)
# --------------------

@app.get("/i3s/{slpk_folder}/{path:path}")
@app.get("/i3s/{slpk_folder}")
async def serve_i3s(slpk_folder: str, path: str = "", request: Request = None):
    """
    I3S REST-style endpoint that maps Cesium's I3S requests to actual files.
    
    This is needed because FastAPI's StaticFiles doesn't handle I3S service roots properly.
    Cesium.I3SDataProvider expects REST-style URLs like:
    - /i3s/<folder>?f=json → service metadata (service.json or 3dSceneLayer.json)
    - /i3s/<folder>/layers/0 → layer metadata (layer.json or 3dSceneLayer.json)
    - /i3s/<folder>/layers/0/nodes/... → node data (binary or JSON)
    """
    import logging
    import mimetypes
    import gzip
    logger = logging.getLogger("myearth.i3s")
    
    # Log the request
    query_params = dict(request.query_params) if request else {}
    logger.info(f"📥 I3S Request: /i3s/{slpk_folder}/{path} (params: {query_params})")
    # Normalize path to avoid trailing-slash directory lookups from clients
    path = (path or "").lstrip("/").rstrip("/")
    
    extract_dir = UPLOADS_DIR / slpk_folder
    
    if not extract_dir.exists() or not extract_dir.is_dir():
        logger.error(f"❌ SLPK folder not found: {extract_dir}")
        raise HTTPException(status_code=404, detail=f"SLPK folder '{slpk_folder}' not found")
    
    attempted_paths = []
    resolved_file = None
    
    # ============================================================
    # Special case: Root metadata (service.json or 3dSceneLayer.json)
    # ============================================================
    if not path or path == "" or path == "/":
        logger.info("   → Root metadata request")
        candidates = [
            extract_dir / "service.json",
            extract_dir / "SceneServer" / "service.json",
            extract_dir / "SceneServer" / "3dSceneLayer.json",
            extract_dir / "3dSceneLayer.json"
        ]
        
        for candidate in candidates:
            attempted_paths.append(str(candidate))
            if candidate.exists():
                resolved_file = candidate
                logger.info(f"   ✅ Resolved to: {candidate.relative_to(UPLOADS_DIR)}")
                break
    
    # ============================================================
    # Special case: Layer metadata (layers/N or layers/N?f=json)
    # ============================================================
    elif path.startswith("layers/") and path.count("/") == 1:
        logger.info(f"   → Layer metadata request: {path}")
        layer_path = path.rstrip("/")
        
        candidates = [
            extract_dir / layer_path / "layer.json",
            extract_dir / layer_path / "3dSceneLayer.json",
            extract_dir / "SceneServer" / layer_path / "layer.json",
            extract_dir / "SceneServer" / layer_path / "3dSceneLayer.json"
        ]
        
        for candidate in candidates:
            attempted_paths.append(str(candidate))
            if candidate.exists():
                resolved_file = candidate
                logger.info(f"   ✅ Resolved to: {candidate.relative_to(UPLOADS_DIR)}")
                break
    
    # ============================================================
    # All other paths: direct file resolution
    # ============================================================
    else:
        logger.info(f"   → Direct file request: {path}")
        # Some extracted SLPKs place nodes/ at the root (e.g., nodes/root/...) while clients request layers/<id>/nodes/...
        # If the request is for nodes/features/resources under a layer, also try stripping the `layers/<id>/` prefix.
        alt_path = None
        if path.startswith("layers/"):
            parts = path.split("/")
            # layers/<layerId>/...
            if len(parts) >= 3 and parts[1].isdigit():
                alt_path = "/".join(parts[2:])

        candidates = []

        # Direct path
        candidates.append(extract_dir / path)
        logger.info(f"   ↪ alt_path: {alt_path}")
        candidates.append(extract_dir / "SceneServer" / path)

        # Alternate mapping for root-level nodes/
        if alt_path:
            candidates.append(extract_dir / alt_path)
            candidates.append(extract_dir / "SceneServer" / alt_path)

        # Common JSON fallbacks (Cesium sometimes requests node paths without .json)
        candidates.append(extract_dir / f"{path}.json")
        candidates.append(extract_dir / "SceneServer" / f"{path}.json")
        if alt_path:
            candidates.append(extract_dir / f"{alt_path}.json")
            candidates.append(extract_dir / "SceneServer" / f"{alt_path}.json")

        # If the request points to a directory, try common entry docs
        candidates.append(extract_dir / path / "index.json")
        candidates.append(extract_dir / "SceneServer" / path / "index.json")
        candidates.append(extract_dir / path / "3dNodeIndexDocument.json")
        candidates.append(extract_dir / "SceneServer" / path / "3dNodeIndexDocument.json")
        if alt_path:
            candidates.append(extract_dir / alt_path / "index.json")
            candidates.append(extract_dir / "SceneServer" / alt_path / "index.json")
            candidates.append(extract_dir / alt_path / "3dNodeIndexDocument.json")
            candidates.append(extract_dir / "SceneServer" / alt_path / "3dNodeIndexDocument.json")

        for candidate in candidates:
            attempted_paths.append(str(candidate))
            if candidate.exists() and candidate.is_file():
                resolved_file = candidate
                logger.info(f"   ✅ Resolved to: {candidate.relative_to(UPLOADS_DIR)}")
                break
            if candidate.exists() and candidate.is_dir():
                # Some I3S node directories use 3dNodeIndexDocument.json instead of index.json
                for entry_name in ["index.json", "3dNodeIndexDocument.json"]:
                    entry = candidate / entry_name
                    attempted_paths.append(str(entry))
                    if entry.exists() and entry.is_file():
                        resolved_file = entry
                        logger.info(f"   ✅ Resolved to: {entry.relative_to(UPLOADS_DIR)}")
                        break
                if resolved_file:
                    break
    
    # ============================================================
    # Handle gzipped files (*.json.gz → decompress)
    # ============================================================
    if not resolved_file:
        for attempted in attempted_paths[:]:  # Check attempted paths for .gz versions
            gz_path = Path(attempted + ".gz")
            if gz_path.exists():
                logger.info(f"   ℹ️  Found gzipped version: {gz_path.relative_to(UPLOADS_DIR)}")
                resolved_file = gz_path
                break
    
    # ============================================================
    # File not found: return helpful 404 with attempted paths
    # ============================================================
    if not resolved_file:
        logger.error(f"   ❌ File not found. Attempted paths:")
        for p in attempted_paths:
            logger.error(f"      • {p}")
        
        return JSONResponse(
            status_code=404,
            content={
                "error": "File not found",
                "requested": f"/i3s/{slpk_folder}/{path}",
                "attempted_paths": [str(Path(p).relative_to(UPLOADS_DIR)) for p in attempted_paths]
            }
        )
    
    # ============================================================
    # Serve the file
    # ============================================================
    try:
        # Handle gzipped files
        if resolved_file.suffix == ".gz":
            logger.info(f"   📦 Decompressing gzipped file")
            with gzip.open(resolved_file, 'rb') as f:
                content = f.read()
            
            # Guess content type from original filename (without .gz)
            original_name = resolved_file.stem
            content_type, _ = mimetypes.guess_type(original_name)
            if not content_type:
                content_type = "application/json" if original_name.endswith(".json") else "application/octet-stream"
            
            logger.info(f"   ✅ 200 OK ({len(content)} bytes, {content_type})")
            return Response(content=content, media_type=content_type)
        
        # Regular file serving
        content_type, _ = mimetypes.guess_type(str(resolved_file))
        if not content_type:
            # Default to JSON for common I3S files, binary otherwise
            if resolved_file.suffix in [".json", ".json.gz"]:
                content_type = "application/json"
            else:
                content_type = "application/octet-stream"
        
        logger.info(f"   ✅ 200 OK ({resolved_file.stat().st_size} bytes, {content_type})")
        return FileResponse(str(resolved_file), media_type=content_type)
    
    except Exception as e:
        logger.error(f"   ❌ Error serving file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error serving file: {str(e)}")

# --------------------
# Health check endpoint
# --------------------
@app.get("/api/ping")
def ping():
    """Quick test endpoint"""
    return {"message": "pong"}

# --------------------
# Test DB connection endpoint
# --------------------
@app.get("/api/test-db")
def test_db():
    """Check if DB connection works"""
    try:
        conn = get_db_connection()
        if conn is None:
            return {"error": "Database connection failed"}
        cur = conn.cursor()
        cur.execute("SELECT NOW()")
        result = cur.fetchone()
        cur.close()
        conn.close()
        return {"db_time": result[0]}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/test-wms")
async def test_wms():
    """Test WMS service availability"""
    import requests
    
    wms_services = {
        "land_degradation": {
            "url": "https://datacore.unepgrid.ch/geoserver/MapX_UNDP/ows",
            "name": "Global Land Degradation"
        }
    }
    
    results = {}
    
    for service_key, service in wms_services.items():
        try:
            test_url = f"{service['url']}?service=WMS&version=1.3.0&request=GetCapabilities"
            response = requests.get(test_url, timeout=10, headers={
                'User-Agent': 'MyEarth/1.0'
            })
            
            if response.status_code == 200:
                # Basic XML validation
                if '<WMS_Capabilities' in response.text or '<wms:WMS_Capabilities' in response.text:
                    results[service_key] = {
                        "status": "available",
                        "name": service['name'],
                        "response_time": response.elapsed.total_seconds()
                    }
                else:
                    results[service_key] = {
                        "status": "invalid_response",
                        "name": service['name'],
                        "error": "Invalid WMS capabilities response"
                    }
            else:
                results[service_key] = {
                    "status": "error",
                    "name": service['name'],
                    "error": f"HTTP {response.status_code}: {response.reason}"
                }
                
        except requests.exceptions.Timeout:
            results[service_key] = {
                "status": "timeout",
                "name": service['name'],
                "error": "Request timeout"
            }
        except requests.exceptions.ConnectionError:
            results[service_key] = {
                "status": "connection_error",
                "name": service['name'],
                "error": "Connection failed"
            }
        except Exception as e:
            results[service_key] = {
                "status": "error",
                "name": service['name'],
                "error": str(e)
            }
    
    return {"wms_services": results}

# --------------------
# 3D Model Upload endpoint
# --------------------
# Create uploads directory if it doesn't exist
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

# Serve uploads as static so extracted folders (e.g., SLPK -> I3S) are reachable
# NOTE: This must exist before requests hit /uploads/... URLs.
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Universal 3D model format support
UNIVERSAL_3D_FORMATS = {
    # Cesium 3D Tiles
    '.json': 'application/json',  # 3D Tileset
    '.cmpt': 'application/octet-stream',  # Composite tiles
    '.b3dm': 'application/octet-stream',  # Batched 3D model tiles
    '.i3dm': 'application/octet-stream',  # Instanced 3D model tiles
    '.pnts': 'application/octet-stream',  # Point cloud tiles
    
    # glTF formats
    '.gltf': 'model/gltf+json',
    '.glb': 'model/gltf-binary',
    
    # Traditional 3D formats
    '.obj': 'model/obj',
    '.fbx': 'model/fbx',
    '.dae': 'model/collada+xml',
    '.3ds': 'model/3ds',
    '.blend': 'model/blend',
    '.stl': 'model/stl',
    '.ply': 'model/ply',
    '.max': 'model/3dsmax',
    '.ma': 'model/maya-ascii',
    '.mb': 'model/maya-binary',
    
    # Point cloud formats
    '.las': 'application/octet-stream',
    '.laz': 'application/octet-stream',
    
    # Gaussian Splatting formats
    '.splat': 'application/octet-stream',
    
    # Geospatial formats
    '.kml': 'application/vnd.google-earth.kml+xml',
    '.kmz': 'application/vnd.google-earth.kmz',
    '.citygml': 'application/gml+xml',
    '.gml': 'application/gml+xml',
    '.slpk': 'application/octet-stream',  # ArcGIS Scene Layer Package (I3S in a zip)
    
    # Archive formats
    '.zip': 'application/zip',
    '.7z': 'application/x-7z-compressed',
    '.rar': 'application/x-rar-compressed',
    
    # Image formats for photogrammetry
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    
    # BIM formats
    '.ifc': 'application/ifc',
    '.rvt': 'application/revit',
    '.dwg': 'application/dwg',
}

# Cesium ion configuration (you'll need to set these as environment variables)
CESIUM_ION_ACCESS_TOKEN = os.getenv("CESIUM_ION_ACCESS_TOKEN", "")
CESIUM_ION_API_URL = "https://api.cesium.com/v1"

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get status of a background processing job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    return JSONResponse({
        "job_id": job["job_id"],
        "filename": job["filename"],
        "status": job["status"],
        "stage": job["stage"],
        "progress": job["progress"],
        "message": job.get("message"),
        "error": job.get("error"),
        "result": job.get("result")
    })

async def process_model_background(job_id: str, file_path: Path, file_ext: str, original_filename: str):
    """Background task to process 3D model"""
    import logging
    logger = logging.getLogger("myearth.assets")
    
    try:
        update_job(job_id, status=JobStatus.PROCESSING, progress=0, message="Starting processing...")
        
        # Process the model
        processing_result = await process_3d_model(file_path, file_ext, original_filename, job_id)
        
        # Check if processing failed (e.g., SLPK with no I3S entrypoint)
        if processing_result.get("processing_type") == "slpk_extracted_unrecognized":
            # Mark as error so UI doesn't get stuck
            update_job(
                job_id,
                status=JobStatus.ERROR,
                stage=JobStage.DONE,
                progress=100,
                error=processing_result.get("message", "SLPK extraction failed"),
                message="SLPK extracted but no I3S entrypoint found",
                result={
                    "success": False,
                    "filename": processing_result["filename"],
                    "url": processing_result["url"],
                    "size": processing_result["size"],
                    "original_format": file_ext,
                    "processing_type": processing_result["processing_type"],
                    "message": processing_result["message"]
                }
            )
            logger.error(f"Job {job_id} failed: {processing_result.get('message')}")
            return
        
        # Mark job as complete
        update_job(
            job_id,
            status=JobStatus.DONE,
            stage=JobStage.DONE,
            progress=100,
            message="Processing complete",
            result={
                "success": True,
                "filename": processing_result["filename"],
                "url": processing_result["url"],
                "size": processing_result["size"],
                "original_format": file_ext,
                "processing_type": processing_result["processing_type"],
                "cesium_ion_asset_id": processing_result.get("cesium_ion_asset_id"),
                "message": processing_result["message"]
            }
        )
        
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {str(e)}", exc_info=True)
        update_job(
            job_id,
            status=JobStatus.ERROR,
            progress=0,
            error=str(e),
            message=f"Processing failed: {str(e)}"
        )
        
        # Clean up on error
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass

@app.post("/api/upload-model")
async def upload_model(file: UploadFile = File(...)):
    """Universal 3D model upload with Cesium ion integration and multi-format support"""
    import logging
    logger = logging.getLogger("myearth.assets")
    
    # Get file extension
    file_ext = Path(file.filename).suffix.lower()
    
    logger.info(f"Upload request: {file.filename} | Extension: {file_ext} | Size: {file.size or 'unknown'} bytes")
    
    # Check if format is supported
    if file_ext not in UNIVERSAL_3D_FORMATS:
        logger.error(f"Unsupported format: {file_ext}")
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported format: {file_ext}. Supported formats: {', '.join(list(UNIVERSAL_3D_FORMATS.keys())[:10])}... and more"
        )
    
    # Define max size (5GB)
    MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB in bytes
    CHUNK_SIZE = 8 * 1024 * 1024  # 8MB chunks for streaming
    
    # Pre-check file size if available (optimization)
    if file.size and file.size > MAX_FILE_SIZE:
        logger.error(f"File too large: {file.size} bytes")
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5GB")
    
    original_path = None
    try:
        # Save original file with streaming + size validation
        original_filename = f"original_{int(time.time())}_{file.filename}"
        original_path = UPLOADS_DIR / original_filename
        
        logger.info(f"Saving to: {original_path} (streaming in {CHUNK_SIZE // (1024*1024)}MB chunks)")
        
        bytes_written = 0
        with open(original_path, "wb") as buffer:
            while True:
                # Read chunk
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                
                # Check size limit before writing
                bytes_written += len(chunk)
                if bytes_written > MAX_FILE_SIZE:
                    logger.error(f"File exceeded size limit during upload: {bytes_written} bytes")
                    # Delete partial file
                    if original_path.exists():
                        original_path.unlink()
                    raise HTTPException(status_code=400, detail="File too large. Maximum size: 5GB")
                
                # Write chunk to disk
                buffer.write(chunk)
        
        logger.info(f"File saved successfully: {bytes_written} bytes ({bytes_written / (1024*1024):.1f}MB)")
        
        # Create job for background processing
        job_id = create_job(file.filename)
        logger.info(f"Created job {job_id} for {file.filename}")
        
        # Start background processing
        asyncio.create_task(process_model_background(job_id, original_path, file_ext, file.filename))
        
        # Return job_id immediately (202 Accepted)
        return JSONResponse({
            "job_id": job_id,
            "status": "processing",
            "message": "Upload complete, processing started"
        }, status_code=202)
        
    except HTTPException:
        # Re-raise HTTP exceptions (already logged)
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}", exc_info=True)
        # Clean up on error
        if original_path and original_path.exists():
            original_path.unlink()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

async def process_3d_model(file_path: Path, file_ext: str, original_filename: str, job_id: str = None) -> dict:
    """Process 3D model based on format type"""
    
    # Strategy 1: Cesium 3D Tiles (direct support)
    if file_ext in ['.json', '.cmpt', '.b3dm', '.i3dm', '.pnts']:
        return await handle_3d_tiles(file_path, original_filename)
    
    # Strategy 2: glTF formats (direct CesiumJS support)
    elif file_ext in ['.gltf', '.glb']:
        return await handle_gltf(file_path, original_filename)
    
    # Strategy 3: Point clouds (LAS/LAZ/PLY)
    # CRITICAL: Cesium does NOT support raw point cloud formats (PLY/LAS/LAZ).
    # Point clouds MUST be converted to 3D Tiles (tileset.json + .pnts binary tiles).
    # Raw PLY/LAS/LAZ files will NOT render in CesiumJS.
    elif file_ext in ['.las', '.laz', '.ply']:
        if job_id:
            update_job(job_id, stage=JobStage.CONVERTING_POINTCLOUD, progress=20, message="Converting point cloud to 3D Tiles...")
        return await handle_point_cloud(file_path, original_filename, job_id)
    
    # Strategy 4: Gaussian Splatting
    # NOTE: .splat is a dedicated Gaussian splat format (not point cloud or mesh)
    elif file_ext in ['.splat']:
        return await handle_gaussian_splats(file_path, original_filename)

    # Strategy 5: Traditional 3D mesh formats (convert to glTF)
    # These are polygon meshes, not point clouds
    elif file_ext in ['.obj', '.fbx', '.dae', '.3ds', '.stl']:
        return await handle_traditional_3d(file_path, original_filename)
    
    # Strategy 6: Geospatial formats
    elif file_ext in ['.kml', '.kmz', '.citygml', '.gml']:
        return await handle_geospatial(file_path, original_filename)
    
    # Strategy 7: ArcGIS Scene Layer Package (SLPK -> I3S)
    elif file_ext in ['.slpk']:
        if job_id:
            update_job(job_id, stage=JobStage.EXTRACTING_SLPK, progress=20, message="Extracting SLPK to I3S format...")
        return await handle_slpk(file_path, original_filename, job_id)

    # Strategy 8: Archive formats
    elif file_ext in ['.zip', '.7z', '.rar']:
        return await handle_archive(file_path, original_filename)
    
    # Strategy 9: Image formats (photogrammetry)
    elif file_ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif']:
        return await handle_photogrammetry(file_path, original_filename)
    
    # Strategy 10: BIM formats
    elif file_ext in ['.ifc', '.rvt', '.dwg']:
        return await handle_bim(file_path, original_filename)
    
    # Fallback: Try Cesium ion conversion
    else:
        return await handle_cesium_ion_conversion(file_path, original_filename)

async def handle_3d_tiles(file_path: Path, original_filename: str) -> dict:
    """Handle Cesium 3D Tiles formats"""
    filename = f"3dtiles_{int(time.time())}_{original_filename}"
    new_path = UPLOADS_DIR / filename
    shutil.move(str(file_path), str(new_path))
    
    return {
        "filename": filename,
        "url": f"/uploads/{filename}",
        "size": new_path.stat().st_size,
        "processing_type": "3d_tiles",
        "message": "3D Tiles file ready for CesiumJS"
    }

async def handle_gltf(file_path: Path, original_filename: str) -> dict:
    """Handle glTF formats"""
    import logging
    logger = logging.getLogger("myearth.assets")
    
    filename = f"gltf_{int(time.time())}_{original_filename}"
    new_path = UPLOADS_DIR / filename
    shutil.move(str(file_path), str(new_path))
    
    file_size = new_path.stat().st_size
    asset_url = f"/uploads/{filename}"
    
    logger.info(f"GLB/glTF ready: {filename} | Size: {file_size} bytes | URL: {asset_url}")
    
    return {
        "filename": filename,
        "url": asset_url,
        "size": file_size,
        "processing_type": "gltf",
        "message": "glTF file ready for CesiumJS"
    }

async def handle_point_cloud(file_path: Path, original_filename: str, job_id: str = None) -> dict:
    """
    Handle point cloud formats (LAS/LAZ/PLY).
    
    CRITICAL: CesiumJS does NOT support raw point cloud files.
    Point clouds MUST be converted to 3D Tiles format (tileset.json + .pnts binary tiles).
    
    This handler attempts conversion using py3dtiles or similar tools.
    If conversion fails, we return HTTP 400 with explicit error.
    """
    import logging
    logger = logging.getLogger("myearth.assets")
    
    file_ext = file_path.suffix.lower()
    logger.info(f"Point cloud upload: {original_filename} | Format: {file_ext}")
    
    try:
        # Try to convert to 3D Tiles
        if job_id:
            update_job(job_id, progress=30, message="Starting point cloud conversion...")
        conversion_result = await convert_point_cloud_to_3dtiles(file_path, original_filename, job_id)
        
        if conversion_result and conversion_result.get("success"):
            logger.info(f"Point cloud converted successfully: {conversion_result['tileset_url']}")
            return {
                "filename": conversion_result["tileset_name"],
                "url": conversion_result["tileset_url"],
                "size": conversion_result["size"],
                "processing_type": "point_cloud_3dtiles",
                "message": f"Point cloud converted to 3D Tiles ({conversion_result.get('tile_count', '?')} tiles)"
            }
        else:
            # Conversion failed - this is NOT acceptable for Cesium
            error_detail = conversion_result.get("error") if conversion_result else "Conversion tool not available"
            logger.error(f"Point cloud conversion failed: {error_detail}")
            
            # Clean up original file
            try:
                file_path.unlink()
            except Exception:
                pass
            
            # Return explicit error
            raise HTTPException(
                status_code=400,
                detail=f"Point clouds must be converted to 3D Tiles to render in Cesium. "
                       f"Conversion failed: {error_detail}. "
                       f"Please upload LAS/LAZ with py3dtiles installed, or upload pre-generated tileset.json."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Point cloud processing error: {e}", exc_info=True)
        
        # Clean up
        try:
            file_path.unlink()
        except Exception:
            pass
        
        raise HTTPException(
            status_code=400,
            detail=f"Point cloud processing failed: {str(e)}. "
                   f"Cesium requires point clouds as 3D Tiles (tileset.json). "
                   f"Please upload LAS/LAZ with conversion tools installed, or upload pre-generated tileset.json."
        )
        filename = f"pointcloud_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "point_cloud_fallback",
            "message": "Point cloud file (processing failed)"
        }

async def handle_gaussian_splats(file_path: Path, original_filename: str) -> dict:
    """Handle Gaussian Splatting formats"""
    try:
        # Try to convert to 3D Tiles with splat support
        if await convert_splats_to_3dtiles(file_path):
            filename = f"splats_{int(time.time())}_{Path(original_filename).stem}.json"
            tileset_path = UPLOADS_DIR / filename
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": tileset_path.stat().st_size,
                "processing_type": "gaussian_splats_3dtiles",
                "message": "Gaussian splats converted to 3D Tiles"
            }
        else:
            # Fallback: serve original file
            filename = f"splats_{int(time.time())}_{original_filename}"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(file_path), str(new_path))
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "gaussian_splats_raw",
                "message": "Gaussian splats file (may need client-side processing)"
            }
    except Exception as e:
        print(f"Gaussian splats processing error: {e}")
        # Fallback to original file
        filename = f"splats_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "gaussian_splats_fallback",
            "message": "Gaussian splats file (processing failed)"
        }

async def handle_traditional_3d(file_path: Path, original_filename: str) -> dict:
    """Handle traditional 3D formats by converting to glTF"""
    try:
        # Try conversion to glTF
        gltf_path = await convert_to_gltf(file_path)
        if gltf_path and gltf_path.exists():
            filename = f"converted_{int(time.time())}_{Path(original_filename).stem}.glb"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(gltf_path), str(new_path))
            
            # Clean up original
            file_path.unlink()
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "converted_gltf",
                "message": f"Converted {Path(original_filename).suffix} to GLB"
            }
        else:
            # Fallback: serve original file
            filename = f"traditional_{int(time.time())}_{original_filename}"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(file_path), str(new_path))
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "traditional_fallback",
                "message": f"Original {Path(original_filename).suffix} file (conversion failed)"
            }
    except Exception as e:
        print(f"Traditional 3D conversion error: {e}")
        # Fallback to original file
        filename = f"traditional_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "traditional_error",
            "message": f"Original {Path(original_filename).suffix} file (conversion failed)"
        }

async def handle_geospatial(file_path: Path, original_filename: str) -> dict:
    """Handle geospatial formats (KML/KMZ/CityGML/GML)"""
    # For now, serve as-is (may need conversion in future)
    filename = f"geospatial_{int(time.time())}_{original_filename}"
    new_path = UPLOADS_DIR / filename
    shutil.move(str(file_path), str(new_path))
    
    return {
        "filename": filename,
        "url": f"/uploads/{filename}",
        "size": new_path.stat().st_size,
        "processing_type": "geospatial_raw",
        "message": "Geospatial file (may need client-side processing)"
    }

async def handle_slpk(file_path: Path, original_filename: str, job_id: str = None) -> dict:
    """Handle ArcGIS Scene Layer Package (.slpk).

    SLPK is essentially a ZIP containing an I3S SceneServer structure.
    CesiumJS can load I3S via `Cesium.I3SDataProvider.fromUrl(...)`.

    This handler extracts the SLPK into a folder under uploads and returns a URL
    pointing to the I3S layer root.
    """
    import logging
    logger = logging.getLogger("myearth.assets")

    extract_dir = UPLOADS_DIR / f"slpk_{int(time.time())}_{Path(original_filename).stem}"
    extract_dir.mkdir(exist_ok=True)

    try:
        # SLPK is a zip container
        if job_id:
            update_job(job_id, progress=30, message="Extracting SLPK archive...")
        
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Decompress all *.json.gz files to *.json (common in I3S packages)
        import gzip
        for gz_file in extract_dir.rglob("*.json.gz"):
            json_file = gz_file.with_suffix('')  # Remove .gz extension
            try:
                with gzip.open(gz_file, 'rb') as f_in:
                    with open(json_file, 'wb') as f_out:
                        f_out.write(f_in.read())
                gz_file.unlink()  # Remove .gz file after decompression
                logger.info(f"   Decompressed: {gz_file.relative_to(extract_dir)} → {json_file.name}")
            except Exception as e:
                logger.warning(f"   Failed to decompress {gz_file.name}: {e}")
        
        if job_id:
            update_job(job_id, progress=60, message="Locating I3S layer entry point...")

        # Remove original package to save space
        try:
            file_path.unlink()
        except Exception:
            pass

        # ============================================================
        # DEEP INSPECTION: Log extracted structure comprehensively
        # ============================================================
        logger.info(f"📂 Extracted SLPK to: {extract_dir.name}")
        
        # Gather all directories and files (deep scan)
        all_dirs = sorted([str(p.relative_to(extract_dir)) for p in extract_dir.rglob("*") if p.is_dir()])
        all_files = sorted([str(p.relative_to(extract_dir)) for p in extract_dir.rglob("*") if p.is_file()])
        json_files = sorted([str(p.relative_to(extract_dir)) for p in extract_dir.rglob("*.json")])
        
        logger.info(f"📊 SLPK Statistics:")
        logger.info(f"   • Total directories: {len(all_dirs)}")
        logger.info(f"   • Total files: {len(all_files)}")
        logger.info(f"   • JSON files: {len(json_files)}")
        
        # Show first 50 directories
        logger.info(f"📁 First {min(50, len(all_dirs))} directories:")
        for d in all_dirs[:50]:
            logger.info(f"   • {d}/")
        
        # Show first 50 files
        logger.info(f"📄 First {min(50, len(all_files))} files:")
        for f in all_files[:50]:
            logger.info(f"   • {f}")
        
        # Show ALL JSON files (critical for I3S detection)
        logger.info(f"📋 All {len(json_files)} JSON files:")
        for json_file in json_files:
            logger.info(f"   • {json_file}")
        
        # Search for I3S-specific files
        service_json_files = list(extract_dir.glob("**/service.json"))
        layers_folders = [p for p in extract_dir.rglob("*") if p.is_dir() and p.name == "layers"]
        scene_layer_files = list(extract_dir.glob("**/3dSceneLayer.json"))
        layer_json_files = list(extract_dir.glob("**/layer.json"))
        
        logger.info(f"🔍 I3S-specific candidates:")
        logger.info(f"   • service.json files: {len(service_json_files)}")
        for f in service_json_files:
            logger.info(f"      - {f.relative_to(extract_dir)}")
        logger.info(f"   • layers/ folders: {len(layers_folders)}")
        for d in layers_folders:
            logger.info(f"      - {d.relative_to(extract_dir)}/")
        logger.info(f"   • 3dSceneLayer.json files: {len(scene_layer_files)}")
        for f in scene_layer_files:
            logger.info(f"      - {f.relative_to(extract_dir)}")
        logger.info(f"   • layer.json files: {len(layer_json_files)}")
        for f in layer_json_files:
            logger.info(f"      - {f.relative_to(extract_dir)}")

        # ============================================================
        # ROBUST I3S DETECTION: Multiple strategies
        # ============================================================
        i3s_url = None
        detection_strategy = None
        
        # Strategy 0: Root-level 3dSceneLayer.json (direct I3S layer at root)
        if (extract_dir / "3dSceneLayer.json").exists():
            i3s_url = f"/i3s/{extract_dir.name}"
            detection_strategy = "root-level 3dSceneLayer.json"
            logger.info(f"✅ Strategy 0: Found 3dSceneLayer.json at root: {i3s_url}")
        
        # Strategy 1: SceneServer root (most common for SLPK)
        if not i3s_url:
            scene_server_dir = extract_dir / "SceneServer"
            if not scene_server_dir.exists():
                # Case-insensitive search
                candidates = list(extract_dir.glob("**/SceneServer"))
                if candidates:
                    scene_server_dir = candidates[0]
            
            if scene_server_dir and scene_server_dir.exists():
                i3s_url = f"/i3s/{extract_dir.name}"
                detection_strategy = "SceneServer root"
                logger.info(f"✅ Strategy 1: Found SceneServer root: {i3s_url}")
        
        # Strategy 2: Folder with service.json + layers/ subfolder
        if not i3s_url:
            for service_file in service_json_files:
                parent = service_file.parent
                if (parent / "layers").exists():
                    i3s_url = f"/i3s/{extract_dir.name}"
                    detection_strategy = "service.json + layers/"
                    logger.info(f"✅ Strategy 2: Found service root with service.json + layers/: {i3s_url}")
                    break
        
        # Strategy 3: Folder containing layers/0/ with scene layer metadata
        if not i3s_url:
            for layers_folder in layers_folders:
                layer_0 = layers_folder / "0"
                if layer_0.exists() and layer_0.is_dir():
                    # Check if this layer has metadata
                    if (layer_0 / "3dSceneLayer.json").exists() or (layer_0 / "layer.json").exists():
                        # Return the service root (handled by I3S shim endpoint)
                        i3s_url = f"/i3s/{extract_dir.name}"
                        detection_strategy = "layers/0/ folder"
                        logger.info(f"✅ Strategy 3: Found service root via layers/0/: {i3s_url}")
                        break
        
        # Strategy 4: Direct layer folder (folder containing 3dSceneLayer.json)
        if not i3s_url and scene_layer_files:
            # Return the service root (I3S shim will resolve to the file)
            i3s_url = f"/i3s/{extract_dir.name}"
            detection_strategy = "direct layer file (3dSceneLayer.json)"
            logger.info(f"✅ Strategy 4: Found 3dSceneLayer.json file: {i3s_url}")
        
        # Strategy 5: Direct layer folder (folder containing layer.json)
        if not i3s_url and layer_json_files:
            # Return the service root (I3S shim will resolve to the file)
            i3s_url = f"/i3s/{extract_dir.name}"
            detection_strategy = "direct layer file (layer.json)"
            logger.info(f"✅ Strategy 5: Found layer.json file: {i3s_url}")

        # ============================================================
        # NO I3S ENTRY POINT FOUND: Return detailed diagnostic
        # ============================================================
        if not i3s_url:
            if job_id:
                update_job(job_id, progress=50, message="No I3S entrypoint found")
            
            logger.error(f"❌ SLPK extracted but no I3S entry point found in {extract_dir.name}")
            logger.error(f"   Extraction path: {extract_dir}")
            logger.error(f"   • Directories: {len(all_dirs)}")
            logger.error(f"   • Files: {len(all_files)}")
            logger.error(f"   • JSON files: {len(json_files)}")
            logger.error(f"   • service.json: {len(service_json_files)}")
            logger.error(f"   • layers/ folders: {len(layers_folders)}")
            logger.error(f"   • 3dSceneLayer.json: {len(scene_layer_files)}")
            logger.error(f"   • layer.json: {len(layer_json_files)}")
            
            # Get top-level folder names
            top_level = sorted([p.name for p in extract_dir.iterdir()])
            logger.error(f"   • Top-level items: {', '.join(top_level)}")
            
            # Build detailed error message
            error_parts = [
                f"SLPK extracted but no I3S entry point found.",
                f"Statistics: {len(all_dirs)} dirs, {len(all_files)} files, {len(json_files)} JSONs.",
                f"Top-level: {', '.join(top_level)}.",
            ]
            
            if json_files:
                json_list = ", ".join(json_files[:30])
                error_parts.append(f"JSON files: {json_list}.")
            
            if not layers_folders:
                error_parts.append("No 'layers/' folders found (expected for valid I3S).")
            
            if not service_json_files and not scene_layer_files and not layer_json_files:
                error_parts.append("No I3S metadata files found (service.json, 3dSceneLayer.json, layer.json).")
            
            error_message = " ".join(error_parts)
            
            return {
                "filename": original_filename,
                "url": f"/i3s/{extract_dir.name}",
                "size": sum(p.stat().st_size for p in extract_dir.rglob('*') if p.is_file()),
                "processing_type": "slpk_extracted_unrecognized",
                "message": error_message
            }

        total_size = sum(p.stat().st_size for p in extract_dir.rglob('*') if p.is_file())
        logger.info(f"✅ SLPK extracted successfully: {extract_dir.name}")
        logger.info(f"   • Detection strategy: {detection_strategy}")
        logger.info(f"   • I3S URL: {i3s_url}")
        logger.info(f"   • Total size: {total_size} bytes")
        logger.info(f"   • Directories: {len(all_dirs)}, Files: {len(all_files)}, JSONs: {len(json_files)}")
        
        if job_id:
            update_job(job_id, progress=90, message="I3S layer ready")

        # Final log: show exactly what URL we're returning
        logger.info(f"🎯 FINAL I3S URL: {i3s_url}")
        logger.info(f"🎯 Detection strategy used: {detection_strategy}")

        return {
            "filename": original_filename,
            "url": i3s_url,
            "size": total_size,
            "processing_type": "i3s",
            "message": "SLPK extracted as I3S (load with Cesium.I3SDataProvider)"
        }

    except Exception as e:
        logger.error(f"SLPK processing error: {e}", exc_info=True)
        # Clean up
        try:
            if extract_dir.exists():
                shutil.rmtree(extract_dir)
        except Exception:
            pass
        # Fallback: serve original file
        filename = f"slpk_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))

        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "slpk_raw",
            "message": "SLPK could not be extracted; serving raw file"
        }
    """Handle geospatial formats"""
    try:
        # Try to convert to 3D Tiles
        if await convert_geospatial_to_3dtiles(file_path):
            filename = f"geospatial_{int(time.time())}_{Path(original_filename).stem}.json"
            tileset_path = UPLOADS_DIR / filename
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": tileset_path.stat().st_size,
                "processing_type": "geospatial_3dtiles",
                "message": "Geospatial data converted to 3D Tiles"
            }
        else:
            # Fallback: serve original file
            filename = f"geospatial_{int(time.time())}_{original_filename}"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(file_path), str(new_path))
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "geospatial_raw",
                "message": "Geospatial file (may need client-side processing)"
            }
    except Exception as e:
        print(f"Geospatial processing error: {e}")
        # Fallback to original file
        filename = f"geospatial_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "geospatial_fallback",
            "message": "Geospatial file (processing failed)"
        }

async def handle_archive(file_path: Path, original_filename: str) -> dict:
    """Handle archive formats by extracting and processing contents"""
    try:
        # Extract archive
        extract_dir = UPLOADS_DIR / f"extracted_{int(time.time())}_{Path(original_filename).stem}"
        extract_dir.mkdir(exist_ok=True)
        
        if file_path.suffix.lower() == '.zip':
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
        
        # Find main files in extracted directory
        main_files = []
        for ext in ['.gltf', '.glb', '.obj', '.fbx', '.dae', '.json', '.cmpt', '.b3dm']:
            main_files.extend(extract_dir.glob(f"**/*{ext}"))
        
        if main_files:
            # Use the first main file found
            main_file = main_files[0]
            filename = f"archive_{int(time.time())}_{main_file.name}"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(main_file), str(new_path))
            
            # Clean up
            shutil.rmtree(extract_dir)
            file_path.unlink()
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "archive_extracted",
                "message": f"Extracted {main_file.name} from archive"
            }
        else:
            # No main files found, serve as-is
            filename = f"archive_{int(time.time())}_{original_filename}"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(file_path), str(new_path))
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "archive_raw",
                "message": "Archive file (no supported formats found inside)"
            }
    except Exception as e:
        print(f"Archive processing error: {e}")
        # Fallback to original file
        filename = f"archive_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "archive_error",
            "message": "Archive file (extraction failed)"
        }

async def handle_photogrammetry(file_path: Path, original_filename: str) -> dict:
    """Handle image formats for photogrammetry"""
    try:
        # For now, serve as-is (would need photogrammetry processing)
        filename = f"photogrammetry_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "photogrammetry_raw",
            "message": "Image file (photogrammetry processing not yet implemented)"
        }
    except Exception as e:
        print(f"Photogrammetry processing error: {e}")
        # Fallback to original file
        filename = f"photogrammetry_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "photogrammetry_error",
            "message": "Image file (processing failed)"
        }

async def handle_bim(file_path: Path, original_filename: str) -> dict:
    """Handle BIM formats"""
    try:
        # Try to convert to glTF using IFC.js or similar
        if await convert_bim_to_gltf(file_path):
            filename = f"bim_{int(time.time())}_{Path(original_filename).stem}.glb"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(file_path), str(new_path))
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "bim_converted",
                "message": f"BIM file converted to GLB"
            }
        else:
            # Fallback: serve original file
            filename = f"bim_{int(time.time())}_{original_filename}"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(file_path), str(new_path))
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "bim_raw",
                "message": f"BIM file (conversion not available)"
            }
    except Exception as e:
        print(f"BIM processing error: {e}")
        # Fallback to original file
        filename = f"bim_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "bim_error",
            "message": f"BIM file (processing failed)"
        }

async def handle_cesium_ion_conversion(file_path: Path, original_filename: str) -> dict:
    """Handle unknown formats by uploading to Cesium ion for conversion"""
    if not CESIUM_ION_ACCESS_TOKEN:
        # No Cesium ion token, serve as-is
        filename = f"unknown_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "unknown_raw",
            "message": "Unknown format (Cesium ion not configured)"
        }
    
    try:
        # Upload to Cesium ion for conversion
        asset_id = await upload_to_cesium_ion(file_path, original_filename)
        
        return {
            "filename": original_filename,
            "url": f"ion://{asset_id}",
            "size": file_path.stat().st_size,
            "processing_type": "cesium_ion",
            "cesium_ion_asset_id": asset_id,
            "message": "File uploaded to Cesium ion for processing"
        }
    except Exception as e:
        print(f"Cesium ion upload error: {e}")
        # Fallback to original file
        filename = f"unknown_{int(time.time())}_{original_filename}"
        new_path = UPLOADS_DIR / filename
        shutil.move(str(file_path), str(new_path))
        
        return {
            "filename": filename,
            "url": f"/uploads/{filename}",
            "size": new_path.stat().st_size,
            "processing_type": "unknown_fallback",
            "message": "Unknown format (Cesium ion upload failed)"
        }

# Conversion helper functions
async def convert_to_gltf(input_path: Path) -> Path:
    """Convert various formats to glTF using Blender"""
    try:
        output_path = input_path.with_suffix('.glb')
        
        # Create Blender conversion script
        blender_script = f"""
import bpy
import sys

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import the model
filepath = r"{input_path.absolute()}"
file_ext = "{input_path.suffix.lower()}"

if file_ext == '.obj':
    bpy.ops.import_scene.obj(filepath=filepath)
elif file_ext == '.fbx':
    bpy.ops.import_scene.fbx(filepath=filepath)
elif file_ext == '.dae':
    bpy.ops.wm.collada_import(filepath=filepath)
elif file_ext == '.3ds':
    bpy.ops.import_scene.autodesk_3ds(filepath=filepath)
elif file_ext == '.stl':
    bpy.ops.import_mesh.stl(filepath=filepath)
elif file_ext == '.ply':
    bpy.ops.import_mesh.ply(filepath=filepath)

# Apply all modifiers
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        bpy.context.view_layer.objects.active = obj
        for modifier in obj.modifiers:
            bpy.ops.object.modifier_apply(modifier=modifier.name)

# Export as GLB
bpy.ops.export_scene.gltf(
    filepath=r"{output_path.absolute()}",
    export_format='GLB',
    export_animations=False,
    export_apply=True
)
"""
        
        # Write script to temporary file
        script_path = UPLOADS_DIR / "temp_conversion_script.py"
        with open(script_path, "w") as f:
            f.write(blender_script)
        
        # Run Blender
        result = subprocess.run([
            "blender", "--background", "--python", str(script_path)
        ], capture_output=True, timeout=120)
        
        # Clean up script
        script_path.unlink()
        
        if result.returncode == 0 and output_path.exists():
            return output_path
        else:
            return None
            
    except Exception as e:
        print(f"Blender conversion failed: {e}")
        return None

async def convert_point_cloud_to_3dtiles(input_path: Path, original_filename: str, job_id: str = None) -> dict:
    """
    Convert point cloud (PLY/LAS/LAZ) to 3D Tiles format.
    
    Uses py3dtiles library (https://github.com/Oslandia/py3dtiles).
    Output: folder with tileset.json + .pnts binary tiles.
    
    Returns dict with:
      - success: bool
      - tileset_url: str (URL to tileset.json)
      - tileset_name: str (folder name)
      - size: int (total bytes)
      - tile_count: int
      - error: str (if failed)
    """
    import logging
    logger = logging.getLogger("myearth.assets")
    
    file_ext = input_path.suffix.lower()
    output_dirname = f"pointcloud_{int(time.time())}_{Path(original_filename).stem}"
    output_dir = UPLOADS_DIR / output_dirname
    output_dir.mkdir(exist_ok=True)
    
    try:
        # Try py3dtiles first (preferred, pure Python)
        try:
            import subprocess
            
            if job_id:
                update_job(job_id, stage=JobStage.GENERATING_TILESET, progress=40, message="Running py3dtiles converter...")
            
            result = subprocess.run([
                "py3dtiles", "convert", str(input_path),
                "--out", str(output_dir),
                "--overwrite"
            ], capture_output=True, text=True, timeout=600)
            
            if result.returncode == 0:
                if job_id:
                    update_job(job_id, progress=70, message="Conversion complete, finalizing...")
                
                tileset_path = output_dir / "tileset.json"
                if tileset_path.exists():
                    # Count tiles
                    tile_count = len(list(output_dir.rglob("*.pnts")))
                    total_size = sum(f.stat().st_size for f in output_dir.rglob('*') if f.is_file())
                    
                    logger.info(f"py3dtiles conversion success: {tile_count} tiles, {total_size} bytes")
                    
                    if job_id:
                        update_job(job_id, progress=90, message=f"Generated {tile_count} tiles")
                    
                    # Clean up original
                    try:
                        input_path.unlink()
                    except Exception:
                        pass
                    
                    return {
                        "success": True,
                        "tileset_url": f"/uploads/{output_dirname}/tileset.json",
                        "tileset_name": output_dirname,
                        "size": total_size,
                        "tile_count": tile_count
                    }
                else:
                    logger.warning(f"py3dtiles ran but tileset.json not found: {result.stderr}")
            else:
                logger.warning(f"py3dtiles failed (code {result.returncode}): {result.stderr}")
        except FileNotFoundError:
            logger.warning("py3dtiles not installed")
        except Exception as e:
            logger.warning(f"py3dtiles error: {e}")
        
        # All conversion methods failed
        logger.error(f"No point cloud converter available for {file_ext}")
        
        # Clean up output dir
        try:
            if output_dir.exists():
                shutil.rmtree(output_dir)
        except Exception:
            pass
        
        return {
            "success": False,
            "error": f"py3dtiles not installed or failed. Install with: pip install py3dtiles[las]"
        }
        
    except Exception as e:
        logger.error(f"Point cloud conversion error: {e}", exc_info=True)
        
        # Clean up
        try:
            if output_dir.exists():
                shutil.rmtree(output_dir)
        except Exception:
            pass
        
        return {
            "success": False,
            "error": str(e)
        }

async def convert_splats_to_3dtiles(input_path: Path) -> bool:
    """Convert Gaussian splats to 3D Tiles"""
    try:
        # This would require specialized splat processing
        # For now, return False to use fallback
        return False
        
    except Exception as e:
        print(f"Splats conversion failed: {e}")
        return False

async def convert_geospatial_to_3dtiles(input_path: Path) -> bool:
    """Convert geospatial formats to 3D Tiles"""
    try:
        # This would require specialized geospatial processing
        # For now, return False to use fallback
        return False
        
    except Exception as e:
        print(f"Geospatial conversion failed: {e}")
        return False

async def convert_bim_to_gltf(input_path: Path) -> bool:
    """Convert BIM formats to glTF"""
    try:
        # This would require IFC.js or similar BIM processing
        # For now, return False to use fallback
        return False
        
    except Exception as e:
        print(f"BIM conversion failed: {e}")
        return False

async def upload_to_cesium_ion(file_path: Path, filename: str) -> str:
    """Upload file to Cesium ion for processing"""
    try:
        # This would require Cesium ion API integration
        # For now, return a placeholder
        return "placeholder_asset_id"
        
    except Exception as e:
        print(f"Cesium ion upload failed: {e}")
        raise e

# NOTE: /uploads is now served by StaticFiles (see app.mount above) to support both files and directories.
# If you need custom headers later (cache control, etc.), we can add a dedicated /api/asset/{path} endpoint.

# --------------------
# Server startup
# --------------------
if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Debug: Print environment info
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print(f"Environment variables:")
    for key, value in os.environ.items():
        if key in ['PATH', 'PYTHONPATH', 'PORT', 'DB_HOST', 'DB_NAME', 'DB_USER']:
            print(f"  {key}: {value}")
    
    # Get port from environment variable, command line argument, or default to 5001
    port = int(os.getenv('PORT', 5001))  # Check PORT env var first (for deployment)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--port":
        try:
            port = int(sys.argv[2])  # Command line overrides env var
        except (IndexError, ValueError):
            pass
    
    print(f"Starting MyEarth server on port {port}")
    try:
        uvicorn.run(app, host="0.0.0.0", port=port)
    except Exception as e:
        print(f"Failed to start server: {e}")
        sys.exit(1)
