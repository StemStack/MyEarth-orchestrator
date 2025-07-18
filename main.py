#!/usr/bin/env python3
"""
Main entry point for CesiumJS application server
This file serves as the primary application launcher for deployment
"""

from server import run_server
import os

if __name__ == "__main__":
    # Get port from environment variable (used by Cloud Run and other platforms)
    port = int(os.environ.get('PORT', 5000))
    
    print("🌍 Starting CesiumJS Geospatial Application Server")
    print(f"🚀 Deployment target: Static file serving")
    print(f"🔧 Server configuration: Python HTTP server with CORS support")
    
    run_server(port)