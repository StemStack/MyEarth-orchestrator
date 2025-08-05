"""
FastAPI server for MyEarth:
- Serves CesiumJS static files
- Provides API endpoints for DB connection and health checks
- Replaces old Flask + custom HTTP server setup
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import psycopg2

# --------------------
# Database configuration
# --------------------
from dotenv import load_dotenv
import os
import psycopg2

# Load environment variables
load_dotenv()

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT")
}

def get_db_connection():
    """Connect to PostgreSQL using psycopg2"""
    return psycopg2.connect(**DB_CONFIG)

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
        cur = conn.cursor()
        cur.execute("SELECT NOW()")
        result = cur.fetchone()
        cur.close()
        conn.close()
        return {"db_time": result[0]}
    except Exception as e:
        return {"error": str(e)}

# --------------------
# Server startup
# --------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
