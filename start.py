#!/usr/bin/env python3
"""
Production startup script for CesiumJS Globe Viewer
This script starts the FastAPI backend server on port 5000
"""

import uvicorn
import os

if __name__ == "__main__":
    # Get port from environment variable (for deployment flexibility)
    port = int(os.environ.get("PORT", 5000))
    
    # Start the FastAPI application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Disable reload for production
        workers=1
    )