"""
FastAPI server for MyEarth:
- Serves CesiumJS static files
- Provides API endpoints for DB connection and health checks
- Replaces old Flask + custom HTTP server setup
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import psycopg2
import os
import shutil
from pathlib import Path

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
app = FastAPI()

# Enable CORS (all origins allowed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# Serve Cesium static files
# --------------------
# Mount current folder (where index.html & Cesium files are located)
app.mount("/static", StaticFiles(directory="."), name="static")

# Root route → serves index.html directly
@app.get("/")
def serve_index():
    return FileResponse("index.html")

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

# --------------------
# 3D Model Upload endpoint
# --------------------
# Create uploads directory if it doesn't exist
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

@app.post("/api/upload-model")
async def upload_model(file: UploadFile = File(...)):
    """Upload a 3D model file (GLB/GLTF)"""
    try:
        # Validate file type
        allowed_extensions = {'.glb', '.gltf'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Only .glb and .gltf files are supported. Got: {file_extension}"
            )
        
        # Validate file size (5MB limit)
        max_size = 5 * 1024 * 1024  # 5MB
        if file.size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is 5MB. Got: {file.size / 1024 / 1024:.1f}MB"
            )
        
        # Create a safe filename
        safe_filename = Path(file.filename).name
        file_path = UPLOADS_DIR / safe_filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Return the URL to access the file
        file_url = f"/uploads/{safe_filename}"
        
        return JSONResponse({
            "success": True,
            "filename": safe_filename,
            "url": file_url,
            "size": file.size,
            "message": "Model uploaded successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

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
    uvicorn.run(app, host="0.0.0.0", port=5000)
