"""
FastAPI server for MyEarth:
- Serves CesiumJS static files
- Provides API endpoints for DB connection and health checks
- Handles user authentication and layer management
- Replaces old Flask + custom HTTP server setup
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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
from typing import Optional

# --------------------
# Import our modules
# --------------------
from auth import get_current_active_user, get_db, create_access_token, verify_google_token, verify_github_token, verify_linkedin_token, get_or_create_user
from layer_api import router as layer_router
from models import User, Layer, LayerRating, LayerCategory, License

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
        "created_at": current_user.created_at
    }

@app.get("/api/auth/logout")
async def logout():
    """Logout endpoint (client should discard token)"""
    return {"message": "Logged out successfully"}

# --------------------
# Serve static files
# --------------------
# Mount static folder for assets (favicon, logos, etc.)
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = (BASE_DIR / "static").resolve()
INDEX_FILE = (BASE_DIR / "index.html").resolve()
VERSION_FILE = (BASE_DIR / "version.json").resolve()

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Root route → serves index.html directly
@app.get("/")
def serve_index():
    return FileResponse(str(INDEX_FILE))

# Serve gizmo JavaScript files
@app.get("/CesiumModelImporter.js")
async def serve_model_importer():
    """Serve the CesiumModelImporter.js file"""
    return FileResponse("CesiumModelImporter.js")

@app.get("/CesiumGizmo.js")
async def serve_gizmo():
    """Serve the CesiumGizmo.js file"""
    return FileResponse("CesiumGizmo.js")

@app.get("/printService.js")
async def serve_print_service():
    """Serve the printService.js file"""
    return FileResponse("printService.js")

@app.get("/printStyles.css")
async def serve_print_styles():
    """Serve the printStyles.css file"""
    return FileResponse("printStyles.css")

@app.get("/PrintOverlay.js")
async def serve_print_overlay():
    """Serve the PrintOverlay.js file"""
    return FileResponse("PrintOverlay.js")

@app.get("/printOverlayStyles.css")
async def serve_print_overlay_styles():
    """Serve the printOverlayStyles.css file"""
    return FileResponse("printOverlayStyles.css")

@app.get("/version.json")
async def serve_version():
    """Serve the version.json file with current build information"""
    try:
        with open(str(VERSION_FILE), "r") as f:
            version_data = json.load(f)
        return JSONResponse(content=version_data)
    except FileNotFoundError:
        # Fallback if version.json doesn't exist
        return JSONResponse(content={
            "version": "0.3",
            "buildDate": "unknown",
            "buildTimestamp": 0,
            "commitHash": "unknown",
            "environment": "development"
        })

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

@app.post("/api/upload-model")
async def upload_model(file: UploadFile = File(...)):
    """Universal 3D model upload with Cesium ion integration and multi-format support"""
    
    # Get file extension
    file_ext = Path(file.filename).suffix.lower()
    
    # Check if format is supported
    if file_ext not in UNIVERSAL_3D_FORMATS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported format: {file_ext}. Supported formats: {', '.join(list(UNIVERSAL_3D_FORMATS.keys())[:10])}... and more"
        )
    
    # Check file size (increased to 500MB for large models)
    if file.size > 500 * 1024 * 1024:  # 500MB
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 500MB")
    
    try:
        # Save original file
        original_filename = f"original_{int(time.time())}_{file.filename}"
        original_path = UPLOADS_DIR / original_filename
        
        with open(original_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Determine processing strategy based on file type
        processing_result = await process_3d_model(original_path, file_ext, file.filename)
        
        return JSONResponse({
            "success": True,
            "filename": processing_result["filename"],
            "url": processing_result["url"],
            "size": processing_result["size"],
            "original_format": file_ext,
            "processing_type": processing_result["processing_type"],
            "cesium_ion_asset_id": processing_result.get("cesium_ion_asset_id"),
            "message": processing_result["message"]
        })
        
    except Exception as e:
        # Clean up on error
        if original_path and original_path.exists():
            original_path.unlink()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

async def process_3d_model(file_path: Path, file_ext: str, original_filename: str) -> dict:
    """Process 3D model based on format type"""
    
    # Strategy 1: Cesium 3D Tiles (direct support)
    if file_ext in ['.json', '.cmpt', '.b3dm', '.i3dm', '.pnts']:
        return await handle_3d_tiles(file_path, original_filename)
    
    # Strategy 2: glTF formats (direct CesiumJS support)
    elif file_ext in ['.gltf', '.glb']:
        return await handle_gltf(file_path, original_filename)
    
    # Strategy 3: Point clouds (LAS/LAZ)
    elif file_ext in ['.las', '.laz']:
        return await handle_point_cloud(file_path, original_filename)
    
    # Strategy 4: Gaussian Splatting
    elif file_ext in ['.splat', '.ply']:
        return await handle_gaussian_splats(file_path, original_filename)
    
    # Strategy 5: Traditional 3D formats (convert to glTF)
    elif file_ext in ['.obj', '.fbx', '.dae', '.3ds', '.stl', '.ply']:
        return await handle_traditional_3d(file_path, original_filename)
    
    # Strategy 6: Geospatial formats
    elif file_ext in ['.kml', '.kmz', '.citygml', '.gml']:
        return await handle_geospatial(file_path, original_filename)
    
    # Strategy 7: Archive formats
    elif file_ext in ['.zip', '.7z', '.rar']:
        return await handle_archive(file_path, original_filename)
    
    # Strategy 8: Image formats (photogrammetry)
    elif file_ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif']:
        return await handle_photogrammetry(file_path, original_filename)
    
    # Strategy 9: BIM formats
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
    filename = f"gltf_{int(time.time())}_{original_filename}"
    new_path = UPLOADS_DIR / filename
    shutil.move(str(file_path), str(new_path))
    
    return {
        "filename": filename,
        "url": f"/uploads/{filename}",
        "size": new_path.stat().st_size,
        "processing_type": "gltf",
        "message": "glTF file ready for CesiumJS"
    }

async def handle_point_cloud(file_path: Path, original_filename: str) -> dict:
    """Handle point cloud formats (LAS/LAZ)"""
    try:
        # Try to convert to 3D Tiles using PotreeConverter
        if await convert_point_cloud_to_3dtiles(file_path):
            filename = f"pointcloud_{int(time.time())}_{Path(original_filename).stem}.json"
            tileset_path = UPLOADS_DIR / filename
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": tileset_path.stat().st_size,
                "processing_type": "point_cloud_3dtiles",
                "message": "Point cloud converted to 3D Tiles"
            }
        else:
            # Fallback: serve original file
            filename = f"pointcloud_{int(time.time())}_{original_filename}"
            new_path = UPLOADS_DIR / filename
            shutil.move(str(file_path), str(new_path))
            
            return {
                "filename": filename,
                "url": f"/uploads/{filename}",
                "size": new_path.stat().st_size,
                "processing_type": "point_cloud_raw",
                "message": "Point cloud file (may need client-side processing)"
            }
    except Exception as e:
        print(f"Point cloud processing error: {e}")
        # Fallback to original file
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

async def convert_point_cloud_to_3dtiles(input_path: Path) -> bool:
    """Convert point cloud to 3D Tiles using PotreeConverter"""
    try:
        output_dir = UPLOADS_DIR / f"pointcloud_tiles_{int(time.time())}"
        output_dir.mkdir(exist_ok=True)
        
        # Try using PotreeConverter
        result = subprocess.run([
            "PotreeConverter", str(input_path), "-o", str(output_dir)
        ], capture_output=True, timeout=300)
        
        if result.returncode == 0:
            # Find the tileset.json file
            tileset_file = output_dir / "tileset.json"
            if tileset_file.exists():
                # Move to uploads directory
                final_tileset = UPLOADS_DIR / f"pointcloud_{int(time.time())}.json"
                shutil.move(str(tileset_file), str(final_tileset))
                
                # Clean up temporary directory
                shutil.rmtree(output_dir)
                return True
        
        return False
        
    except Exception as e:
        print(f"Point cloud conversion failed: {e}")
        return False

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

@app.get("/uploads/{filename}")
async def serve_uploaded_file(filename: str):
    """Serve uploaded files"""
    file_path = UPLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

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
