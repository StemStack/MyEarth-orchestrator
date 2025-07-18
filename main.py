from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, SessionLocal
from models import Base, Location
from pydantic import BaseModel
from typing import List
import os

app = FastAPI(title="CesiumJS Globe Viewer with PostGIS", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
try:
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully")
except Exception as e:
    print(f"Database connection error: {e}")

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models for API
class LocationCreate(BaseModel):
    name: str
    longitude: float
    latitude: float

class LocationResponse(BaseModel):
    id: int
    name: str
    longitude: float
    latitude: float

# Root endpoint serves the frontend application
@app.get("/")
def root():
    return FileResponse("index.html")

# Health check endpoint for deployment monitoring
@app.get("/api/health")
def health_check_api():
    return {"message": "CesiumJS Globe Viewer with PostGIS", "status": "healthy", "version": "1.0.0"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.post("/locations", response_model=LocationResponse)
def create_location(location: LocationCreate, db: Session = Depends(get_db)):
    try:
        # Create geometry point using PostGIS
        db_location = Location(
            name=location.name,
            geom=f"POINT({location.longitude} {location.latitude})"
        )
        db.add(db_location)
        db.commit()
        db.refresh(db_location)
        
        # Get coordinates back from the geometry
        result = db.execute(text(f"SELECT ST_X(geom) as lon, ST_Y(geom) as lat FROM locations WHERE id = {db_location.id}")).fetchone()
        
        return LocationResponse(
            id=db_location.id,
            name=db_location.name,
            longitude=result.lon,
            latitude=result.lat
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/locations", response_model=List[LocationResponse])
def get_locations(db: Session = Depends(get_db)):
    try:
        # Get all locations with coordinates
        result = db.execute(text("SELECT id, name, ST_X(geom) as lon, ST_Y(geom) as lat FROM locations")).fetchall()
        
        return [LocationResponse(
            id=row.id,
            name=row.name,
            longitude=row.lon,
            latitude=row.lat
        ) for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/locations/nearby")
def get_nearby_locations(longitude: float, latitude: float, radius_km: float = 100, db: Session = Depends(get_db)):
    try:
        # Find locations within radius using PostGIS
        query = text("""
            SELECT id, name, ST_X(geom) as lon, ST_Y(geom) as lat, 
                   ST_Distance(geom, ST_GeomFromText('POINT(:lon :lat)', 4326)) * 111.32 as distance_km
            FROM locations
            WHERE ST_DWithin(geom, ST_GeomFromText('POINT(:lon :lat)', 4326), :radius_deg)
            ORDER BY distance_km
        """)
        
        result = db.execute(query, {
            "lon": longitude,
            "lat": latitude,
            "radius_deg": radius_km / 111.32  # Convert km to degrees (approximate)
        }).fetchall()
        
        return [{"id": row.id, "name": row.name, "longitude": row.lon, "latitude": row.lat, "distance_km": row.distance_km} for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve the frontend index.html
@app.get("/app")
def serve_frontend():
    return FileResponse("index.html")

# Mount static files to serve CesiumJS assets
app.mount("/static", StaticFiles(directory="."), name="static")
